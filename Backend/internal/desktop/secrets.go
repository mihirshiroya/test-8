package desktop

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"time"
)

// Secrets are written by the Tauri shell as one JSON line on stdin, so the
// database URL and JWT secrets (read from the OS credential store) never
// appear in the process environment or command line.
type Secrets struct {
	Token            string `json:"token"`
	DatabaseURL      string `json:"databaseUrl"`
	JWTSecret        string `json:"jwtSecret"`
	JWTRefreshSecret string `json:"jwtRefreshSecret"`
}

// ReadSecrets reads the first stdin line. The returned reader must be passed
// to WatchParent so the rest of stdin keeps being drained.
func ReadSecrets(r io.Reader, timeout time.Duration) (*Secrets, *bufio.Reader, error) {
	br := bufio.NewReader(r)
	type result struct {
		line []byte
		err  error
	}
	ch := make(chan result, 1)
	go func() {
		line, err := br.ReadBytes('\n')
		ch <- result{line, err}
	}()

	select {
	case res := <-ch:
		if len(bytes.TrimSpace(res.line)) == 0 {
			if res.err == nil {
				res.err = errors.New("empty line")
			}
			return nil, nil, fmt.Errorf("read desktop secrets: %w", res.err)
		}
		var s Secrets
		if err := json.Unmarshal(bytes.TrimSpace(res.line), &s); err != nil {
			return nil, nil, fmt.Errorf("decode desktop secrets: %w", err)
		}
		return &s, br, nil
	case <-time.After(timeout):
		return nil, nil, errors.New("timed out waiting for desktop secrets on stdin")
	}
}

// WatchParent blocks until stdin closes, which happens when the Tauri shell
// exits or crashes, then calls onExit. This guarantees the backend never
// outlives the app that started it.
func WatchParent(r io.Reader, onExit func(), log *slog.Logger) {
	_, _ = io.Copy(io.Discard, r)
	log.Info("desktop shell closed stdin, shutting down")
	onExit()
}
