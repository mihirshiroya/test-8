// Package compat reproduces the JavaScript semantics the Node.js backend relied
// on (Date#toJSON, parseInt, new Date(x), Math.round, the `ms` duration
// format) so the Go API stays byte-for-byte compatible with existing clients.
package compat

import (
	"bytes"
	"encoding/json"
	"errors"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const isoLayout = "2006-01-02T15:04:05.000Z"

// ISOTime marshals exactly like JavaScript's Date#toJSON
// ("2024-01-02T03:04:05.678Z").
type ISOTime time.Time

func FormatISO(t time.Time) string { return t.UTC().Format(isoLayout) }

func (t ISOTime) MarshalJSON() ([]byte, error) {
	return []byte(`"` + FormatISO(time.Time(t)) + `"`), nil
}

func (t *ISOTime) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	parsed, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return err
	}
	*t = ISOTime(parsed.UTC())
	return nil
}

func ISO(t time.Time) ISOTime { return ISOTime(t) }

func ISOPtr(t *time.Time) *ISOTime {
	if t == nil {
		return nil
	}
	v := ISOTime(*t)
	return &v
}

// Millis returns epoch milliseconds, or nil for a nil time (JSON null).
func Millis(t *time.Time) *int64 {
	if t == nil {
		return nil
	}
	v := t.UnixMilli()
	return &v
}

// Now returns the current UTC time truncated to milliseconds, matching the
// TIMESTAMP(3) precision of every column so responses equal stored values.
func Now() time.Time { return time.Now().UTC().Truncate(time.Millisecond) }

// Round is JavaScript's Math.round (half rounds toward +Infinity).
func Round(x float64) float64 { return math.Floor(x + 0.5) }

// RoundInt is Round converted to int.
func RoundInt(x float64) int { return int(Round(x)) }

var leadingInt = regexp.MustCompile(`^[+-]?\d+`)

// ParseIntString mirrors parseInt(s, 10): leading whitespace is skipped and
// parsing stops at the first non-digit.
func ParseIntString(s string) (int64, bool) {
	m := leadingInt.FindString(strings.TrimLeft(s, " \t\n\r\v\f\u00a0\ufeff"))
	if m == "" {
		return 0, false
	}
	v, err := strconv.ParseInt(m, 10, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}

// ParseInt mirrors parseInt(value, 10) for a raw JSON value.
func ParseInt(raw json.RawMessage) (int64, bool) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return 0, false
	}
	switch raw[0] {
	case '"':
		var s string
		if json.Unmarshal(raw, &s) != nil {
			return 0, false
		}
		return ParseIntString(s)
	case '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
		f, err := strconv.ParseFloat(string(raw), 64)
		if err != nil || math.IsInf(f, 0) || math.Abs(f) > math.MaxInt64/2 {
			return 0, false
		}
		return int64(f), true
	}
	return 0, false
}

const maxJSDateMillis = 8.64e15

var dateLayoutsUTC = []string{
	time.RFC3339Nano,
	"2006-01-02T15:04:05.000Z0700",
	"2006-01-02",
	"2006-01",
	"2006",
}

var dateLayoutsLocal = []string{
	"2006-01-02T15:04:05.000",
	"2006-01-02T15:04:05",
	"2006-01-02T15:04",
	"2006-01-02 15:04:05",
	"2006-01-02 15:04",
}

// ParseDate mirrors `new Date(value)` for JSON numbers (epoch ms) and the
// ISO-8601 string forms browsers produce. ok=false means "Invalid Date".
func ParseDate(raw json.RawMessage) (time.Time, bool) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return time.Time{}, false
	}
	switch raw[0] {
	case '"':
		var s string
		if json.Unmarshal(raw, &s) != nil {
			return time.Time{}, false
		}
		return parseDateString(strings.TrimSpace(s))
	case 't':
		return time.UnixMilli(1).UTC(), string(raw) == "true"
	case 'f':
		return time.UnixMilli(0).UTC(), string(raw) == "false"
	}
	f, err := strconv.ParseFloat(string(raw), 64)
	if err != nil || math.IsNaN(f) || math.Abs(f) > maxJSDateMillis {
		return time.Time{}, false
	}
	return time.UnixMilli(int64(f)).UTC(), true
}

func parseDateString(s string) (time.Time, bool) {
	for _, layout := range dateLayoutsUTC {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC().Truncate(time.Millisecond), true
		}
	}
	for _, layout := range dateLayoutsLocal {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return t.UTC().Truncate(time.Millisecond), true
		}
	}
	return time.Time{}, false
}

var msPattern = regexp.MustCompile(`(?i)^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$`)

// ParseDuration parses the `ms` package format used by jsonwebtoken's
// expiresIn ("15m", "7d", "2 hours"). A bare number means milliseconds.
func ParseDuration(s string) (time.Duration, error) {
	m := msPattern.FindStringSubmatch(strings.TrimSpace(s))
	if m == nil {
		return 0, errors.New("invalid duration " + strconv.Quote(s))
	}
	n, err := strconv.ParseFloat(m[1], 64)
	if err != nil {
		return 0, err
	}
	unit := time.Millisecond
	switch u := strings.ToLower(m[2]); {
	case u == "":
		unit = time.Millisecond
	case strings.HasPrefix(u, "ms") || strings.HasPrefix(u, "msec") || strings.HasPrefix(u, "milli"):
		unit = time.Millisecond
	case strings.HasPrefix(u, "s"):
		unit = time.Second
	case strings.HasPrefix(u, "m"):
		unit = time.Minute
	case strings.HasPrefix(u, "h"):
		unit = time.Hour
	case strings.HasPrefix(u, "d"):
		unit = 24 * time.Hour
	case strings.HasPrefix(u, "w"):
		unit = 7 * 24 * time.Hour
	case strings.HasPrefix(u, "y"):
		unit = time.Duration(365.25 * 24 * float64(time.Hour))
	}
	d := time.Duration(n * float64(unit))
	if d <= 0 {
		return 0, errors.New("duration must be positive")
	}
	return d, nil
}
