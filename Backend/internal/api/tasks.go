package api

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"productivity/internal/compat"
	"productivity/internal/database"
	"productivity/internal/httpx"
	"productivity/internal/reqctx"
)

const maxTaskTitle = 200

var completeTooEarly = "Complete becomes available after " +
	strconv.FormatFloat(completionThreshold*100, 'f', -1, 64) + "% of the planned time is used"

/* ------------------------------- validation ------------------------------- */

type dateField struct {
	set   bool
	value *time.Time
}

type taskInput struct {
	keys                                             []string // provided fields, in Node's insertion order
	title, description, workspaceID, status, priority *string
	planned                                          *int
	startDate, deadlineDate                          dateField
}

func (in *taskInput) mark(key string) { in.keys = append(in.keys, key) }

// jsTrimmed mirrors `clean(v)` followed by a truthiness check: strings are
// trimmed, other JSON values keep JavaScript truthiness.
func jsTrimmed(raw json.RawMessage) (value string, isString, truthy bool) {
	if s, ok := exactString(raw); ok {
		s = strings.TrimSpace(s)
		return s, true, s != ""
	}
	return "", false, httpx.Truthy(raw)
}

// jsLength is String#length (UTF-16 code units).
func jsLength(s string) int {
	n := 0
	for _, r := range s {
		if r > 0xFFFF {
			n += 2
		} else {
			n++
		}
	}
	return n
}

// buildTaskInput validates task fields; partial skips "required" checks (PATCH).
func buildTaskInput(b httpx.Body, partial bool) (*taskInput, []string) {
	in := &taskInput{}
	var errs []string

	if b.Has("title") || !partial {
		title, isStr, truthy := jsTrimmed(b.Raw("title"))
		switch {
		case !truthy || !isStr:
			errs = append(errs, "Title is required")
		case jsLength(title) > maxTaskTitle:
			errs = append(errs, "Title must be less than "+strconv.Itoa(maxTaskTitle)+" characters")
		default:
			in.title = &title
			in.mark("title")
		}
	}

	if b.Has("description") {
		in.description = ptr(cleanString(b.Raw("description")))
		in.mark("description")
	}

	if b.Has("workspaceId") || !partial {
		if id := cleanString(b.Raw("workspaceId")); id == "" {
			errs = append(errs, "Workspace ID is required")
		} else {
			in.workspaceID = &id
			in.mark("workspaceId")
		}
	}

	enum := func(key string, list []string, label string, dst **string) {
		if !b.Has(key) && partial {
			return
		}
		v, isStr, truthy := jsTrimmed(b.Raw(key))
		switch {
		case truthy && !(isStr && slices.Contains(list, v)):
			errs = append(errs, label+" must be one of: "+strings.Join(list, ", "))
		case truthy:
			*dst = &v
			in.mark(key)
		case !partial:
			errs = append(errs, label+" is required")
		}
	}
	enum("status", taskStatuses, "Status", &in.status)
	enum("priority", taskPriorities, "Priority", &in.priority)

	if b.Has("plannedDurationSeconds") {
		secs, ok := compat.ParseInt(b.Raw("plannedDurationSeconds"))
		if !ok || secs < 0 || secs > math.MaxInt32 {
			errs = append(errs, "plannedDurationSeconds must be a non-negative integer")
		} else {
			in.planned = ptr(int(secs))
			in.mark("plannedDurationSeconds")
		}
	}

	for _, f := range []struct {
		key string
		dst *dateField
	}{{"startDate", &in.startDate}, {"deadlineDate", &in.deadlineDate}} {
		if !b.Has(f.key) {
			continue
		}
		raw := b.Raw(f.key)
		if s, ok := exactString(raw); b.IsNull(f.key) || (ok && s == "") {
			*f.dst = dateField{set: true}
			in.mark(f.key)
			continue
		}
		t, ok := compat.ParseDate(raw)
		if !ok {
			errs = append(errs, f.key+" is invalid")
			continue
		}
		*f.dst = dateField{set: true, value: &t}
		in.mark(f.key)
	}

	if in.startDate.value != nil && in.deadlineDate.value != nil && in.deadlineDate.value.Before(*in.startDate.value) {
		errs = append(errs, "Deadline must be after the start date")
	}
	return in, errs
}

