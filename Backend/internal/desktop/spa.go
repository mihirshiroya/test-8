package desktop

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// SPA serves the built React app from dir, falling back to index.html so
// client-side routes (/kanban, /floating-timer, ...) load on refresh.
func SPA(dir string) http.Handler {
	if dir == "" {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "The frontend bundle is not configured (FRONTEND_DIR).", http.StatusNotFound)
		})
	}
	root := http.Dir(dir)
	files := http.FileServer(root)
	index := filepath.Join(dir, "index.html")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p := path.Clean("/" + r.URL.Path)
		if p != "/" && p != "/index.html" {
			if f, err := root.Open(p); err == nil {
				stat, statErr := f.Stat()
				_ = f.Close()
				if statErr == nil && !stat.IsDir() {
					if strings.HasPrefix(p, "/assets/") {
						w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
					}
					files.ServeHTTP(w, r)
					return
				}
			}
		}

		f, err := os.Open(index)
		if err != nil {
			http.Error(w, "index.html not found in the frontend bundle.", http.StatusNotFound)
			return
		}
		defer f.Close()
		stat, err := f.Stat()
		if err != nil {
			http.Error(w, "index.html is unreadable.", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeContent(w, r, "index.html", stat.ModTime(), f)
	})
}
