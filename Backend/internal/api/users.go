package api

import (
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"productivity/internal/auth"
	"productivity/internal/compat"
	"productivity/internal/database"
	"productivity/internal/httpx"
	"productivity/internal/reqctx"
)

var validRoles = map[string]bool{"USER": true, "ADMIN": true, "MODERATOR": true}

type listedUser struct {
	ID              string          `json:"id"`
	Email           string          `json:"email"`
	FirstName       string          `json:"firstName"`
	LastName        string          `json:"lastName"`
	Role            string          `json:"role"`
	Provider        string          `json:"provider"`
	IsEmailVerified bool            `json:"isEmailVerified"`
	IsActive        bool            `json:"isActive"`
	Avatar          *string         `json:"avatar"`
	LastLoginAt     *compat.ISOTime `json:"lastLoginAt"`
	CreatedAt       compat.ISOTime  `json:"createdAt"`
	UpdatedAt       compat.ISOTime  `json:"updatedAt"`
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func queryInt(r *http.Request, key string, fallback, min, max int) int {
	v, ok := compat.ParseIntString(r.URL.Query().Get(key))
	if !ok || int(v) < min {
		return fallback
	}
	if int(v) > max {
		return max
	}
	return int(v)
}

// GET /api/users (admin)
func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page := queryInt(r, "page", 1, 1, math.MaxInt32)
	limit := queryInt(r, "limit", 10, 1, 100)

	var where []string
	var args []any
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, strings.ReplaceAll(cond, "$?", "$"+itoa(len(args))))
	}
	if search := q.Get("search"); search != "" {
		add(`("firstName" ILIKE $? OR "lastName" ILIKE $? OR email ILIKE $?)`, "%"+escapeLike(search)+"%")
	}
	if role := q.Get("role"); role != "" {
		add(`role::text = $?`, role)
	}
	if provider := q.Get("provider"); provider != "" {
		add(`provider::text = $?`, provider)
	}
	if q.Has("verified") {
		add(`"isEmailVerified" = $?`, q.Get("verified") == "true")
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}
	ctx := r.Context()

	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM users`+whereSQL, args...).Scan(&total); err != nil {
		s.serverError(w, "Get all users", err, "Failed to fetch users")
		return
	}
	pageArgs := append(append([]any(nil), args...), limit, (page-1)*limit)
	rows, err := s.db.Query(ctx, `
		SELECT id, email, "firstName", "lastName", role::text, provider::text, "isEmailVerified", "isActive",
			avatar, "lastLoginAt", "createdAt", "updatedAt"
		FROM users`+whereSQL+` ORDER BY "createdAt" DESC
		LIMIT $`+itoa(len(args)+1)+` OFFSET $`+itoa(len(args)+2), pageArgs...)
	if err != nil {
		s.serverError(w, "Get all users", err, "Failed to fetch users")
		return
	}
	users, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (listedUser, error) {
		var u listedUser
		var last *time.Time
		var created, updated time.Time
		err := row.Scan(&u.ID, &u.Email, &u.FirstName, &u.LastName, &u.Role, &u.Provider, &u.IsEmailVerified,
			&u.IsActive, &u.Avatar, &last, &created, &updated)
		u.LastLoginAt, u.CreatedAt, u.UpdatedAt = compat.ISOPtr(last), compat.ISO(created), compat.ISO(updated)
		return u, err
	})
	if err != nil {
		s.serverError(w, "Get all users", err, "Failed to fetch users")
		return
	}
	if users == nil {
		users = []listedUser{}
	}

	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{
		"users": users,
		"pagination": httpx.M{
			"currentPage": page,
			"totalPages":  int(math.Ceil(float64(total) / float64(limit))),
			"totalCount":  total,
			"limit":       limit,
		},
	}})
}

func canAccessUser(me *reqctx.AuthUser, id string) bool { return me.ID == id || me.Role == "ADMIN" }

// GET /api/users/:id
func (s *Server) getUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := urlParam(r, "id")
	if !canAccessUser(reqctx.User(ctx), id) {
		httpx.Fail(w, http.StatusForbidden, "Access denied")
		return
	}
	user, err := findUser(ctx, s.db, byID, id)
	if err != nil {
		s.serverError(w, "Get user by ID", err, "Failed to fetch user")
		return
	}
	if user == nil {
		httpx.Fail(w, http.StatusNotFound, "User not found")
		return
	}
	devices, err := s.countRefreshTokens(ctx, id)
	if err != nil {
		s.serverError(w, "Get user by ID", err, "Failed to fetch user")
		return
	}
	pub := user.Public()
	pub.Count = &userCount{RefreshTokens: devices}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{"user": pub, "activeDevices": devices}})
}

// PUT /api/users/:id
func (s *Server) updateUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := urlParam(r, "id")
	me := reqctx.User(ctx)
	body := httpx.BodyFrom(r)
	if !canAccessUser(me, id) {
		httpx.Fail(w, http.StatusForbidden, "Access denied")
		return
	}
	user, err := findUser(ctx, s.db, byID, id)
	if err != nil {
		s.serverError(w, "Update user", err, "Failed to update user")
		return
	}
	if user == nil {
		httpx.Fail(w, http.StatusNotFound, "User not found")
		return
	}

	sets := new(database.Sets)
	if v, _ := body.String("firstName"); v != "" {
		sets.Add("firstName", v)
	}
	if v, _ := body.String("lastName"); v != "" {
		sets.Add("lastName", v)
	}
	email, _ := body.String("email")

	if me.Role != "ADMIN" {
		if v, ok := body.String("pfpFrame"); ok {
			sets.Add("pfpFrame", v)
		}
		if email != "" && email != user.Email {
			existing, err := findUser(ctx, s.db, byEmail, email)
			if err != nil {
				s.serverError(w, "Update user", err, "Failed to update user")
				return
			}
			if existing != nil {
				httpx.Fail(w, http.StatusBadRequest, "Email already in use")
				return
			}
			sets.Add("email", email).Add("isEmailVerified", false).
				Add("emailVerificationToken", auth.RandomHex(32)).Add("emailVerifiedAt", nil)
		}
	} else {
		if email != "" {
			sets.Add("email", email)
		}
		if role, _ := body.String("role"); role != "" {
			if !validRoles[role] {
				httpx.Fail(w, http.StatusBadRequest, "Invalid role")
				return
			}
			sets.AddEnum("role", "UserRole", role)
		}
		if body.Has("isActive") {
			active, ok := body.Bool("isActive")
			if !ok {
				httpx.Fail(w, http.StatusBadRequest, "isActive must be a boolean")
				return
			}
			if me.ID == id && !active {
				httpx.Fail(w, http.StatusBadRequest, "You cannot deactivate your own account")
				return
			}
			sets.Add("isActive", active)
		}
	}

	updated, err := s.patchUser(ctx, s.db, id, sets)
	if database.IsUniqueViolation(err) {
		httpx.Fail(w, http.StatusBadRequest, "Email already in use")
		return
	}
	if err != nil || updated == nil {
		s.serverError(w, "Update user", err, "Failed to update user")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "User updated successfully", "data": httpx.M{"user": updated.Public()}})
}

// DELETE /api/users/:id
func (s *Server) deleteUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := urlParam(r, "id")
	me := reqctx.User(ctx)
	if !canAccessUser(me, id) {
		httpx.Fail(w, http.StatusForbidden, "Access denied")
		return
	}
	if me.ID == id && me.Role == "ADMIN" {
		httpx.Fail(w, http.StatusBadRequest, "You cannot delete your own admin account")
		return
	}
	user, err := findUser(ctx, s.db, byID, id)
	if err != nil {
		s.serverError(w, "Delete user", err, "Failed to delete user")
		return
	}
	if user == nil {
		httpx.Fail(w, http.StatusNotFound, "User not found")
		return
	}
	if err := s.deleteUserRow(ctx, id); err != nil {
		s.serverError(w, "Delete user", err, "Failed to delete user")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "User deleted successfully"})
}

// PATCH /api/users/:id/deactivate (admin)
func (s *Server) deactivateUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := urlParam(r, "id")
	if reqctx.UserID(ctx) == id {
		httpx.Fail(w, http.StatusBadRequest, "You cannot deactivate your own account")
		return
	}
	var updated *User
	err := database.InTx(ctx, s.db, func(tx pgx.Tx) error {
		var err error
		if updated, err = s.patchUser(ctx, tx, id, new(database.Sets).Add("isActive", false)); err != nil || updated == nil {
			return err
		}
		_, err = tx.Exec(ctx, `DELETE FROM refresh_tokens WHERE "userId" = $1`, id)
		return err
	})
	if err != nil {
		s.serverError(w, "Deactivate user", err, "Failed to deactivate user")
		return
	}
	if updated == nil {
		httpx.Fail(w, http.StatusNotFound, "User not found")
		return
	}
	s.cache.InvalidateUser(ctx, id)
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "User deactivated successfully", "data": httpx.M{"user": updated.Public()}})
}

// PATCH /api/users/:id/activate (admin)
func (s *Server) activateUser(w http.ResponseWriter, r *http.Request) {
	updated, err := s.patchUser(r.Context(), s.db, urlParam(r, "id"), new(database.Sets).Add("isActive", true))
	if err != nil {
		s.serverError(w, "Activate user", err, "Failed to activate user")
		return
	}
	if updated == nil {
		httpx.Fail(w, http.StatusNotFound, "User not found")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "User activated successfully", "data": httpx.M{"user": updated.Public()}})
}

// PATCH /api/users/:id/role (admin)
func (s *Server) updateUserRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := urlParam(r, "id")
	if reqctx.UserID(ctx) == id {
		httpx.Fail(w, http.StatusBadRequest, "You cannot change your own role")
		return
	}
	role, _ := httpx.BodyFrom(r).String("role")
	if !validRoles[role] {
		httpx.Fail(w, http.StatusBadRequest, "Invalid role")
		return
	}
	updated, err := s.patchUser(ctx, s.db, id, new(database.Sets).AddEnum("role", "UserRole", role))
	if err != nil {
		s.serverError(w, "Update user role", err, "Failed to update user role")
		return
	}
	if updated == nil {
		httpx.Fail(w, http.StatusNotFound, "User not found")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "User role updated successfully", "data": httpx.M{"user": updated.Public()}})
}

// GET /api/users/stats (admin)
func (s *Server) userStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var total, active, verified, recent int
	err := s.db.QueryRow(ctx, `
		SELECT count(*),
			count(*) FILTER (WHERE "isActive"),
			count(*) FILTER (WHERE "isEmailVerified"),
			count(*) FILTER (WHERE "createdAt" >= $1)
		FROM users`, compat.Now().Add(-7*24*time.Hour)).Scan(&total, &active, &verified, &recent)
	if err != nil {
		s.serverError(w, "Get user stats", err, "Failed to fetch user statistics")
		return
	}
	rows, err := s.db.Query(ctx, `
		SELECT count(*), role::text, provider::text, "isEmailVerified", "isActive"
		FROM users GROUP BY role, provider, "isEmailVerified", "isActive"`)
	if err != nil {
		s.serverError(w, "Get user stats", err, "Failed to fetch user statistics")
		return
	}
	type group struct {
		Count           int    `json:"_count"`
		Role            string `json:"role"`
		Provider        string `json:"provider"`
		IsEmailVerified bool   `json:"isEmailVerified"`
		IsActive        bool   `json:"isActive"`
	}
	breakdown, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (group, error) {
		var g group
		return g, row.Scan(&g.Count, &g.Role, &g.Provider, &g.IsEmailVerified, &g.IsActive)
	})
	if err != nil {
		s.serverError(w, "Get user stats", err, "Failed to fetch user statistics")
		return
	}
	if breakdown == nil {
		breakdown = []group{}
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{
		"totalUsers": total, "activeUsers": active, "verifiedUsers": verified, "recentUsers": recent,
		"breakdown": breakdown,
	}})
}

// GET /api/users/me/sessions
func (s *Server) getActiveSessions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := s.db.Query(ctx,
		`SELECT id, "createdAt", "expiresAt" FROM refresh_tokens WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
		reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, "Get active sessions", err, "Failed to fetch active sessions")
		return
	}
	type session struct {
		ID        string         `json:"id"`
		CreatedAt compat.ISOTime `json:"createdAt"`
		ExpiresAt compat.ISOTime `json:"expiresAt"`
		IsExpired bool           `json:"isExpired"`
	}
	now := time.Now()
	sessions, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (session, error) {
		var id string
		var created, expires time.Time
		err := row.Scan(&id, &created, &expires)
		return session{ID: id, CreatedAt: compat.ISO(created), ExpiresAt: compat.ISO(expires), IsExpired: expires.Before(now)}, err
	})
	if err != nil {
		s.serverError(w, "Get active sessions", err, "Failed to fetch active sessions")
		return
	}
	if sessions == nil {
		sessions = []session{}
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{"sessions": sessions}})
}

// DELETE /api/users/me/sessions/:sessionId
func (s *Server) revokeSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tag, err := s.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE id = $1 AND "userId" = $2`,
		urlParam(r, "sessionId"), reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, "Revoke session", err, "Failed to revoke session")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Fail(w, http.StatusNotFound, "Session not found")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "Session revoked successfully"})
}
