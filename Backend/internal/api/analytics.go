package api

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"productivity/internal/compat"
	"productivity/internal/database"
	"productivity/internal/httpx"
	"productivity/internal/reqctx"
)

// The client sends `tz` = Date#getTimezoneOffset() (minutes, UTC - local).
// Every "day" below is a calendar day in the user's local time zone, encoded
// as a "YYYY-MM-DD" key.

const (
	dayLayout            = "2006-01-02"
	dailyGoalSeconds     = 4 * 60 * 60
	dayBucketHours       = 3
	recentActivityLimit  = 8
	maxTZOffsetMinutes   = 14 * 60
	analyticsFailMessage = "Failed to load analytics"
)

var (
	dayKeyPattern   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	monthKeyPattern = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)
)

/* ------------------------------ time helpers ------------------------------ */

func parseTZ(raw string) int {
	tz, ok := compat.ParseIntString(raw)
	if !ok || tz > maxTZOffsetMinutes || tz < -maxTZOffsetMinutes {
		return 0
	}
	return int(tz)
}

func tzOffset(tz int) time.Duration { return time.Duration(tz) * time.Minute }

func isDayKey(s string) bool {
	if !dayKeyPattern.MatchString(s) {
		return false
	}
	_, err := time.Parse(dayLayout, s)
	return err == nil
}

func keyTime(key string) time.Time {
	t, _ := time.Parse(dayLayout, key)
	return t
}

// dayKey is the local "YYYY-MM-DD" of an instant.
func dayKey(t time.Time, tz int) string { return t.Add(-tzOffset(tz)).UTC().Format(dayLayout) }

// dayStart is the UTC instant at which local day `key` starts.
func dayStart(key string, tz int) time.Time { return keyTime(key).Add(tzOffset(tz)) }

func shiftDay(key string, days int) string { return keyTime(key).AddDate(0, 0, days).Format(dayLayout) }

func localHour(t time.Time, tz int) int { return t.Add(-tzOffset(tz)).UTC().Hour() }

// weekStartKey is the Monday of the week containing `key`.
func weekStartKey(key string) string {
	weekday := int(keyTime(key).Weekday()) // 0 = Sunday
	return shiftDay(key, -((weekday + 6) % 7))
}

func daysBetween(from, to string) int {
	return compat.RoundInt(keyTime(to).Sub(keyTime(from)).Hours() / 24)
}

func pctDelta(current, previous int) int {
	if previous == 0 {
		if current > 0 {
			return 100
		}
		return 0
	}
	return compat.RoundInt(float64(current-previous) / float64(previous) * 100)
}

func toMinutes(seconds float64) int { return compat.RoundInt(seconds / 60) }

func relativeTime(t, now time.Time) string {
	seconds := max(0, int(now.Sub(t).Milliseconds()/1000))
	if seconds < 60 {
		return "just now"
	}
	minutes := seconds / 60
	if minutes < 60 {
		return strconv.Itoa(minutes) + "m ago"
	}
	hours := minutes / 60
	if hours < 24 {
		return strconv.Itoa(hours) + "h ago"
	}
	if days := hours / 24; days < 30 {
		return strconv.Itoa(days) + "d ago"
	}
	return t.Local().Format("Jan 2")
}

func formatShortDuration(seconds float64) string {
	m := compat.RoundInt(seconds / 60)
	if m < 60 {
		return strconv.Itoa(m) + " min"
	}
	h, rest := m/60, m%60
	if rest == 0 {
		return strconv.Itoa(h) + "h"
	}
	return strconv.Itoa(h) + "h " + strconv.Itoa(rest) + "m"
}

/* ----------------------------- session helpers ---------------------------- */

type focusSession struct {
	ID, TaskID      string
	StartedAt       time.Time
	EndedAt         *time.Time
	DurationSeconds *int
	TaskTitle       string
	WorkspaceName   *string
}

