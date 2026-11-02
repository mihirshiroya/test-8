// Package httpx holds HTTP plumbing shared by every handler: JSON responses,
// request body access and middleware.
package httpx

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
)

// M is a convenience alias for ad-hoc JSON objects.
type M = map[string]any

// JSON writes v with the same content type and escaping Express used.
func JSON(w http.ResponseWriter, status int, v any) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		slog.Error("encode response", "error", err)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"success":false,"message":"Internal server error"}`))
		return
	}
	body := bytes.TrimRight(buf.Bytes(), "\n")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

// Fail writes the standard `{ success: false, message }` error envelope.
func Fail(w http.ResponseWriter, status int, message string) {
	JSON(w, status, M{"success": false, "message": message})
}

// Error writes the `{ error }` envelope used by the task endpoints.
func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, M{"error": message})
}

func NoContent(w http.ResponseWriter) { w.WriteHeader(http.StatusNoContent) }
