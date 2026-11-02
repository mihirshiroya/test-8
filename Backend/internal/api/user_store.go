package api

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/lucsky/cuid"

	"productivity/internal/compat"
	"productivity/internal/database"
	"productivity/internal/reqctx"
)

// User is a full users row.
type User struct {
	ID                     string
	Email                  string
	Password               *string
	FirstName              string
	LastName               string
	IsEmailVerified        bool
	IsActive               bool
	Role                   string
	Provider               string
	GoogleID               *string
	Avatar                 *string
	LastLoginAt            *time.Time
	EmailVerifiedAt        *time.Time
	PasswordResetToken     *string
	PasswordResetExpires   *time.Time
	EmailVerificationToken *string
	TotalFocusHours        int
	PfpFrame               string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

const userColumns = `id, email, password, "firstName", "lastName", "isEmailVerified", "isActive",
	role::text, provider::text, "googleId", avatar, "lastLoginAt", "emailVerifiedAt",
	"passwordResetToken", "passwordResetExpires", "emailVerificationToken",
	"totalFocusHours", "pfpFrame", "createdAt", "updatedAt"`

func scanUser(row pgx.Row) (*User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.Password, &u.FirstName, &u.LastName, &u.IsEmailVerified, &u.IsActive,
		&u.Role, &u.Provider, &u.GoogleID, &u.Avatar, &u.LastLoginAt, &u.EmailVerifiedAt,
		&u.PasswordResetToken, &u.PasswordResetExpires, &u.EmailVerificationToken,
		&u.TotalFocusHours, &u.PfpFrame, &u.CreatedAt, &u.UpdatedAt)
	if database.IsNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// PublicUser is the sanitised user (password and secret tokens removed),
// matching AuthUtils.sanitizeUser in the Node backend.
type PublicUser struct {
	ID              string          `json:"id"`
	Email           string          `json:"email"`
	FirstName       string          `json:"firstName"`
	LastName        string          `json:"lastName"`
	IsEmailVerified bool            `json:"isEmailVerified"`
	IsActive        bool            `json:"isActive"`
	Role            string          `json:"role"`
	Provider        string          `json:"provider"`
	GoogleID        *string         `json:"googleId"`
	Avatar          *string         `json:"avatar"`
	LastLoginAt     *compat.ISOTime `json:"lastLoginAt"`
	EmailVerifiedAt *compat.ISOTime `json:"emailVerifiedAt"`
	TotalFocusHours int             `json:"totalFocusHours"`
	PfpFrame        string          `json:"pfpFrame"`
	CreatedAt       compat.ISOTime  `json:"createdAt"`
	UpdatedAt       compat.ISOTime  `json:"updatedAt"`
	Count           *userCount      `json:"_count,omitempty"`
}

type userCount struct {
	RefreshTokens int `json:"refreshTokens"`
}

func (u *User) Public() PublicUser {
	return PublicUser{
		ID: u.ID, Email: u.Email, FirstName: u.FirstName, LastName: u.LastName,
		IsEmailVerified: u.IsEmailVerified, IsActive: u.IsActive, Role: u.Role, Provider: u.Provider,
		GoogleID: u.GoogleID, Avatar: u.Avatar,
		LastLoginAt: compat.ISOPtr(u.LastLoginAt), EmailVerifiedAt: compat.ISOPtr(u.EmailVerifiedAt),
		TotalFocusHours: u.TotalFocusHours, PfpFrame: u.PfpFrame,
		CreatedAt: compat.ISO(u.CreatedAt), UpdatedAt: compat.ISO(u.UpdatedAt),
	}
}

func (u *User) authUser() *reqctx.AuthUser {
	return &reqctx.AuthUser{
		ID: u.ID, Email: u.Email, FirstName: u.FirstName, LastName: u.LastName,
		Role: u.Role, Provider: u.Provider, IsEmailVerified: u.IsEmailVerified, IsActive: u.IsActive,
		LastLoginAt: compat.ISOPtr(u.LastLoginAt),
	}
}

// userLookup columns are code constants, never user input.
type userLookup string

const (
	byID         userLookup = "id"
	byEmail      userLookup = "email"
	byGoogleID   userLookup = `"googleId"`
	byVerifToken userLookup = `"emailVerificationToken"`
)

func findUser(ctx context.Context, q database.Querier, col userLookup, value string) (*User, error) {
	return scanUser(q.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE `+string(col)+` = $1 LIMIT 1`, value))
}

// loadAuthUser serves the per-request user from Redis when possible.
func (s *Server) loadAuthUser(ctx context.Context, id string) (*reqctx.AuthUser, error) {
	if cached := s.cache.GetUser(ctx, id); cached != nil {
		return cached, nil
	}
	u, err := findUser(ctx, s.db, byID, id)
	if err != nil || u == nil {
		return nil, err
	}
	au := u.authUser()
	s.cache.SetUser(ctx, au)
	return au, nil
}

// patchUser applies sets (plus updatedAt) and drops the cached auth record.
// Returns nil when the user does not exist.
func (s *Server) patchUser(ctx context.Context, q database.Querier, id string, sets *database.Sets) (*User, error) {
	sets.Add("updatedAt", compat.Now())
	clause, args, next := sets.Build()
	args = append(args, id)
	u, err := scanUser(q.QueryRow(ctx,
		`UPDATE users SET `+clause+` WHERE id = $`+itoa(next)+` RETURNING `+userColumns, args...))
	s.cache.InvalidateUser(ctx, id)
	return u, err
}

type newUser struct {
	Email, FirstName, LastName, Provider string
	Password, GoogleID, Avatar           *string
	EmailVerificationToken               *string
	IsEmailVerified                      bool
	EmailVerifiedAt, LastLoginAt         *time.Time
}

func (s *Server) createUser(ctx context.Context, q database.Querier, n newUser) (*User, error) {
	now := compat.Now()
	return scanUser(q.QueryRow(ctx, `
		INSERT INTO users (id, email, password, "firstName", "lastName", provider, "googleId", avatar,
			"emailVerificationToken", "isEmailVerified", "emailVerifiedAt", "lastLoginAt", "isActive",
			"createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6::text::"AuthProvider", $7, $8, $9, $10, $11, $12, true, $13, $13)
		RETURNING `+userColumns,
		cuid.New(), n.Email, n.Password, n.FirstName, n.LastName, n.Provider, n.GoogleID, n.Avatar,
		n.EmailVerificationToken, n.IsEmailVerified, n.EmailVerifiedAt, n.LastLoginAt, now))
}

func (s *Server) deleteUserRow(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	s.cache.InvalidateUser(ctx, id)
	return err
}

func (s *Server) countRefreshTokens(ctx context.Context, userID string) (int, error) {
	var n int
	err := s.db.QueryRow(ctx, `SELECT count(*) FROM refresh_tokens WHERE "userId" = $1`, userID).Scan(&n)
	return n, err
}
