package httpx

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"
)

// Body is a decoded JSON object whose values stay raw, so handlers can
// distinguish "missing" from "null" from "wrong type" exactly like the
// original JavaScript (`=== undefined`, `typeof x === 'string'`, truthiness).
type Body map[string]json.RawMessage

// ParseBody decodes a JSON object; anything else yields an empty Body.
func ParseBody(raw []byte) Body {
	var b Body
	if err := json.Unmarshal(raw, &b); err != nil || b == nil {
		return Body{}
	}
	return b
}

// Has reports whether the key is present (JS `!== undefined`). JSON null counts
// as present.
func (b Body) Has(k string) bool { _, ok := b[k]; return ok }

func (b Body) IsNull(k string) bool {
	v, ok := b[k]
	return ok && string(bytes.TrimSpace(v)) == "null"
}

func (b Body) Raw(k string) json.RawMessage { return b[k] }

// String returns the value only when it is a JSON string.
func (b Body) String(k string) (string, bool) {
	v, ok := b[k]
	if !ok {
		return "", false
	}
	v = bytes.TrimSpace(v)
	if len(v) == 0 || v[0] != '"' {
		return "", false
	}
	var s string
	if json.Unmarshal(v, &s) != nil {
		return "", false
	}
	return s, true
}

// Trim mirrors `typeof v === 'string' ? v.trim() : ''`.
func (b Body) Trim(k string) string {
	s, _ := b.String(k)
	return strings.TrimSpace(s)
}

func (b Body) Bool(k string) (value, ok bool) {
	switch string(bytes.TrimSpace(b[k])) {
	case "true":
		return true, true
	case "false":
		return false, true
	}
	return false, false
}

// Truthy mirrors JavaScript truthiness for a JSON value.
func (b Body) Truthy(k string) bool { return Truthy(b[k]) }

func Truthy(v json.RawMessage) bool {
	v = bytes.TrimSpace(v)
	switch string(v) {
	case "", "null", "false", `""`:
		return false
	}
	if v[0] == '-' || (v[0] >= '0' && v[0] <= '9') {
		var f float64
		if json.Unmarshal(v, &f) == nil {
			return f != 0
		}
	}
	return true
}

// Array returns the elements when the value is a JSON array.
func (b Body) Array(k string) ([]json.RawMessage, bool) { return AsArray(b[k]) }

func AsArray(v json.RawMessage) ([]json.RawMessage, bool) {
	v = bytes.TrimSpace(v)
	if len(v) == 0 || v[0] != '[' {
		return nil, false
	}
	var arr []json.RawMessage
	if json.Unmarshal(v, &arr) != nil {
		return nil, false
	}
	return arr, true
}

// Object returns the nested object, or ok=false when it is not an object.
func (b Body) Object(k string) (Body, bool) {
	v := bytes.TrimSpace(b[k])
	if len(v) == 0 || v[0] != '{' {
		return nil, false
	}
	return ParseBody(v), true
}

// SetString replaces a value (used by validators that sanitise input).
func (b Body) SetString(k, v string) {
	raw, _ := json.Marshal(v)
	b[k] = raw
}

type bodyKey struct{}

// BodyFrom returns the parsed request body (never nil).
func BodyFrom(r *http.Request) Body {
	if b, ok := r.Context().Value(bodyKey{}).(Body); ok {
		return b
	}
	return Body{}
}

var errBodyTooLarge = errors.New("request entity too large")

// BodyParser reads JSON and urlencoded bodies up to limit bytes, rejecting
// malformed JSON with 400 and oversized payloads with 413, like express.json().
func BodyParser(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body == nil || r.Body == http.NoBody {
				next.ServeHTTP(w, r)
				return
			}
			mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
			isJSON := mediaType == "application/json" || strings.HasSuffix(mediaType, "+json")
			isForm := mediaType == "application/x-www-form-urlencoded"
			if !isJSON && !isForm {
				next.ServeHTTP(w, r)
				return
			}

			raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, limit))
			if err != nil {
				var maxErr *http.MaxBytesError
				if errors.As(err, &maxErr) {
					Fail(w, http.StatusRequestEntityTooLarge, errBodyTooLarge.Error())
					return
				}
				Fail(w, http.StatusBadRequest, "Invalid request body")
				return
			}

			body := Body{}
			trimmed := bytes.TrimSpace(raw)
			switch {
			case len(trimmed) == 0:
			case isJSON:
				// express.json() is strict: only objects and arrays are accepted.
				if (trimmed[0] != '{' && trimmed[0] != '[') || !json.Valid(trimmed) {
					Fail(w, http.StatusBadRequest, "Invalid JSON payload")
					return
				}
				body = ParseBody(trimmed)
			case isForm:
				values, err := url.ParseQuery(string(trimmed))
				if err != nil {
					Fail(w, http.StatusBadRequest, "Invalid form payload")
					return
				}
				for k, vs := range values {
					if len(vs) > 0 {
						body.SetString(k, vs[len(vs)-1])
					}
				}
			}
			r.Body = io.NopCloser(bytes.NewReader(raw))
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), bodyKey{}, body)))
		})
	}
}
