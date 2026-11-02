package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"productivity/internal/compat"
	"productivity/internal/database"
	"productivity/internal/httpx"
	"productivity/internal/reqctx"
)

// The global timer is the user's active task countdown. Its single source of
// truth is the task_sessions table: an open session (endedAt IS NULL) means
// "running", and elapsed time is always derived from wall-clock timestamps.
// That makes the timer survive window closes, app restarts and system sleep
// without drift, and the per-user advisory lock in start/hold prevents
// duplicate or conflicting sessions.

const (
	timerIdle    = "idle"
	timerRunning = "running"
	timerPaused  = "paused"

	// timerRefreshEvery re-reads state for every open stream. Besides acting
	// as a keep-alive, it catches changes made by other devices and wall-clock
	// jumps after the computer wakes from sleep.
	timerRefreshEvery = 15 * time.Second
)

type timerState struct {
	Status           string  `json:"status"`
	SessionType      string  `json:"sessionType"` // "focus", "overtime" or "none"
	TaskID           *string `json:"taskId"`
	TaskTitle        string  `json:"taskTitle"`
	WorkspaceID      *string `json:"workspaceId"`
	WorkspaceName    string  `json:"workspaceName"`
	PlannedSeconds   int     `json:"plannedSeconds"`
	SpentSeconds     int     `json:"spentSeconds"`
	RemainingSeconds int     `json:"remainingSeconds"`
	SessionStartedAt *int64  `json:"sessionStartedAt"`
	ServerTime       int64   `json:"serverTime"`
}

// loadTimerState derives the timer from the database. When nothing is running,
// the most recently held task is reported as "paused" so Start resumes it.
func loadTimerState(ctx context.Context, q database.Querier, userID string) (*timerState, error) {
	now := compat.Now()
	state := &timerState{Status: timerIdle, SessionType: "none", ServerTime: ms(now)}

	session, err := findActiveSession(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	var task *taskRow
	if session != nil {
		if task, err = findOwnedTask(ctx, q, session.TaskID, userID); err != nil {
			return nil, err
		}
	}

	if task != nil {
		state.Status = timerRunning
		started := ms(session.StartedAt)
		state.SessionStartedAt = &started
		if state.SpentSeconds, err = liveSpentSeconds(ctx, q, task.ID); err != nil {
			return nil, err
		}
	} else {
		task, err = scanTask(q.QueryRow(ctx, `SELECT `+taskColumns+` FROM tasks
			WHERE "userId" = $1 AND status = 'ON_HOLD' ORDER BY "updatedAt" DESC LIMIT 1`, userID))
		if err != nil {
			return nil, err
		}
		if task == nil {
			return state, nil
		}
		state.Status = timerPaused
		if state.SpentSeconds, err = spentSeconds(ctx, q, task.ID); err != nil {
			return nil, err
		}
	}

	var workspaceName string
	if err := q.QueryRow(ctx, `SELECT name FROM workspaces WHERE id = $1`, task.WorkspaceID).Scan(&workspaceName); err != nil && !database.IsNoRows(err) {
		return nil, err
	}

	state.TaskID = &task.ID
	state.TaskTitle = task.Title
	state.WorkspaceID = &task.WorkspaceID
	state.WorkspaceName = workspaceName
	state.PlannedSeconds = task.PlannedDurationSeconds
	state.RemainingSeconds = max(0, task.PlannedDurationSeconds-state.SpentSeconds)
	state.SessionType = "focus"
	if task.PlannedDurationSeconds > 0 && state.SpentSeconds >= task.PlannedDurationSeconds {
		state.SessionType = "overtime"
	}
	return state, nil
}

/* ---------------------------------- hub ----------------------------------- */

// timerHub fans out "state changed" signals to every open stream of a user
// (dashboard, floating widget, tray relay) so all views update instantly.
type timerHub struct {
	mu     sync.Mutex
	subs   map[string]map[chan struct{}]struct{}
	closed chan struct{}
	once   sync.Once
}

func newTimerHub() *timerHub {
	return &timerHub{subs: map[string]map[chan struct{}]struct{}{}, closed: make(chan struct{})}
}

func (h *timerHub) subscribe(userID string) (<-chan struct{}, func()) {
	ch := make(chan struct{}, 1)
	h.mu.Lock()
	if h.subs[userID] == nil {
		h.subs[userID] = map[chan struct{}]struct{}{}
	}
	h.subs[userID][ch] = struct{}{}
	h.mu.Unlock()
	return ch, func() {
		h.mu.Lock()
		delete(h.subs[userID], ch)
		if len(h.subs[userID]) == 0 {
			delete(h.subs, userID)
		}
		h.mu.Unlock()
	}
}

func (h *timerHub) notify(userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs[userID] {
		select {
		case ch <- struct{}{}:
		default: // a signal is already pending; the stream will reload anyway
		}
	}
}

// close ends every stream so graceful shutdown is not held open by SSE.
func (h *timerHub) close() { h.once.Do(func() { close(h.closed) }) }

// CloseStreams is registered with http.Server.RegisterOnShutdown.
func (s *Server) CloseStreams() { s.timers.close() }

// notifyTimer signals the hub after any successful write that may change the
// timer (task start/hold/complete/move/delete, workspace delete, timer actions).
func (s *Server) notifyTimer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		rec := &statusRecorder{ResponseWriter: w}
		next.ServeHTTP(rec, r)
		if rec.status < http.StatusBadRequest {
			if userID := reqctx.UserID(r.Context()); userID != "" {
				s.timers.notify(userID)
			}
		}
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	if s.status == 0 {
		s.status = code
	}
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	return s.ResponseWriter.Write(b)
}

