package desktop

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"productivity/internal/httpx"
)

type Mode string

const (
	// ModeReady: database connected, full API available.
	ModeReady Mode = "ready"
	// ModeSetup: no database configured yet; only setup endpoints work.
	ModeSetup Mode = "setup"
	// ModeError: a database is configured but could not be reached or migrated.
	ModeError Mode = "error"
)

type Options struct {
	Token        string
	FrontendDir  string
	Version      string
	Mode         Mode
	StartupError *CheckResult
	// API is the full API handler; nil unless Mode is ModeReady.
	API      http.Handler
	Log      *slog.Logger
	Shutdown func()
}

// Handler composes the desktop control endpoints, the API and the frontend
// behind the token guard. Each part is a separate top-level router so chi
// route contexts never nest.
func Handler(o Options) http.Handler {
	ctrl := chi.NewRouter()
	ctrl.Use(httpx.Recoverer(o.Log), noStore)

	ctrl.Get("/__desktop/status", func(w http.ResponseWriter, _ *http.Request) {
		body := httpx.M{
			"mode":               o.Mode,
			"version":            o.Version,
			"databaseConfigured": o.Mode != ModeSetup,
			"serverTime":         time.Now().UnixMilli(),
		}
		if o.StartupError != nil {
			body["error"] = o.StartupError
		}
		httpx.JSON(w, http.StatusOK, body)
	})

	ctrl.Post("/__desktop/db/test", func(w http.ResponseWriter, r *http.Request) {
		raw, ok := decodeURL(w, r)
		if !ok {
			return
		}
		httpx.JSON(w, http.StatusOK, Check(r.Context(), raw))
	})

	ctrl.Post("/__desktop/db/setup", func(w http.ResponseWriter, r *http.Request) {
		raw, ok := decodeURL(w, r)
		if !ok {
			return
		}
		httpx.JSON(w, http.StatusOK, Setup(r.Context(), raw, o.Log))
	})

	ctrl.Post("/__desktop/shutdown", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusAccepted, httpx.M{"success": true})
		if o.Shutdown != nil {
			go o.Shutdown()
		}
	})

	frontend := httpx.DesktopSecurityHeaders(SPA(o.FrontendDir))

	root := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		switch {
		case strings.HasPrefix(p, "/__desktop/"):
			ctrl.ServeHTTP(w, r)
		case isAPIPath(p):
			if o.API == nil {
				httpx.JSON(w, http.StatusServiceUnavailable, httpx.M{
					"success": false, "mode": o.Mode,
					"message": "The database is not available. Open the desktop setup to connect it.",
				})
				return
			}
			o.API.ServeHTTP(w, r)
		default:
			frontend.ServeHTTP(w, r)
		}
	})
	return Guard(o.Token, root)
}

func isAPIPath(p string) bool {
	return p == "/api" || strings.HasPrefix(p, "/api/") || p == "/health" || strings.HasPrefix(p, "/health/")
}

func noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func decodeURL(w http.ResponseWriter, r *http.Request) (string, bool) {
	var body struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 16<<10)).Decode(&body); err != nil {
		httpx.JSON(w, http.StatusBadRequest, CheckResult{Code: "invalid_request", Message: "Send the connection URL as JSON: {\"url\": \"postgres://...\"}."})
		return "", false
	}
	return strings.TrimSpace(body.URL), true
}
