package api

import (
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"productivity/internal/httpx"
)

// Prisma's @default(uuid()) generates v4 UUIDs for every non-user model.
func newID() string { return uuid.NewString() }

func ms(t time.Time) int64 { return t.UnixMilli() }

// statusError carries an HTTP status out of a transaction callback so the
// handler can respond after the rollback.
type statusError struct {
	status  int
	message string
}

func (e *statusError) Error() string { return e.message }

func reject(status int, message string) error { return &statusError{status: status, message: message} }

func asStatusError(err error) (*statusError, bool) {
	var se *statusError
	ok := errors.As(err, &se)
	return se, ok
}

// cleanString mirrors `typeof v === 'string' ? v.trim() : ''`.
func cleanString(raw json.RawMessage) string {
	var s string
	if len(raw) == 0 || raw[0] != '"' || json.Unmarshal(raw, &s) != nil {
		return ""
	}
	return strings.TrimSpace(s)
}

// exactString returns the JSON string value without trimming.
func exactString(raw json.RawMessage) (string, bool) {
	var s string
	if len(raw) == 0 || raw[0] != '"' || json.Unmarshal(raw, &s) != nil {
		return "", false
	}
	return s, true
}

// oneOf mirrors `LIST.includes(value)` where value must be an exact string.
func oneOf(raw json.RawMessage, list []string) (string, bool) {
	s, ok := exactString(raw)
	return s, ok && slices.Contains(list, s)
}

func bodyObjects(raw json.RawMessage) []httpx.Body {
	arr, _ := httpx.AsArray(raw)
	out := make([]httpx.Body, len(arr))
	for i, el := range arr {
		out[i] = httpx.ParseBody(el)
	}
	return out
}
