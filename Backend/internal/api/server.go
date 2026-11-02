// Package api implements every HTTP endpoint of the productivity backend.
package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"productivity/internal/auth"
	"productivity/internal/cache"
	"productivity/internal/compat"
	"productivity/internal/config"
	"productivity/internal/httpx"
	"productivity/internal/mail"
	"productivity/internal/reqctx"
)

const maxBodyBytes = 10 << 20 // 10 MB, as express.json({ limit: '10mb' })

type Server struct {
	cfg    *config.Config
	db     *pgxpool.Pool
	cache  *cache.Cache
	tokens *auth.TokenManager
	mailer mail.Sender
	log    *slog.Logger

	google       *oauth2.Config
	googleClient GoogleClient

	// background tracks fire-and-forget work (emails) so shutdown can wait.
	background chan struct{}

	timers *timerHub
}

type Deps struct {
	Config       *config.Config
	DB           *pgxpool.Pool
	Cache        *cache.Cache
	Mailer       mail.Sender
	Logger       *slog.Logger
	GoogleClient GoogleClient // optional; defaults to the real Google APIs
}

func New(d Deps) *Server {
	s := &Server{
		cfg:          d.Config,
		db:           d.DB,
		cache:        d.Cache,
		mailer:       d.Mailer,
		log:          d.Logger,
		tokens:       auth.NewTokenManager(d.Config.JWTSecret, d.Config.JWTRefreshSecret, d.Config.AccessTokenTTL, d.Config.RefreshTokenTTL),
		googleClient: d.GoogleClient,
		background:   make(chan struct{}, 64),
		timers:       newTimerHub(),
	}
	if d.Config.GoogleEnabled() {
		s.google = &oauth2.Config{
			ClientID:     d.Config.GoogleClientID,
			ClientSecret: d.Config.GoogleSecret,
			RedirectURL:  d.Config.GoogleCallbackURL,
			Scopes:       []string{"profile", "email"},
			Endpoint:     google.Endpoint,
		}
	}
	if s.googleClient == nil {
		s.googleClient = newGoogleHTTPClient(d.Config.GoogleClientID)
	}
	return s
}