func dedupe(list []string) []string {
	seen := map[string]bool{}
	out := list[:0:0]
	for _, s := range list {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

/* --------------------------------- helpers -------------------------------- */

func (s *Server) taskServerError(w http.ResponseWriter, err error) {
	s.log.Error("tasks error", "error", err)
	httpx.Error(w, http.StatusInternalServerError, "Internal server error")
}

// inUserTx runs fn in a transaction holding the user's advisory lock, so
// concurrent requests (double clicks, multiple tabs) cannot both pass the
// "one active session" check or interleave position rewrites.
func (s *Server) inUserTx(ctx context.Context, userID string, fn func(tx pgx.Tx) error) error {
	return database.InTx(ctx, s.db, func(tx pgx.Tx) error {
		if err := database.LockUser(ctx, tx, userID); err != nil {
			return err
		}
		return fn(tx)
	})
}

func (s *Server) taskTxError(w http.ResponseWriter, err error) {
	if se, ok := asStatusError(err); ok {
		httpx.Error(w, se.status, se.message)
		return
	}
	s.taskServerError(w, err)
}

// respondTask writes the task with its session-tracked spent time.
func (s *Server) respondTask(w http.ResponseWriter, ctx context.Context, t *taskRow) {
	spent, err := spentSeconds(ctx, s.db, t.ID)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, serializeTask(t, &spent))
}

func requireTask(ctx context.Context, q database.Querier, id, userID string) (*taskRow, error) {
	t, err := findOwnedTask(ctx, q, id, userID)
	if err == nil && t == nil {
		err = reject(http.StatusNotFound, "Task not found")
	}
	return t, err
}

func requireWorkspace(ctx context.Context, q database.Querier, id, userID string) error {
	ws, err := findOwnedWorkspace(ctx, q, id, userID)
	if err == nil && ws == nil {
		err = reject(http.StatusNotFound, "Workspace not found")
	}
	return err
}

/* -------------------------------- handlers -------------------------------- */

// GET /api/tasks?workspaceId=&status=
func (s *Server) getTasks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	where := []string{`"userId" = $1`}
	args := []any{userID}
	if ws := r.URL.Query().Get("workspaceId"); ws != "" {
		args = append(args, ws)
		where = append(where, `"workspaceId" = $`+itoa(len(args)))
	}
	if st := r.URL.Query().Get("status"); slices.Contains(taskStatuses, st) {
		args = append(args, st)
		where = append(where, `status = $`+itoa(len(args))+`::text::"TaskStatus"`)
	}

	rows, err := s.db.Query(ctx, `SELECT `+taskColumns+`,
			COALESCE((SELECT SUM(s."durationSeconds") FROM task_sessions s WHERE s."taskId" = tasks.id), 0)::int
		FROM tasks WHERE `+strings.Join(where, " AND ")+` ORDER BY "workspaceId" ASC, position ASC`, args...)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	tasks, spent, err := collectTasks(rows, true)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	workspaces, err := listWorkspaces(ctx, s.db, userID)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	active, err := findActiveSession(ctx, s.db, userID)
	if err != nil {
		s.taskServerError(w, err)
		return
	}

	out := make([]taskJSON, len(tasks))
	for i, t := range tasks {
		out[i] = serializeTask(t, &spent[i])
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"tasks": out, "workspaces": workspaces, "activeSession": serializeSession(active)})
}

// GET /api/tasks/today — open tasks plus anything touched since local midnight.
func (s *Server) getTodayTasks(w http.ResponseWriter, r *http.Request) {
	y, m, d := time.Now().Date()
	midnight := time.Date(y, m, d, 0, 0, 0, 0, time.Local).UTC()
	rows, err := s.db.Query(r.Context(), `SELECT `+taskColumns+` FROM tasks
		WHERE "userId" = $1 AND (status IN ('IN_PROGRESS', 'TODO') OR "updatedAt" >= $2)
		ORDER BY "workspaceId" ASC, position ASC`, reqctx.UserID(r.Context()), midnight)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	tasks, _, err := collectTasks(rows, false)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, serializeTasks(tasks))
}

