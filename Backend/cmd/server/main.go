// Command server runs the productivity HTTP API.
//
// With DESKTOP_MODE=true it runs as the local backend of the Tauri desktop app:
// loopback-only, token-guarded, serving the bundled frontend, and able to start
// without a database so the first-run setup screen can configure one.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"productivity/internal/api"
	"productivity/internal/cache"
	"productivity/internal/config"
	"productivity/internal/database"
	"productivity/internal/desktop"
	"productivity/internal/mail"
)

// version is set at build time: -ldflags "-X main.version=1.2.3".
var version = "dev"

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if err := run(log); err != nil {
		log.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	// A missing .env is fine: production injects real environment variables.
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if cfg.Desktop {
		return runDesktop(ctx, cfg, log)
	}

	app, err := buildAPI(ctx, cfg, log)
	if err != nil {
		return err
	}
	defer app.close()
	return serve(ctx, cfg, app.server.Routes(), log, app.server)
}

func runDesktop(parent context.Context, cfg *config.Config, log *slog.Logger) error {
	ctx, cancel := context.WithCancel(parent)
	defer cancel()

	if cfg.DesktopSecretsStdin {
		secrets, rest, err := desktop.ReadSecrets(os.Stdin, 15*time.Second)
		if err != nil {
			return err
		}
		cfg.DesktopToken = secrets.Token
		cfg.DatabaseURL = secrets.DatabaseURL
		cfg.JWTSecret = secrets.JWTSecret
		cfg.JWTRefreshSecret = secrets.JWTRefreshSecret
		go desktop.WatchParent(rest, cancel, log)
	}
	if err := cfg.ValidateDesktop(); err != nil {
		return err
	}

	opts := desktop.Options{
		Token:       cfg.DesktopToken,
		FrontendDir: cfg.FrontendDir,
		Version:     version,
		Log:         log,
		Shutdown:    cancel,
	}

	var app *apiApp
	if cfg.NeedsSetup() {
		opts.Mode = desktop.ModeSetup
		log.Info("no database configured, starting in setup mode")
	} else {
		built, err := buildAPI(ctx, cfg, log)
		if err != nil {
			// Stay up so the UI can explain the problem and offer reconnect or
			// a different database instead of the app failing to open.
			result := desktop.Classify(err)
			log.Error("database unavailable at startup", "error", err, "code", result.Code)
			opts.Mode = desktop.ModeError
			opts.StartupError = &result
		} else {
			app = built
			defer app.close()
			opts.Mode = desktop.ModeReady
			opts.API = app.server.Routes()
		}
	}

	var srv *api.Server
	if app != nil {
		srv = app.server
	}
	return serve(ctx, cfg, desktop.Handler(opts), log, srv)
}

type apiApp struct {
	server *api.Server
	close  func()
}

// buildAPI migrates, connects and wires the API server.
func buildAPI(ctx context.Context, cfg *config.Config, log *slog.Logger) (*apiApp, error) {
	if cfg.AutoMigrate {
		if err := database.Migrate(ctx, cfg.DatabaseURL, log); err != nil {
			return nil, err
		}
	}

	db, err := database.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		return nil, err
	}

	store, err := cache.New(cfg.RedisURL, log)
	if err != nil {
		db.Close()
		return nil, err
	}

	mailer := mail.New(mail.Config{
		Host: cfg.EmailHost, Port: cfg.EmailPort, User: cfg.EmailUser, Pass: cfg.EmailPass,
		From: cfg.EmailFrom, AppName: cfg.AppName, ClientURL: cfg.ClientURL,
		LogLinks: cfg.IsDevelopment(),
	}, log)

	srv := api.New(api.Deps{Config: cfg, DB: db, Cache: store, Mailer: mailer, Logger: log})

	go cleanupExpiredTokens(ctx, db, log)

	return &apiApp{server: srv, close: func() {
		store.Close()
		db.Close()
	}}, nil
}

// serve runs the HTTP server until ctx is cancelled, then drains it. srv may
// be nil (desktop setup mode).
func serve(ctx context.Context, cfg *config.Config, handler http.Handler, log *slog.Logger, srv *api.Server) error {
	httpServer := &http.Server{
		Addr:              net.JoinHostPort(cfg.Host, cfg.Port),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		BaseContext:       func(net.Listener) context.Context { return context.WithoutCancel(ctx) },
	}
	if srv != nil {
		httpServer.RegisterOnShutdown(srv.CloseStreams)
	}

	listener, err := net.Listen("tcp", httpServer.Addr)
	if err != nil {
		return err
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("server listening", "addr", listener.Addr().String(), "environment", cfg.Env, "desktop", cfg.Desktop)
		errCh <- httpServer.Serve(listener)
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		log.Info("shutdown signal received, draining connections")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownPeriod)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Error("http shutdown", "error", err)
	}
	if srv != nil {
		srv.Drain(shutdownCtx)
	}
	return nil
}

// cleanupExpiredTokens deletes expired refresh tokens on startup and hourly.
func cleanupExpiredTokens(ctx context.Context, db *pgxpool.Pool, log *slog.Logger) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		tag, err := db.Exec(ctx, `DELETE FROM refresh_tokens WHERE "expiresAt" <= $1`, time.Now().UTC())
		switch {
		case err != nil && ctx.Err() == nil:
			log.Error("refresh token cleanup failed", "error", err)
		case err == nil && tag.RowsAffected() > 0:
			log.Info("expired refresh tokens removed", "count", tag.RowsAffected())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
