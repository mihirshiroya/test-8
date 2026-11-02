package api

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"productivity/internal/compat"
	"productivity/internal/database"
)

const (
	statusTodo       = "TODO"
	statusInProgress = "IN_PROGRESS"
	statusOnHold     = "ON_HOLD"
	statusCompleted  = "COMPLETED"

	completionThreshold = 0.75
)

var (
	taskStatuses   = []string{statusTodo, statusInProgress, statusOnHold, statusCompleted}
	taskPriorities = []string{"LOW", "MEDIUM", "HIGH", "URGENT"}
)

type taskRow struct {
	ID, UserID, WorkspaceID string
	Title, Description      string
	Status, Priority        string
	Position                int
	PlannedDurationSeconds  int
	ActualDurationSeconds   int
	StartDate, DeadlineDate *time.Time
	StartedAt, CompletedAt  *time.Time
	CreatedAt, UpdatedAt    time.Time
}

const taskColumns = `id, "userId", "workspaceId", title, description, status::text, priority::text, position,
	"plannedDurationSeconds", "actualDurationSeconds", "startDate", "deadlineDate", "startedAt", "completedAt",
	"createdAt", "updatedAt"`

func (t *taskRow) scanTargets() []any {
	return []any{&t.ID, &t.UserID, &t.WorkspaceID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.Position,
		&t.PlannedDurationSeconds, &t.ActualDurationSeconds, &t.StartDate, &t.DeadlineDate, &t.StartedAt,
		&t.CompletedAt, &t.CreatedAt, &t.UpdatedAt}
}