// GET /api/tasks/{taskId}
func (s *Server) getTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	t, err := findOwnedTask(ctx, s.db, urlParam(r, "taskId"), reqctx.UserID(ctx))
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	if t == nil {
		httpx.Error(w, http.StatusNotFound, "Task not found")
		return
	}
	spent, err := spentSeconds(ctx, s.db, t.ID)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	open, err := findOpenSession(ctx, s.db, t.ID)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, struct {
		taskJSON
		ActiveSession *sessionJSON `json:"activeSession"`
	}{serializeTask(t, &spent), serializeSession(open)})
}

// POST /api/tasks
func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)

	body := httpx.Body{"status": json.RawMessage(`"TODO"`), "priority": json.RawMessage(`"MEDIUM"`),
		"description": json.RawMessage(`""`), "plannedDurationSeconds": json.RawMessage(`0`)}
	for k, v := range httpx.BodyFrom(r) {
		body[k] = v
	}
	in, errs := buildTaskInput(body, false)
	if len(errs) > 0 {
		httpx.Error(w, http.StatusBadRequest, strings.Join(errs, ", "))
		return
	}

	var task *taskRow
	err := s.inUserTx(ctx, userID, func(tx pgx.Tx) error {
		if err := requireWorkspace(ctx, tx, *in.workspaceID, userID); err != nil {
			return err
		}
		status := *in.status
		if status == statusInProgress {
			ok, err := canStart(ctx, tx, userID, "")
			if err != nil {
				return err
			}
			if !ok {
				return reject(http.StatusBadRequest, "Cannot create an IN_PROGRESS task while another task is active")
			}
		}
		pos, err := nextTaskPosition(ctx, tx, userID, *in.workspaceID, status)
		if err != nil {
			return err
		}
		now := compat.Now()
		var startedAt, completedAt *time.Time
		if status == statusInProgress {
			startedAt = &now
		}
		if status == statusCompleted {
			completedAt = &now
		}
		description := ""
		if in.description != nil {
			description = *in.description
		}
		planned := 0
		if in.planned != nil {
			planned = *in.planned
		}
		task, err = scanTask(tx.QueryRow(ctx, `
			INSERT INTO tasks (id, "userId", "workspaceId", title, description, status, priority, position,
				"plannedDurationSeconds", "startDate", "deadlineDate", "startedAt", "completedAt", "createdAt", "updatedAt")
			VALUES ($1, $2, $3, $4, $5, $6::text::"TaskStatus", $7::text::"TaskPriority", $8, $9, $10, $11, $12, $13, $14, $14)
			RETURNING `+taskColumns,
			newID(), userID, *in.workspaceID, *in.title, description, status, *in.priority, pos,
			planned, in.startDate.value, in.deadlineDate.value, startedAt, completedAt, now))
		if err != nil {
			return err
		}
		if err := recordActivity(ctx, tx, userID, "TASK_CREATED",
			activityMeta{"taskId": task.ID, "title": task.Title, "workspaceId": task.WorkspaceID}, true); err != nil {
			return err
		}
		switch status {
		case statusInProgress:
			if err := openSession(ctx, tx, userID, task.ID); err != nil {
				return err
			}
			return recordActivity(ctx, tx, userID, "TASK_STARTED", activityMeta{"taskId": task.ID}, true)
		case statusCompleted:
			return recordActivity(ctx, tx, userID, "TASK_COMPLETED", activityMeta{"taskId": task.ID}, true)
		}
		return nil
	})
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, serializeTask(task, ptr(0)))
}

