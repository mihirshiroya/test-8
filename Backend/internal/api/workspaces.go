package api

import (
	"context"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"productivity/internal/compat"
	"productivity/internal/database"
	"productivity/internal/httpx"
	"productivity/internal/reqctx"
)

const maxWorkspaceName = 100

// tint / icon are frontend keys validated by shape only, so new keys can be
// added on the frontend without a backend change.
var appearanceKey = regexp.MustCompile(`(?i)^[a-z0-9_-]{1,30}$`)

type workspaceJSON struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Tint        string  `json:"tint"`
	Icon        string  `json:"icon"`
	CreatedAt   int64   `json:"createdAt"`
	UpdatedAt   int64   `json:"updatedAt"`
}

const workspaceColumns = `id, name, description, tint, icon, "createdAt", "updatedAt"`

func scanWorkspace(row pgx.Row) (*workspaceJSON, error) {
	var w workspaceJSON
	var created, updated time.Time
	err := row.Scan(&w.ID, &w.Name, &w.Description, &w.Tint, &w.Icon, &created, &updated)
	if database.IsNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	w.CreatedAt, w.UpdatedAt = ms(created), ms(updated)
	return &w, nil
}

func findOwnedWorkspace(ctx context.Context, q database.Querier, id, userID string) (*workspaceJSON, error) {
	return scanWorkspace(q.QueryRow(ctx,
		`SELECT `+workspaceColumns+` FROM workspaces WHERE id = $1 AND "userId" = $2`, id, userID))
}

func listWorkspaces(ctx context.Context, q database.Querier, userID string) ([]workspaceJSON, error) {
	rows, err := q.Query(ctx, `SELECT `+workspaceColumns+` FROM workspaces WHERE "userId" = $1 ORDER BY name ASC`, userID)
	if err != nil {
		return nil, err
	}
	out := []workspaceJSON{}
	for rows.Next() {
		w, err := scanWorkspace(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, *w)
	}
	return out, rows.Err()
}

// parseAppearance returns (value, provided, errMessage).
func parseAppearance(b httpx.Body, key, label string) (string, bool, string) {
	if !b.Has(key) {
		return "", false, ""
	}
	v := cleanString(b.Raw(key))
	if !appearanceKey.MatchString(v) {
		return "", false, label + " is invalid"
	}
	return v, true, ""
}

func workspaceNameError(name string, empty string) string {
	if name == "" {
		return empty
	}
	if jsLength(name) > maxWorkspaceName {
		return "Name must be at most " + strconv.Itoa(maxWorkspaceName) + " characters"
	}
	return ""
}

// GET /api/workspaces
func (s *Server) getWorkspaces(w http.ResponseWriter, r *http.Request) {
	list, err := listWorkspaces(r.Context(), s.db, reqctx.UserID(r.Context()))
	if err != nil {
		s.serverError(w, "Get workspaces", err, "Failed to fetch workspaces")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{"workspaces": list}})
}

// GET /api/workspaces/{workspaceId}
func (s *Server) getWorkspace(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ws, err := findOwnedWorkspace(ctx, s.db, urlParam(r, "workspaceId"), reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, "Get workspace by ID", err, "Failed to fetch workspace")
		return
	}
	if ws == nil {
		httpx.Fail(w, http.StatusNotFound, "Workspace not found")
		return
	}
	var taskCount int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM tasks WHERE "workspaceId" = $1`, ws.ID).Scan(&taskCount); err != nil {
		s.serverError(w, "Get workspace by ID", err, "Failed to fetch workspace")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{"workspace": ws, "taskCount": taskCount}})
}

// POST /api/workspaces   body: { name, description?, tint?, icon? }
func (s *Server) createWorkspace(w http.ResponseWriter, r *http.Request) {
	b := httpx.BodyFrom(r)
	name := cleanString(b.Raw("name"))
	if msg := workspaceNameError(name, "Name is required"); msg != "" {
		httpx.Fail(w, http.StatusBadRequest, msg)
		return
	}
	var description *string
	if b.Has("description") {
		description = ptr(cleanString(b.Raw("description")))
	}
	tint, hasTint, msg := parseAppearance(b, "tint", "Tint")
	if msg != "" {
		httpx.Fail(w, http.StatusBadRequest, msg)
		return
	}
	icon, hasIcon, msg := parseAppearance(b, "icon", "Icon")
	if msg != "" {
		httpx.Fail(w, http.StatusBadRequest, msg)
		return
	}
	if !hasTint {
		tint = "lavender"
	}
	if !hasIcon {
		icon = "folder"
	}

	now := compat.Now()
	ws, err := scanWorkspace(s.db.QueryRow(r.Context(), `
		INSERT INTO workspaces (id, "userId", name, description, tint, icon, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING `+workspaceColumns,
		newID(), reqctx.UserID(r.Context()), name, description, tint, icon, now))
	if err != nil {
		s.serverError(w, "Create workspace", err, "Failed to create workspace")
		return
	}
	httpx.JSON(w, http.StatusCreated, httpx.M{
		"success": true, "message": "Workspace created successfully", "data": httpx.M{"workspace": ws},
	})
}

// PATCH /api/workspaces/{workspaceId}   body: { name?, description?, tint?, icon? }
func (s *Server) updateWorkspace(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ws, err := findOwnedWorkspace(ctx, s.db, urlParam(r, "workspaceId"), reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, "Update workspace", err, "Failed to update workspace")
		return
	}
	if ws == nil {
		httpx.Fail(w, http.StatusNotFound, "Workspace not found")
		return
	}

	b := httpx.BodyFrom(r)
	sets := new(database.Sets)
	if b.Has("name") {
		name := cleanString(b.Raw("name"))
		if msg := workspaceNameError(name, "Name cannot be empty"); msg != "" {
			httpx.Fail(w, http.StatusBadRequest, msg)
			return
		}
		sets.Add("name", name)
	}
	if b.Has("description") {
		if b.IsNull("description") {
			sets.Add("description", nil)
		} else {
			sets.Add("description", cleanString(b.Raw("description")))
		}
	}
	for _, f := range []struct{ key, label string }{{"tint", "Tint"}, {"icon", "Icon"}} {
		v, ok, msg := parseAppearance(b, f.key, f.label)
		if msg != "" {
			httpx.Fail(w, http.StatusBadRequest, msg)
			return
		}
		if ok {
			sets.Add(f.key, v)
		}
	}
	if sets.Len() == 0 {
		httpx.Fail(w, http.StatusBadRequest, "No valid fields to update")
		return
	}

	sets.Add("updatedAt", compat.Now())
	clause, args, next := sets.Build()
	updated, err := scanWorkspace(s.db.QueryRow(ctx,
		`UPDATE workspaces SET `+clause+` WHERE id = $`+itoa(next)+` RETURNING `+workspaceColumns,
		append(args, ws.ID)...))
	if err != nil || updated == nil {
		s.serverError(w, "Update workspace", err, "Failed to update workspace")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{
		"success": true, "message": "Workspace updated successfully", "data": httpx.M{"workspace": updated},
	})
}

// DELETE /api/workspaces/{workspaceId}   (tasks cascade)
func (s *Server) deleteWorkspace(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tag, err := s.db.Exec(ctx, `DELETE FROM workspaces WHERE id = $1 AND "userId" = $2`,
		urlParam(r, "workspaceId"), reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, "Delete workspace", err, "Failed to delete workspace")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Fail(w, http.StatusNotFound, "Workspace not found")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "Workspace deleted successfully"})
}
