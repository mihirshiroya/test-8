package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"productivity/internal/cache"
	"productivity/internal/config"
	"productivity/internal/database"
)

// These tests exercise the full HTTP stack against real PostgreSQL and Redis.
//
//	TEST_DATABASE_URL=postgres://postgres@localhost:5432/test?sslmode=disable \
//	TEST_REDIS_URL=redis://localhost:6379/15 go test ./internal/api/ -run Integration -v
//
// The database is migrated in place; use a disposable database.

type fakeMailer struct{}

func (fakeMailer) SendVerification(context.Context, string, string, string) error { return nil }
func (fakeMailer) SendPasswordReset(context.Context, string, string, string) error { return nil }
func (fakeMailer) SendWelcome(context.Context, string, string) error              { return nil }

type harness struct {
	t   *testing.T
	srv *httptest.Server
	api *Server
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	// Twice: the baseline must be idempotent (it also runs on Prisma-managed DBs).
	for i := 0; i < 2; i++ {
		if err := database.Migrate(ctx, dbURL, log); err != nil {
			t.Fatalf("migrate (run %d): %v", i+1, err)
		}
	}
	db, err := database.Connect(ctx, dbURL, 20)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(db.Close)

	store, err := cache.New(os.Getenv("TEST_REDIS_URL"), log)
	if err != nil {
		t.Fatalf("redis: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	if os.Getenv("TEST_REDIS_URL") != "" && !store.Ready() {
		t.Fatal("redis configured but not ready")
	}

	cfg := &config.Config{
		Env: "test", JWTSecret: "test-access-secret", JWTRefreshSecret: "test-refresh-secret",
		AccessTokenTTL: 15 * time.Minute, RefreshTokenTTL: 7 * 24 * time.Hour, BcryptRounds: 4,
		ClientURL: "http://localhost:3000",
	}
	s := New(Deps{Config: cfg, DB: db, Cache: store, Mailer: fakeMailer{}, Logger: log})
	srv := httptest.NewServer(s.Routes())
	t.Cleanup(srv.Close)
	return &harness{t: t, srv: srv, api: s}
}

type resp struct {
	status int
	body   map[string]any
	list   []any
	raw    string
}

func (h *harness) do(method, path, token string, body any) resp {
	h.t.Helper()
	var reader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, h.srv.URL+path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		h.t.Fatalf("%s %s: %v", method, path, err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	out := resp{status: res.StatusCode, raw: string(raw)}
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) > 0 && trimmed[0] == '[' {
		_ = json.Unmarshal(raw, &out.list)
	} else {
		_ = json.Unmarshal(raw, &out.body)
	}
	return out
}

func (h *harness) expect(r resp, status int, label string) resp {
	h.t.Helper()
	if r.status != status {
		h.t.Fatalf("%s: expected %d, got %d: %s", label, status, r.status, r.raw)
	}
	return r
}

func dig(v any, path ...string) any {
	for _, p := range path {
		m, ok := v.(map[string]any)
		if !ok {
			return nil
		}
		v = m[p]
	}
	return v
}

func str(v any, path ...string) string { s, _ := dig(v, path...).(string); return s }
func num(v any, path ...string) float64 { n, _ := dig(v, path...).(float64); return n }

func (h *harness) register(label string) string {
	h.t.Helper()
	email := fmt.Sprintf("%s-%d@example.com", label, time.Now().UnixNano())
	r := h.expect(h.do("POST", "/api/auth/register", "", map[string]any{
		"email": email, "password": "Passw0rd!x", "firstName": "Test", "lastName": "User",
	}), http.StatusCreated, "register")
	token := str(r.body, "data", "tokens", "accessToken")
	if token == "" {
		h.t.Fatalf("register returned no access token: %s", r.raw)
	}
	return token
}

func TestIntegrationWorkspacesAndTasks(t *testing.T) {
	h := newHarness(t)
	alice := h.register("alice")
	bob := h.register("bob")

	h.expect(h.do("GET", "/api/tasks", "", nil), http.StatusUnauthorized, "tasks without token")

	// ── Workspaces ──
	h.expect(h.do("POST", "/api/workspaces", alice, map[string]any{"name": "  "}), http.StatusBadRequest, "empty name")
	h.expect(h.do("POST", "/api/workspaces", alice, map[string]any{"name": "X", "tint": "bad tint!"}), http.StatusBadRequest, "bad tint")
	ws := h.expect(h.do("POST", "/api/workspaces", alice, map[string]any{"name": " Work ", "icon": "rocket"}), http.StatusCreated, "create workspace")
	wsID := str(ws.body, "data", "workspace", "id")
	if got := str(ws.body, "data", "workspace", "name"); got != "Work" {
		t.Fatalf("name not trimmed: %q", got)
	}
	if got := str(ws.body, "data", "workspace", "tint"); got != "lavender" {
		t.Fatalf("default tint: %q", got)
	}
	if num(ws.body, "data", "workspace", "createdAt") == 0 {
		t.Fatal("createdAt must be epoch millis")
	}
	ws2 := h.expect(h.do("POST", "/api/workspaces", alice, map[string]any{"name": "Archive"}), http.StatusCreated, "create workspace 2")
	ws2ID := str(ws2.body, "data", "workspace", "id")

	h.expect(h.do("GET", "/api/workspaces/"+wsID, bob, nil), http.StatusNotFound, "foreign workspace")
	h.expect(h.do("PATCH", "/api/workspaces/"+wsID, alice, map[string]any{}), http.StatusBadRequest, "empty patch")
	up := h.expect(h.do("PATCH", "/api/workspaces/"+wsID, alice, map[string]any{"description": nil, "tint": "mint"}), http.StatusOK, "patch workspace")
	if str(up.body, "data", "workspace", "tint") != "mint" {
		t.Fatalf("tint not updated: %s", up.raw)
	}

	// ── Task creation + validation ──
	bad := h.expect(h.do("POST", "/api/tasks", alice, map[string]any{"workspaceId": wsID, "status": "NOPE"}), http.StatusBadRequest, "invalid task")
	if !strings.Contains(str(bad.body, "error"), "Title is required") || !strings.Contains(str(bad.body, "error"), "Status must be one of") {
		t.Fatalf("validation message: %s", bad.raw)
	}
	h.expect(h.do("POST", "/api/tasks", alice, map[string]any{"title": "T", "workspaceId": wsID,
		"startDate": "2030-01-02", "deadlineDate": "2030-01-01"}), http.StatusBadRequest, "deadline before start")
	h.expect(h.do("POST", "/api/tasks", bob, map[string]any{"title": "T", "workspaceId": wsID}), http.StatusNotFound, "foreign workspace task")

	var ids []string
	for i := 0; i < 4; i++ {
		r := h.expect(h.do("POST", "/api/tasks", alice, map[string]any{"title": fmt.Sprintf("Task %d", i), "workspaceId": wsID}),
			http.StatusCreated, "create task")
		if num(r.body, "position") != float64(i) || str(r.body, "status") != "TODO" || str(r.body, "priority") != "MEDIUM" {
			t.Fatalf("unexpected task: %s", r.raw)
		}
		ids = append(ids, str(r.body, "id"))
	}

	// Cache warm-up, then a write must be visible immediately (Redis invalidation).
	list := h.expect(h.do("GET", "/api/tasks", alice, nil), http.StatusOK, "list tasks")
	if n := len(dig(list.body, "tasks").([]any)); n != 4 {
		t.Fatalf("expected 4 tasks, got %d", n)
	}
	h.expect(h.do("GET", "/api/tasks", alice, nil), http.StatusOK, "list tasks cached")
	h.expect(h.do("PATCH", "/api/tasks/"+ids[0], alice, map[string]any{"title": "Renamed", "priority": "HIGH"}), http.StatusOK, "update task")
	list = h.expect(h.do("GET", "/api/tasks", alice, nil), http.StatusOK, "list after update")
	if first := dig(list.body, "tasks").([]any)[0]; str(first, "title") != "Renamed" || str(first, "priority") != "HIGH" {
		t.Fatalf("stale cache after write: %v", first)
	}
	if n := len(dig(h.do("GET", "/api/tasks", bob, nil).body, "tasks").([]any)); n != 0 {
		t.Fatalf("bob sees %d of alice's tasks", n)
	}
	h.expect(h.do("GET", "/api/tasks/"+ids[0], bob, nil), http.StatusNotFound, "foreign task")

	// ── Single active session, even under concurrent starts ──
	var wg sync.WaitGroup
	statuses := make([]int, 3)
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			statuses[i] = h.do("POST", "/api/tasks/"+ids[i]+"/start", alice, nil).status
		}(i)
	}
	wg.Wait()
	started := 0
	for _, s := range statuses {
		if s == http.StatusOK {
			started++
		}
	}
	var open int
	if err := h.api.db.QueryRow(context.Background(),
		`SELECT count(*) FROM task_sessions s JOIN tasks t ON t.id = s."taskId" WHERE t.id = ANY($1) AND s."endedAt" IS NULL`,
		ids).Scan(&open); err != nil {
		t.Fatal(err)
	}
	if started != 1 || open != 1 {
		t.Fatalf("concurrent starts: %d succeeded, %d open sessions (statuses %v)", started, open, statuses)
	}

	active := dig(h.do("GET", "/api/tasks", alice, nil).body, "activeSession")
	activeTask := str(active, "taskId")
	if activeTask == "" {
		t.Fatal("activeSession missing")
	}
	sync1 := h.expect(h.do("POST", "/api/tasks/"+activeTask+"/sync", alice, nil), http.StatusOK, "sync")
	if _, ok := sync1.body["committedSeconds"]; !ok {
		t.Fatalf("sync response: %s", sync1.raw)
	}
	h.expect(h.do("POST", "/api/tasks/"+ids[3]+"/sync", alice, nil), http.StatusBadRequest, "sync without session")

	// Backdate the running session so hold commits real time.
	if _, err := h.api.db.Exec(context.Background(),
		`UPDATE task_sessions SET "startedAt" = "startedAt" - interval '90 seconds' WHERE "taskId" = $1 AND "endedAt" IS NULL`,
		activeTask); err != nil {
		t.Fatal(err)
	}
	held := h.expect(h.do("POST", "/api/tasks/"+activeTask+"/hold", alice, nil), http.StatusOK, "hold")
	if str(held.body, "status") != "ON_HOLD" || num(held.body, "spentSeconds") < 90 {
		t.Fatalf("hold: %s", held.raw)
	}

	// ── Completion threshold ──
	planned := h.expect(h.do("POST", "/api/tasks", alice, map[string]any{"title": "Planned", "workspaceId": wsID,
		"plannedDurationSeconds": "3600"}), http.StatusCreated, "planned task")
	plannedID := str(planned.body, "id")
	early := h.expect(h.do("POST", "/api/tasks/"+plannedID+"/complete", alice, nil), http.StatusBadRequest, "complete too early")
	if str(early.body, "error") != "Complete becomes available after 75% of the planned time is used" {
		t.Fatalf("threshold message: %s", early.raw)
	}
	done := h.expect(h.do("POST", "/api/tasks/"+ids[3]+"/complete", alice, nil), http.StatusOK, "complete")
	if str(done.body, "status") != "COMPLETED" || dig(done.body, "completedAt") == nil {
		t.Fatalf("complete: %s", done.raw)
	}
	h.expect(h.do("PATCH", "/api/tasks/"+ids[3], alice, map[string]any{"title": "x"}), http.StatusBadRequest, "update completed")
	h.expect(h.do("PATCH", "/api/tasks/"+ids[3]+"/move", alice, map[string]any{"status": "TODO"}), http.StatusBadRequest, "move completed")

	// ── Move + reorder keep columns dense ──
	h.expect(h.do("PATCH", "/api/tasks/"+plannedID+"/move", alice, map[string]any{"index": 0}), http.StatusOK, "move within column")
	moved := h.expect(h.do("PATCH", "/api/tasks/"+plannedID+"/move", alice, map[string]any{"workspaceId": ws2ID, "status": "IN_PROGRESS"}),
		http.StatusOK, "move across workspaces")
	if str(moved.body, "workspaceId") != ws2ID || str(moved.body, "status") != "IN_PROGRESS" || dig(moved.body, "startedAt") == nil {
		t.Fatalf("move: %s", moved.raw)
	}
	assertDense(t, h, alice, wsID, "TODO")

	todo := h.expect(h.do("GET", "/api/tasks?workspaceId="+wsID+"&status=TODO", alice, nil), http.StatusOK, "filtered list")
	var todoIDs []string
	for _, task := range dig(todo.body, "tasks").([]any) {
		todoIDs = append(todoIDs, str(task, "id"))
	}
	reversed := make([]string, len(todoIDs))
	for i, id := range todoIDs {
		reversed[len(todoIDs)-1-i] = id
	}
	reordered := h.expect(h.do("PATCH", "/api/tasks/reorder", alice, map[string]any{"workspaceId": wsID, "status": "TODO", "ids": reversed}),
		http.StatusOK, "reorder")
	for i, task := range reordered.list {
		if str(task, "id") != reversed[i] || num(task, "position") != float64(i) {
			t.Fatalf("reorder result: %s", reordered.raw)
		}
	}
	h.expect(h.do("PATCH", "/api/tasks/reorder", alice, map[string]any{"workspaceId": wsID, "status": "TODO", "ids": "x"}),
		http.StatusBadRequest, "reorder ids not array")

	today := h.expect(h.do("GET", "/api/tasks/today", alice, nil), http.StatusOK, "today")
	if len(today.list) == 0 {
		t.Fatalf("today list empty: %s", today.raw)
	}

	h.expect(h.do("DELETE", "/api/tasks/"+todoIDs[0], alice, nil), http.StatusNoContent, "delete task")
	assertDense(t, h, alice, wsID, "TODO")

	// ── Analytics ──
	overview := h.expect(h.do("GET", "/api/analytics/overview?tz=-330", alice, nil), http.StatusOK, "overview")
	metrics := dig(overview.body, "data", "metrics").([]any)
	if len(metrics) != 4 || len(dig(overview.body, "data", "daySeries").([]any)) != 8 || len(dig(overview.body, "data", "weekSeries").([]any)) != 7 {
		t.Fatalf("overview shape: %s", overview.raw)
	}
	if num(metrics[1], "today") < 1 {
		t.Fatalf("expected a completed task today: %v", metrics[1])
	}
	if num(metrics[0], "today") < 1 {
		t.Fatalf("expected focus minutes today: %v", metrics[0])
	}
	activity := dig(overview.body, "data", "activity").([]any)
	if len(activity) == 0 || len(activity) > 8 {
		t.Fatalf("activity feed: %d items", len(activity))
	}
	if str(activity[0], "text") == "" || str(activity[0], "ago") == "" {
		t.Fatalf("activity item: %v", activity[0])
	}

	sessions := h.expect(h.do("GET", "/api/analytics/sessions?tz=0", alice, nil), http.StatusOK, "sessions")
	items := dig(sessions.body, "data", "sessions").([]any)
	running := 0
	for _, it := range items {
		if dig(it, "running") == true {
			running++
		}
	}
	if len(items) < 2 || running != 1 || num(sessions.body, "data", "goalSeconds") != 14400 {
		t.Fatalf("sessions: %s", sessions.raw)
	}
	h.expect(h.do("GET", "/api/analytics/sessions?date=2024-13-01", alice, nil), http.StatusBadRequest, "bad date")

	profile := h.expect(h.do("GET", "/api/analytics/profile?month=2999-01", alice, nil), http.StatusOK, "profile")
	data := dig(profile.body, "data")
	if len(dig(data, "achievements").([]any)) != 7 || len(dig(data, "projects").([]any)) != 2 ||
		num(data, "stats", "totalCompleted") != 1 || num(data, "stats", "currentStreak") != 1 {
		t.Fatalf("profile: %s", profile.raw)
	}
	if month := str(data, "monthly", "month"); month > time.Now().UTC().AddDate(0, 0, 1).Format("2006-01") {
		t.Fatalf("future month not clamped: %s", month)
	}

	// Deleting a workspace cascades to its tasks.
	h.expect(h.do("DELETE", "/api/workspaces/"+ws2ID, alice, nil), http.StatusOK, "delete workspace")
	h.expect(h.do("GET", "/api/tasks/"+plannedID, alice, nil), http.StatusNotFound, "cascaded task")
	if dig(h.do("GET", "/api/tasks", alice, nil).body, "activeSession") != nil {
		t.Fatal("active session should be gone with its task")
	}
}