// bounds returns the effective [start, end]; open sessions run until now.
func (s *focusSession) bounds(now time.Time) (time.Time, time.Time) {
	end := now
	if s.EndedAt != nil {
		end = *s.EndedAt
	}
	if end.Before(s.StartedAt) {
		end = s.StartedAt
	}
	return s.StartedAt, end
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

// focusByDay splits every session across local days: dayKey -> seconds.
func focusByDay(sessions []focusSession, tz int, now time.Time) map[string]float64 {
	out := map[string]float64{}
	for i := range sessions {
		start, end := sessions[i].bounds(now)
		for cursor := start; cursor.Before(end); {
			key := dayKey(cursor, tz)
			sliceEnd := minTime(dayStart(shiftDay(key, 1), tz), end)
			out[key] += sliceEnd.Sub(cursor).Seconds()
			cursor = sliceEnd
		}
	}
	return out
}

// focusByBucket returns focus seconds per 3-hour bucket of local day `key`.
func focusByBucket(sessions []focusSession, key string, tz int, now time.Time) []float64 {
	buckets := make([]float64, 24/dayBucketHours)
	from, to := dayStart(key, tz), dayStart(shiftDay(key, 1), tz)
	for i := range sessions {
		start, end := sessions[i].bounds(now)
		cursor, stop := maxTime(start, from), minTime(end, to)
		for cursor.Before(stop) {
			bucket := localHour(cursor, tz) / dayBucketHours
			bucketEnd := from.Add(time.Duration(bucket+1) * dayBucketHours * time.Hour)
			sliceEnd := minTime(bucketEnd, stop)
			buckets[bucket] += sliceEnd.Sub(cursor).Seconds()
			cursor = sliceEnd
		}
	}
	return buckets
}

func bucketLabel(i int) string {
	hour := i * dayBucketHours
	switch {
	case hour == 0:
		return "12a"
	case hour == 12:
		return "12p"
	case hour < 12:
		return strconv.Itoa(hour) + "a"
	}
	return strconv.Itoa(hour-12) + "p"
}

func sumRange[V int | float64](m map[string]V, from, to string) V {
	var total V
	for k := from; k <= to; k = shiftDay(k, 1) {
		total += m[k]
	}
	return total
}

func countByDay(dates []*time.Time, tz int) map[string]int {
	out := map[string]int{}
	for _, d := range dates {
		if d != nil {
			out[dayKey(*d, tz)]++
		}
	}
	return out
}

func heatLevel(minutes, completed int) int {
	switch {
	case minutes <= 0:
		if completed > 0 {
			return 1
		}
		return 0
	case minutes < 30:
		return 1
	case minutes < 90:
		return 2
	case minutes < 180:
		return 3
	}
	return 4
}

type heatCell struct {
	Date      string `json:"date"`
	Minutes   int    `json:"minutes"`
	Completed int    `json:"completed"`
	Value     int    `json:"value"`
}

func buildHeatmap(from, to string, focus map[string]float64, completed map[string]int) []heatCell {
	cells := []heatCell{}
	for k := from; k <= to; k = shiftDay(k, 1) {
		minutes := toMinutes(focus[k])
		cells = append(cells, heatCell{Date: k, Minutes: minutes, Completed: completed[k], Value: heatLevel(minutes, completed[k])})
	}
	return cells
}

// sessionsOverlapping returns the user's sessions that overlap [from, to).
func sessionsOverlapping(ctx context.Context, q database.Querier, userID string, from, to time.Time) ([]focusSession, error) {
	rows, err := q.Query(ctx, `SELECT s.id, s."taskId", s."startedAt", s."endedAt", s."durationSeconds", t.title, w.name
		FROM task_sessions s
		JOIN tasks t ON t.id = s."taskId"
		LEFT JOIN workspaces w ON w.id = t."workspaceId"
		WHERE s."userId" = $1 AND s."startedAt" < $3 AND (s."endedAt" IS NULL OR s."endedAt" > $2)
		ORDER BY s."startedAt" ASC`, userID, from, to)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (focusSession, error) {
		var s focusSession
		err := row.Scan(&s.ID, &s.TaskID, &s.StartedAt, &s.EndedAt, &s.DurationSeconds, &s.TaskTitle, &s.WorkspaceName)
		return s, err
	})
}

