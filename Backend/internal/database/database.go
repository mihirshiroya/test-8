// Package database owns the PostgreSQL connection pool, transactions and
// schema migrations.
package database

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Querier is satisfied by both *pgxpool.Pool and pgx.Tx, so query helpers work
// inside and outside transactions.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// prismaOnlyParams are DATABASE_URL query parameters understood by Prisma but
// rejected by PostgreSQL as unknown startup parameters.
var prismaOnlyParams = []string{"schema", "connection_limit", "pool_timeout", "pgbouncer", "sslaccept", "socket_timeout", "statement_cache_size"}

// ConnString converts a Prisma-style DATABASE_URL into a pgx connection string
// and reports the Prisma options that map onto pgx settings.
func ConnString(raw string) (conn string, maxConns int, pgbouncer bool, err error) {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") {
		// Not a URL (e.g. "host=... dbname=..."): pass through untouched.
		return raw, 0, false, nil
	}
	q := u.Query()
	if schema := q.Get("schema"); schema != "" && q.Get("search_path") == "" {
		q.Set("search_path", schema)
	}
	if n, convErr := strconv.Atoi(q.Get("connection_limit")); convErr == nil && n > 0 {
		maxConns = n
	}
	pgbouncer = q.Get("pgbouncer") == "true"
	for _, p := range prismaOnlyParams {
		q.Del(p)
	}
	u.RawQuery = q.Encode()
	return u.String(), maxConns, pgbouncer, nil
}

// Connect opens a pool and verifies connectivity.
func Connect(ctx context.Context, rawURL string, maxConns int32) (*pgxpool.Pool, error) {
	connStr, prismaMax, pgbouncer, err := ConnString(rawURL)
	if err != nil {
		return nil, err
	}
	cfg, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	cfg.MaxConns = maxConns
	if prismaMax > 0 {
		cfg.MaxConns = int32(prismaMax)
	}
	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 15 * time.Minute
	cfg.HealthCheckPeriod = 30 * time.Second
	cfg.ConnConfig.ConnectTimeout = 10 * time.Second
	if pgbouncer {
		// Transaction-pooling PgBouncer cannot hold prepared statements.
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	}
	// Timestamps are stored as UTC wall-clock values (Prisma convention).
	cfg.ConnConfig.RuntimeParams["timezone"] = "UTC"

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database ping: %w", err)
	}
	return pool, nil
}

// InTx runs fn inside a transaction, committing on success and rolling back on
// error or panic.
func InTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, pool, pgx.TxOptions{}, fn)
}

// LockUser serialises concurrent writes for one user inside a transaction
// (e.g. two "start task" clicks racing for the single active-session slot).
func LockUser(ctx context.Context, tx pgx.Tx, userID string) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, userID)
	return err
}

func IsNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// Sets builds the SET clause of a dynamic UPDATE. Column names always come
// from code constants; values are always bound parameters.
type Sets struct {
	cols  []string
	casts []string
	args  []any
}

func (s *Sets) Add(col string, value any) *Sets { return s.add(col, "", value) }

// AddEnum binds a string to a Postgres enum column via an explicit text cast.
func (s *Sets) AddEnum(col, enumType string, value string) *Sets {
	return s.add(col, `::text::"`+enumType+`"`, value)
}

func (s *Sets) add(col, cast string, value any) *Sets {
	s.cols = append(s.cols, col)
	s.casts = append(s.casts, cast)
	s.args = append(s.args, value)
	return s
}

func (s *Sets) Len() int { return len(s.cols) }

// Build returns `"a" = $1, "b" = $2` and the args; extra placeholders appended
// by the caller start at the returned next index.
func (s *Sets) Build() (clause string, args []any, next int) {
	parts := make([]string, len(s.cols))
	for i, c := range s.cols {
		parts[i] = fmt.Sprintf(`"%s" = $%d%s`, c, i+1, s.casts[i])
	}
	return strings.Join(parts, ", "), append([]any(nil), s.args...), len(s.cols) + 1
}
