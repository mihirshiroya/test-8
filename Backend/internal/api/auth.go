package api

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/lucsky/cuid"

	"productivity/internal/auth"
	"productivity/internal/compat"
	"productivity/internal/database"
	"productivity/internal/httpx"
	"productivity/internal/reqctx"
)

const (
	accessCookieMaxAge  = 15 * time.Minute
	refreshCookieMaxAge = 7 * 24 * time.Hour
	refreshTokenTTL     = 7 * 24 * time.Hour
	passwordResetTTL    = 10 * time.Minute
)

type cookieOptions struct {
	secure   bool
	sameSite http.SameSite
}

func (s *Server) defaultCookies() cookieOptions { return cookieOptions{secure: s.cfg.IsProduction()} }

func setCookie(w http.ResponseWriter, name, value string, maxAge time.Duration, o cookieOptions) {
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: value, Path: "/",
		MaxAge: int(maxAge.Seconds()), Expires: time.Now().Add(maxAge),
		HttpOnly: true, Secure: o.secure, SameSite: o.sameSite,
	})
}

func clearAuthCookies(w http.ResponseWriter) {
	for _, name := range []string{"accessToken", "refreshToken"} {
		http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: "/", Expires: time.Unix(0, 0), MaxAge: -1})
	}
}

type tokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

func subjectOf(u *User) auth.Subject {
	return auth.Subject{ID: u.ID, Email: u.Email, Role: u.Role, Provider: u.Provider, IsEmailVerified: u.IsEmailVerified}
}

func saveRefreshToken(ctx context.Context, q database.Querier, userID, token string) error {
	now := compat.Now()
	_, err := q.Exec(ctx,
		`INSERT INTO refresh_tokens (id, token, "userId", "expiresAt", "createdAt") VALUES ($1, $2, $3, $4, $5)`,
		cuid.New(), token, userID, now.Add(refreshTokenTTL), now)
	return err
}

// startSession issues tokens, stores the refresh token and sets cookies.
func (s *Server) startSession(ctx context.Context, w http.ResponseWriter, u *User, o cookieOptions) (*tokenPair, error) {
	access, refresh, err := s.tokens.Issue(subjectOf(u))
	if err != nil {
		return nil, err
	}
	if err := saveRefreshToken(ctx, s.db, u.ID, refresh); err != nil {
		return nil, err
	}
	setCookie(w, "accessToken", access, accessCookieMaxAge, o)
	setCookie(w, "refreshToken", refresh, refreshCookieMaxAge, o)
	return &tokenPair{AccessToken: access, RefreshToken: refresh}, nil
}

// refreshTokenFrom reads the cookie first, then the JSON body.
func refreshTokenFrom(r *http.Request) string {
	if c, err := r.Cookie("refreshToken"); err == nil && c.Value != "" {
		return c.Value
	}
	t, _ := httpx.BodyFrom(r).String("refreshToken")
	return t
}

func ptr[T any](v T) *T { return &v }