/* ------------------------------ activity feed ----------------------------- */

var activityKind = map[string]string{
	"TASK_CREATED":      "created",
	"TASK_COMPLETED":    "completed",
	"TASK_STARTED":      "focus",
	"SESSION_COMPLETED": "focus",
	"SESSION_STARTED":   "focus",
	"TASK_UPDATED":      "comment",
	"STATUS_CHANGED":    "comment",
	"PRIORITY_CHANGED":  "comment",
	"DEADLINE_CHANGED":  "comment",
	"TASK_DELETED":      "milestone",
}

var statusLabel = map[string]string{
	"TODO": "To do", "IN_PROGRESS": "In progress", "ON_HOLD": "On hold", "COMPLETED": "Completed",
}

func metaString(meta map[string]any, key string) string {
	s, _ := meta[key].(string)
	return s
}

// jsNumber mirrors `Number(v) || 0`.
func jsNumber(v any) float64 {
	switch n := v.(type) {
	case float64:
		if math.IsNaN(n) {
			return 0
		}
		return n
	case string:
		if f, err := strconv.ParseFloat(strings.TrimSpace(n), 64); err == nil {
			return f
		}
	case bool:
		if n {
			return 1
		}
	}
	return 0
}

func activityText(kind, title string, meta map[string]any) string {
	name := `"` + title + `"`
	switch kind {
	case "TASK_CREATED":
		return "Created " + name
	case "TASK_COMPLETED":
		return "Completed " + name
	case "TASK_STARTED":
		return "Started working on " + name
	case "SESSION_COMPLETED":
		return "Logged a " + formatShortDuration(jsNumber(meta["seconds"])) + " focus session on " + name
	case "SESSION_STARTED":
		return "Started a focus session on " + name
	case "STATUS_CHANGED":
		to := metaString(meta, "to")
		label := statusLabel[to]
		if label == "" {
			label = orDefault(to, "a new status")
		}
		return "Moved " + name + " to " + label
	case "PRIORITY_CHANGED":
		return "Changed priority of " + name
	case "DEADLINE_CHANGED":
		return "Updated the deadline of " + name
	case "TASK_DELETED":
		return "Deleted " + name
	}
	return "Updated " + name
}

type activityItem struct {
	ID   string `json:"id"`
	Kind string `json:"kind"`
	Type string `json:"type"`
	Text string `json:"text"`
	Meta string `json:"meta"`
	Ago  string `json:"ago"`
	At   int64  `json:"at"`
}

func recentActivity(ctx context.Context, q database.Querier, userID string, now time.Time) ([]activityItem, error) {
	type row struct {
		id, kind      string
		meta          map[string]any
		createdAt     time.Time
		taskTitle     *string
		workspaceName *string
	}
	rows, err := q.Query(ctx, `SELECT a.id, a.type::text, a.metadata, a."createdAt", t.title, w.name
		FROM daily_activities a
		JOIN daily_analytics d ON d.id = a."dailyAnalyticsId"
		LEFT JOIN tasks t ON t.id = a."taskId"
		LEFT JOIN workspaces w ON w.id = t."workspaceId"
		WHERE d."userId" = $1
		ORDER BY a."createdAt" DESC LIMIT $2`, userID, recentActivityLimit)
	if err != nil {
		return nil, err
	}
	list, err := pgx.CollectRows(rows, func(cr pgx.CollectableRow) (row, error) {
		var r row
		var raw []byte
		err := cr.Scan(&r.id, &r.kind, &raw, &r.createdAt, &r.taskTitle, &r.workspaceName)
		if err == nil && len(raw) > 0 {
			_ = json.Unmarshal(raw, &r.meta) // non-object metadata is treated as empty
		}
		if r.meta == nil {
			r.meta = map[string]any{}
		}
		return r, err
	})
	if err != nil {
		return nil, err
	}

	// Deleted tasks keep their workspace id in metadata; resolve those names.
	var orphanIDs []string
	for _, r := range list {
		if r.taskTitle == nil {
			if id := metaString(r.meta, "workspaceId"); id != "" {
				orphanIDs = append(orphanIDs, id)
			}
		}
	}
	workspaceName := map[string]string{}
	if len(orphanIDs) > 0 {
		wsRows, err := q.Query(ctx, `SELECT id, name FROM workspaces WHERE "userId" = $1 AND id = ANY($2)`, userID, orphanIDs)
		if err != nil {
			return nil, err
		}
		for wsRows.Next() {
			var id, name string
			if err := wsRows.Scan(&id, &name); err != nil {
				wsRows.Close()
				return nil, err
			}
			workspaceName[id] = name
		}
		if err := wsRows.Err(); err != nil {
			return nil, err
		}
	}

	out := make([]activityItem, 0, len(list))
	for _, r := range list {
		title := orDefault(orDefault(deref(r.taskTitle), metaString(r.meta, "title")), "a task")
		meta := deref(r.workspaceName)
		if meta == "" {
			meta = orDefault(workspaceName[metaString(r.meta, "workspaceId")], "Workspace")
		}
		kind := activityKind[r.kind]
		if kind == "" {
			kind = "comment"
		}
		out = append(out, activityItem{
			ID: r.id, Kind: kind, Type: r.kind, Text: activityText(r.kind, title, r.meta),
			Meta: meta, Ago: relativeTime(r.createdAt, now), At: ms(r.createdAt),
		})
	}
	return out, nil
}

