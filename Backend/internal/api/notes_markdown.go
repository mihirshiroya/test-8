package api

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"productivity/internal/httpx"
)

const maxNoteContentBytes = 1024 * 1024

var (
	noteFencePattern          = regexp.MustCompile("^ {0,3}(`{3,}|~{3,})")
	noteHeadingPattern        = regexp.MustCompile(`^ {0,3}#{1,6}[\t ]+(.+)$`)
	noteClosingHeadingPattern = regexp.MustCompile(`[\t ]+#+[\t ]*$`)
)

// Markdown uses the existing text enum with language=markdown, avoiding a destructive
// schema migration and preserving old clients' text/code contracts.
func normalizeNoteContent(b httpx.Body, current *contentJSON, strict bool) (contentJSON, error) {
	out := contentJSON{Type: "text"}
	if current != nil {
		out = *current
	}
	if b.Has("type") {
		kind, ok := oneOf(b.Raw("type"), contentTypes)
		if !ok {
			if strict {
				return out, errors.New(oneOfMessage("type", contentTypes))
			}
			kind = "text"
		}
		out.Type = kind
	}
	if b.Has("content") {
		body, ok := exactString(b.Raw("content"))
		if !ok && strict {
			return out, errors.New("content must be a string")
		}
		out.Content = body
	}
	if b.Has("title") {
		out.Title = cleanString(b.Raw("title"))
	}
	if b.Has("language") {
		if _, ok := b.String("language"); !ok && !b.IsNull("language") && strict {
			return out, errors.New("language must be a string or null")
		}
		out.Language = cleanString(b.Raw("language"))
	}
	if len(out.Content) > maxNoteContentBytes {
		return out, errors.New("content must be no larger than 1 MB")
	}
	if !utf8.ValidString(out.Content) || strings.ContainsRune(out.Content, '\x00') {
		return out, errors.New("content must be valid UTF-8 without null bytes")
	}
	if utf8.RuneCountInString(out.Language) > 50 {
		return out, errors.New("language must be no longer than 50 characters")
	}
	if out.Type == "text" && out.Language == "markdown" {
		if strings.TrimSpace(out.Content) == "" {
			return out, errors.New("Markdown content cannot be empty")
		}
		out.Title = noteMarkdownTitle(out.Content)
	} else if utf8.RuneCountInString(out.Title) > 200 {
		return out, errors.New("title must be no longer than 200 characters")
	}
	return out, nil
}

func noteMarkdownTitle(markdown string) string {
	fence := ""
	for _, line := range strings.Split(markdown, "\n") {
		if marker := noteFencePattern.FindStringSubmatch(line); marker != nil {
			if fence == "" {
				fence = marker[1]
			} else if marker[1][0] == fence[0] && len(marker[1]) >= len(fence) {
				fence = ""
			}
			continue
		}
		if fence != "" {
			continue
		}
		if heading := noteHeadingPattern.FindStringSubmatch(line); heading != nil {
			title := strings.TrimSpace(noteClosingHeadingPattern.ReplaceAllString(heading[1], ""))
			if title == "" {
				continue
			}
			runes := []rune(title)
			if len(runes) > 200 {
				title = string(runes[:200])
			}
			return title
		}
	}
	return "Untitled note"
}

func validateNoteContentTree(topics []httpx.Body) error {
	for _, topic := range topics {
		for _, subtopic := range bodyObjects(topic.Raw("subtopics")) {
			for _, content := range bodyObjects(subtopic.Raw("content")) {
				if _, err := normalizeNoteContent(content, nil, false); err != nil {
					return err
				}
			}
		}
	}
	return nil
}
