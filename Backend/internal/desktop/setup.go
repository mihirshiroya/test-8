package desktop

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"productivity/internal/database"
)

// CheckResult is returned by the Test Connection and setup endpoints. Code is
// machine-readable so the UI can offer targeted help; Message is user-facing.
type CheckResult struct {
	OK            bool   `json:"ok"`
	Code          string `json:"code,omitempty"`
	Message       string `json:"message"`
	ServerVersion string `json:"serverVersion,omitempty"`
	Database      string `json:"database,omitempty"`
}

// ValidateURL accepts the connection formats the backend supports: PostgreSQL
// URLs (postgres:// or postgresql://, including Prisma-style parameters).
func ValidateURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return errors.New("Enter a database connection URL.")
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") {
		return errors.New("Only PostgreSQL connection URLs are supported (they start with postgres:// or postgresql://).")
	}
	if u.Hostname() == "" {
		return errors.New("The connection URL is missing a host name.")
	}
	if strings.Trim(u.Path, "/") == "" {
		return errors.New("The connection URL is missing a database name (postgres://user:password@host:5432/database).")
	}
	return nil
}

// Check verifies credentials and connectivity without changing anything.
func Check(ctx context.Context, raw string) CheckResult {
	raw = strings.TrimSpace(raw)
	if err := ValidateURL(raw); err != nil {
		return CheckResult{Code: "invalid_url", Message: err.Error()}
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	pool, err := database.Connect(ctx, raw, 2)
	if err != nil {
		return Classify(err)
	}
	defer pool.Close()

	var version, dbName string
	if err := pool.QueryRow(ctx, `SELECT current_setting('server_version'), current_database()`).Scan(&version, &dbName); err != nil {
		return Classify(err)
	}
	var canCreate bool
	if err := pool.QueryRow(ctx, `SELECT has_schema_privilege(current_schema(), 'CREATE')`).Scan(&canCreate); err == nil && !canCreate {
		return CheckResult{
			Code:    "permission_denied",
			Message: "Connected, but this database user cannot create tables. Use the database owner or grant CREATE on the schema.",
		}
	}
	return CheckResult{OK: true, Message: "Connected to PostgreSQL " + version + ".", ServerVersion: version, Database: dbName}
}

// Setup checks the connection, applies every migration (which also seeds the
// default application settings) and reports the outcome.
func Setup(ctx context.Context, raw string, log *slog.Logger) CheckResult {
	result := Check(ctx, raw)
	if !result.OK {
		return result
	}
	migrateCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if err := database.Migrate(migrateCtx, strings.TrimSpace(raw), log); err != nil {
		log.Error("desktop setup migration failed", "error", err)
		return CheckResult{Code: "migration_failed", Message: "Connected, but the database migrations failed: " + Classify(err).Message}
	}
	result.Message = "Database ready. Tables and default settings were created."
	return result
}

// Classify maps driver and network errors to an actionable message. It never
// includes the password from the connection URL.
func Classify(err error) CheckResult {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "28P01", "28000":
			return CheckResult{Code: "auth_failed", Message: "The database rejected the username or password."}
		case "3D000":
			return CheckResult{Code: "database_not_found", Message: "That database does not exist on the server. Create it first or check the name in the URL."}
		case "42501":
			return CheckResult{Code: "permission_denied", Message: "The database user does not have permission for this operation: " + pgErr.Message}
		case "53300":
			return CheckResult{Code: "too_many_connections", Message: "The database server has too many open connections. Try again shortly."}
		case "57P03":
			return CheckResult{Code: "unavailable", Message: "The database server is starting up or shutting down. Try again in a moment."}
		}
		return CheckResult{Code: "database_error", Message: pgErr.Message}
	}

	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return CheckResult{Code: "host_not_found", Message: fmt.Sprintf("Could not find the host %q. Check the host name in the URL.", dnsErr.Name)}
	}

	msg := err.Error()
	lower := strings.ToLower(msg)
	var netErr net.Error
	switch {
	case errors.Is(err, syscall.ECONNREFUSED) || strings.Contains(lower, "refused"):
		return CheckResult{Code: "unreachable", Message: "Connection refused. Make sure PostgreSQL is running and accepting connections on that host and port."}
	case errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &netErr) && netErr.Timeout()) || strings.Contains(lower, "timeout"):
		return CheckResult{Code: "timeout", Message: "Timed out reaching the database server. Check the host, port and any firewall."}
	case strings.Contains(lower, "password authentication failed"):
		return CheckResult{Code: "auth_failed", Message: "The database rejected the username or password."}
	case strings.Contains(lower, "tls") || strings.Contains(lower, "ssl") || strings.Contains(lower, "certificate"):
		return CheckResult{Code: "ssl", Message: "Secure connection (SSL) failed. Try adding ?sslmode=require, or sslmode=disable for a local server."}
	}
	return CheckResult{Code: "connection_failed", Message: "Could not connect to the database: " + msg}
}
