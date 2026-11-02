package database

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// Migrate applies pending migrations. The baseline migration is idempotent, so
// it is safe on a database previously managed by Prisma as well as on an
// empty one. A Postgres advisory lock prevents concurrent instances from
// migrating at the same time.
func Migrate(ctx context.Context, rawURL string, log *slog.Logger) error {
	connStr, _, _, err := ConnString(rawURL)
	if err != nil {
		return err
	}
	cfg, err := pgx.ParseConfig(connStr)
	if err != nil {
		return fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	db := stdlib.OpenDB(*cfg)
	defer db.Close()

	return runMigrations(ctx, db, log)
}

func runMigrations(ctx context.Context, db *sql.DB, log *slog.Logger) error {
	sub, err := fs.Sub(migrationFiles, "migrations")
	if err != nil {
		return err
	}
	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return err
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, db, sub, goose.WithSessionLocker(locker))
	if err != nil {
		return err
	}
	results, err := provider.Up(ctx)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	for _, r := range results {
		log.Info("migration applied", "version", r.Source.Version, "file", r.Source.Path, "duration", r.Duration)
	}
	return nil
}