/* -------------------------------- handlers -------------------------------- */

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	body := httpx.BodyFrom(r)
	if validateRegister(body).respond(w) {
		return
	}
	email, _ := body.String("email")
	password, _ := body.String("password")
	firstName, _ := body.String("firstName")
	lastName, _ := body.String("lastName")
	ctx := r.Context()

	existing, err := findUser(ctx, s.db, byEmail, email)
	if err != nil {
		s.serverError(w, "Registration", err, "Registration failed")
		return
	}
	if existing != nil {
		httpx.Fail(w, http.StatusBadRequest, "User already exists with this email")
		return
	}

	hash, err := auth.HashPassword(password, s.cfg.BcryptRounds)
	if err != nil {
		s.serverError(w, "Registration", err, "Registration failed")
		return
	}
	verifyToken := auth.RandomHex(32)
	user, err := s.createUser(ctx, s.db, newUser{
		Email: email, Password: &hash, FirstName: firstName, LastName: lastName,
		Provider: "LOCAL", EmailVerificationToken: &verifyToken,
	})
	if database.IsUniqueViolation(err) {
		httpx.Fail(w, http.StatusBadRequest, "User already exists with this email")
		return
	}
	if err != nil {
		s.serverError(w, "Registration", err, "Registration failed")
		return
	}

	s.goBackground("send verification email", func(ctx context.Context) error {
		return s.mailer.SendVerification(ctx, email, firstName, verifyToken)
	})

	tokens, err := s.startSession(ctx, w, user, s.defaultCookies())
	if err != nil {
		s.serverError(w, "Registration", err, "Registration failed")
		return
	}
	httpx.JSON(w, http.StatusCreated, httpx.M{
		"success": true,
		"message": "User registered successfully. Please check your email for verification.",
		"data":    httpx.M{"user": user.Public(), "tokens": tokens},
	})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	body := httpx.BodyFrom(r)
	if validateLogin(body).respond(w) {
		return
	}
	email, _ := body.String("email")
	password, _ := body.String("password")
	ctx := r.Context()

	user, err := findUser(ctx, s.db, byEmail, email)
	if err != nil {
		s.serverError(w, "Login", err, "Login failed")
		return
	}
	if user == nil {
		httpx.Fail(w, http.StatusBadRequest, "Invalid credentials")
		return
	}
	if !user.IsActive {
		httpx.Fail(w, http.StatusBadRequest, "Account is deactivated")
		return
	}
	if user.Provider == "GOOGLE" && user.Password == nil {
		httpx.Fail(w, http.StatusBadRequest, "Please sign in with Google")
		return
	}
	if !auth.ComparePassword(user.Password, password) {
		httpx.Fail(w, http.StatusBadRequest, "Invalid credentials")
		return
	}

	if user, err = s.patchUser(ctx, s.db, user.ID, new(database.Sets).Add("lastLoginAt", compat.Now())); err != nil || user == nil {
		s.serverError(w, "Login", err, "Login failed")
		return
	}
	tokens, err := s.startSession(ctx, w, user, s.defaultCookies())
	if err != nil {
		s.serverError(w, "Login", err, "Login failed")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{
		"success": true,
		"message": "Login successful",
		"data":    httpx.M{"user": user.Public(), "tokens": tokens},
	})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if token := refreshTokenFrom(r); token != "" {
		if _, err := s.db.Exec(r.Context(), `DELETE FROM refresh_tokens WHERE token = $1`, token); err != nil {
			s.serverError(w, "Logout", err, "Logout failed")
			return
		}
	}
	clearAuthCookies(w)
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "Logout successful"})
}

func (s *Server) logoutAll(w http.ResponseWriter, r *http.Request) {
	if _, err := s.db.Exec(r.Context(), `DELETE FROM refresh_tokens WHERE "userId" = $1`, reqctx.UserID(r.Context())); err != nil {
		s.serverError(w, "Logout all", err, "Logout from all devices failed")
		return
	}
	clearAuthCookies(w)
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "Logged out from all devices"})
}

// refreshToken rotates the refresh token atomically: the old token is deleted
// and the new one stored in one transaction, so a token can be used once.
func (s *Server) refreshToken(w http.ResponseWriter, r *http.Request) {
	token := refreshTokenFrom(r)
	if token == "" {
		httpx.Fail(w, http.StatusNotFound, "Refresh token not found")
		return
	}
	if _, err := s.tokens.VerifyRefresh(token); err != nil {
		httpx.Fail(w, http.StatusNotFound, "Invalid refresh token")
		return
	}

	ctx := r.Context()
	var (
		user   *User
		tokens *tokenPair
		reject string
	)
	err := database.InTx(ctx, s.db, func(tx pgx.Tx) error {
		var userID string
		var expiresAt time.Time
		err := tx.QueryRow(ctx, `DELETE FROM refresh_tokens WHERE token = $1 RETURNING "userId", "expiresAt"`, token).Scan(&userID, &expiresAt)
		if database.IsNoRows(err) || (err == nil && expiresAt.Before(time.Now())) {
			reject = "Invalid or expired refresh token"
			return nil
		}
		if err != nil {
			return err
		}
		if user, err = findUser(ctx, tx, byID, userID); err != nil {
			return err
		}
		if user == nil {
			reject = "Invalid or expired refresh token"
			return nil
		}
		if !user.IsActive {
			reject = "Account is deactivated"
			return nil
		}
		access, refresh, err := s.tokens.Issue(subjectOf(user))
		if err != nil {
			return err
		}
		if err := saveRefreshToken(ctx, tx, user.ID, refresh); err != nil {
			return err
		}
		tokens = &tokenPair{AccessToken: access, RefreshToken: refresh}
		return nil
	})
	if err != nil {
		s.log.Error("refresh token error", "error", err)
		httpx.Fail(w, http.StatusUnauthorized, "Token refresh failed")
		return
	}
	if reject != "" {
		httpx.Fail(w, http.StatusUnauthorized, reject)
		return
	}

	o := s.defaultCookies()
	setCookie(w, "accessToken", tokens.AccessToken, accessCookieMaxAge, o)
	setCookie(w, "refreshToken", tokens.RefreshToken, refreshCookieMaxAge, o)
	httpx.JSON(w, http.StatusOK, httpx.M{
		"success": true,
		"message": "Token refreshed successfully",
		"data":    httpx.M{"tokens": tokens},
	})
}