/* ----------------------------- completion rate ---------------------------- */

type taskDates struct{ createdAt, completedAt, deadlineDate *time.Time }

// completionRate = completed / tasks relevant in [from, to) (created,
// completed or due inside it).
func completionRate(tasks []taskDates, from, to time.Time) int {
	inRange := func(d *time.Time) bool { return d != nil && !d.Before(from) && d.Before(to) }
	relevant, completed := 0, 0
	for _, t := range tasks {
		done := inRange(t.completedAt)
		if done || inRange(t.createdAt) || inRange(t.deadlineDate) {
			relevant++
			if done {
				completed++
			}
		}
	}
	if relevant == 0 {
		return 0
	}
	return compat.RoundInt(float64(completed) / float64(relevant) * 100)
}

func (s *Server) analyticsError(w http.ResponseWriter, err error) {
	s.log.Error("analytics error", "error", err)
	httpx.Fail(w, http.StatusInternalServerError, analyticsFailMessage)
}

/* -------------------------------- handlers -------------------------------- */

type metric struct {
	Key           string `json:"key"`
	Label         string `json:"label"`
	Unit          string `json:"unit"`
	Today         int    `json:"today"`
	Yesterday     int    `json:"yesterday"`
	WeekTotal     int    `json:"weekTotal"`
	PrevWeekTotal int    `json:"prevWeekTotal"`
}

type seriesPoint struct {
	Label    string `json:"label"`
	Current  int    `json:"current"`
	Previous int    `json:"previous"`
}

