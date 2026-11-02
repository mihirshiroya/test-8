package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"productivity/internal/compat"
	"productivity/internal/database"
	"productivity/internal/httpx"
	"productivity/internal/reqctx"
)

var (
	contentTypes = []string{"text", "code"}
	noteTints    = []string{"blue", "violet", "pink", "amber", "emerald", "rose", "cyan", "lime"}
	noteIcons    = []string{"folder", "doc", "image", "star", "work", "heart", "code", "music", "rocket", "camera"}
)

func oneOfMessage(field string, list []string) string {
	return field + " must be one of: " + strings.Join(list, ", ")
}

/* ------------------------------- serializers ------------------------------ */

type folderJSON struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Tint      string `json:"tint"`
	Icon      string `json:"icon"`
	Items     int    `json:"items"`
	UpdatedAt int64  `json:"updatedAt"`
}

// Optional fields use omitempty: the Node serializers turned null into
// `undefined`, which JSON.stringify drops.
type contentJSON struct {
	ID       string `json:"id"`
	Title    string `json:"title,omitempty"`
	Type     string `json:"type"`
	Content  string `json:"content"`
	Language string `json:"language,omitempty"`
}

type subtopicJSON struct {
	ID          string        `json:"id"`
	Title       string        `json:"title"`
	Description string        `json:"description,omitempty"`
	Content     []contentJSON `json:"content"`
}

type subtopicSummaryJSON struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

type topicJSON struct {
	ID        string         `json:"id"`
	Title     string         `json:"title"`
	Subtopics []subtopicJSON `json:"subtopics"`
}

