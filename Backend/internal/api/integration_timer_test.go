package api

import (
	"bufio"
	"context"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestIntegrationGlobalTimer(t *testing.T) {
	h := newHarness(t)
	alice := h.register("timer-alice")
	bob := h.register("timer-bob")

	h.expect(h.do("GET", "/api/timer", "", nil), http.StatusUnauthorized, "timer without token")

	idle := h.expect(h.do("GET", "/api/timer", alice, nil), http.StatusOK, "idle timer")
	if str(idle.body, "status") != timerIdle || dig(idle.body, "taskId") != nil {
		t.Fatalf("expected idle timer: %s", idle.raw)
	}
	h.expect(h.do("POST", "/api/timer/start", alice, nil), http.StatusBadRequest, "resume with nothing paused")
	h.expect(h.do("POST", "/api/timer/toggle", alice, nil), http.StatusBadRequest, "toggle with nothing paused")

	ws := h.expect(h.do("POST", "/api/workspaces", alice, map[string]any{"name": "Focus"}), http.StatusCreated, "workspace")
	wsID := str(ws.body, "data", "workspace", "id")
	task := h.expect(h.do("POST", "/api/tasks", alice, map[string]any{"title": "Deep work", "workspaceId": wsID,
		"plannedDurationSeconds": "600"}), http.StatusCreated, "task")
	taskID := str(task.body, "id")

	h.expect(h.do("POST", "/api/timer/start", bob, map[string]any{"taskId": taskID}), http.StatusNotFound, "start foreign task")

	// The SSE stream must push a state event when another client starts the timer.
	events := openTimerStream(t, h, alice)
	if ev := events.next(t); ev != "state" {
		t.Fatalf("expected initial state event, got %q", ev)
	}

	running := h.expect(h.do("POST", "/api/timer/start", alice, map[string]any{"taskId": taskID}), http.StatusOK, "start")
	if str(running.body, "status") != timerRunning || str(running.body, "taskId") != taskID ||
		str(running.body, "sessionType") != "focus" || num(running.body, "plannedSeconds") != 600 ||
		dig(running.body, "sessionStartedAt") == nil {
		t.Fatalf("running timer: %s", running.raw)
	}
	if ev := events.next(t); ev != "state" {
		t.Fatalf("expected pushed state event after start, got %q", ev)
	}

	// Starting again must not open a second session.
	h.expect(h.do("POST", "/api/timer/start", alice, nil), http.StatusOK, "idempotent resume")
	if n := h.openSessions(t, taskID); n != 1 {
		t.Fatalf("expected exactly one open session, got %d", n)
	}

	// Elapsed time is derived from wall-clock timestamps, so a gap (e.g. sleep) is counted.
	h.backdateOpenSession(t, taskID, 120)
	afterSleep := h.expect(h.do("GET", "/api/timer", alice, nil), http.StatusOK, "after sleep")
	if s := num(afterSleep.body, "spentSeconds"); s < 120 {
		t.Fatalf("spent seconds should include the backdated gap, got %v", s)
	}
	if r := num(afterSleep.body, "remainingSeconds"); r > 480 {
		t.Fatalf("remaining should be <= 480, got %v", r)
	}

	paused := h.expect(h.do("POST", "/api/timer/toggle", alice, nil), http.StatusOK, "toggle pause")
	if str(paused.body, "status") != timerPaused || num(paused.body, "spentSeconds") < 120 {
		t.Fatalf("paused timer: %s", paused.raw)
	}
	h.expect(h.do("POST", "/api/timer/pause", alice, nil), http.StatusOK, "pause when already paused")

	resumed := h.expect(h.do("POST", "/api/timer/toggle", alice, nil), http.StatusOK, "toggle resume")
	if str(resumed.body, "status") != timerRunning || str(resumed.body, "taskId") != taskID {
		t.Fatalf("resumed timer: %s", resumed.raw)
	}

	// Reset discards only the running session; earlier committed time stays.
	h.backdateOpenSession(t, taskID, 60)
	reset := h.expect(h.do("POST", "/api/timer/reset", alice, nil), http.StatusOK, "reset")
	spent := num(reset.body, "spentSeconds")
	if str(reset.body, "status") != timerPaused || spent < 120 || spent >= 180 {
		t.Fatalf("reset timer: %s", reset.raw)
	}
	if n := h.openSessions(t, taskID); n != 0 {
		t.Fatalf("reset left %d open sessions", n)
	}

	// Past the plan the session reports overtime.
	h.expect(h.do("POST", "/api/timer/start", alice, nil), http.StatusOK, "resume for overtime")
	h.backdateOpenSession(t, taskID, 600)
	over := h.expect(h.do("GET", "/api/timer", alice, nil), http.StatusOK, "overtime")
	if str(over.body, "sessionType") != "overtime" || num(over.body, "remainingSeconds") != 0 {
		t.Fatalf("overtime timer: %s", over.raw)
	}

	if other := h.expect(h.do("GET", "/api/timer", bob, nil), http.StatusOK, "bob timer"); str(other.body, "status") != timerIdle {
		t.Fatalf("timer leaked across users: %s", other.raw)
	}
}

func (h *harness) openSessions(t *testing.T, taskID string) int {
	t.Helper()
	var n int
	if err := h.api.db.QueryRow(context.Background(),
		`SELECT count(*) FROM task_sessions WHERE "taskId" = $1 AND "endedAt" IS NULL`, taskID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func (h *harness) backdateOpenSession(t *testing.T, taskID string, seconds int) {
	t.Helper()
	if _, err := h.api.db.Exec(context.Background(),
		`UPDATE task_sessions SET "startedAt" = "startedAt" - make_interval(secs => $2) WHERE "taskId" = $1 AND "endedAt" IS NULL`,
		taskID, seconds); err != nil {
		t.Fatal(err)
	}
}

type sseReader struct {
	names chan string
}

func openTimerStream(t *testing.T, h *harness, token string) *sseReader {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	req, _ := http.NewRequestWithContext(ctx, "GET", h.srv.URL+"/api/timer/events", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("open timer stream: %v", err)
	}
	if res.StatusCode != http.StatusOK || !strings.HasPrefix(res.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatalf("timer stream: status %d, content-type %q", res.StatusCode, res.Header.Get("Content-Type"))
	}
	r := &sseReader{names: make(chan string, 16)}
	go func() {
		defer res.Body.Close()
		scanner := bufio.NewScanner(res.Body)
		for scanner.Scan() {
			if name, ok := strings.CutPrefix(scanner.Text(), "event: "); ok {
				r.names <- name
			}
		}
	}()
	return r
}

func (r *sseReader) next(t *testing.T) string {
	t.Helper()
	select {
	case name := <-r.names:
		return name
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for timer event")
		return ""
	}
}
