package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lucsky/cuid"

	"productivity/internal/auth"
)

func TestIntegrationAuthCompatibility(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	email := fmt.Sprintf("auth-%d@example.com", time.Now().UnixNano())
	const password = "Passw0rd!x"

	// The auth limiter allows 5 register/login calls per window; this test uses
	// exactly 5 and then asserts the 6th is throttled.
	reg := h.expect(h.do("POST", "/api/auth/register", "", map[string]any{
		"email": email, "password": password, "firstName": "Ada", "lastName": "Lovelace",
	}), http.StatusCreated, "register")
	if _, leaked := dig(reg.body, "data", "user").(map[string]any)["password"]; leaked {
		t.Fatal("password hash leaked in register response")
	}

	h.expect(h.do("POST", "/api/auth/login", "", map[string]any{"email": email, "password": "wrong-pass"}),
		http.StatusBadRequest, "wrong password")
	login := h.expect(h.do("POST", "/api/auth/login", "", map[string]any{"email": email, "password": password}),
		http.StatusOK, "login")
	access := str(login.body, "data", "tokens", "accessToken")
	refresh := str(login.body, "data", "tokens", "refreshToken")

	profile := h.expect(h.do("GET", "/api/auth/profile", access, nil), http.StatusOK, "profile")
	if str(profile.body, "data", "user", "email") != email {
		t.Fatalf("profile: %s", profile.raw)
	}
	h.expect(h.do("GET", "/api/auth/profile", "not-a-jwt", nil), http.StatusUnauthorized, "garbage token")

	// Refresh tokens rotate: the old one is single-use.
	rotated := h.expect(h.do("POST", "/api/auth/refresh-token", "", map[string]any{"refreshToken": refresh}), http.StatusOK, "refresh")
	newRefresh := str(rotated.body, "data", "tokens", "refreshToken")
	if newRefresh == "" || newRefresh == refresh {
		t.Fatalf("refresh did not rotate: %s", rotated.raw)
	}
	if r := h.do("POST", "/api/auth/refresh-token", "", map[string]any{"refreshToken": refresh}); r.status == http.StatusOK {
		t.Fatal("reused refresh token was accepted")
	}

	sessions := h.expect(h.do("GET", "/api/users/me/sessions", access, nil), http.StatusOK, "active sessions")
	if !strings.Contains(sessions.raw, `"success":true`) {
		t.Fatalf("sessions: %s", sessions.raw)
	}

	// A user row written by the Node backend: cuid id, bcryptjs `$2b$` hash.
	legacyEmail := "legacy-" + email
	hash, err := auth.HashPassword(password, 4)
	if err != nil {
		t.Fatal(err)
	}
	legacyHash := "$2b$" + strings.TrimPrefix(hash, "$2a$")
	legacyID := cuid.New()
	if _, err := h.api.db.Exec(ctx, `INSERT INTO users (id, email, password, "firstName", "lastName", "isEmailVerified", "updatedAt")
		VALUES ($1, $2, $3, 'Legacy', 'User', true, now())`, legacyID, legacyEmail, legacyHash); err != nil {
		t.Fatal(err)
	}
	h.expect(h.do("POST", "/api/auth/login", "", map[string]any{"email": legacyEmail, "password": password}),
		http.StatusOK, "login with bcryptjs hash")

	// An access token exactly as Node's jsonwebtoken signed it (no jti).
	nodeToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id": legacyID, "email": legacyEmail, "role": "USER", "provider": "LOCAL", "isEmailVerified": true,
		"iat": time.Now().Unix(), "exp": time.Now().Add(15 * time.Minute).Unix(),
	}).SignedString([]byte(h.api.cfg.JWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	legacyProfile := h.expect(h.do("GET", "/api/auth/profile", nodeToken, nil), http.StatusOK, "node-signed token")
	if str(legacyProfile.body, "data", "user", "id") != legacyID {
		t.Fatalf("legacy profile: %s", legacyProfile.raw)
	}
	h.expect(h.do("POST", "/api/workspaces", nodeToken, map[string]any{"name": "Legacy WS"}), http.StatusCreated, "legacy user writes")

	// Password change; the old password stops working.
	h.expect(h.do("POST", "/api/auth/change-password", access, map[string]any{
		"currentPassword": "nope-nope", "newPassword": "N3wPassw0rd!",
	}), http.StatusBadRequest, "wrong current password")
	h.expect(h.do("POST", "/api/auth/change-password", access, map[string]any{
		"currentPassword": password, "newPassword": "N3wPassw0rd!",
	}), http.StatusOK, "change password")
	h.expect(h.do("POST", "/api/auth/change-password", access, map[string]any{
		"currentPassword": password, "newPassword": "Another1!",
	}), http.StatusBadRequest, "old password rejected")
	h.expect(h.do("POST", "/api/auth/login", "", map[string]any{"email": email, "password": "N3wPassw0rd!"}),
		http.StatusOK, "login with new password")

	h.expect(h.do("POST", "/api/auth/login", "", map[string]any{"email": email, "password": "N3wPassw0rd!"}),
		http.StatusTooManyRequests, "auth rate limit")

	h.expect(h.do("POST", "/api/auth/logout-all", access, nil), http.StatusOK, "logout all")
	if r := h.do("POST", "/api/auth/refresh-token", "", map[string]any{"refreshToken": newRefresh}); r.status == http.StatusOK {
		t.Fatal("refresh token survived logout-all")
	}
}
