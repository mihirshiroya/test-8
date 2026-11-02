// Package config loads and validates runtime configuration from the
// environment. Variable names are identical to the previous Node.js backend so
// existing .env files keep working unchanged.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"productivity/internal/compat"
)

type Config struct {
	Env  string // NODE_ENV (kept for drop-in compatibility)
	Port string

	DatabaseURL    string
	DBMaxConns     int32
	AutoMigrate    bool
	RedisURL       string
	TrustProxy     bool
	ExtraOrigins   []string
	ShutdownPeriod time.Duration

	JWTSecret         string
	JWTRefreshSecret  string
	AccessTokenTTL    time.Duration
	RefreshTokenTTL   time.Duration
	BcryptRounds      int
	GoogleClientID    string
	GoogleSecret      string
	GoogleCallbackURL string

	EmailHost string
	EmailPort int
	EmailUser string
	EmailPass string
	EmailFrom string
	AppName   string

	ClientURL string
	ServerURL string

	// Desktop mode: the backend runs as a Tauri sidecar bound to loopback,
	// serves the bundled frontend and may start without a database (setup mode).
	Desktop             bool
	Host                string
	FrontendDir         string
	DesktopToken        string
	DesktopSecretsStdin bool
}

// NeedsSetup reports a desktop launch with no database configured yet.
func (c *Config) NeedsSetup() bool { return c.Desktop && c.DatabaseURL == "" }

func (c *Config) IsProduction() bool  { return c.Env == "production" }
func (c *Config) IsDevelopment() bool { return c.Env == "development" }
func (c *Config) GoogleEnabled() bool {
	return c.GoogleClientID != "" && c.GoogleSecret != "" && c.GoogleCallbackURL != ""
}

// Load reads configuration from the environment and fails fast on missing
// secrets instead of failing on the first request.
func Load() (*Config, error) {
	c := &Config{
		Env:               os.Getenv("NODE_ENV"),
		Port:              env("PORT", "5000"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		DBMaxConns:        int32(envInt("DB_MAX_CONNS", 20)),
		AutoMigrate:       envBool("AUTO_MIGRATE", true),
		RedisURL:          os.Getenv("REDIS_URL"),
		TrustProxy:        envBool("TRUST_PROXY", false),
		ExtraOrigins:      splitList(os.Getenv("CORS_ORIGINS")),
		ShutdownPeriod:    time.Duration(envInt("SHUTDOWN_TIMEOUT_SECONDS", 15)) * time.Second,
		JWTSecret:         os.Getenv("JWT_SECRET"),
		JWTRefreshSecret:  os.Getenv("JWT_REFRESH_SECRET"),
		BcryptRounds:      envInt("BCRYPT_ROUNDS", 12),
		GoogleClientID:    os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleSecret:      os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleCallbackURL: os.Getenv("GOOGLE_CALLBACK_URL"),
		EmailHost:         os.Getenv("EMAIL_HOST"),
		EmailPort:         envInt("EMAIL_PORT", 587),
		EmailUser:         os.Getenv("EMAIL_USER"),
		EmailPass:         os.Getenv("EMAIL_PASS"),
		EmailFrom:         os.Getenv("EMAIL_FROM"),
		AppName:           env("APP_NAME", "Auth App"),
		ClientURL:         os.Getenv("CLIENT_URL"),
		ServerURL:         os.Getenv("SERVER_URL"),

		Desktop:             envBool("DESKTOP_MODE", false),
		Host:                os.Getenv("HOST"),
		FrontendDir:         os.Getenv("FRONTEND_DIR"),
		DesktopToken:        os.Getenv("DESKTOP_TOKEN"),
		DesktopSecretsStdin: envBool("DESKTOP_SECRETS_STDIN", true),
	}

	if c.Desktop {
		// Never expose the desktop backend to the network.
		c.Host = "127.0.0.1"
	}

	// In desktop mode the database URL and JWT secrets arrive over stdin from
	// the Tauri shell (see ValidateDesktop), so they are not required here.
	var errs []error
	if c.DatabaseURL == "" && !c.Desktop {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if c.JWTSecret == "" && !c.Desktop {
		errs = append(errs, errors.New("JWT_SECRET is required"))
	}
	if c.JWTRefreshSecret == "" && !c.Desktop {
		errs = append(errs, errors.New("JWT_REFRESH_SECRET is required"))
	}

	var err error
	if c.AccessTokenTTL, err = compat.ParseDuration(env("JWT_EXPIRE", "15m")); err != nil {
		errs = append(errs, fmt.Errorf("JWT_EXPIRE: %w", err))
	}
	if c.RefreshTokenTTL, err = compat.ParseDuration(env("JWT_REFRESH_EXPIRE", "7d")); err != nil {
		errs = append(errs, fmt.Errorf("JWT_REFRESH_EXPIRE: %w", err))
	}
	if c.BcryptRounds < 4 || c.BcryptRounds > 31 {
		c.BcryptRounds = 12
	}
	if c.DBMaxConns < 1 {
		c.DBMaxConns = 20
	}

	return c, errors.Join(errs...)
}

// ValidateDesktop checks the secrets a desktop launch must have once the
// Tauri shell has supplied them.
func (c *Config) ValidateDesktop() error {
	var errs []error
	if len(c.DesktopToken) < 32 {
		errs = append(errs, errors.New("desktop token is missing or too short"))
	}
	if c.JWTSecret == "" || c.JWTRefreshSecret == "" {
		errs = append(errs, errors.New("desktop JWT secrets are missing"))
	}
	return errors.Join(errs...)
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key))); err == nil {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	if v, err := strconv.ParseBool(strings.TrimSpace(os.Getenv(key))); err == nil {
		return v
	}
	return fallback
}

func splitList(raw string) []string {
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
