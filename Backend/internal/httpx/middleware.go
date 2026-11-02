package httpx

import (
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/httprate"
)

// SecurityHeaders sets the same headers helmet() did in the Node backend
// (with crossOriginEmbedderPolicy disabled, crossOriginResourcePolicy
// "cross-origin" and the popup-friendly opener policy Google sign-in needs).
func SecurityHeaders(next http.Handler) http.Handler {
	headers := [][2]string{
		{"Content-Security-Policy", "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests"},
		{"Cross-Origin-Opener-Policy", "same-origin-allow-popups"},
		{"Cross-Origin-Resource-Policy", "cross-origin"},
		{"Origin-Agent-Cluster", "?1"},
		{"Referrer-Policy", "no-referrer"},
		{"Strict-Transport-Security", "max-age=31536000; includeSubDomains"},
		{"X-Content-Type-Options", "nosniff"},
		{"X-DNS-Prefetch-Control", "off"},
		{"X-Download-Options", "noopen"},
		{"X-Frame-Options", "SAMEORIGIN"},
		{"X-Permitted-Cross-Domain-Policies", "none"},
		{"X-XSS-Protection", "0"},
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		for _, kv := range headers {
			h.Set(kv[0], kv[1])
		}
		next.ServeHTTP(w, r)
	})
}

// DesktopSecurityHeaders is SecurityHeaders for the loopback desktop server.
// It drops HSTS and upgrade-insecure-requests (the app is served over
// http://127.0.0.1, which would otherwise be upgraded to a dead https URL) and
// allows the Tauri IPC origins so window/tray commands keep working.
func DesktopSecurityHeaders(next http.Handler) http.Handler {
	headers := [][2]string{
		{"Content-Security-Policy", "default-src 'self';base-uri 'self';connect-src 'self' ipc: http://ipc.localhost;font-src 'self' https: data:;form-action 'self';frame-ancestors 'none';img-src 'self' data: blob: https:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline'"},
		{"Cross-Origin-Opener-Policy", "same-origin-allow-popups"},
		{"Referrer-Policy", "no-referrer"},
		{"X-Content-Type-Options", "nosniff"},
		{"X-Frame-Options", "DENY"},
		{"X-Permitted-Cross-Domain-Policies", "none"},
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		for _, kv := range headers {
			h.Set(kv[0], kv[1])
		}
		next.ServeHTTP(w, r)
	})
}

const (
	corsMethods = "GET,POST,PUT,DELETE,PATCH,OPTIONS"
	corsHeaders = "Content-Type,Authorization,X-Requested-With"
)

// CORS allows credentialed requests from the configured origins. Requests from
// any other origin are rejected with 403, as the Express cors() setup did.
// Requests without an Origin header (curl, server-to-server) are allowed.
func CORS(allowed []string) func(http.Handler) http.Handler {
	allowed = slices.DeleteFunc(slices.Clone(allowed), func(s string) bool { return s == "" })
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			h := w.Header()
			h.Add("Vary", "Origin")
			if origin != "" {
				if !slices.Contains(allowed, origin) {
					Fail(w, http.StatusForbidden, "CORS policy violation")
					return
				}
				h.Set("Access-Control-Allow-Origin", origin)
			}
			h.Set("Access-Control-Allow-Credentials", "true")

			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", corsMethods)
				h.Set("Access-Control-Allow-Headers", corsHeaders)
				h.Set("Content-Length", "0")
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (s *statusWriter) WriteHeader(code int) {
	if s.status == 0 {
		s.status = code
	}
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusWriter) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	n, err := s.ResponseWriter.Write(b)
	s.bytes += n
	return n, err
}

func (s *statusWriter) Unwrap() http.ResponseWriter { return s.ResponseWriter }

// Logger emits one structured line per request.
func Logger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w}
			next.ServeHTTP(sw, r)
			if sw.status == 0 {
				sw.status = http.StatusOK
			}
			level := slog.LevelInfo
			if sw.status >= 500 {
				level = slog.LevelError
			}
			log.Log(r.Context(), level, "request",
				"method", r.Method,
				"path", r.URL.RequestURI(),
				"status", sw.status,
				"duration_ms", time.Since(start).Milliseconds(),
				"bytes", sw.bytes,
				"ip", ClientIP(r, false),
			)
		})
	}
}

// Recoverer turns a handler panic into a 500 instead of killing the
// connection, and logs the stack trace.
func Recoverer(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					if rec == http.ErrAbortHandler {
						panic(rec)
					}
					log.Error("panic recovered", "panic", rec, "path", r.URL.Path, "stack", string(debug.Stack()))
					Fail(w, http.StatusInternalServerError, "Internal server error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func NotFound(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusNotFound, M{"success": false, "message": "Route not found", "path": r.URL.RequestURI()})
}

func MethodNotAllowed(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusMethodNotAllowed, M{"success": false, "message": "Method not allowed", "path": r.URL.RequestURI()})
}

// ClientIP returns the caller's IP. With trustProxy it uses the left-most
// X-Forwarded-For entry (Express `trust proxy` semantics); otherwise the TCP
// peer address, which cannot be spoofed.
func ClientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			if ip := strings.TrimSpace(strings.Split(xff, ",")[0]); net.ParseIP(ip) != nil {
				return ip
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// RateLimit returns a per-IP sliding-window limiter. Reuse the returned
// middleware across routes to share one budget (as Express limiter instances
// were shared between routers).
func RateLimit(limit int, window time.Duration, message string, trustProxy bool) func(http.Handler) http.Handler {
	return httprate.LimitBy(limit, window,
		func(r *http.Request) (string, error) {
			return httprate.CanonicalizeIP(ClientIP(r, trustProxy)), nil
		},
		httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
			Fail(w, http.StatusTooManyRequests, message)
		}),
	)
}