// GET /api/analytics/overview?tz=
func (s *Server) analyticsOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	tz := parseTZ(r.URL.Query().Get("tz"))
	now := compat.Now()

	today := dayKey(now, tz)
	yesterday := shiftDay(today, -1)
	thisWeek := weekStartKey(today)
	lastWeek := shiftDay(thisWeek, -7)
	lastWeekEnd := shiftDay(thisWeek, -1)
	yearStart := today[:4] + "-01-01"
	rangeStartKey := min(yearStart, lastWeek)
	rangeFrom, rangeTo := dayStart(rangeStartKey, tz), dayStart(shiftDay(today, 1), tz)

	sessions, err := sessionsOverlapping(ctx, s.db, userID, rangeFrom, rangeTo)
	if err != nil {
		s.analyticsError(w, err)
		return
	}
	rows, err := s.db.Query(ctx, `SELECT "createdAt", "completedAt", "deadlineDate" FROM tasks
		WHERE "userId" = $1 AND ("createdAt" >= $2 OR "completedAt" >= $2 OR ("deadlineDate" >= $2 AND "deadlineDate" < $3))`,
		userID, rangeFrom, rangeTo)
	if err != nil {
		s.analyticsError(w, err)
		return
	}
	tasks, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (taskDates, error) {
		var t taskDates
		var created time.Time
		err := row.Scan(&created, &t.completedAt, &t.deadlineDate)
		t.createdAt = &created
		return t, err
	})
	if err != nil {
		s.analyticsError(w, err)
		return
	}
	activity, err := recentActivity(ctx, s.db, userID, now)
	if err != nil {
		s.analyticsError(w, err)
		return
	}

	focusMap := focusByDay(sessions, tz, now)
	completedDates := make([]*time.Time, len(tasks))
	for i := range tasks {
		completedDates[i] = tasks[i].completedAt
	}
	completedMap := countByDay(completedDates, tz)
	startDates := make([]*time.Time, len(sessions))
	for i := range sessions {
		startDates[i] = &sessions[i].StartedAt
	}
	sessionCountMap := countByDay(startDates, tz)

	rate := func(fromKey, toKey string) int {
		return completionRate(tasks, dayStart(fromKey, tz), dayStart(shiftDay(toKey, 1), tz))
	}
	focus := func(from, to string) int { return toMinutes(sumRange(focusMap, from, to)) }

	metrics := []metric{
		{"focus", "Focus time", "minutes", focus(today, today), focus(yesterday, yesterday),
			focus(thisWeek, today), focus(lastWeek, lastWeekEnd)},
		{"tasks", "Tasks completed", "count", sumRange(completedMap, today, today), sumRange(completedMap, yesterday, yesterday),
			sumRange(completedMap, thisWeek, today), sumRange(completedMap, lastWeek, lastWeekEnd)},
		{"rate", "Completion rate", "percent", rate(today, today), rate(yesterday, yesterday),
			rate(thisWeek, today), rate(lastWeek, lastWeekEnd)},
		{"sessions", "Focus sessions", "count", sumRange(sessionCountMap, today, today), sumRange(sessionCountMap, yesterday, yesterday),
			sumRange(sessionCountMap, thisWeek, today), sumRange(sessionCountMap, lastWeek, lastWeekEnd)},
	}

	weekSeries := make([]seriesPoint, 0, 7)
	for i, label := range []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"} {
		weekSeries = append(weekSeries, seriesPoint{label,
			toMinutes(focusMap[shiftDay(thisWeek, i)]), toMinutes(focusMap[shiftDay(lastWeek, i)])})
	}
	todayBuckets := focusByBucket(sessions, today, tz, now)
	yesterdayBuckets := focusByBucket(sessions, yesterday, tz, now)
	daySeries := make([]seriesPoint, len(todayBuckets))
	for i := range todayBuckets {
		daySeries[i] = seriesPoint{bucketLabel(i), toMinutes(todayBuckets[i]), toMinutes(yesterdayBuckets[i])}
	}

	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{
		"generatedAt": ms(now),
		"metrics":     metrics,
		"weekSeries":  weekSeries,
		"daySeries":   daySeries,
		"activity":    activity,
		"heatmap":     buildHeatmap(yearStart, today, focusMap, completedMap),
	}})
}

type sessionItem struct {
	ID              string  `json:"id"`
	TaskID          string  `json:"taskId"`
	TaskName        string  `json:"taskName"`
	WorkspaceName   *string `json:"workspaceName"`
	Start           string  `json:"start"`
	End             string  `json:"end"`
	DurationSeconds int     `json:"durationSeconds"`
	Running         bool    `json:"running"`
}