func (s *Server) verifyEmail(w http.ResponseWriter, r *http.Request) {
	body := httpx.BodyFrom(r)
	if validateVerifyEmail(body).respond(w) {
		return
	}
	token, _ := body.String("token")
	ctx := r.Context()

	user, err := findUser(ctx, s.db, byVerifToken, token)
	if err != nil {
		s.serverError(w, "Email verification", err, "Email verification failed")
		return
	}
	if user == nil {
		httpx.Fail(w, http.StatusBadRequest, "Invalid verification token")
		return
	}
	if user.IsEmailVerified {
		httpx.JSON(w, http.StatusOK, httpx.M{
			"success": true, "message": "Email is already verified",
			"data": httpx.M{"user": user.Public()},
		})
		return
	}
	updated, err := s.patchUser(ctx, s.db, user.ID, new(database.Sets).
		Add("isEmailVerified", true).Add("emailVerifiedAt", compat.Now()))
	if err != nil || updated == nil {
		s.serverError(w, "Email verification", err, "Email verification failed")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{
		"success": true, "message": "Email verified successfully",
		"data": httpx.M{"user": updated.Public()},
	})
}

func (s *Server) resendVerification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, err := findUser(ctx, s.db, byID, reqctx.UserID(ctx))
	if err != nil || user == nil {
		s.serverError(w, "Resend verification email", err, "Failed to send verification email")
		return
	}
	if user.IsEmailVerified {
		httpx.Fail(w, http.StatusBadRequest, "Email is already verified")
		return
	}
	token := auth.RandomHex(32)
	if _, err := s.patchUser(ctx, s.db, user.ID, new(database.Sets).Add("emailVerificationToken", token)); err != nil {
		s.serverError(w, "Resend verification email", err, "Failed to send verification email")
		return
	}
	email, firstName := user.Email, user.FirstName
	s.goBackground("resend verification email", func(ctx context.Context) error {
		return s.mailer.SendVerification(ctx, email, firstName, token)
	})
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "Verification email sent successfully"})
}

func (s *Server) forgotPassword(w http.ResponseWriter, r *http.Request) {
	body := httpx.BodyFrom(r)
	if validateForgotPassword(body).respond(w) {
		return
	}
	email, _ := body.String("email")
	ctx := r.Context()
	const genericOK = "If an account with that email exists, a password reset link has been sent"

	user, err := findUser(ctx, s.db, byEmail, email)
	if err != nil {
		s.serverError(w, "Forgot password", err, "Failed to process password reset request")
		return
	}
	if user == nil {
		httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": genericOK})
		return
	}
	if user.Provider == "GOOGLE" && user.Password == nil {
		httpx.Fail(w, http.StatusBadRequest, "This account uses Google sign-in. Please sign in with Google.")
		return
	}

	token := auth.RandomHex(32)
	if _, err := s.patchUser(ctx, s.db, user.ID, new(database.Sets).
		Add("passwordResetToken", token).Add("passwordResetExpires", compat.Now().Add(passwordResetTTL))); err != nil {
		s.serverError(w, "Forgot password", err, "Failed to process password reset request")
		return
	}
	if err := s.mailer.SendPasswordReset(ctx, user.Email, user.FirstName, token); err != nil {
		s.serverError(w, "Forgot password", err, "Failed to process password reset request")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": genericOK})
}

func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request) {
	body := httpx.BodyFrom(r)
	token, _ := body.String("token")
	password, _ := body.String("password")
	ctx := r.Context()

	if token == "" {
		httpx.Fail(w, http.StatusBadRequest, "Invalid or expired reset token")
		return
	}
	if password == "" {
		httpx.Fail(w, http.StatusBadRequest, "Password is required")
		return
	}

	user, err := scanUser(s.db.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE "passwordResetToken" = $1 AND "passwordResetExpires" > $2 LIMIT 1`,
		token, compat.Now()))
	if err != nil {
		s.serverError(w, "Reset password", err, "Password reset failed")
		return
	}
	if user == nil {
		httpx.Fail(w, http.StatusBadRequest, "Invalid or expired reset token")
		return
	}
	hash, err := auth.HashPassword(password, s.cfg.BcryptRounds)
	if err != nil {
		s.serverError(w, "Reset password", err, "Password reset failed")
		return
	}
	err = database.InTx(ctx, s.db, func(tx pgx.Tx) error {
		if _, err := s.patchUser(ctx, tx, user.ID, new(database.Sets).
			Add("password", hash).Add("passwordResetToken", nil).Add("passwordResetExpires", nil)); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM refresh_tokens WHERE "userId" = $1`, user.ID)
		return err
	})
	if err != nil {
		s.serverError(w, "Reset password", err, "Password reset failed")
		return
	}
	s.cache.InvalidateUser(ctx, user.ID)
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "Password reset successful"})
}

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	body := httpx.BodyFrom(r)
	current, _ := body.String("currentPassword")
	next, _ := body.String("newPassword")
	ctx := r.Context()
	userID := reqctx.UserID(ctx)

	user, err := findUser(ctx, s.db, byID, userID)
	if err != nil || user == nil {
		s.serverError(w, "Change password", err, "Password change failed")
		return
	}
	if !auth.ComparePassword(user.Password, current) {
		httpx.Fail(w, http.StatusBadRequest, "Current password is incorrect")
		return
	}
	if next == "" {
		httpx.Fail(w, http.StatusBadRequest, "New password is required")
		return
	}
	hash, err := auth.HashPassword(next, s.cfg.BcryptRounds)
	if err != nil {
		s.serverError(w, "Change password", err, "Password change failed")
		return
	}

	currentRefresh := ""
	if c, err := r.Cookie("refreshToken"); err == nil {
		currentRefresh = c.Value
	}
	err = database.InTx(ctx, s.db, func(tx pgx.Tx) error {
		if _, err := s.patchUser(ctx, tx, userID, new(database.Sets).Add("password", hash)); err != nil {
			return err
		}
		// Sign out every other device; keep the session making this request.
		_, err := tx.Exec(ctx, `DELETE FROM refresh_tokens WHERE "userId" = $1 AND ($2 = '' OR token <> $2)`, userID, currentRefresh)
		return err
	})
	if err != nil {
		s.serverError(w, "Change password", err, "Password change failed")
		return
	}
	s.cache.InvalidateUser(ctx, userID)
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "Password changed successfully"})
}