// Routes builds the full HTTP handler.
func (s *Server) Routes() http.Handler {
	securityHeaders := httpx.SecurityHeaders
	if s.cfg.Desktop {
		securityHeaders = httpx.DesktopSecurityHeaders
	}

	r := chi.NewRouter()
	r.Use(
		httpx.Recoverer(s.log),
		httpx.Logger(s.log),
		securityHeaders,
		httpx.CORS(s.allowedOrigins()),
		middleware.StripSlashes,
		httpx.BodyParser(maxBodyBytes),
	)
	r.NotFound(httpx.NotFound)
	r.MethodNotAllowed(httpx.MethodNotAllowed)

	tp := s.cfg.TrustProxy
	authLimit := httpx.RateLimit(5, 15*time.Minute, "Too many authentication attempts, please try again later", tp)
	generalLimit := httpx.RateLimit(100, 15*time.Minute, "Too many requests, please try again later", tp)
	// Kanban interactions are chatty, so tasks/workspaces/analytics share a
	// larger budget instead of the general 100/15min limiter.
	taskLimit := httpx.RateLimit(2000, 15*time.Minute, "Too many requests, please try again later", tp)

	r.Get("/", s.welcome)
	r.Get("/health", s.health)
	r.Get("/health/ready", s.ready)

	r.Route("/api/auth", func(r chi.Router) {
		r.With(authLimit).Post("/register", s.register)
		r.With(authLimit).Post("/login", s.login)
		r.Post("/logout", s.logout)
		r.With(s.authenticate).Post("/logout-all", s.logoutAll)
		r.Post("/refresh-token", s.refreshToken)

		r.Post("/verify-email", s.verifyEmail)
		r.With(s.authenticate).Post("/resend-verification", s.resendVerification)

		r.With(authLimit).Post("/forgot-password", s.forgotPassword)
		r.With(authLimit).Post("/reset-password", s.resetPassword)
		r.With(s.authenticate).Post("/change-password", s.changePassword)

		r.With(s.authenticate).Get("/profile", s.getProfile)
		r.With(s.authenticate).Put("/profile", s.updateProfile)

		r.Get("/google", s.googleAuth)
		r.Get("/google/callback", s.googleCallback)
		r.With(authLimit).Post("/google/register-login", s.googleRegisterLogin)
		r.With(s.authenticate).Post("/google/link", s.linkGoogle)
		r.With(s.authenticate).Delete("/google/unlink", s.unlinkGoogle)
		r.With(s.authenticate).Get("/google/status", s.googleStatus)
	})

	usersNS := cache.Namespace{Name: "users", Global: true}
	r.Route("/api/users", func(r chi.Router) {
		r.Use(generalLimit, s.authenticate, s.cache.InvalidateOn(usersNS))
		cached := s.cache.Response(usersNS, 60*time.Second)
		admin := s.authorize("ADMIN")

		// Session lists are not cached: they must reflect logins on other devices.
		r.Get("/me/sessions", s.getActiveSessions)
		r.Delete("/me/sessions/{sessionId}", s.revokeSession)

		r.With(admin, cached).Get("/", s.listUsers)
		r.With(admin, cached).Get("/stats", s.userStats)
		r.With(cached).Get("/{id}", s.getUser)
		r.Put("/{id}", s.updateUser)
		r.Delete("/{id}", s.deleteUser)
		r.With(admin).Patch("/{id}/deactivate", s.deactivateUser)
		r.With(admin).Patch("/{id}/activate", s.activateUser)
		r.With(admin).Patch("/{id}/role", s.updateUserRole)
	})

	r.Route("/api/notes", func(r chi.Router) {
		r.Use(generalLimit, s.authenticate, s.cache.InvalidateOn(cache.NS("notes")))
		cached := s.cache.Response(cache.NS("notes"), 300*time.Second)

		r.With(cached).Get("/", s.getNotes)
		r.Post("/", s.createNote)

		r.Patch("/content/{contentId}", s.updateContent)
		r.Delete("/content/{contentId}", s.deleteContent)

		r.Post("/subtopics/{subtopicId}/content", s.addContent)
		r.Patch("/subtopics/{subtopicId}", s.updateSubtopic)
		r.Delete("/subtopics/{subtopicId}", s.deleteSubtopic)

		r.Post("/topics/{topicId}/subtopics", s.addSubtopic)
		r.Patch("/topics/{topicId}", s.updateTopic)
		r.Delete("/topics/{topicId}", s.deleteTopic)

		r.With(cached).Get("/{noteId}", s.getNote)
		r.Patch("/{noteId}", s.updateNote)
		r.Delete("/{noteId}", s.deleteNote)
		r.Put("/{noteId}/doc", s.replaceDoc)
		r.Post("/{noteId}/topics", s.addTopic)
	})

	r.Route("/api/tasks", func(r chi.Router) {
		// Task writes change task lists, workspace contents and every analytics view.
		r.Use(taskLimit, s.authenticate, s.cache.InvalidateOn(cache.NS("tasks"), cache.NS("workspaces"), cache.NS("analytics")), s.notifyTimer)
		cached := s.cache.Response(cache.NS("tasks"), 120*time.Second)

		r.With(cached).Get("/", s.getTasks)
		r.Post("/", s.createTask)
		r.Patch("/reorder", s.reorderTasks)
		r.With(s.cache.Response(cache.NS("tasks"), 60*time.Second)).Get("/today", s.getTodayTasks)

		r.Post("/{taskId}/start", s.startTask)
		r.Post("/{taskId}/hold", s.holdTask)
		r.Post("/{taskId}/complete", s.completeTask)
		r.Post("/{taskId}/sync", s.syncTime)
		r.Patch("/{taskId}/move", s.moveTask)

		r.With(cached).Get("/{taskId}", s.getTask)
		r.Patch("/{taskId}", s.updateTask)
		r.Delete("/{taskId}", s.deleteTask)
	})

	r.Route("/api/workspaces", func(r chi.Router) {
		// Deleting/renaming a workspace also affects its tasks and analytics.
		r.Use(taskLimit, s.authenticate, s.cache.InvalidateOn(cache.NS("workspaces"), cache.NS("tasks"), cache.NS("analytics")), s.notifyTimer)
		cached := s.cache.Response(cache.NS("workspaces"), 300*time.Second)

		r.With(cached).Get("/", s.getWorkspaces)
		r.Post("/", s.createWorkspace)
		r.With(cached).Get("/{workspaceId}", s.getWorkspace)
		r.Patch("/{workspaceId}", s.updateWorkspace)
		r.Delete("/{workspaceId}", s.deleteWorkspace)
	})

	r.Route("/api/timer", func(r chi.Router) {
		r.Use(taskLimit, s.authenticate)
		r.Get("/", s.getTimer)
		// The SSE stream is kept outside the cache middleware so nothing
		// buffers or wraps its writer.
		r.Get("/events", s.timerEvents)
		r.Group(func(r chi.Router) {
			r.Use(s.cache.InvalidateOn(cache.NS("tasks"), cache.NS("workspaces"), cache.NS("analytics")), s.notifyTimer)
			r.Post("/start", s.timerStart)
			r.Post("/pause", s.timerPause)
			r.Post("/toggle", s.timerToggle)
			r.Post("/reset", s.timerReset)
		})
	})

	r.Route("/api/analytics", func(r chi.Router) {
		r.Use(taskLimit, s.authenticate)
		// Analytics include "now"-relative values, so keep the TTL short; task
		// and workspace writes also invalidate this namespace immediately.
		cached := s.cache.Response(cache.NS("analytics"), 30*time.Second)
		r.With(cached).Get("/overview", s.analyticsOverview)
		r.With(cached).Get("/sessions", s.analyticsSessions)
		r.With(s.cache.Response(cache.NS("analytics"), 120*time.Second)).Get("/profile", s.analyticsProfile)
	})

	return r
}