// GET /api/analytics/sessions?date=YYYY-MM-DD&tz=
func (s *Server) analyticsSessions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tz := parseTZ(r.URL.Query().Get("tz"))
	now := compat.Now()
	date := r.URL.Query().Get("date")
	if date == "" {
		date = dayKey(now, tz)
	}
	if !isDayKey(date) {
		httpx.Fail(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
		return
	}
	from, to := dayStart(date, tz), dayStart(shiftDay(date, 1), tz)
	rows, err := sessionsOverlapping(ctx, s.db, reqctx.UserID(ctx), from, to)
	if err != nil {
		s.analyticsError(w, err)
		return
	}

	sessions := []sessionItem{}
	for i := range rows {
		row := &rows[i]
		start, end := row.bounds(now)
		start, end = maxTime(start, from), minTime(end, to)
		item := sessionItem{
			ID: row.ID, TaskID: row.TaskID, TaskName: orDefault(row.TaskTitle, "Untitled task"),
			WorkspaceName: row.WorkspaceName, Start: compat.FormatISO(start), End: compat.FormatISO(end),
			DurationSeconds: max(0, int(end.Sub(start).Milliseconds()/1000)), Running: row.EndedAt == nil,
		}
		if item.DurationSeconds > 0 || item.Running {
			sessions = append(sessions, item)
		}
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{
		"date": date, "goalSeconds": dailyGoalSeconds, "sessions": sessions,
	}})
}

type achievementTier struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	RequiredHours int    `json:"requiredHours"`
	Color         string `json:"color"`
	Icon          string `json:"icon"`
}

type achievement struct {
	achievementTier
	Unlocked bool `json:"unlocked"`
	Progress int  `json:"progress"`
}

var achievementTiers = []achievementTier{
	{"starter", "Starter Spark", 1, "#94a3b8", "spark"},
	{"bronze", "Bronze Spark", 10, "#CD7F32", "spark"},
	{"silver", "Silver Spark", 25, "#A8A9AD", "spark"},
	{"gold", "Golden Spark", 50, "#DAA520", "spark"},
	{"diamond", "Diamond Spark", 100, "#5B9BD5", "diamond"},
	{"platinum", "Platinum Spark", 250, "#8B5CF6", "crown"},
	{"legendary", "Legendary Spark", 500, "#F59E0B", "star"},
}

type monthDay struct {
	Date         string `json:"date"`
	Completed    int    `json:"completed"`
	FocusMinutes int    `json:"focusMinutes"`
}

type focusDay struct {
	Date    string `json:"date"`
	Minutes int    `json:"minutes"`
}

type project struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Tint   string `json:"tint"`
	Icon   string `json:"icon"`
	Total  int    `json:"total"`
	Done   int    `json:"done"`
	Status string `json:"status"`
}

type profileTotals struct {
	completed      []*time.Time
	longestClosed  int
	totalClosed    int64
	openStarts     []time.Time
	projects       []project
	totalFocusHrs  int
	pfpFrame       string
	userFound      bool
}

func (s *Server) loadProfileTotals(ctx context.Context, userID string) (*profileTotals, error) {
	p := &profileTotals{pfpFrame: "none"}

	rows, err := s.db.Query(ctx, `SELECT "completedAt" FROM tasks WHERE "userId" = $1 AND "completedAt" IS NOT NULL`, userID)
	if err != nil {
		return nil, err
	}
	if p.completed, err = pgx.CollectRows(rows, pgx.RowTo[*time.Time]); err != nil {
		return nil, err
	}

	if err := s.db.QueryRow(ctx, `SELECT COALESCE(MAX("durationSeconds"), 0)::int, COALESCE(SUM("durationSeconds"), 0)::bigint
		FROM task_sessions WHERE "userId" = $1 AND "endedAt" IS NOT NULL`, userID).Scan(&p.longestClosed, &p.totalClosed); err != nil {
		return nil, err
	}

	rows, err = s.db.Query(ctx, `SELECT "startedAt" FROM task_sessions WHERE "userId" = $1 AND "endedAt" IS NULL`, userID)
	if err != nil {
		return nil, err
	}
	if p.openStarts, err = pgx.CollectRows(rows, pgx.RowTo[time.Time]); err != nil {
		return nil, err
	}

	rows, err = s.db.Query(ctx, `SELECT w.id, w.name, w.tint, w.icon,
			count(t.id)::int, (count(t.id) FILTER (WHERE t.status = 'COMPLETED'))::int
		FROM workspaces w LEFT JOIN tasks t ON t."workspaceId" = w.id AND t."userId" = $1
		WHERE w."userId" = $1 GROUP BY w.id ORDER BY w."updatedAt" DESC`, userID)
	if err != nil {
		return nil, err
	}
	if p.projects, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (project, error) {
		var pr project
		err := row.Scan(&pr.ID, &pr.Name, &pr.Tint, &pr.Icon, &pr.Total, &pr.Done)
		switch {
		case pr.Total == 0:
			pr.Status = "Planning"
		case pr.Done == pr.Total:
			pr.Status = "Done"
		default:
			pr.Status = "In progress"
		}
		return pr, err
	}); err != nil {
		return nil, err
	}

	err = s.db.QueryRow(ctx, `SELECT "totalFocusHours", "pfpFrame" FROM users WHERE id = $1`, userID).Scan(&p.totalFocusHrs, &p.pfpFrame)
	p.userFound = err == nil
	if err != nil && !database.IsNoRows(err) {
		return nil, err
	}
	return p, nil
}

