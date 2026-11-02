// Package auth contains token, password and random-secret primitives.
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims mirrors the payload the Node backend signed, so tokens issued before
// the migration remain valid.
type Claims struct {
	ID              string `json:"id"`
	Email           string `json:"email"`
	Role            string `json:"role"`
	Provider        string `json:"provider"`
	IsEmailVerified bool   `json:"isEmailVerified"`
	jwt.RegisteredClaims
}

var (
	ErrTokenExpired = errors.New("token expired")
	ErrTokenInvalid = errors.New("invalid token")
)

type TokenManager struct {
	accessSecret  []byte
	refreshSecret []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

func NewTokenManager(accessSecret, refreshSecret string, accessTTL, refreshTTL time.Duration) *TokenManager {
	return &TokenManager{
		accessSecret:  []byte(accessSecret),
		refreshSecret: []byte(refreshSecret),
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
	}
}

type Subject struct {
	ID, Email, Role, Provider string
	IsEmailVerified           bool
}

// Issue signs a new access/refresh pair. Each refresh token carries a random
// jti so two logins in the same second can never collide on the unique
// refresh_tokens.token column.
func (m *TokenManager) Issue(s Subject) (access, refresh string, err error) {
	now := time.Now()
	access, err = m.sign(s, now, m.accessTTL, m.accessSecret, "")
	if err != nil {
		return "", "", err
	}
	refresh, err = m.sign(s, now, m.refreshTTL, m.refreshSecret, RandomHex(16))
	return access, refresh, err
}

func (m *TokenManager) sign(s Subject, now time.Time, ttl time.Duration, secret []byte, jti string) (string, error) {
	claims := Claims{
		ID: s.ID, Email: s.Email, Role: s.Role, Provider: s.Provider, IsEmailVerified: s.IsEmailVerified,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			ID:        jti,
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func (m *TokenManager) VerifyAccess(token string) (*Claims, error) {
	return verify(token, m.accessSecret)
}

func (m *TokenManager) VerifyRefresh(token string) (*Claims, error) {
	return verify(token, m.refreshSecret)
}

func verify(token string, secret []byte) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(token, claims,
		func(*jwt.Token) (any, error) { return secret, nil },
		jwt.WithValidMethods([]string{"HS256", "HS384", "HS512"}),
	)
	switch {
	case errors.Is(err, jwt.ErrTokenExpired):
		return nil, ErrTokenExpired
	case err != nil:
		return nil, ErrTokenInvalid
	case claims.ID == "":
		return nil, ErrTokenInvalid
	}
	return claims, nil
}

// RandomHex returns n random bytes hex-encoded (crypto/rand).
func RandomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