// PATCH /api/tasks/{taskId} — field edits; status changes use dedicated endpoints.
func (s *Server) updateTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	var result *taskRow
	err := s.inUserTx(ctx, userID, func(tx pgx.Tx) error {
		task, err := requireTask(ctx, tx, urlParam(r, "taskId"), userID)
		if err != nil {
			return err
		}
		if task.Status == statusCompleted {
			return reject(http.StatusBadRequest, "Cannot update a completed task")
		}

		in, errs := buildTaskInput(httpx.BodyFrom(r), true)
		in.status = nil
		in.keys = slices.DeleteFunc(in.keys, func(k string) bool { return k == "status" })

		nextStart, nextDeadline := task.StartDate, task.DeadlineDate
		if in.startDate.set {
			nextStart = in.startDate.value
		}
		if in.deadlineDate.set {
			nextDeadline = in.deadlineDate.value
		}
		if nextStart != nil && nextDeadline != nil && nextDeadline.Before(*nextStart) {
			errs = append(errs, "Deadline must be after the start date")
		}
		if len(errs) > 0 {
			return reject(http.StatusBadRequest, strings.Join(dedupe(errs), ", "))
		}
		if len(in.keys) == 0 {
			result = task
			return nil
		}

		moved := in.workspaceID != nil && *in.workspaceID != task.WorkspaceID
		if moved {
			if err := requireWorkspace(ctx, tx, *in.workspaceID, userID); err != nil {
				return err
			}
		}

		sets := new(database.Sets)
		if in.title != nil {
			sets.Add("title", *in.title)
		}
		if in.description != nil {
			sets.Add("description", *in.description)
		}
		if in.workspaceID != nil {
			sets.Add("workspaceId", *in.workspaceID)
		}
		if in.priority != nil {
			sets.AddEnum("priority", "TaskPriority", *in.priority)
		}
		if in.planned != nil {
			sets.Add("plannedDurationSeconds", *in.planned)
		}
		if in.startDate.set {
			sets.Add("startDate", in.startDate.value)
		}
		if in.deadlineDate.set {
			sets.Add("deadlineDate", in.deadlineDate.value)
		}
		if moved {
			pos, err := nextTaskPosition(ctx, tx, userID, *in.workspaceID, task.Status)
			if err != nil {
				return err
			}
			sets.Add("position", pos)
		}
		sets.Add("updatedAt", compat.Now())
		clause, args, next := sets.Build()
		if result, err = scanTask(tx.QueryRow(ctx, `UPDATE tasks SET `+clause+` WHERE id = $`+itoa(next)+` RETURNING `+taskColumns,
			append(args, task.ID)...)); err != nil {
			return err
		}
		if moved {
			if err := reindexColumn(ctx, tx, userID, task.WorkspaceID, task.Status); err != nil {
				return err
			}
		}

		kind := "TASK_UPDATED"
		if in.priority != nil && *in.priority != task.Priority {
			kind = "PRIORITY_CHANGED"
		} else if in.deadlineDate.set && !sameMillis(in.deadlineDate.value, task.DeadlineDate) {
			kind = "DEADLINE_CHANGED"
		}
		return recordActivity(ctx, tx, userID, kind, activityMeta{"taskId": task.ID, "changes": in.keys}, true)
	})
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	s.respondTask(w, ctx, result)
}

func sameMillis(a, b *time.Time) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return a.UnixMilli() == b.UnixMilli()
}

// DELETE /api/tasks/{taskId}
func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	err := s.inUserTx(ctx, userID, func(tx pgx.Tx) error {
		task, err := requireTask(ctx, tx, urlParam(r, "taskId"), userID)
		if err != nil {
			return err
		}
		if _, err := closeOpenSession(ctx, tx, userID, task.ID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, task.ID); err != nil {
			return err
		}
		if err := recordActivity(ctx, tx, userID, "TASK_DELETED",
			activityMeta{"taskId": task.ID, "title": task.Title, "workspaceId": task.WorkspaceID}, false); err != nil {
			return err
		}
		return reindexColumn(ctx, tx, userID, task.WorkspaceID, task.Status)
	})
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	httpx.NoContent(w)
}