type docJSON struct {
	Topics []topicJSON `json:"topics"`
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// nullIfEmpty mirrors `clean(v) || null`.
func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

/* --------------------------------- queries -------------------------------- */

const folderSelect = `SELECT n.id, n.title, n.tint::text, n.icon::text, n."updatedAt",
	(SELECT count(*) FROM subtopics s JOIN topics t ON t.id = s."topicId" WHERE t."noteId" = n.id)::int
	FROM notes n`

func scanFolder(row pgx.Row) (*folderJSON, error) {
	var f folderJSON
	var updated time.Time
	err := row.Scan(&f.ID, &f.Title, &f.Tint, &f.Icon, &updated, &f.Items)
	if database.IsNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	f.UpdatedAt = ms(updated)
	return &f, nil
}

func loadFolder(ctx context.Context, q database.Querier, noteID string) (*folderJSON, error) {
	return scanFolder(q.QueryRow(ctx, folderSelect+` WHERE n.id = $1`, noteID))
}

// loadDoc returns the full ordered topic -> subtopic -> content tree.
func loadDoc(ctx context.Context, q database.Querier, noteID string) (docJSON, error) {
	doc := docJSON{Topics: []topicJSON{}}

	rows, err := q.Query(ctx, `SELECT id, title FROM topics WHERE "noteId" = $1 ORDER BY position ASC, "createdAt" ASC`, noteID)
	if err != nil {
		return doc, err
	}
	topicIndex := map[string]int{}
	for rows.Next() {
		var t topicJSON
		if err := rows.Scan(&t.ID, &t.Title); err != nil {
			rows.Close()
			return doc, err
		}
		t.Subtopics = []subtopicJSON{}
		topicIndex[t.ID] = len(doc.Topics)
		doc.Topics = append(doc.Topics, t)
	}
	if err := rows.Err(); err != nil || len(doc.Topics) == 0 {
		return doc, err
	}

	type subRef struct{ topic, sub int }
	subIndex := map[string]subRef{}
	rows, err = q.Query(ctx, `SELECT s.id, s."topicId", s.title, s.description FROM subtopics s
		JOIN topics t ON t.id = s."topicId" WHERE t."noteId" = $1
		ORDER BY s.position ASC, s."createdAt" ASC`, noteID)
	if err != nil {
		return doc, err
	}
	for rows.Next() {
		var st subtopicJSON
		var topicID string
		var desc *string
		if err := rows.Scan(&st.ID, &topicID, &st.Title, &desc); err != nil {
			rows.Close()
			return doc, err
		}
		st.Description, st.Content = deref(desc), []contentJSON{}
		ti := topicIndex[topicID]
		subIndex[st.ID] = subRef{ti, len(doc.Topics[ti].Subtopics)}
		doc.Topics[ti].Subtopics = append(doc.Topics[ti].Subtopics, st)
	}
	if err := rows.Err(); err != nil || len(subIndex) == 0 {
		return doc, err
	}

	rows, err = q.Query(ctx, `SELECT c.id, c."subtopicId", c.title, c.type::text, c.content, c.language FROM contents c
		JOIN subtopics s ON s.id = c."subtopicId" JOIN topics t ON t.id = s."topicId" WHERE t."noteId" = $1
		ORDER BY c.position ASC, c."createdAt" ASC`, noteID)
	if err != nil {
		return doc, err
	}
	defer rows.Close()
	for rows.Next() {
		var c contentJSON
		var subID string
		var lang *string
		if err := rows.Scan(&c.ID, &subID, &c.Title, &c.Type, &c.Content, &lang); err != nil {
			return doc, err
		}
		c.Language = deref(lang)
		ref := subIndex[subID]
		st := &doc.Topics[ref.topic].Subtopics[ref.sub]
		st.Content = append(st.Content, c)
	}
	return doc, rows.Err()
}

// insertTree bulk-inserts a client doc in one round trip. Client-side ids are
// ignored; the database generates its own.
func insertTree(ctx context.Context, tx pgx.Tx, noteID string, topics []httpx.Body) error {
	if len(topics) == 0 {
		return nil
	}
	now := compat.Now()
	batch := &pgx.Batch{}
	for ti, t := range topics {
		topicID := newID()
		batch.Queue(`INSERT INTO topics (id, "noteId", title, position, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $5)`,
			topicID, noteID, orDefault(cleanString(t.Raw("title")), "Untitled topic"), ti, now)
		for si, st := range bodyObjects(t.Raw("subtopics")) {
			subID := newID()
			batch.Queue(`INSERT INTO subtopics (id, "topicId", title, description, position, "createdAt", "updatedAt")
				VALUES ($1, $2, $3, $4, $5, $6, $6)`,
				subID, topicID, orDefault(cleanString(st.Raw("title")), "Untitled subtopic"),
				nullIfEmpty(cleanString(st.Raw("description"))), si, now)
			for ci, c := range bodyObjects(st.Raw("content")) {
				kind, ok := oneOf(c.Raw("type"), contentTypes)
				if !ok {
					kind = "text"
				}
				body, _ := exactString(c.Raw("content"))
				batch.Queue(`INSERT INTO contents (id, "subtopicId", title, type, content, language, position, "createdAt", "updatedAt")
					VALUES ($1, $2, $3, $4::text::"ContentType", $5, $6, $7, $8, $8)`,
					newID(), subID, cleanString(c.Raw("title")), kind, body,
					nullIfEmpty(cleanString(c.Raw("language"))), ci, now)
			}
		}
	}
	return tx.SendBatch(ctx, batch).Close()
}

func orDefault(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

func nextChildPosition(ctx context.Context, q database.Querier, table, parentCol, parentID string) (int, error) {
	var pos int
	err := q.QueryRow(ctx, `SELECT COALESCE(MAX(position), -1) + 1 FROM `+table+` WHERE "`+parentCol+`" = $1`, parentID).Scan(&pos)
	return pos, err
}

// touchNote bumps the folder's updatedAt and returns the fresh summary so the
// client can update `items` and `updatedAt` in one go.
func touchNote(ctx context.Context, q database.Querier, noteID string) (*folderJSON, error) {
	if _, err := q.Exec(ctx, `UPDATE notes SET "updatedAt" = $2 WHERE id = $1`, noteID, compat.Now()); err != nil {
		return nil, err
	}
	return loadFolder(ctx, q, noteID)
}

func ownsNote(ctx context.Context, q database.Querier, noteID, userID string) (bool, error) {
	var ok bool
	err := q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM notes WHERE id = $1 AND "userId" = $2)`, noteID, userID).Scan(&ok)
	return ok, err
}

// ownedParent resolves an owned topic/subtopic/content id to its note id
// ("" when missing or owned by someone else).
func ownedParent(ctx context.Context, q database.Querier, sql, id, userID string) (string, error) {
	var noteID string
	err := q.QueryRow(ctx, sql, id, userID).Scan(&noteID)
	if database.IsNoRows(err) {
		return "", nil
	}
	return noteID, err
}

const (
	ownedTopicSQL = `SELECT t."noteId" FROM topics t JOIN notes n ON n.id = t."noteId"
		WHERE t.id = $1 AND n."userId" = $2`
	ownedSubtopicSQL = `SELECT t."noteId" FROM subtopics s JOIN topics t ON t.id = s."topicId"
		JOIN notes n ON n.id = t."noteId" WHERE s.id = $1 AND n."userId" = $2`
	ownedContentSQL = `SELECT t."noteId" FROM contents c JOIN subtopics s ON s.id = c."subtopicId"
		JOIN topics t ON t.id = s."topicId" JOIN notes n ON n.id = t."noteId" WHERE c.id = $1 AND n."userId" = $2`
)

/* --------------------------------- folders -------------------------------- */

// GET /api/notes
func (s *Server) getNotes(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), folderSelect+` WHERE n."userId" = $1 ORDER BY n."updatedAt" DESC`, reqctx.UserID(r.Context()))
	if err != nil {
		s.serverError(w, "Get notes", err, "Failed to fetch notes")
		return
	}
	defer rows.Close()
	folders := []folderJSON{}
	for rows.Next() {
		f, err := scanFolder(rows)
		if err != nil {
			s.serverError(w, "Get notes", err, "Failed to fetch notes")
			return
		}
		folders = append(folders, *f)
	}
	if err := rows.Err(); err != nil {
		s.serverError(w, "Get notes", err, "Failed to fetch notes")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{"folders": folders}})
}

// GET /api/notes/{noteId}   (folder + full doc)
func (s *Server) getNote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	noteID := urlParam(r, "noteId")
	owned, err := ownsNote(ctx, s.db, noteID, reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, "Get note by ID", err, "Failed to fetch note")
		return
	}
	if !owned {
		httpx.Fail(w, http.StatusNotFound, "Note not found")
		return
	}
	folder, doc, err := loadFolderAndDoc(ctx, s.db, noteID)
	if err != nil {
		s.serverError(w, "Get note by ID", err, "Failed to fetch note")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "data": httpx.M{"folder": folder, "doc": doc}})
}

func loadFolderAndDoc(ctx context.Context, q database.Querier, noteID string) (*folderJSON, docJSON, error) {
	folder, err := loadFolder(ctx, q, noteID)
	if err != nil {
		return nil, docJSON{}, err
	}
	doc, err := loadDoc(ctx, q, noteID)
	return folder, doc, err
}

// POST /api/notes   body: { title, tint?, icon?, topics? }
func (s *Server) createNote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	b := httpx.BodyFrom(r)
	title := cleanString(b.Raw("title"))
	if title == "" {
		httpx.Fail(w, http.StatusBadRequest, "Name is required")
		return
	}
	tint, icon := "blue", "folder"
	if b.Has("tint") {
		var ok bool
		if tint, ok = oneOf(b.Raw("tint"), noteTints); !ok {
			httpx.Fail(w, http.StatusBadRequest, oneOfMessage("tint", noteTints))
			return
		}
	}
	if b.Has("icon") {
		var ok bool
		if icon, ok = oneOf(b.Raw("icon"), noteIcons); !ok {
			httpx.Fail(w, http.StatusBadRequest, oneOfMessage("icon", noteIcons))
			return
		}
	}
	if _, isArray := b.Array("topics"); b.Has("topics") && !isArray {
		httpx.Fail(w, http.StatusBadRequest, "topics must be an array")
		return
	}

	var folder *folderJSON
	var doc docJSON
	err := database.InTx(ctx, s.db, func(tx pgx.Tx) error {
		noteID := newID()
		now := compat.Now()
		if _, err := tx.Exec(ctx, `INSERT INTO notes (id, "userId", title, tint, icon, "createdAt", "updatedAt")
			VALUES ($1, $2, $3, $4::text::"NoteTint", $5::text::"NoteIcon", $6, $6)`,
			noteID, reqctx.UserID(ctx), title, tint, icon, now); err != nil {
			return err
		}
		if err := insertTree(ctx, tx, noteID, bodyObjects(b.Raw("topics"))); err != nil {
			return err
		}
		var err error
		folder, doc, err = loadFolderAndDoc(ctx, tx, noteID)
		return err
	})
	if err != nil {
		s.serverError(w, "Create note", err, "Failed to create note")
		return
	}
	httpx.JSON(w, http.StatusCreated, httpx.M{
		"success": true, "message": "Note created successfully", "data": httpx.M{"folder": folder, "doc": doc},
	})
}

// PATCH /api/notes/{noteId}   body: { title?, tint?, icon? }
func (s *Server) updateNote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	b := httpx.BodyFrom(r)
	sets := new(database.Sets)
	if b.Has("title") {
		title := cleanString(b.Raw("title"))
		if title == "" {
			httpx.Fail(w, http.StatusBadRequest, "name cannot be empty")
			return
		}
		sets.Add("title", title)
	}
	for _, f := range []struct {
		key, enum string
		list      []string
	}{{"tint", "NoteTint", noteTints}, {"icon", "NoteIcon", noteIcons}} {
		if !b.Has(f.key) {
			continue
		}
		v, ok := oneOf(b.Raw(f.key), f.list)
		if !ok {
			httpx.Fail(w, http.StatusBadRequest, oneOfMessage(f.key, f.list))
			return
		}
		sets.AddEnum(f.key, f.enum, v)
	}
	if sets.Len() == 0 {
		httpx.Fail(w, http.StatusBadRequest, "No valid fields to update")
		return
	}

	noteID := urlParam(r, "noteId")
	sets.Add("updatedAt", compat.Now())
	clause, args, next := sets.Build()
	tag, err := s.db.Exec(ctx, `UPDATE notes SET `+clause+` WHERE id = $`+itoa(next)+` AND "userId" = $`+itoa(next+1),
		append(args, noteID, reqctx.UserID(ctx))...)
	if err != nil {
		s.serverError(w, "Update note", err, "Failed to update note")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Fail(w, http.StatusNotFound, "Note not found")
		return
	}
	folder, err := loadFolder(ctx, s.db, noteID)
	if err != nil {
		s.serverError(w, "Update note", err, "Failed to update note")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{
		"success": true, "message": "Note updated successfully", "data": httpx.M{"folder": folder},
	})
}

// DELETE /api/notes/{noteId}   (cascades to topics/subtopics/content)
func (s *Server) deleteNote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tag, err := s.db.Exec(ctx, `DELETE FROM notes WHERE id = $1 AND "userId" = $2`, urlParam(r, "noteId"), reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, "Delete note", err, "Failed to delete note")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Fail(w, http.StatusNotFound, "Note not found")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{"success": true, "message": "Note deleted successfully"})
}

// PUT /api/notes/{noteId}/doc   body: { doc: { topics: [...] } } — replaces the whole tree.
func (s *Server) replaceDoc(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	docBody, isObject := httpx.BodyFrom(r).Object("doc")
	if !isObject {
		httpx.Fail(w, http.StatusBadRequest, "doc.topics must be an array")
		return
	}
	if _, ok := docBody.Array("topics"); !ok {
		httpx.Fail(w, http.StatusBadRequest, "doc.topics must be an array")
		return
	}
	noteID := urlParam(r, "noteId")
	owned, err := ownsNote(ctx, s.db, noteID, reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, "Replace doc", err, "Failed to save doc")
		return
	}
	if !owned {
		httpx.Fail(w, http.StatusNotFound, "Note not found")
		return
	}

	var folder *folderJSON
	var doc docJSON
	err = database.InTx(ctx, s.db, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM topics WHERE "noteId" = $1`, noteID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE notes SET "updatedAt" = $2 WHERE id = $1`, noteID, compat.Now()); err != nil {
			return err
		}
		if err := insertTree(ctx, tx, noteID, bodyObjects(docBody.Raw("topics"))); err != nil {
			return err
		}
		var err error
		folder, doc, err = loadFolderAndDoc(ctx, tx, noteID)
		return err
	})
	if err != nil {
		s.serverError(w, "Replace doc", err, "Failed to save doc")
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.M{
		"success": true, "message": "Doc saved successfully", "data": httpx.M{"folder": folder, "doc": doc},
	})
}

/* --------------------------------- topics --------------------------------- */

// POST /api/notes/{noteId}/topics   body: { title }
func (s *Server) addTopic(w http.ResponseWriter, r *http.Request) {
	const label, msg = "Add topic", "Failed to add topic"
	ctx := r.Context()
	noteID := urlParam(r, "noteId")
	title := cleanString(httpx.BodyFrom(r).Raw("title"))
	if title == "" {
		httpx.Fail(w, http.StatusBadRequest, "Title is required")
		return
	}
	owned, err := ownsNote(ctx, s.db, noteID, reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	if !owned {
		httpx.Fail(w, http.StatusNotFound, "Note not found")
		return
	}
	pos, err := nextChildPosition(ctx, s.db, "topics", "noteId", noteID)
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	topic := topicJSON{ID: newID(), Title: title, Subtopics: []subtopicJSON{}}
	if _, err := s.db.Exec(ctx, `INSERT INTO topics (id, "noteId", title, position, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $5)`, topic.ID, noteID, title, pos, compat.Now()); err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	s.respondWithFolder(ctx, w, http.StatusCreated, noteID, "Topic added successfully", label, msg, httpx.M{"topic": topic})
}

// respondWithFolder touches the note and writes `{ ...extra, folder }`.
func (s *Server) respondWithFolder(ctx context.Context, w http.ResponseWriter, status int, noteID, message, label, failMsg string, extra httpx.M) {
	folder, err := touchNote(ctx, s.db, noteID)
	if err != nil {
		s.serverError(w, label, err, failMsg)
		return
	}
	data := httpx.M{"folder": folder}
	for k, v := range extra {
		data[k] = v
	}
	httpx.JSON(w, status, httpx.M{"success": true, "message": message, "data": data})
}

// PATCH /api/notes/topics/{topicId}   body: { title }
func (s *Server) updateTopic(w http.ResponseWriter, r *http.Request) {
	const label, msg = "Update topic", "Failed to update topic"
	ctx := r.Context()
	topicID := urlParam(r, "topicId")
	title := cleanString(httpx.BodyFrom(r).Raw("title"))
	if title == "" {
		httpx.Fail(w, http.StatusBadRequest, "Title is required")
		return
	}
	noteID, err := ownedParent(ctx, s.db, ownedTopicSQL, topicID, reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	if noteID == "" {
		httpx.Fail(w, http.StatusNotFound, "Topic not found")
		return
	}
	if _, err := s.db.Exec(ctx, `UPDATE topics SET title = $2, "updatedAt" = $3 WHERE id = $1`, topicID, title, compat.Now()); err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	s.respondWithFolder(ctx, w, http.StatusOK, noteID, "Topic updated successfully", label, msg,
		httpx.M{"topic": httpx.M{"id": topicID, "title": title}})
}

// deleteChild removes an owned topic/subtopic/content row and returns the folder.
func (s *Server) deleteChild(w http.ResponseWriter, r *http.Request, param, ownedSQL, table, notFound, label, failMsg, message string) {
	ctx := r.Context()
	id := urlParam(r, param)
	noteID, err := ownedParent(ctx, s.db, ownedSQL, id, reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, label, err, failMsg)
		return
	}
	if noteID == "" {
		httpx.Fail(w, http.StatusNotFound, notFound)
		return
	}
	if _, err := s.db.Exec(ctx, `DELETE FROM `+table+` WHERE id = $1`, id); err != nil {
		s.serverError(w, label, err, failMsg)
		return
	}
	s.respondWithFolder(ctx, w, http.StatusOK, noteID, message, label, failMsg, nil)
}

// DELETE /api/notes/topics/{topicId}
func (s *Server) deleteTopic(w http.ResponseWriter, r *http.Request) {
	s.deleteChild(w, r, "topicId", ownedTopicSQL, "topics", "Topic not found",
		"Delete topic", "Failed to delete topic", "Topic deleted successfully")
}

/* -------------------------------- subtopics ------------------------------- */

// POST /api/notes/topics/{topicId}/subtopics   body: { title, description? }
func (s *Server) addSubtopic(w http.ResponseWriter, r *http.Request) {
	const label, msg = "Add subtopic", "Failed to add subtopic"
	ctx := r.Context()
	b := httpx.BodyFrom(r)
	topicID := urlParam(r, "topicId")
	title := cleanString(b.Raw("title"))
	if title == "" {
		httpx.Fail(w, http.StatusBadRequest, "Title is required")
		return
	}
	noteID, err := ownedParent(ctx, s.db, ownedTopicSQL, topicID, reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	if noteID == "" {
		httpx.Fail(w, http.StatusNotFound, "Topic not found")
		return
	}
	pos, err := nextChildPosition(ctx, s.db, "subtopics", "topicId", topicID)
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	description := cleanString(b.Raw("description"))
	sub := subtopicJSON{ID: newID(), Title: title, Description: description, Content: []contentJSON{}}
	if _, err := s.db.Exec(ctx, `INSERT INTO subtopics (id, "topicId", title, description, position, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $6)`, sub.ID, topicID, title, nullIfEmpty(description), pos, compat.Now()); err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	s.respondWithFolder(ctx, w, http.StatusCreated, noteID, "Subtopic added successfully", label, msg, httpx.M{"subtopic": sub})
}

// PATCH /api/notes/subtopics/{subtopicId}   body: { title?, description? }
func (s *Server) updateSubtopic(w http.ResponseWriter, r *http.Request) {
	const label, msg = "Update subtopic", "Failed to update subtopic"
	ctx := r.Context()
	b := httpx.BodyFrom(r)
	sets := new(database.Sets)
	if b.Has("title") {
		title := cleanString(b.Raw("title"))
		if title == "" {
			httpx.Fail(w, http.StatusBadRequest, "Title cannot be empty")
			return
		}
		sets.Add("title", title)
	}
	if b.Has("description") {
		sets.Add("description", nullIfEmpty(cleanString(b.Raw("description"))))
	}
	if sets.Len() == 0 {
		httpx.Fail(w, http.StatusBadRequest, "No valid fields to update")
		return
	}
	subtopicID := urlParam(r, "subtopicId")
	noteID, err := ownedParent(ctx, s.db, ownedSubtopicSQL, subtopicID, reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	if noteID == "" {
		httpx.Fail(w, http.StatusNotFound, "Subtopic not found")
		return
	}
	sets.Add("updatedAt", compat.Now())
	clause, args, next := sets.Build()
	var out subtopicSummaryJSON
	var desc *string
	if err := s.db.QueryRow(ctx, `UPDATE subtopics SET `+clause+` WHERE id = $`+itoa(next)+` RETURNING id, title, description`,
		append(args, subtopicID)...).Scan(&out.ID, &out.Title, &desc); err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	out.Description = deref(desc)
	s.respondWithFolder(ctx, w, http.StatusOK, noteID, "Subtopic updated successfully", label, msg, httpx.M{"subtopic": out})
}

// DELETE /api/notes/subtopics/{subtopicId}
func (s *Server) deleteSubtopic(w http.ResponseWriter, r *http.Request) {
	s.deleteChild(w, r, "subtopicId", ownedSubtopicSQL, "subtopics", "Subtopic not found",
		"Delete subtopic", "Failed to delete subtopic", "Subtopic deleted successfully")
}

/* --------------------------------- content -------------------------------- */

const contentReturning = ` RETURNING id, title, type::text, content, language`

func scanContent(row pgx.Row) (contentJSON, error) {
	var c contentJSON
	var lang *string
	err := row.Scan(&c.ID, &c.Title, &c.Type, &c.Content, &lang)
	c.Language = deref(lang)
	return c, err
}

// POST /api/notes/subtopics/{subtopicId}/content   body: { title?, type, content, language? }
func (s *Server) addContent(w http.ResponseWriter, r *http.Request) {
	const label, msg = "Add content", "Failed to add content"
	ctx := r.Context()
	b := httpx.BodyFrom(r)
	kind := "text"
	if b.Has("type") {
		var ok bool
		if kind, ok = oneOf(b.Raw("type"), contentTypes); !ok {
			httpx.Fail(w, http.StatusBadRequest, oneOfMessage("type", contentTypes))
			return
		}
	}
	body := ""
	if b.Has("content") {
		var ok bool
		if body, ok = exactString(b.Raw("content")); !ok {
			httpx.Fail(w, http.StatusBadRequest, "content must be a string")
			return
		}
	}
	subtopicID := urlParam(r, "subtopicId")
	noteID, err := ownedParent(ctx, s.db, ownedSubtopicSQL, subtopicID, reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	if noteID == "" {
		httpx.Fail(w, http.StatusNotFound, "Subtopic not found")
		return
	}
	pos, err := nextChildPosition(ctx, s.db, "contents", "subtopicId", subtopicID)
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	created, err := scanContent(s.db.QueryRow(ctx, `INSERT INTO contents
		(id, "subtopicId", title, type, content, language, position, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4::text::"ContentType", $5, $6, $7, $8, $8)`+contentReturning,
		newID(), subtopicID, cleanString(b.Raw("title")), kind, body,
		nullIfEmpty(cleanString(b.Raw("language"))), pos, compat.Now()))
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	s.respondWithFolder(ctx, w, http.StatusCreated, noteID, "Content added successfully", label, msg, httpx.M{"content": created})
}

// PATCH /api/notes/content/{contentId}   body: { title?, type?, content?, language? }
func (s *Server) updateContent(w http.ResponseWriter, r *http.Request) {
	const label, msg = "Update content", "Failed to update content"
	ctx := r.Context()
	b := httpx.BodyFrom(r)
	sets := new(database.Sets)
	if b.Has("type") {
		kind, ok := oneOf(b.Raw("type"), contentTypes)
		if !ok {
			httpx.Fail(w, http.StatusBadRequest, oneOfMessage("type", contentTypes))
			return
		}
		sets.AddEnum("type", "ContentType", kind)
	}
	if b.Has("content") {
		body, ok := exactString(b.Raw("content"))
		if !ok {
			httpx.Fail(w, http.StatusBadRequest, "content must be a string")
			return
		}
		sets.Add("content", body)
	}
	if b.Has("title") {
		// contents.title is NOT NULL; an empty title is serialised as absent.
		sets.Add("title", cleanString(b.Raw("title")))
	}
	if b.Has("language") {
		sets.Add("language", nullIfEmpty(cleanString(b.Raw("language"))))
	}
	if sets.Len() == 0 {
		httpx.Fail(w, http.StatusBadRequest, "No valid fields to update")
		return
	}
	contentID := urlParam(r, "contentId")
	noteID, err := ownedParent(ctx, s.db, ownedContentSQL, contentID, reqctx.UserID(ctx))
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	if noteID == "" {
		httpx.Fail(w, http.StatusNotFound, "Content not found")
		return
	}
	sets.Add("updatedAt", compat.Now())
	clause, args, next := sets.Build()
	updated, err := scanContent(s.db.QueryRow(ctx, `UPDATE contents SET `+clause+` WHERE id = $`+itoa(next)+contentReturning,
		append(args, contentID)...))
	if err != nil {
		s.serverError(w, label, err, msg)
		return
	}
	s.respondWithFolder(ctx, w, http.StatusOK, noteID, "Content updated successfully", label, msg, httpx.M{"content": updated})
}

// DELETE /api/notes/content/{contentId}
func (s *Server) deleteContent(w http.ResponseWriter, r *http.Request) {
	s.deleteChild(w, r, "contentId", ownedContentSQL, "contents", "Content not found",
		"Delete content", "Failed to delete content", "Content deleted successfully")
}