func (s *Server) allowedOrigins() []string {
	origins := []string{s.cfg.ClientURL, "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"}
	return append(origins, s.cfg.ExtraOrigins...)
}

func (s *Server) welcome(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusOK, httpx.M{
		"success":       true,
		"message":       "Welcome to the Authentication API",
		"version":       "1.0.0",
		"documentation": "/api/docs",
	})
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	body := httpx.M{"success": true, "message": "Server is running", "timestamp": compat.FormatISO(time.Now())}
	if s.cfg.Env != "" {
		body["environment"] = s.cfg.Env
	}
	httpx.JSON(w, http.StatusOK, body)
}

// ready is a readiness probe: it fails when the database is unreachable.
// Redis is reported but never fails readiness because caching is optional.
func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	dbOK := s.db.Ping(ctx) == nil
	status := http.StatusOK
	if !dbOK {
		status = http.StatusServiceUnavailable
	}
	httpx.JSON(w, status, httpx.M{"success": dbOK, "database": dbOK, "cache": s.cache.Ready()})
}

/* ------------------------------ auth middleware ----------------------------- */

func extractToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return h[len("Bearer "):]
	}
	if c, err := r.Cookie("accessToken"); err == nil {
		return c.Value
	}
	return ""
}

func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractToken(r)
		if token == "" {
			httpx.Fail(w, http.StatusUnauthorized, "Access token required")
			return
		}
		claims, err := s.tokens.VerifyAccess(token)
		if errors.Is(err, auth.ErrTokenExpired) {
			httpx.Fail(w, http.StatusUnauthorized, "Token expired")
			return
		}
		if err != nil {
			httpx.Fail(w, http.StatusUnauthorized, "Invalid token")
			return
		}
		user, err := s.loadAuthUser(r.Context(), claims.ID)
		if err != nil {
			s.log.Error("authentication error", "error", err)
			httpx.Fail(w, http.StatusInternalServerError, "Authentication failed")
			return
		}
		if user == nil {
			httpx.Fail(w, http.StatusUnauthorized, "User not found")
			return
		}
		if !user.IsActive {
			httpx.Fail(w, http.StatusUnauthorized, "Account is deactivated")
			return
		}
		next.ServeHTTP(w, r.WithContext(reqctx.WithUser(r.Context(), user)))
	})
}

func (s *Server) authorize(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := reqctx.User(r.Context())
			if u == nil {
				httpx.Fail(w, http.StatusUnauthorized, "Authentication required")
				return
			}
			for _, role := range roles {
				if u.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			httpx.Fail(w, http.StatusForbidden, "Insufficient permissions")
		})
	}
}

/* --------------------------------- helpers -------------------------------- */

// serverError logs the cause and returns a generic 500 envelope.
func (s *Server) serverError(w http.ResponseWriter, label string, err error, message string) {
	s.log.Error(label+" error", "error", err)
	httpx.Fail(w, http.StatusInternalServerError, message)
}

// goBackground runs fn detached from the request (bounded concurrency) so
// slow SMTP servers never delay API responses.
func (s *Server) goBackground(label string, fn func(ctx context.Context) error) {
	go func() {
		s.background <- struct{}{}
		defer func() { <-s.background }()
		defer func() {
			if rec := recover(); rec != nil {
				s.log.Error(label+" panicked", "panic", rec)
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()
		if err := fn(ctx); err != nil {
			s.log.Error(label+" failed", "error", err)
		}
	}()
}

// Drain waits for in-flight background work during shutdown.
func (s *Server) Drain(ctx context.Context) {
	for i := 0; i < cap(s.background); i++ {
		select {
		case s.background <- struct{}{}:
		case <-ctx.Done():
			return
		}
	}
}

func urlParam(r *http.Request, name string) string { return chi.URLParam(r, name) }
