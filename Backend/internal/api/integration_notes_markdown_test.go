package api

import (
	"net/http"
	"testing"
)

func TestIntegrationNotesMarkdown(t *testing.T) {
	h := newHarness(t)
	alice := h.register("markdown-alice")
	bob := h.register("markdown-bob")
	source := "# Imported document\n\n- [x] Done\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n$$\nx^2\n$$\n"
	created := h.expect(h.do("POST", "/api/notes", alice, map[string]any{
		"title": "Markdown", "topics": []any{map[string]any{"title": "Topic", "subtopics": []any{map[string]any{
			"title": "Section", "content": []any{map[string]any{"type": "text", "language": "markdown", "content": source}},
		}}}},
	}), http.StatusCreated, "create Markdown tree")
	noteID := str(created.body, "data", "folder", "id")
	t.Cleanup(func() { h.do("DELETE", "/api/notes/"+noteID, alice, nil) })
	topics := dig(created.body, "data", "doc", "topics").([]any)
	subtopics := dig(topics[0], "subtopics").([]any)
	blocks := dig(subtopics[0], "content").([]any)
	contentID := str(blocks[0], "id")
	subtopicID := str(subtopics[0], "id")
	h.expect(h.do("POST", "/api/notes/subtopics/"+subtopicID+"/content", alice, map[string]any{
		"type": "text", "language": "markdown", "content": "# Duplicate",
	}), http.StatusConflict, "reject second Markdown document")
	legacy := h.expect(h.do("POST", "/api/notes/subtopics/"+subtopicID+"/content", alice, map[string]any{
		"type": "code", "language": "go", "title": "Legacy block", "content": "fmt.Println(42)",
	}), http.StatusCreated, "retain legacy code support")
	legacyID := str(legacy.body, "data", "content", "id")
	h.expect(h.do("PATCH", "/api/notes/content/"+legacyID, alice, map[string]any{
		"type": "text", "language": "markdown", "content": "# Duplicate conversion",
	}), http.StatusConflict, "reject second Markdown by conversion")
	if str(blocks[0], "title") != "Imported document" || str(blocks[0], "content") != source {
		t.Fatalf("Markdown source or derived title changed: %s", created.raw)
	}
	h.expect(h.do("PATCH", "/api/notes/content/"+contentID, bob, map[string]any{"content": "# Unauthorized"}), http.StatusNotFound, "foreign Markdown patch")
	updatedSource := "## Updated heading\n\nBody with trailing newline.\n"
	patched := h.expect(h.do("PATCH", "/api/notes/content/"+contentID, alice, map[string]any{"content": updatedSource}), http.StatusOK, "partial Markdown patch")
	if str(patched.body, "data", "content", "title") != "Updated heading" || str(patched.body, "data", "content", "language") != "markdown" {
		t.Fatalf("partial patch did not retain Markdown metadata: %s", patched.raw)
	}
	h.expect(h.do("PATCH", "/api/notes/content/"+contentID, alice, map[string]any{"content": " \n"}), http.StatusBadRequest, "reject empty Markdown")
	fetched := h.expect(h.do("GET", "/api/notes/"+noteID, alice, nil), http.StatusOK, "reload Markdown")
	topics = dig(fetched.body, "data", "doc", "topics").([]any)
	subtopics = dig(topics[0], "subtopics").([]any)
	blocks = dig(subtopics[0], "content").([]any)
	if str(blocks[0], "content") != updatedSource {
		t.Fatalf("reload lost source bytes: %s", fetched.raw)
	}
	replaced := h.expect(h.do("PUT", "/api/notes/"+noteID+"/doc", alice, map[string]any{"doc": map[string]any{"topics": topics}}), http.StatusOK, "replace Markdown tree")
	topics = dig(replaced.body, "data", "doc", "topics").([]any)
	subtopics = dig(topics[0], "subtopics").([]any)
	blocks = dig(subtopics[0], "content").([]any)
	if str(blocks[0], "language") != "markdown" || str(blocks[0], "content") != updatedSource {
		t.Fatalf("tree replacement lost Markdown: %s", replaced.raw)
	}
}