func (s *Server) getProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, err := findUser(ctx, s.db, byID, reqctx.UserID(ctx))
	if err != nil || user == nil {
		s.serverError(w, "Get profile", err, "Failed to fetch profile")
		return
	}
	devices, err := s.countRefreshTokens(ctx, user.ID)
	if err != nil {
		s.serverError(w, "Get profile", err, "Failed to fetch profile")
		return
	}
	pub := user.Public()
	pub.Count = &userCount{RefreshTokens: devices}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{"user": pub, "activeDevices": devices}})
}

func (s *Server) updateProfile(w http.ResponseWriter, r *http.Request) {
	body := httpx.BodyFrom(r)
	if validateUpdateProfile(body).respond(w) {
		return
	}
	ctx := r.Context()
	me := reqctx.User(ctx)
	sets := new(database.Sets)

	if v := body.Trim("firstName"); v != "" {
		sets.Add("firstName", v)
	}
	if v := body.Trim("lastName"); v != "" {
		sets.Add("lastName", v)
	}
	if v, ok := body.String("pfpFrame"); ok {
		sets.Add("pfpFrame", v)
	}
	email, _ := body.String("email")
	emailChanged := email != "" && email != me.Email
	var verifyToken string
	if emailChanged {
		existing, err := findUser(ctx, s.db, byEmail, email)
		if err != nil {
			s.serverError(w, "Update profile", err, "Profile update failed")
			return
		}
		if existing != nil {
			httpx.Fail(w, http.StatusBadRequest, "Email already in use")
			return
		}
		verifyToken = auth.RandomHex(32)
		sets.Add("email", email).Add("isEmailVerified", false).
			Add("emailVerificationToken", verifyToken).Add("emailVerifiedAt", nil)
	}

	updated, err := s.patchUser(ctx, s.db, me.ID, sets)
	if database.IsUniqueViolation(err) {
		httpx.Fail(w, http.StatusBadRequest, "Email already in use")
		return
	}
	if err != nil || updated == nil {
		s.serverError(w, "Update profile", err, "Profile update failed")
		return
	}

	message := "Profile updated successfully"
	if emailChanged {
		message = "Profile updated successfully. Please verify your new email address."
		firstName := updated.FirstName
		s.goBackground("send verification email", func(ctx context.Context) error {
			return s.mailer.SendVerification(ctx, email, firstName, verifyToken)
		})
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": message, "data": httpx.M{"user": updated.Public()}})
}