func (s *statusRecorder) Unwrap() http.ResponseWriter { return s.ResponseWriter }

/* -------------------------------- handlers -------------------------------- */

func (s *Server) respondTimer(w http.ResponseWriter, ctx context.Context, userID string) {
	state, err := loadTimerState(ctx, s.db, userID)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, state)
}

// GET /api/timer
func (s *Server) getTimer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	s.respondTimer(w, ctx, reqctx.UserID(ctx))
}

// POST /api/timer/start — body {taskId?}. Without a taskId it resumes the
// most recently paused task.
func (s *Server) timerStart(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	if err := s.startTimer(ctx, userID, httpx.BodyFrom(r).Trim("taskId")); err != nil {
		s.taskTxError(w, err)
		return
	}
	s.respondTimer(w, ctx, userID)
}

// POST /api/timer/pause
func (s *Server) timerPause(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	if err := s.pauseTimer(ctx, userID); err != nil {
		s.taskTxError(w, err)
		return
	}
	s.respondTimer(w, ctx, userID)
}

// POST /api/timer/toggle — used by the tray and the global shortcut.
func (s *Server) timerToggle(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	active, err := findActiveSession(ctx, s.db, userID)
	if err != nil {
		s.taskServerError(w, err)
		return
	}
	if active != nil {
		err = s.pauseTimer(ctx, userID)
	} else {
		err = s.startTimer(ctx, userID, "")
	}
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	s.respondTimer(w, ctx, userID)
}

// POST /api/timer/reset — discards the running session's uncommitted time and
// puts the task on hold. Time from earlier sessions is kept.
func (s *Server) timerReset(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	err := s.inUserTx(ctx, userID, func(tx pgx.Tx) error {
		session, err := findActiveSession(ctx, tx, userID)
		if err != nil || session == nil {
			return err
		}
		task, err := requireTask(ctx, tx, session.TaskID, userID)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM task_sessions WHERE id = $1 AND "endedAt" IS NULL`, session.ID); err != nil {
			return err
		}
		if _, err := transitionTask(ctx, tx, userID, task, statusOnHold, nil); err != nil {
			return err
		}
		return recordActivity(ctx, tx, userID, "STATUS_CHANGED",
			activityMeta{"taskId": task.ID, "from": task.Status, "to": statusOnHold}, true)
	})
	if err != nil {
		s.taskTxError(w, err)
		return
	}
	s.respondTimer(w, ctx, userID)
}

func (s *Server) startTimer(ctx context.Context, userID, taskID string) error {
	if taskID == "" {
		state, err := loadTimerState(ctx, s.db, userID)
		if err != nil {
			return err
		}
		if state.Status == timerRunning {
			return nil
		}
		if state.TaskID == nil {
			return reject(http.StatusBadRequest, "No paused task to resume. Start a task from the board first.")
		}
		taskID = *state.TaskID
	}
	_, err := s.startTaskTx(ctx, userID, taskID)
	return err
}

func (s *Server) pauseTimer(ctx context.Context, userID string) error {
	active, err := findActiveSession(ctx, s.db, userID)
	if err != nil || active == nil {
		return err
	}
	_, err = s.holdTaskTx(ctx, userID, active.TaskID)
	return err
}

// GET /api/timer/events — Server-Sent Events stream of timer state.
//
//	event: state      full timerState, on every change and every 15s
//	event: completed  the running task just reached its planned duration
//	event: unavailable the database could not be read (client shows reconnect)
func (s *Server) timerEvents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)

	rc := http.NewResponseController(w)
	// Long-lived stream: lift the server-wide read/write timeouts.
	_ = rc.SetReadDeadline(time.Time{})
	_ = rc.SetWriteDeadline(time.Time{})

	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache, no-transform")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	changes, unsubscribe := s.timers.subscribe(userID)
	defer unsubscribe()

	refresh := time.NewTicker(timerRefreshEvery)
	defer refresh.Stop()
	// Fires exactly when the running task reaches its plan, so the completion
	// event is on time rather than up to 15s late.
	completion := time.NewTimer(time.Hour)
	completion.Stop()
	defer completion.Stop()

	var last *timerState
	send := func() bool {
		state, err := loadTimerState(ctx, s.db, userID)
		if err != nil {
			if ctx.Err() != nil {
				return false
			}
			s.log.Warn("timer stream load failed", "error", err)
			return writeSSE(w, rc, "unavailable", httpx.M{"message": "The database is unavailable."}) == nil
		}
		if reachedPlan(last, state) {
			if writeSSE(w, rc, "completed", state) != nil {
				return false
			}
		}
		last = state
		if state.Status == timerRunning && state.RemainingSeconds > 0 {
			completion.Reset(time.Duration(state.RemainingSeconds)*time.Second + 500*time.Millisecond)
		}
		return writeSSE(w, rc, "state", state) == nil
	}

	if !send() {
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.timers.closed:
			return
		case <-changes:
		case <-refresh.C:
		case <-completion.C:
		}
		if !send() {
			return
		}
	}
}

// reachedPlan is true once, on the transition into overtime of the same
// running task, so each stream reports a completion a single time.
func reachedPlan(prev, next *timerState) bool {
	return prev != nil && next.Status == timerRunning && next.PlannedSeconds > 0 &&
		prev.TaskID != nil && next.TaskID != nil && *prev.TaskID == *next.TaskID &&
		prev.RemainingSeconds > 0 && next.RemainingSeconds == 0
}

func writeSSE(w http.ResponseWriter, rc *http.ResponseController, event string, data any) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, payload); err != nil {
		return err
	}
	return rc.Flush()
}