func scanTask(row pgx.Row) (*taskRow, error) {
	var t taskRow
	err := row.Scan(t.scanTargets()...)
	if database.IsNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

type taskJSON struct {
	ID                     string `json:"id"`
	Title                  string `json:"title"`
	Description            string `json:"description"`
	Status                 string `json:"status"`
	Priority               string `json:"priority"`
	WorkspaceID            string `json:"workspaceId"`
	Position               int    `json:"position"`
	CreatedAt              int64  `json:"createdAt"`
	UpdatedAt              int64  `json:"updatedAt"`
	PlannedDurationSeconds int    `json:"plannedDurationSeconds"`
	ActualDurationSeconds  int    `json:"actualDurationSeconds"`
	SpentSeconds           int    `json:"spentSeconds"`
	StartDate              *int64 `json:"startDate"`
	DeadlineDate           *int64 `json:"deadlineDate"`
	StartedAt              *int64 `json:"startedAt"`
	CompletedAt            *int64 `json:"completedAt"`
}

// serializeTask reports `spent` when given, otherwise the stored
// actualDurationSeconds (same fallback as the Node serializer).
func serializeTask(t *taskRow, spent *int) taskJSON {
	tracked := t.ActualDurationSeconds
	if spent != nil {
		tracked = *spent
	}
	return taskJSON{
		ID: t.ID, Title: t.Title, Description: t.Description, Status: t.Status, Priority: t.Priority,
		WorkspaceID: t.WorkspaceID, Position: t.Position,
		CreatedAt: ms(t.CreatedAt), UpdatedAt: ms(t.UpdatedAt),
		PlannedDurationSeconds: t.PlannedDurationSeconds, ActualDurationSeconds: tracked, SpentSeconds: tracked,
		StartDate: compat.Millis(t.StartDate), DeadlineDate: compat.Millis(t.DeadlineDate),
		StartedAt: compat.Millis(t.StartedAt), CompletedAt: compat.Millis(t.CompletedAt),
	}
}

type sessionRow struct {
	ID, TaskID      string
	StartedAt       time.Time
	EndedAt         *time.Time
	DurationSeconds *int
}

const sessionColumns = `id, "taskId", "startedAt", "endedAt", "durationSeconds"`

func scanSession(row pgx.Row) (*sessionRow, error) {
	var s sessionRow
	err := row.Scan(&s.ID, &s.TaskID, &s.StartedAt, &s.EndedAt, &s.DurationSeconds)
	if database.IsNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

type sessionJSON struct {
	ID               string `json:"id"`
	TaskID           string `json:"taskId"`
	StartedAt        int64  `json:"startedAt"`
	EndedAt          *int64 `json:"endedAt"`
	CommittedSeconds int    `json:"committedSeconds"`
}

func serializeSession(s *sessionRow) *sessionJSON {
	if s == nil {
		return nil
	}
	committed := 0
	if s.DurationSeconds != nil {
		committed = *s.DurationSeconds
	}
	return &sessionJSON{ID: s.ID, TaskID: s.TaskID, StartedAt: ms(s.StartedAt), EndedAt: compat.Millis(s.EndedAt), CommittedSeconds: committed}
}

func elapsedSeconds(start, end time.Time) int {
	return max(0, int(end.Sub(start).Milliseconds()/1000))
}

/* --------------------------------- queries -------------------------------- */

func findOwnedTask(ctx context.Context, q database.Querier, id, userID string) (*taskRow, error) {
	return scanTask(q.QueryRow(ctx, `SELECT `+taskColumns+` FROM tasks WHERE id = $1 AND "userId" = $2`, id, userID))
}

func loadTask(ctx context.Context, q database.Querier, id string) (*taskRow, error) {
	return scanTask(q.QueryRow(ctx, `SELECT `+taskColumns+` FROM tasks WHERE id = $1`, id))
}

func collectTasks(rows pgx.Rows, withSpent bool) ([]*taskRow, []int, error) {
	defer rows.Close()
	var tasks []*taskRow
	var spent []int
	for rows.Next() {
		var t taskRow
		targets := t.scanTargets()
		var s int
		if withSpent {
			targets = append(targets, &s)
		}
		if err := rows.Scan(targets...); err != nil {
			return nil, nil, err
		}
		tasks = append(tasks, &t)
		spent = append(spent, s)
	}
	return tasks, spent, rows.Err()
}

func serializeTasks(tasks []*taskRow) []taskJSON {
	out := make([]taskJSON, len(tasks))
	for i, t := range tasks {
		out[i] = serializeTask(t, nil)
	}
	return out
}

func listColumnTasks(ctx context.Context, q database.Querier, userID, workspaceID, status string) ([]*taskRow, error) {
	rows, err := q.Query(ctx, `SELECT `+taskColumns+` FROM tasks
		WHERE "userId" = $1 AND "workspaceId" = $2 AND status = $3::text::"TaskStatus"
		ORDER BY "workspaceId" ASC, position ASC`, userID, workspaceID, status)
	if err != nil {
		return nil, err
	}
	tasks, _, err := collectTasks(rows, false)
	return tasks, err
}

func nextTaskPosition(ctx context.Context, q database.Querier, userID, workspaceID, status string) (int, error) {
	var pos int
	err := q.QueryRow(ctx, `SELECT COALESCE(MAX(position) + 1, 0) FROM tasks
		WHERE "userId" = $1 AND "workspaceId" = $2 AND status = $3::text::"TaskStatus"`,
		userID, workspaceID, status).Scan(&pos)
	return pos, err
}

// reindexColumn rewrites the positions of one kanban column to 0..n-1.
func reindexColumn(ctx context.Context, q database.Querier, userID, workspaceID, status string) error {
	_, err := q.Exec(ctx, `
		UPDATE tasks t SET position = o.pos, "updatedAt" = $4
		FROM (
			SELECT id, (row_number() OVER (ORDER BY position ASC, "updatedAt" DESC) - 1)::int AS pos
			FROM tasks WHERE "userId" = $1 AND "workspaceId" = $2 AND status = $3::text::"TaskStatus"
		) o
		WHERE t.id = o.id AND t.position <> o.pos`, userID, workspaceID, status, compat.Now())
	return err
}

// setPositions assigns position i to ids[i], skipping rows already in place.
func setPositions(ctx context.Context, q database.Querier, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	positions := make([]int32, len(ids))
	for i := range ids {
		positions[i] = int32(i)
	}
	_, err := q.Exec(ctx, `
		UPDATE tasks t SET position = v.pos, "updatedAt" = $3
		FROM unnest($1::text[], $2::int[]) AS v(id, pos)
		WHERE t.id = v.id AND t.position <> v.pos`, ids, positions, compat.Now())
	return err
}

func columnTaskIDs(ctx context.Context, q database.Querier, userID, workspaceID, status, exceptID string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT id FROM tasks
		WHERE "userId" = $1 AND "workspaceId" = $2 AND status = $3::text::"TaskStatus" AND id <> $4
		ORDER BY position ASC`, userID, workspaceID, status, exceptID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

/* --------------------------------- sessions ------------------------------- */

func findOpenSession(ctx context.Context, q database.Querier, taskID string) (*sessionRow, error) {
	return scanSession(q.QueryRow(ctx,
		`SELECT `+sessionColumns+` FROM task_sessions WHERE "taskId" = $1 AND "endedAt" IS NULL LIMIT 1`, taskID))
}

func findActiveSession(ctx context.Context, q database.Querier, userID string) (*sessionRow, error) {
	return scanSession(q.QueryRow(ctx, `SELECT `+sessionColumns+` FROM task_sessions
		WHERE "userId" = $1 AND "endedAt" IS NULL ORDER BY "startedAt" DESC LIMIT 1`, userID))
}

func openSession(ctx context.Context, q database.Querier, userID, taskID string) error {
	now := compat.Now()
	_, err := q.Exec(ctx, `INSERT INTO task_sessions (id, "userId", "taskId", "startedAt", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $4, $4)`, newID(), userID, taskID, now)
	return err
}

// closeOpenSession ends the task's running session, adds its duration to the
// task and records SESSION_COMPLETED. Returns the session length in seconds.
func closeOpenSession(ctx context.Context, q database.Querier, userID, taskID string) (int, error) {
	return closeOpenSessionCapped(ctx, q, userID, taskID, 0)
}

// closeOpenSessionCapped is closeOpenSession, but when plannedSeconds > 0 the
// session is trimmed so the task's total tracked time never exceeds the plan.
// Used on completion so overtime past the planned duration is not saved.
func closeOpenSessionCapped(ctx context.Context, q database.Querier, userID, taskID string, plannedSeconds int) (int, error) {
	session, err := findOpenSession(ctx, q, taskID)
	if err != nil || session == nil {
		return 0, err
	}
	now := compat.Now()
	seconds := elapsedSeconds(session.StartedAt, now)
	endedAt := now
	if plannedSeconds > 0 {
		var closed int
		if err := q.QueryRow(ctx, `SELECT COALESCE(SUM("durationSeconds"), 0)::int FROM task_sessions
			WHERE "taskId" = $1 AND "endedAt" IS NOT NULL`, taskID).Scan(&closed); err != nil {
			return 0, err
		}
		if allowed := max(0, plannedSeconds-closed); seconds > allowed {
			seconds = allowed
			endedAt = session.StartedAt.Add(time.Duration(seconds) * time.Second)
		}
	}
	if _, err := q.Exec(ctx, `UPDATE task_sessions SET "endedAt" = $2, "durationSeconds" = $3, "updatedAt" = $4 WHERE id = $1`,
		session.ID, endedAt, seconds, now); err != nil {
		return 0, err
	}
	if _, err := q.Exec(ctx, `UPDATE tasks SET "actualDurationSeconds" = "actualDurationSeconds" + $2, "updatedAt" = $3 WHERE id = $1`,
		taskID, seconds, now); err != nil {
		return 0, err
	}
	if seconds > 0 {
		err = recordActivity(ctx, q, userID, "SESSION_COMPLETED", activityMeta{"taskId": taskID, "seconds": seconds}, true)
	}
	return seconds, err
}

// spentSeconds sums every session's committed duration (closed sessions plus
// the last /sync checkpoint of an open one).
func spentSeconds(ctx context.Context, q database.Querier, taskID string) (int, error) {
	var n int
	err := q.QueryRow(ctx, `SELECT COALESCE(SUM("durationSeconds"), 0)::int FROM task_sessions WHERE "taskId" = $1`, taskID).Scan(&n)
	return n, err
}

// liveSpentSeconds is closed time plus the running session's elapsed time.
func liveSpentSeconds(ctx context.Context, q database.Querier, taskID string) (int, error) {
	var closed int
	var openStart *time.Time
	err := q.QueryRow(ctx, `SELECT
			COALESCE(SUM("durationSeconds") FILTER (WHERE "endedAt" IS NOT NULL), 0)::int,
			MIN("startedAt") FILTER (WHERE "endedAt" IS NULL)
		FROM task_sessions WHERE "taskId" = $1`, taskID).Scan(&closed, &openStart)
	if err != nil || openStart == nil {
		return closed, err
	}
	return closed + elapsedSeconds(*openStart, time.Now()), nil
}

func canStart(ctx context.Context, q database.Querier, userID, exceptTaskID string) (bool, error) {
	var exists bool
	err := q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM task_sessions
		WHERE "userId" = $1 AND "endedAt" IS NULL AND ($2 = '' OR "taskId" <> $2))`, userID, exceptTaskID).Scan(&exists)
	return !exists, err
}

func canComplete(ctx context.Context, q database.Querier, t *taskRow) (bool, error) {
	if t.PlannedDurationSeconds <= 0 {
		return true, nil
	}
	spent, err := liveSpentSeconds(ctx, q, t.ID)
	// Small grace (2s) for clock drift between client and server.
	return float64(spent+2) >= float64(t.PlannedDurationSeconds)*completionThreshold, err
}

/* -------------------------------- analytics ------------------------------- */

type activityMeta map[string]any

// analyticsDay is today's server-local calendar date (stored in a DATE column).
func analyticsDay() time.Time {
	y, m, d := time.Now().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// recordActivity upserts today's DailyAnalytics counters and appends a
// DailyActivity row. taskExists=false leaves taskId NULL (deleted tasks).
func recordActivity(ctx context.Context, q database.Querier, userID, kind string, meta activityMeta, taskExists bool) error {
	var created, completed, sessions, focus int
	switch kind {
	case "TASK_CREATED":
		created = 1
	case "TASK_COMPLETED":
		completed = 1
	case "SESSION_COMPLETED":
		sessions = 1
		if secs, ok := meta["seconds"].(int); ok {
			focus = max(0, secs)
		}
	}
	now := compat.Now()
	var analyticsID string
	err := q.QueryRow(ctx, `
		INSERT INTO daily_analytics (id, "userId", "analyticsDate", "createdTaskCount", "completedTaskCount",
			"totalSessions", "totalFocusSeconds", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
		ON CONFLICT ("userId", "analyticsDate") DO UPDATE SET
			"createdTaskCount" = daily_analytics."createdTaskCount" + EXCLUDED."createdTaskCount",
			"completedTaskCount" = daily_analytics."completedTaskCount" + EXCLUDED."completedTaskCount",
			"totalSessions" = daily_analytics."totalSessions" + EXCLUDED."totalSessions",
			"totalFocusSeconds" = daily_analytics."totalFocusSeconds" + EXCLUDED."totalFocusSeconds",
			"updatedAt" = EXCLUDED."updatedAt"
		RETURNING id`,
		newID(), userID, analyticsDay(), created, completed, sessions, focus, now).Scan(&analyticsID)
	if err != nil {
		return err
	}

	var taskID *string
	if id, ok := meta["taskId"].(string); ok && taskExists {
		taskID = &id
	}
	metaJSON, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	_, err = q.Exec(ctx, `INSERT INTO daily_activities (id, "dailyAnalyticsId", "taskId", type, metadata, "createdAt")
		VALUES ($1, $2, $3, $4::text::"ActivityType", $5::jsonb, $6)`,
		newID(), analyticsID, taskID, kind, string(metaJSON), now)
	return err
}