// PATCH /api/tasks/{taskId}/move   body: { status?, index?, workspaceId? }
func (s *Server) moveTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	b := httpx.BodyFrom(r)
	var result *taskRow
	err := s.inUserTx(ctx, userID, func(tx pgx.Tx) error {
		task, err := requireTask(ctx, tx, urlParam(r, "taskId"), userID)
		if err != nil {
			return err
		}
		if task.Status == statusCompleted {
			return reject(http.StatusBadRequest, "Cannot move a completed task")
		}

		newStatus := task.Status
		if b.Truthy("status") {
			v, isStr, _ := jsTrimmed(b.Raw("status"))
			if !isStr {
				v = ""
			}
			newStatus = v
		}
		if !slices.Contains(taskStatuses, newStatus) {
			return reject(http.StatusBadRequest, "Invalid status")
		}
		newWorkspaceID := task.WorkspaceID
		if b.Truthy("workspaceId") {
			newWorkspaceID = cleanString(b.Raw("workspaceId"))
		}
		if newWorkspaceID != task.WorkspaceID {
			if err := requireWorkspace(ctx, tx, newWorkspaceID, userID); err != nil {
				return err
			}
		}

		statusChanged := newStatus != task.Status
		movedColumn := statusChanged || newWorkspaceID != task.WorkspaceID
		targetIndex := -1
		if b.Has("index") && !b.IsNull("index") {
			if v, ok := compat.ParseInt(b.Raw("index")); ok {
				targetIndex = int(max(0, min(v, math.MaxInt32)))
			}
		}
		if !movedColumn && (targetIndex < 0 || targetIndex == task.Position) {
			result = task
			return nil
		}

		if newStatus == statusInProgress && statusChanged {
			ok, err := canStart(ctx, tx, userID, task.ID)
			if err != nil {
				return err
			}
			if !ok {
				return reject(http.StatusBadRequest, "Cannot start task while another is active")
			}
		}
		if newStatus == statusCompleted {
			ok, err := canComplete(ctx, tx, task)
			if err != nil {
				return err
			}
			if !ok {
				return reject(http.StatusBadRequest, completeTooEarly)
			}
		}

		siblings, err := columnTaskIDs(ctx, tx, userID, newWorkspaceID, newStatus, task.ID)
		if err != nil {
			return err
		}
		insertAt := len(siblings)
		if targetIndex >= 0 {
			insertAt = min(targetIndex, len(siblings))
		}
		ordered := slices.Insert(slices.Clone(siblings), insertAt, task.ID)

		if statusChanged && task.Status == statusInProgress {
			capSeconds := 0
			if newStatus == statusCompleted {
				capSeconds = task.PlannedDurationSeconds
			}
			if _, err := closeOpenSessionCapped(ctx, tx, userID, task.ID, capSeconds); err != nil {
				return err
			}
		}

		now := compat.Now()
		sets := new(database.Sets).
			AddEnum("status", "TaskStatus", newStatus).
			Add("workspaceId", newWorkspaceID).
			Add("position", insertAt).
			Add("updatedAt", now)
		if newStatus == statusInProgress && statusChanged && task.StartedAt == nil {
			sets.Add("startedAt", now)
		}
		if newStatus == statusCompleted && statusChanged {
			sets.Add("completedAt", now)
		}
		clause, args, next := sets.Build()
		if _, err := tx.Exec(ctx, `UPDATE tasks SET `+clause+` WHERE id = $`+itoa(next), append(args, task.ID)...); err != nil {
			return err
		}
		if err := setPositions(ctx, tx, ordered); err != nil {
			return err
		}
		if movedColumn {
			if err := reindexColumn(ctx, tx, userID, task.WorkspaceID, task.Status); err != nil {
				return err
			}
		}

		if statusChanged {
			if newStatus == statusInProgress {
				if err := openSession(ctx, tx, userID, task.ID); err != nil {
					return err
				}
				if err := recordActivity(ctx, tx, userID, "TASK_STARTED", activityMeta{"taskId": task.ID}, true); err != nil {
					return err
				}
			} else {
				kind := "STATUS_CHANGED"
				if newStatus == statusCompleted {
					kind = "TASK_COMPLETED"
				}
				if err := recordActivity(ctx, tx, userID, kind,
					activityMeta{"taskId": task.ID, "from": task.Status, "to": newStatus}, true); err != nil {
					return err
				}
			}
		}
		result, err = loadTask(ctx, tx, task.ID)
		return err
	})
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	s.respondTask(w, ctx, result)
}

