package api

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/oauth2"

	"productivity/internal/auth"
	"productivity/internal/compat"
	"productivity/internal/database"
	"productivity/internal/httpx"
	"productivity/internal/reqctx"
)

// GoogleProfile is the identity returned by Google's userinfo / tokeninfo APIs.
type GoogleProfile struct {
	Sub        string `json:"sub"`
	Email      string `json:"email"`
	GivenName  string `json:"given_name"`
	FamilyName string `json:"family_name"`
	Picture    string `json:"picture"`
}

// GoogleClient talks to Google; tests replace it with a fake.
type GoogleClient interface {
	// UserInfo fetches the profile for an OAuth access token.
	UserInfo(ctx context.Context, src oauth2.TokenSource) (*GoogleProfile, error)
	// VerifyToken validates an ID token or access token sent by a client.
	VerifyToken(ctx context.Context, token string) (*GoogleProfile, error)
}

type googleHTTPClient struct {
	clientID string
	http     *http.Client
}

func newGoogleHTTPClient(clientID string) *googleHTTPClient {
	return &googleHTTPClient{clientID: clientID, http: &http.Client{Timeout: 10 * time.Second}}
}

func (g *googleHTTPClient) getJSON(ctx context.Context, client *http.Client, endpoint string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1<<16))
		return fmt.Errorf("google %s: status %d", endpoint, res.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(dst)
}

func (g *googleHTTPClient) UserInfo(ctx context.Context, src oauth2.TokenSource) (*GoogleProfile, error) {
	client := oauth2.NewClient(context.WithValue(ctx, oauth2.HTTPClient, g.http), src)
	var p GoogleProfile
	if err := g.getJSON(ctx, client, "https://www.googleapis.com/oauth2/v3/userinfo", &p); err != nil {
		return nil, err
	}
	if p.Sub == "" || p.Email == "" {
		return nil, errors.New("google profile missing id or email")
	}
	return &p, nil
}

func (g *googleHTTPClient) VerifyToken(ctx context.Context, token string) (*GoogleProfile, error) {
	// ID tokens (JWTs) are validated by Google's tokeninfo endpoint, which also
	// checks signature and expiry; we additionally enforce the audience.
	if strings.Count(token, ".") == 2 {
		var info struct {
			GoogleProfile
			Aud           string `json:"aud"`
			EmailVerified string `json:"email_verified"`
		}
		if err := g.getJSON(ctx, g.http, "https://oauth2.googleapis.com/tokeninfo?id_token="+url.QueryEscape(token), &info); err != nil {
			return nil, err
		}
		if g.clientID != "" && info.Aud != g.clientID {
			return nil, errors.New("google token audience mismatch")
		}
		if info.EmailVerified != "true" {
			return nil, errors.New("google email not verified")
		}
		return &info.GoogleProfile, nil
	}
	return g.UserInfo(ctx, oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token, TokenType: "Bearer"}))
}

const oauthStateCookie = "oauth_state"

func (s *Server) googleErrorRedirect(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, s.cfg.ClientURL+"/auth/error?message="+url.QueryEscape("Authentication failed"), http.StatusFound)
}

