// Package reqctx carries the authenticated user through a request context.
package reqctx

import (
	"context"

	"productivity/internal/compat"
)

// AuthUser is the subset of the user row needed on every authenticated
// request. Its JSON shape matches the Node backend's Redis cache entries.
type AuthUser struct {
	ID              string          `json:"id"`
	Email           string          `json:"email"`
	FirstName       string          `json:"firstName"`
	LastName        string          `json:"lastName"`
	Role            string          `json:"role"`
	Provider        string          `json:"provider"`
	IsEmailVerified bool            `json:"isEmailVerified"`
	IsActive        bool            `json:"isActive"`
	LastLoginAt     *compat.ISOTime `json:"lastLoginAt"`
}

type userKey struct{}

func WithUser(ctx context.Context, u *AuthUser) context.Context {
	return context.WithValue(ctx, userKey{}, u)
}

// User returns the authenticated user or nil.
func User(ctx context.Context) *AuthUser {
	u, _ := ctx.Value(userKey{}).(*AuthUser)
	return u
}

func UserID(ctx context.Context) string {
	if u := User(ctx); u != nil {
		return u.ID
	}
	return ""
}