func assertDense(t *testing.T, h *harness, token, wsID, status string) {
	t.Helper()
	r := h.expect(h.do("GET", "/api/tasks?workspaceId="+wsID+"&status="+status, token, nil), http.StatusOK, "column")
	for i, task := range dig(r.body, "tasks").([]any) {
		if num(task, "position") != float64(i) {
			t.Fatalf("column %s not dense: %s", status, r.raw)
		}
	}
}

func TestIntegrationNotes(t *testing.T) {
	h := newHarness(t)
	alice := h.register("notes-alice")
	bob := h.register("notes-bob")

	h.expect(h.do("POST", "/api/notes", alice, map[string]any{"title": ""}), http.StatusBadRequest, "note without title")
	h.expect(h.do("POST", "/api/notes", alice, map[string]any{"title": "N", "tint": "black"}), http.StatusBadRequest, "bad tint")
	h.expect(h.do("POST", "/api/notes", alice, map[string]any{"title": "N", "topics": "nope"}), http.StatusBadRequest, "topics not array")

	created := h.expect(h.do("POST", "/api/notes", alice, map[string]any{
		"title": "Go notes", "tint": "violet",
		"topics": []any{
			map[string]any{"title": "Basics", "subtopics": []any{
				map[string]any{"title": "Syntax", "description": "  ", "content": []any{
					map[string]any{"type": "code", "content": "fmt.Println()", "language": "go"},
					map[string]any{"type": "bogus", "content": 5, "title": "Note"},
				}},
				map[string]any{"title": ""},
			}},
			"not-an-object",
		},
	}), http.StatusCreated, "create note")
	noteID := str(created.body, "data", "folder", "id")
	folder := dig(created.body, "data", "folder")
	if num(folder, "items") != 2 || str(folder, "tint") != "violet" || str(folder, "icon") != "folder" {
		t.Fatalf("folder: %v", folder)
	}
	topics := dig(created.body, "data", "doc", "topics").([]any)
	if len(topics) != 2 || str(topics[1], "title") != "Untitled topic" {
		t.Fatalf("topics: %s", created.raw)
	}
	subs := dig(topics[0], "subtopics").([]any)
	if str(subs[1], "title") != "Untitled subtopic" {
		t.Fatalf("subtopic default title: %v", subs[1])
	}
	if _, has := subs[0].(map[string]any)["description"]; has {
		t.Fatalf("blank description must be omitted: %v", subs[0])
	}
	contents := dig(subs[0], "content").([]any)
	if len(contents) != 2 || str(contents[0], "language") != "go" || str(contents[1], "type") != "text" || str(contents[1], "content") != "" {
		t.Fatalf("contents: %v", contents)
	}
	if _, has := contents[0].(map[string]any)["title"]; has {
		t.Fatalf("missing title must be omitted: %v", contents[0])
	}

	h.expect(h.do("GET", "/api/notes/"+noteID, bob, nil), http.StatusNotFound, "foreign note")
	got := h.expect(h.do("GET", "/api/notes/"+noteID, alice, nil), http.StatusOK, "get note")
	if len(dig(got.body, "data", "doc", "topics").([]any)) != 2 {
		t.Fatalf("get note: %s", got.raw)
	}

	topic := h.expect(h.do("POST", "/api/notes/"+noteID+"/topics", alice, map[string]any{"title": "Advanced"}), http.StatusCreated, "add topic")
	topicID := str(topic.body, "data", "topic", "id")
	h.expect(h.do("PATCH", "/api/notes/topics/"+topicID, bob, map[string]any{"title": "Hijack"}), http.StatusNotFound, "foreign topic")
	h.expect(h.do("PATCH", "/api/notes/topics/"+topicID, alice, map[string]any{"title": "Concurrency"}), http.StatusOK, "rename topic")

	sub := h.expect(h.do("POST", "/api/notes/topics/"+topicID+"/subtopics", alice, map[string]any{"title": "Channels", "description": "CSP"}),
		http.StatusCreated, "add subtopic")
	subID := str(sub.body, "data", "subtopic", "id")
	if num(sub.body, "data", "folder", "items") != 3 {
		t.Fatalf("items after add: %s", sub.raw)
	}
	h.expect(h.do("PATCH", "/api/notes/subtopics/"+subID, alice, map[string]any{}), http.StatusBadRequest, "empty subtopic patch")
	h.expect(h.do("PATCH", "/api/notes/subtopics/"+subID, alice, map[string]any{"description": ""}), http.StatusOK, "clear description")

	content := h.expect(h.do("POST", "/api/notes/subtopics/"+subID+"/content", alice, map[string]any{"content": "chan int"}),
		http.StatusCreated, "add content")
	contentID := str(content.body, "data", "content", "id")
	h.expect(h.do("POST", "/api/notes/subtopics/"+subID+"/content", alice, map[string]any{"content": 1}), http.StatusBadRequest, "non-string content")
	upd := h.expect(h.do("PATCH", "/api/notes/content/"+contentID, alice, map[string]any{"type": "code", "language": "go", "title": "Example"}),
		http.StatusOK, "update content")
	if str(upd.body, "data", "content", "type") != "code" || str(upd.body, "data", "content", "title") != "Example" {
		t.Fatalf("update content: %s", upd.raw)
	}
	h.expect(h.do("DELETE", "/api/notes/content/"+contentID, bob, nil), http.StatusNotFound, "foreign content")
	h.expect(h.do("DELETE", "/api/notes/content/"+contentID, alice, nil), http.StatusOK, "delete content")
	h.expect(h.do("DELETE", "/api/notes/subtopics/"+subID, alice, nil), http.StatusOK, "delete subtopic")
	h.expect(h.do("DELETE", "/api/notes/topics/"+topicID, alice, nil), http.StatusOK, "delete topic")

	h.expect(h.do("PUT", "/api/notes/"+noteID+"/doc", alice, map[string]any{"doc": []any{}}), http.StatusBadRequest, "doc not object")
	replaced := h.expect(h.do("PUT", "/api/notes/"+noteID+"/doc", alice, map[string]any{"doc": map[string]any{"topics": []any{
		map[string]any{"title": "Only"},
	}}}), http.StatusOK, "replace doc")
	if len(dig(replaced.body, "data", "doc", "topics").([]any)) != 1 || num(replaced.body, "data", "folder", "items") != 0 {
		t.Fatalf("replace doc: %s", replaced.raw)
	}

	h.expect(h.do("PATCH", "/api/notes/"+noteID, alice, map[string]any{"icon": "rocket"}), http.StatusOK, "update note")
	list := h.expect(h.do("GET", "/api/notes", alice, nil), http.StatusOK, "list notes")
	folders := dig(list.body, "data", "folders").([]any)
	if len(folders) != 1 || str(folders[0], "icon") != "rocket" {
		t.Fatalf("list notes (cache invalidation): %s", list.raw)
	}
	h.expect(h.do("DELETE", "/api/notes/"+noteID, bob, nil), http.StatusNotFound, "foreign delete")
	h.expect(h.do("DELETE", "/api/notes/"+noteID, alice, nil), http.StatusOK, "delete note")
	if len(dig(h.do("GET", "/api/notes", alice, nil).body, "data", "folders").([]any)) != 0 {
		t.Fatal("note still listed after delete")
	}
}