// transition moves a task to the end of `status`, closing its running session
// first. It is shared by hold and complete.
func transitionTask(ctx context.Context, tx pgx.Tx, userID string, task *taskRow, status string, extra func(*database.Sets)) (*taskRow, error) {
	capSeconds := 0
	if status == statusCompleted {
		capSeconds = task.PlannedDurationSeconds
	}
	if _, err := closeOpenSessionCapped(ctx, tx, userID, task.ID, capSeconds); err != nil {
		return nil, err
	}
	pos, err := nextTaskPosition(ctx, tx, userID, task.WorkspaceID, status)
	if err != nil {
		return nil, err
	}
	sets := new(database.Sets).AddEnum("status", "TaskStatus", status).Add("position", pos).Add("updatedAt", compat.Now())
	if extra != nil {
		extra(sets)
	}
	clause, args, next := sets.Build()
	updated, err := scanTask(tx.QueryRow(ctx, `UPDATE tasks SET `+clause+` WHERE id = $`+itoa(next)+` RETURNING `+taskColumns,
		append(args, task.ID)...))
	if err != nil {
		return nil, err
	}
	return updated, reindexColumn(ctx, tx, userID, task.WorkspaceID, task.Status)
}

// POST /api/tasks/{taskId}/start
func (s *Server) startTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	result, err := s.startTaskTx(ctx, reqctx.UserID(ctx), urlParam(r, "taskId"))
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	s.respondTask(w, ctx, result)
}

// startTaskTx starts (or resumes) a task's timer. Shared by the task and the
// global timer endpoints so both enforce the same single-active-session rule.
func (s *Server) startTaskTx(ctx context.Context, userID, taskID string) (*taskRow, error) {
	var result *taskRow
	err := s.inUserTx(ctx, userID, func(tx pgx.Tx) error {
		task, err := requireTask(ctx, tx, taskID, userID)
		if err != nil {
			return err
		}
		if task.Status == statusCompleted {
			return reject(http.StatusBadRequest, "Task is locked")
		}
		if task.StartDate != nil && task.StartDate.After(time.Now()) {
			return reject(http.StatusBadRequest, "Task cannot be started before its start date")
		}
		ok, err := canStart(ctx, tx, userID, task.ID)
		if err != nil {
			return err
		}
		if !ok {
			return reject(http.StatusBadRequest, "Another task is already active")
		}

		open, err := findOpenSession(ctx, tx, task.ID)
		if err != nil {
			return err
		}
		if task.Status == statusInProgress {
			// Repair: an IN_PROGRESS task without a running session.
			result = task
			if open == nil {
				return openSession(ctx, tx, userID, task.ID)
			}
			return nil
		}

		pos, err := nextTaskPosition(ctx, tx, userID, task.WorkspaceID, statusInProgress)
		if err != nil {
			return err
		}
		now := compat.Now()
		if result, err = scanTask(tx.QueryRow(ctx, `UPDATE tasks
			SET status = 'IN_PROGRESS', position = $2, "startedAt" = COALESCE("startedAt", $3), "updatedAt" = $3
			WHERE id = $1 RETURNING `+taskColumns, task.ID, pos, now)); err != nil {
			return err
		}
		if err := reindexColumn(ctx, tx, userID, task.WorkspaceID, task.Status); err != nil {
			return err
		}
		if open == nil {
			if err := openSession(ctx, tx, userID, task.ID); err != nil {
				return err
			}
		}
		return recordActivity(ctx, tx, userID, "TASK_STARTED", activityMeta{"taskId": task.ID}, true)
	})
	return result, err
}

// POST /api/tasks/{taskId}/hold
func (s *Server) holdTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	result, err := s.holdTaskTx(ctx, reqctx.UserID(ctx), urlParam(r, "taskId"))
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	s.respondTask(w, ctx, result)
}

