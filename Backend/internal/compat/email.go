package compat

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

// The Node backend stored emails after express-validator's normalizeEmail()
// with default options. Logins must normalise identically or existing users
// could no longer sign in, so this is a faithful port of validator.js.

var (
	icloudDomains  = set("icloud.com", "me.com")
	yahooDomains   = set("rocketmail.com", "yahoo.ca", "yahoo.co.uk", "yahoo.com", "yahoo.de", "yahoo.fr", "yahoo.in", "yahoo.it", "ymail.com")
	yandexDomains  = set("ya.ru", "yandex.by", "yandex.com", "yandex.kz", "yandex.ru", "yandex.ua", "yandex.com.tr")
	outlookDomains = set(
		"hotmail.at", "hotmail.be", "hotmail.ca", "hotmail.cl", "hotmail.co.il", "hotmail.co.nz", "hotmail.co.th",
		"hotmail.co.uk", "hotmail.com", "hotmail.com.ar", "hotmail.com.au", "hotmail.com.br", "hotmail.com.gr",
		"hotmail.com.mx", "hotmail.com.pe", "hotmail.com.tr", "hotmail.com.vn", "hotmail.cz", "hotmail.de",
		"hotmail.dk", "hotmail.es", "hotmail.fr", "hotmail.hu", "hotmail.id", "hotmail.ie", "hotmail.in",
		"hotmail.it", "hotmail.jp", "hotmail.kr", "hotmail.lv", "hotmail.my", "hotmail.ph", "hotmail.pt",
		"hotmail.sa", "hotmail.sg", "hotmail.sk", "live.be", "live.co.uk", "live.com", "live.com.ar",
		"live.com.mx", "live.de", "live.es", "live.eu", "live.fr", "live.it", "live.nl", "msn.com", "outlook.at",
		"outlook.be", "outlook.cl", "outlook.co.il", "outlook.co.nz", "outlook.co.th", "outlook.com",
		"outlook.com.ar", "outlook.com.au", "outlook.com.my", "outlook.com.pe", "outlook.com.sg", "outlook.com.tr",
		"outlook.com.vn", "outlook.cz", "outlook.de", "outlook.dk", "outlook.es", "outlook.fr", "outlook.hu",
		"outlook.id", "outlook.ie", "outlook.in", "outlook.it", "outlook.jp", "outlook.kr", "outlook.lv",
		"outlook.my", "outlook.ph", "outlook.pt", "outlook.sa", "outlook.sg", "outlook.sk", "passport.com",
	)
	dotRuns = regexp.MustCompile(`\.+`)
)

func set(values ...string) map[string]struct{} {
	m := make(map[string]struct{}, len(values))
	for _, v := range values {
		m[v] = struct{}{}
	}
	return m
}

func has(m map[string]struct{}, k string) bool { _, ok := m[k]; return ok }

// NormalizeEmail ports validator.js normalizeEmail() with default options.
// ok=false matches validator.js returning `false` (empty local part).
func NormalizeEmail(email string) (string, bool) {
	at := strings.LastIndex(email, "@")
	if at < 0 {
		return email, false
	}
	user, domain := email[:at], strings.ToLower(email[at+1:])

	switch {
	case domain == "gmail.com" || domain == "googlemail.com":
		user = strings.SplitN(user, "+", 2)[0]
		user = dotRuns.ReplaceAllStringFunc(user, func(run string) string {
			if len(run) > 1 {
				return run
			}
			return ""
		})
		if user == "" {
			return "", false
		}
		user = strings.ToLower(user)
		domain = "gmail.com"
	case has(icloudDomains, domain), has(outlookDomains, domain):
		user = strings.SplitN(user, "+", 2)[0]
		if user == "" {
			return "", false
		}
		user = strings.ToLower(user)
	case has(yahooDomains, domain):
		if parts := strings.Split(user, "-"); len(parts) > 1 {
			user = strings.Join(parts[:len(parts)-1], "-")
		}
		if user == "" {
			return "", false
		}
		user = strings.ToLower(user)
	case has(yandexDomains, domain):
		user = strings.ToLower(user)
		domain = "yandex.ru"
	default:
		user = strings.ToLower(user)
	}
	return user + "@" + domain, true
}

var (
	emailLocalPart = regexp.MustCompile("(?i)^[a-z\\d!#$%&'*+\\-/=?^_`{|}~]+(\\.[a-z\\d!#$%&'*+\\-/=?^_`{|}~]+)*$")
	domainLabel    = regexp.MustCompile(`(?i)^[a-z\x{00a1}-\x{ffff}0-9-]+$`)
	tldPattern     = regexp.MustCompile(`(?i)^([a-z\x{00a1}-\x{ff3f}\x{ff41}-\x{ffff}]{2,}|xn[a-z0-9-]{2,})$`)
)

// IsEmail is a pragmatic port of validator.js isEmail() with default options.
func IsEmail(s string) bool {
	if s == "" || utf8.RuneCountInString(s) > 254 || strings.ContainsAny(s, " \t\r\n") {
		return false
	}
	at := strings.LastIndex(s, "@")
	if at <= 0 || at == len(s)-1 {
		return false
	}
	local, domain := s[:at], s[at+1:]
	if len(local) > 64 || len(domain) > 253 || !emailLocalPart.MatchString(local) {
		return false
	}
	labels := strings.Split(strings.TrimSuffix(domain, "."), ".")
	if len(labels) < 2 {
		return false
	}
	for _, l := range labels {
		if l == "" || len(l) > 63 || !domainLabel.MatchString(l) || strings.HasPrefix(l, "-") || strings.HasSuffix(l, "-") {
			return false
		}
	}
	return tldPattern.MatchString(labels[len(labels)-1])
}
