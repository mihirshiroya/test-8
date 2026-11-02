// Package desktop adapts the API server to run as the local backend of the
// Tauri desktop app: loopback-only access guarded by a per-launch token,
// first-run database setup, and serving the bundled React frontend.
package desktop

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

const (
	// SessionCookie authorizes the app's own webviews after bootstrap.
	SessionCookie = "desktop_session"
	// TokenHeader authorizes requests from the Tauri (Rust) process.
	TokenHeader = "X-Desktop-Token"
	// BootstrapPath exchanges the launch token for the session cookie.
	BootstrapPath = "/__desktop/bootstrap"
)

// Guard rejects every request that does not carry the launch token, so other
// local processes and web pages cannot talk to the backend even though it
// listens on 127.0.0.1.
func Guard(token string, next http.Handler) http.Handler {
	expected := []byte(token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == BootstrapPath {
			bootstrap(w, r, expected)
			return
		}
		if authorized(r, expected) {
			next.ServeHTTP(w, r)
			return
		}
		http.Error(w, "This server only accepts requests from the desktop application.", http.StatusForbidden)
	})
}

func authorized(r *http.Request, expected []byte) bool {
	if h := r.Header.Get(TokenHeader); h != "" {
		return subtle.ConstantTimeCompare([]byte(h), expected) == 1
	}
	c, err := r.Cookie(SessionCookie)
	return err == nil && subtle.ConstantTimeCompare([]byte(c.Value), expected) == 1
}

// bootstrap is the first URL the Tauri shell loads in each webview. It turns
// the token into an HttpOnly, SameSite=Strict session cookie and redirects so
// the token never stays in the address or history.
func bootstrap(w http.ResponseWriter, r *http.Request, expected []byte) {
	if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("token")), expected) != 1 {
		http.Error(w, "Invalid desktop token.", http.StatusForbidden)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    string(expected),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	next := r.URL.Query().Get("next")
	if !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") || strings.HasPrefix(next, "/\\") {
		next = "/"
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	http.Redirect(w, r, next, http.StatusFound)
}
