package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"productivity/internal/compat"
	"productivity/internal/httpx"
)

// fieldError matches express-validator's error shape.
type fieldError struct {
	Field   string          `json:"field"`
	Message string          `json:"message"`
	Value   json.RawMessage `json:"value,omitempty"`
}

// validator accumulates errors and sanitises the body in place, mirroring an
// express-validator chain (every rule runs; no bail on first failure).
type validator struct {
	body   httpx.Body
	errors []fieldError
}

func newValidator(b httpx.Body) *validator { return &validator{body: b} }

func (v *validator) fail(field, msg string) {
	v.errors = append(v.errors, fieldError{Field: field, Message: msg, Value: v.body.Raw(field)})
}

// str is the string form express-validator validates against: strings as-is,
// numbers/booleans stringified, everything else (missing, null, objects) "".
func (v *validator) str(field string) string {
	if s, ok := v.body.String(field); ok {
		return s
	}
	raw := bytes.TrimSpace(v.body.Raw(field))
	if len(raw) > 0 && (raw[0] == '-' || raw[0] == 't' || raw[0] == 'f' || (raw[0] >= '0' && raw[0] <= '9')) {
		return string(raw)
	}
	return ""
}

func (v *validator) present(field string) bool { return v.body.Has(field) }

func (v *validator) email(field string, optional bool) {
	if optional && !v.present(field) {
		return
	}
	s := v.str(field)
	if !compat.IsEmail(s) {
		v.fail(field, "Please provide a valid email address")
		return
	}
	if n, ok := compat.NormalizeEmail(s); ok {
		v.body.SetString(field, n)
	}
}

func (v *validator) minLen(field string, n int, msg string) {
	if utf8.RuneCountInString(v.str(field)) < n {
		v.fail(field, msg)
	}
}

func (v *validator) notEmpty(field, msg string) {
	if v.str(field) == "" {
		v.fail(field, msg)
	}
}

var namePattern = regexp.MustCompile(`^[a-zA-Z\s]+$`)

func (v *validator) name(field, label string, optional bool) {
	if optional && !v.present(field) {
		return
	}
	s := strings.TrimSpace(v.str(field))
	if v.present(field) {
		v.body.SetString(field, s)
	}
	if n := utf8.RuneCountInString(s); n < 2 || n > 50 {
		v.fail(field, label+" must be between 2 and 50 characters")
	}
	if !namePattern.MatchString(s) {
		v.fail(field, label+" can only contain letters and spaces")
	}
}

func (v *validator) optionalString(field string) {
	if !v.present(field) {
		return
	}
	s, ok := v.body.String(field)
	if !ok {
		v.fail(field, "Invalid value")
		return
	}
	v.body.SetString(field, strings.TrimSpace(s))
}

// respond writes the 400 envelope and reports whether validation failed.
func (v *validator) respond(w http.ResponseWriter) bool {
	if len(v.errors) == 0 {
		return false
	}
	httpx.JSON(w, http.StatusBadRequest, httpx.M{
		"success": false,
		"message": "Validation failed",
		"errors":  v.errors,
	})
	return true
}

func validateRegister(b httpx.Body) *validator {
	v := newValidator(b)
	v.email("email", false)
	v.minLen("password", 8, "Password must be at least 8 characters long")
	v.name("firstName", "First name", false)
	v.name("lastName", "Last name", false)
	return v
}

func validateLogin(b httpx.Body) *validator {
	v := newValidator(b)
	v.email("email", false)
	v.notEmpty("password", "Password is required")
	return v
}

func validateForgotPassword(b httpx.Body) *validator {
	v := newValidator(b)
	v.email("email", false)
	return v
}

func validateUpdateProfile(b httpx.Body) *validator {
	v := newValidator(b)
	v.name("firstName", "First name", true)
	v.name("lastName", "Last name", true)
	v.email("email", true)
	v.optionalString("pfpFrame")
	return v
}

func validateVerifyEmail(b httpx.Body) *validator {
	v := newValidator(b)
	v.notEmpty("token", "Verification token is required")
	return v
}

func itoa(n int) string { return strconv.Itoa(n) }
