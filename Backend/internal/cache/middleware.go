package cache

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"productivity/internal/reqctx"
)

type cachedResponse struct {
	Status int             `json:"status"`
	Body   json.RawMessage `json:"body"`
}

// Response caches successful GET responses for ttl.
func (c *Cache) Response(ns Namespace, ttl time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := reqctx.UserID(r.Context())
			if r.Method != http.MethodGet || userID == "" {
				next.ServeHTTP(w, r)
				return
			}
			version, ok := c.Version(r.Context(), ns)
			if !ok {
				next.ServeHTTP(w, r)
				return
			}

			sum := sha1.Sum([]byte(r.URL.RequestURI()))
			key := Prefix + ":res:" + ns.Name + ":" + ns.scope(r.Context()) + ":v" + version + ":" + userID + ":" + hex.EncodeToString(sum[:])

			if raw := c.GetRaw(r.Context(), key); raw != nil {
				var hit cachedResponse
				if json.Unmarshal(raw, &hit) == nil && hit.Status != 0 && len(hit.Body) > 0 {
					w.Header().Set("X-Cache", "HIT")
					w.Header().Set("Content-Type", "application/json; charset=utf-8")
					w.Header().Set("Content-Length", strconv.Itoa(len(hit.Body)))
					w.WriteHeader(hit.Status)
					_, _ = w.Write(hit.Body)
					return
				}
			}

			w.Header().Set("X-Cache", "MISS")
			rec := &recorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)

			if rec.status == http.StatusOK && cacheable(rec.buf.Bytes()) {
				if b, err := json.Marshal(cachedResponse{Status: rec.status, Body: rec.buf.Bytes()}); err == nil {
					c.SetRaw(r.Context(), key, b, ttl)
				}
			}
		})
	}
}

// cacheable rejects empty bodies and bodies carrying `"success": false`.
func cacheable(body []byte) bool {
	body = bytes.TrimSpace(body)
	if len(body) == 0 || !json.Valid(body) {
		return false
	}
	var probe struct {
		Success *bool `json:"success"`
	}
	if json.Unmarshal(body, &probe) == nil && probe.Success != nil && !*probe.Success {
		return false
	}
	return true
}

// recorder tees the response so it can be cached after the handler finishes.
type recorder struct {
	http.ResponseWriter
	status int
	buf    bytes.Buffer
}

func (r *recorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *recorder) Write(b []byte) (int, error) {
	r.buf.Write(b)
	return r.ResponseWriter.Write(b)
}

func (r *recorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// InvalidateOn bumps namespace versions after a successful (< 400) write.
// The bump happens BEFORE the response headers are flushed, so a client that
// refetches right after a mutation can never read a stale entry.
func (c *Cache) InvalidateOn(namespaces ...Namespace) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}
			bw := &bumpWriter{ResponseWriter: w, bump: func(status int) {
				if status < 400 && reqctx.UserID(r.Context()) != "" {
					c.Bump(r.Context(), namespaces...)
				}
			}}
			next.ServeHTTP(bw, r)
			if !bw.wrote {
				bw.WriteHeader(http.StatusOK)
			}
		})
	}
}

type bumpWriter struct {
	http.ResponseWriter
	bump  func(status int)
	wrote bool
}

func (b *bumpWriter) WriteHeader(code int) {
	if !b.wrote {
		b.wrote = true
		b.bump(code)
	}
	b.ResponseWriter.WriteHeader(code)
}

func (b *bumpWriter) Write(p []byte) (int, error) {
	if !b.wrote {
		b.WriteHeader(http.StatusOK)
	}
	return b.ResponseWriter.Write(p)
}

func (b *bumpWriter) Unwrap() http.ResponseWriter { return b.ResponseWriter }
