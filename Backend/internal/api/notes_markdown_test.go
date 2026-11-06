package api

import (
	"encoding/json"
	"strings"
	"testing"

	"productivity/internal/httpx"
)

func contentTestBody(t *testing.T, values map[string]any) httpx.Body {
	t.Helper()
	raw, err := json.Marshal(values)
	if err != nil {
		t.Fatal(err)
	}
	return httpx.ParseBody(raw)
}

func TestNoteMarkdownTitle(t *testing.T) {
	for _, tc := range []struct{ source, want string }{
		{"# Heading\n\nBody", "Heading"},
		{"```md\n# Ignore\n```\n## Real C# ##", "Real C#"},
		{"~~~text\n# Ignore\n~~~\n###### 你好", "你好"},
		{"No heading", "Untitled note"},
		{"# " + strings.Repeat("界", 250), strings.Repeat("界", 200)},
	} {
		if got := noteMarkdownTitle(tc.source); got != tc.want {
			t.Errorf("noteMarkdownTitle(%q) = %q, want %q", tc.source, got, tc.want)
		}
	}
}

func TestNormalizeNoteContent(t *testing.T) {
	source := "# Combined heading\n\n**Body**\n\n```go\n  fmt.Println(42)\n```\n"
	content, err := normalizeNoteContent(contentTestBody(t, map[string]any{"type": "text", "language": "markdown", "title": "Old title", "content": source}), nil, true)
	if err != nil || content.Title != "Combined heading" || content.Content != source || content.Language != "markdown" {
		t.Fatalf("Markdown was not preserved: %+v, %v", content, err)
	}
	updated, err := normalizeNoteContent(contentTestBody(t, map[string]any{"content": "## New heading\n\nNew body"}), &content, true)
	if err != nil || updated.Title != "New heading" || updated.Language != "markdown" {
		t.Fatalf("partial patch lost Markdown metadata: %+v, %v", updated, err)
	}
	legacy, err := normalizeNoteContent(contentTestBody(t, map[string]any{"type": "bogus", "content": 5, "title": "Note"}), nil, false)
	if err != nil || legacy.Type != "text" || legacy.Content != "" || legacy.Title != "Note" {
		t.Fatalf("legacy tree compatibility changed: %+v, %v", legacy, err)
	}
	code, err := normalizeNoteContent(contentTestBody(t, map[string]any{"type": "code", "language": "markdown", "title": "Literal Markdown", "content": "# Code, not title"}), nil, true)
	if err != nil || code.Title != "Literal Markdown" {
		t.Fatalf("Markdown code block mistaken for rich content: %+v, %v", code, err)
	}
}

func TestNormalizeNoteContentValidation(t *testing.T) {
	for name, body := range map[string]map[string]any{
		"wrong type":        {"type": "html"},
		"wrong body":        {"content": 123},
		"wrong language":    {"language": 123},
		"empty markdown":    {"language": "markdown", "content": " \n "},
		"oversized content": {"content": strings.Repeat("a", maxNoteContentBytes+1)},
		"null bytes":        {"content": "bad\x00content"},
		"long title":        {"title": strings.Repeat("a", 201)},
		"long language":     {"language": strings.Repeat("a", 51)},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := normalizeNoteContent(contentTestBody(t, body), nil, true); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