// googleAuth starts the OAuth redirect flow. A random state is bound to the
// browser via a short-lived cookie to prevent login CSRF.
func (s *Server) googleAuth(w http.ResponseWriter, r *http.Request) {
	if s.google == nil {
		s.log.Error("google oauth requested but GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL are not configured")
		s.googleErrorRedirect(w, r)
		return
	}
	state := auth.RandomHex(16)
	http.SetCookie(w, &http.Cookie{
		Name: oauthStateCookie, Value: state, Path: "/api/auth/google",
		MaxAge: 600, HttpOnly: true, Secure: s.cfg.IsProduction(), SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, s.google.AuthCodeURL(state), http.StatusFound)
}

func (s *Server) googleCallback(w http.ResponseWriter, r *http.Request) {
	if s.google == nil {
		s.googleErrorRedirect(w, r)
		return
	}
	ctx := r.Context()
	q := r.URL.Query()
	stateCookie, err := r.Cookie(oauthStateCookie)
	http.SetCookie(w, &http.Cookie{Name: oauthStateCookie, Value: "", Path: "/api/auth/google", MaxAge: -1})
	if err != nil || stateCookie.Value == "" || subtle.ConstantTimeCompare([]byte(stateCookie.Value), []byte(q.Get("state"))) != 1 {
		s.log.Warn("google oauth state mismatch")
		s.googleErrorRedirect(w, r)
		return
	}
	if q.Get("error") != "" || q.Get("code") == "" {
		s.googleErrorRedirect(w, r)
		return
	}

	exCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	tok, err := s.google.Exchange(exCtx, q.Get("code"))
	if err != nil {
		s.log.Error("google oauth exchange", "error", err)
		s.googleErrorRedirect(w, r)
		return
	}
	profile, err := s.googleClient.UserInfo(exCtx, s.google.TokenSource(exCtx, tok))
	if err != nil {
		s.log.Error("google oauth profile", "error", err)
		s.googleErrorRedirect(w, r)
		return
	}

	user, err := s.upsertGoogleUser(ctx, profile)
	if err != nil {
		s.log.Error("google oauth upsert", "error", err)
		s.googleErrorRedirect(w, r)
		return
	}
	if !user.IsActive {
		s.googleErrorRedirect(w, r)
		return
	}
	if _, err := s.startSession(ctx, w, user, cookieOptions{secure: false, sameSite: http.SameSiteLaxMode}); err != nil {
		s.log.Error("google callback session", "error", err)
		s.googleErrorRedirect(w, r)
		return
	}
	http.Redirect(w, r, s.cfg.ClientURL+"/auth/success", http.StatusFound)
}

// upsertGoogleUser mirrors the Passport Google strategy: match by googleId,
// then link by email, otherwise create a new verified user.
func (s *Server) upsertGoogleUser(ctx context.Context, p *GoogleProfile) (*User, error) {
	var user *User
	err := database.InTx(ctx, s.db, func(tx pgx.Tx) error {
		now := compat.Now()
		existing, err := findUser(ctx, tx, byGoogleID, p.Sub)
		if err != nil {
			return err
		}
		if existing != nil {
			sets := new(database.Sets).Add("lastLoginAt", now)
			if p.Picture != "" {
				sets.Add("avatar", p.Picture)
			}
			user, err = s.patchUser(ctx, tx, existing.ID, sets)
			return err
		}
		if existing, err = findUser(ctx, tx, byEmail, p.Email); err != nil {
			return err
		}
		if existing != nil {
			sets := new(database.Sets).Add("googleId", p.Sub).AddEnum("provider", "AuthProvider", "GOOGLE").
				Add("isEmailVerified", true).Add("emailVerifiedAt", now).Add("lastLoginAt", now)
			if p.Picture != "" {
				sets.Add("avatar", p.Picture)
			}
			user, err = s.patchUser(ctx, tx, existing.ID, sets)
			return err
		}
		var avatar *string
		if p.Picture != "" {
			avatar = &p.Picture
		}
		user, err = s.createUser(ctx, tx, newUser{
			Email: p.Email, GoogleID: &p.Sub, FirstName: p.GivenName, LastName: p.FamilyName,
			Provider: "GOOGLE", IsEmailVerified: true, EmailVerifiedAt: &now, LastLoginAt: &now, Avatar: avatar,
		})
		return err
	})
	if err == nil && user == nil {
		err = errors.New("google user upsert returned no row")
	}
	return user, err
}

// googleRegisterLogin signs in with Google credentials obtained client-side.
// The Node version trusted googleId/email from the request body, which let
// anyone sign in as any user; the token is now verified with Google and must
// match the claimed identity.
func (s *Server) googleRegisterLogin(w http.ResponseWriter, r *http.Request) {
	body := httpx.BodyFrom(r)
	googleToken, _ := body.String("googleToken")
	googleID, _ := body.String("googleId")
	email, _ := body.String("email")
	if googleToken == "" || googleID == "" || email == "" {
		httpx.Fail(w, http.StatusBadRequest, "Google authentication data is required")
		return
	}
	ctx := r.Context()

	profile, err := s.googleClient.VerifyToken(ctx, googleToken)
	if err != nil || profile.Sub != googleID || !strings.EqualFold(profile.Email, email) {
		if err != nil {
			s.log.Warn("google token verification failed", "error", err)
		}
		httpx.Fail(w, http.StatusUnauthorized, "Invalid Google credentials")
		return
	}

	firstName, _ := body.String("firstName")
	lastName, _ := body.String("lastName")
	avatar, _ := body.String("avatar")

	var user *User
	isNew := false
	err = database.InTx(ctx, s.db, func(tx pgx.Tx) error {
		now := compat.Now()
		var err error
		if user, err = findUser(ctx, tx, byGoogleID, googleID); err != nil {
			return err
		}
		if user == nil {
			if user, err = findUser(ctx, tx, byEmail, email); err != nil {
				return err
			}
		}
		switch {
		case user == nil:
			var av *string
			if avatar != "" {
				av = &avatar
			}
			isNew = true
			user, err = s.createUser(ctx, tx, newUser{
				Email: email, FirstName: firstName, LastName: lastName, GoogleID: &googleID,
				Provider: "GOOGLE", IsEmailVerified: true, EmailVerifiedAt: &now, LastLoginAt: &now, Avatar: av,
			})
		case user.GoogleID == nil:
			verifiedAt := now
			if user.EmailVerifiedAt != nil {
				verifiedAt = *user.EmailVerifiedAt
			}
			sets := new(database.Sets).Add("googleId", googleID).Add("isEmailVerified", true).
				Add("emailVerifiedAt", verifiedAt).Add("emailVerificationToken", nil).Add("lastLoginAt", now)
			if avatar != "" {
				sets.Add("avatar", avatar)
			}
			user, err = s.patchUser(ctx, tx, user.ID, sets)
		default:
			sets := new(database.Sets).Add("lastLoginAt", now)
			if avatar != "" {
				sets.Add("avatar", avatar)
			}
			user, err = s.patchUser(ctx, tx, user.ID, sets)
		}
		return err
	})
	if err != nil || user == nil {
		s.serverError(w, "Google register/login", err, "Google authentication failed")
		return
	}
	if !user.IsActive {
		httpx.Fail(w, http.StatusBadRequest, "Account is deactivated")
		return
	}

	tokens, err := s.startSession(ctx, w, user, s.defaultCookies())
	if err != nil {
		s.serverError(w, "Google register/login", err, "Google authentication failed")
		return
	}
	status, message := http.StatusOK, "Login successful"
	if isNew {
		status, message = http.StatusCreated, "User registered successfully with Google"
	}
	httpx.JSON(w, status, httpx.M{
		"success": true, "message": message,
		"data": httpx.M{"user": user.Public(), "tokens": tokens, "isNewUser": isNew},
	})
}

func (s *Server) linkGoogle(w http.ResponseWriter, r *http.Request) {
	body := httpx.BodyFrom(r)
	googleID, _ := body.String("googleId")
	googleEmail, _ := body.String("googleEmail")
	if googleID == "" {
		httpx.Fail(w, http.StatusBadRequest, "googleId is required")
		return
	}
	ctx := r.Context()
	me := reqctx.User(ctx)

	existing, err := findUser(ctx, s.db, byGoogleID, googleID)
	if err != nil {
		s.serverError(w, "Link Google", err, "Failed to link Google account")
		return
	}
	if existing != nil && existing.ID != me.ID {
		httpx.Fail(w, http.StatusBadRequest, "This Google account is already linked to another account")
		return
	}
	sets := new(database.Sets).Add("googleId", googleID)
	if me.Email == googleEmail && !me.IsEmailVerified {
		sets.Add("isEmailVerified", true).Add("emailVerifiedAt", compat.Now()).Add("emailVerificationToken", nil)
	}
	updated, err := s.patchUser(ctx, s.db, me.ID, sets)
	if database.IsUniqueViolation(err) {
		httpx.Fail(w, http.StatusBadRequest, "This Google account is already linked to another account")
		return
	}
	if err != nil || updated == nil {
		s.serverError(w, "Link Google", err, "Failed to link Google account")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{
		"success": true, "message": "Google account linked successfully",
		"data": httpx.M{"user": updated.Public()},
	})
}

func (s *Server) unlinkGoogle(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, err := findUser(ctx, s.db, byID, reqctx.UserID(ctx))
	if err != nil || user == nil {
		s.serverError(w, "Unlink Google", err, "Failed to unlink Google account")
		return
	}
	if user.Password == nil && user.Provider == "GOOGLE" {
		httpx.Fail(w, http.StatusBadRequest, "Cannot unlink Google account. Please set a password first to maintain account access.")
		return
	}
	sets := new(database.Sets).Add("googleId", nil)
	if user.Provider == "GOOGLE" {
		sets.AddEnum("provider", "AuthProvider", "LOCAL")
	}
	updated, err := s.patchUser(ctx, s.db, user.ID, sets)
	if err != nil || updated == nil {
		s.serverError(w, "Unlink Google", err, "Failed to unlink Google account")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{
		"success": true, "message": "Google account unlinked successfully",
		"data": httpx.M{"user": updated.Public()},
	})
}

func (s *Server) googleStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, err := findUser(ctx, s.db, byID, reqctx.UserID(ctx))
	if err != nil || user == nil {
		s.serverError(w, "Get Google auth status", err, "Failed to get Google auth status")
		return
	}
	hasPassword := user.Password != nil && *user.Password != ""
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{
		"isLinked":    user.GoogleID != nil && *user.GoogleID != "",
		"provider":    user.Provider,
		"hasPassword": hasPassword,
		"canUnlink":   hasPassword || user.Provider != "GOOGLE",
	}})
}