// GET /api/analytics/profile?tz=&month=YYYY-MM
func (s *Server) analyticsProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := reqctx.UserID(ctx)
	tz := parseTZ(r.URL.Query().Get("tz"))
	now := compat.Now()
	today := dayKey(now, tz)
	yearStart := today[:4] + "-01-01"

	currentMonth := today[:7]
	month := r.URL.Query().Get("month")
	if !monthKeyPattern.MatchString(month) || month > currentMonth {
		month = currentMonth
	}
	monthStartKey := month + "-01"
	y, _ := strconv.Atoi(month[:4])
	m, _ := strconv.Atoi(month[5:])
	monthEndKey := time.Date(y, time.Month(m)+1, 0, 0, 0, 0, 0, time.UTC).Format(dayLayout)
	monthLastKey := min(monthEndKey, today)
	prevMonthStartKey := time.Date(y, time.Month(m)-1, 1, 0, 0, 0, 0, time.UTC).Format(dayLayout)
	prevMonthEndKey := shiftDay(monthStartKey, -1)

	last30Start := shiftDay(today, -29)
	prev30Start := shiftDay(today, -59)
	earliestKey := min(yearStart, prevMonthStartKey, prev30Start)

	sessions, err := sessionsOverlapping(ctx, s.db, userID, dayStart(earliestKey, tz), dayStart(shiftDay(today, 1), tz))
	if err != nil {
		s.analyticsError(w, err)
		return
	}
	totals, err := s.loadProfileTotals(ctx, userID)
	if err != nil {
		s.analyticsError(w, err)
		return
	}

	// All-time focus is measured exactly like the heatmap (per-day rounded
	// minutes, open sessions included) so the two numbers never disagree.
	allSessions, err := sessionsOverlapping(ctx, s.db, userID, time.Unix(0, 0), dayStart(shiftDay(today, 1), tz))
	if err != nil {
		s.analyticsError(w, err)
		return
	}
	allTimeFocusMinutes := 0
	for _, seconds := range focusByDay(allSessions, tz, now) {
		allTimeFocusMinutes += toMinutes(seconds)
	}
	allTimeFocusHours := allTimeFocusMinutes / 60
	if totals.userFound && allTimeFocusHours != totals.totalFocusHrs {
		if _, err := s.patchUser(ctx, s.db, userID, new(database.Sets).Add("totalFocusHours", allTimeFocusHours)); err != nil {
			s.analyticsError(w, err)
			return
		}
	}

	focusMap := focusByDay(sessions, tz, now)
	completedMap := countByDay(totals.completed, tz)

	// Headline stats. Days are visited in date order so ties resolve to the
	// earliest best day deterministically.
	activeDays := make([]string, 0, len(completedMap))
	for k := range completedMap {
		activeDays = append(activeDays, k)
	}
	sort.Strings(activeDays)

	var bestDay any
	bestCount := 0
	for _, k := range activeDays {
		if completedMap[k] > bestCount {
			bestCount = completedMap[k]
			bestDay = httpx.M{"date": k, "count": bestCount}
		}
	}

	longestOpen := 0
	for _, start := range totals.openStarts {
		sess := focusSession{StartedAt: start}
		a, b := sess.bounds(now)
		longestOpen = max(longestOpen, int(b.Sub(a).Milliseconds()/1000))
	}
	longestSession := max(totals.longestClosed, longestOpen)

	longestStreak, run, prev := 0, 0, ""
	for _, k := range activeDays {
		if prev != "" && daysBetween(prev, k) == 1 {
			run++
		} else {
			run = 1
		}
		longestStreak = max(longestStreak, run)
		prev = k
	}
	currentStreak := 0
	cursor := today
	if completedMap[today] == 0 {
		cursor = shiftDay(today, -1)
	}
	for completedMap[cursor] > 0 {
		currentStreak++
		cursor = shiftDay(cursor, -1)
	}

	// Month series always span the 1st through the last calendar day; days
	// after today are zero. Averages only count days that have elapsed.
	elapsedDays := daysBetween(monthStartKey, monthLastKey) + 1
	monthDays := []monthDay{}
	monthFocusDays := []focusDay{}
	monthCompleted, monthFocusTotal := 0, 0
	for k := monthStartKey; k <= monthEndKey; k = shiftDay(k, 1) {
		completed, minutes := 0, 0
		if k <= monthLastKey {
			completed, minutes = completedMap[k], toMinutes(focusMap[k])
		}
		monthDays = append(monthDays, monthDay{k, completed, minutes})
		monthFocusDays = append(monthFocusDays, focusDay{k, minutes})
		monthCompleted += completed
		monthFocusTotal += minutes
	}
	avgTasksPerDay := 0.0
	avgFocusMinutes := 0
	if elapsedDays > 0 {
		avgTasksPerDay = compat.Round(float64(monthCompleted)/float64(elapsedDays)*10) / 10
		avgFocusMinutes = compat.RoundInt(float64(monthFocusTotal) / float64(elapsedDays))
	}
	prevMonthFocusTotal := toMinutes(sumRange(focusMap, prevMonthStartKey, prevMonthEndKey))

	focusDays := []focusDay{}
	focusTotal := 0
	for k := last30Start; k <= today; k = shiftDay(k, 1) {
		minutes := toMinutes(focusMap[k])
		focusDays = append(focusDays, focusDay{k, minutes})
		focusTotal += minutes
	}
	focusPrevTotal := toMinutes(sumRange(focusMap, prev30Start, shiftDay(last30Start, -1)))

	achievements := make([]achievement, len(achievementTiers))
	var current any
	for i, tier := range achievementTiers {
		achievements[i] = achievement{
			achievementTier: tier,
			Unlocked:        allTimeFocusMinutes >= tier.RequiredHours*60,
			Progress:        min(100, compat.RoundInt(float64(allTimeFocusMinutes)/float64(tier.RequiredHours*60)*100)),
		}
		if achievements[i].Unlocked {
			current = achievements[i]
		}
	}

	projects := totals.projects
	if projects == nil {
		projects = []project{}
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{
		"generatedAt": ms(now),
		"stats": httpx.M{
			"totalCompleted":        len(totals.completed),
			"bestDay":               bestDay,
			"longestSessionSeconds": longestSession,
			"currentStreak":         currentStreak,
			"longestStreak":         longestStreak,
		},
		"heatmap": buildHeatmap(yearStart, today, focusMap, completedMap),
		"monthly": httpx.M{
			"month": month, "days": monthDays, "totalCompleted": monthCompleted, "avgTasksPerDay": avgTasksPerDay,
		},
		"focus30": httpx.M{
			"days": focusDays, "totalMinutes": focusTotal, "prevTotalMinutes": focusPrevTotal,
			"delta": pctDelta(focusTotal, focusPrevTotal),
		},
		"focusMonth": httpx.M{
			"month": month, "days": monthFocusDays, "totalMinutes": monthFocusTotal,
			"avgMinutesPerDay": avgFocusMinutes, "prevTotalMinutes": prevMonthFocusTotal,
			"delta": pctDelta(monthFocusTotal, prevMonthFocusTotal),
		},
		"projects":           projects,
		"achievements":       achievements,
		"currentAchievement": current,
		"totalFocusHours":    allTimeFocusHours,
		"pfpFrame":           totals.pfpFrame,
	}})
}