// holdTaskTx pauses a task's timer, committing the running session.
func (s *Server) holdTaskTx(ctx context.Context, userID, taskID string) (*taskRow, error) {
	var result *taskRow
	err := s.inUserTx(ctx, userID, func(tx pgx.Tx) error {
		task, err := requireTask(ctx, tx, taskID, userID)
		if err != nil {
			return err
		}
		if task.Status == statusOnHold {
			result = task
			return nil
		}
		if task.Status == statusCompleted {
			return reject(http.StatusBadRequest, "Task is locked")
		}
		if result, err = transitionTask(ctx, tx, userID, task, statusOnHold, nil); err != nil {
			return err
		}
		return recordActivity(ctx, tx, userID, "STATUS_CHANGED",
			activityMeta{"taskId": task.ID, "from": task.Status, "to": statusOnHold}, true)
	})
	return result, err
}

// POST /api/tasks/{taskId}/complete
func (s *Server) completeTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	var result *taskRow
	err := s.inUserTx(ctx, userID, func(tx pgx.Tx) error {
		task, err := requireTask(ctx, tx, urlParam(r, "taskId"), userID)
		if err != nil {
			return err
		}
		if task.Status == statusCompleted {
			result = task
			return nil
		}
		ok, err := canComplete(ctx, tx, task)
		if err != nil {
			return err
		}
		if !ok {
			return reject(http.StatusBadRequest, completeTooEarly)
		}
		if result, err = transitionTask(ctx, tx, userID, task, statusCompleted, func(sets *database.Sets) {
			sets.Add("completedAt", compat.Now())
		}); err != nil {
			return err
		}
		return recordActivity(ctx, tx, userID, "TASK_COMPLETED", activityMeta{"taskId": task.ID}, true)
	})
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	s.respondTask(w, ctx, result)
}

// POST /api/tasks/{taskId}/sync — checkpoints the running session so tracked
// time survives a crash.
func (s *Server) syncTime(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	task, err := findOwnedTask(ctx, s.db, urlParam(r, "taskId"), reqctx.UserID(ctx))
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	if task == nil {
		httpx.Error(w, http.StatusNotFound, "Task not found")
		return
	}
	open, err := findOpenSession(ctx, s.db, task.ID)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	if open == nil {
		httpx.Error(w, http.StatusBadRequest, "No active session")
		return
	}
	now := compat.Now()
	elapsed := elapsedSeconds(open.StartedAt, now)
	// The endedAt guard keeps a concurrent hold/complete from being overwritten.
	if _, err := s.db.Exec(ctx, `UPDATE task_sessions SET "durationSeconds" = $2, "updatedAt" = $3
		WHERE id = $1 AND "endedAt" IS NULL`, open.ID, elapsed, now); err != nil {
		s.taskServerError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"committedSeconds": elapsed})
}

// PATCH /api/tasks/reorder   body: { workspaceId, status, ids: string[] }
func (s *Server) reorderTasks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	b := httpx.BodyFrom(r)

	workspaceID := cleanString(b.Raw("workspaceId"))
	if workspaceID == "" {
		httpx.Error(w, http.StatusBadRequest, "Workspace ID is required")
		return
	}
	status, ok := oneOf(b.Raw("status"), taskStatuses)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "Valid status is required")
		return
	}
	rawIDs, ok := b.Array("ids")
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "ids must be an array")
		return
	}

	var tasks []*taskRow
	err := s.inUserTx(ctx, userID, func(tx pgx.Tx) error {
		current, err := columnTaskIDs(ctx, tx, userID, workspaceID, status, "")
		if err != nil {
			return err
		}
		valid := map[string]bool{}
		for _, id := range current {
			valid[id] = true
		}
		used := map[string]bool{}
		ordered := make([]string, 0, len(current))
		for _, raw := range rawIDs {
			if id, ok := exactString(raw); ok && valid[id] && !used[id] {
				used[id] = true
				ordered = append(ordered, id)
			}
		}
		for _, id := range current {
			if !used[id] {
				ordered = append(ordered, id)
			}
		}
		if err := setPositions(ctx, tx, ordered); err != nil {
			return err
		}
		tasks, err = listColumnTasks(ctx, tx, userID, workspaceID, status)
		return err
	})
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, serializeTasks(tasks))
}
