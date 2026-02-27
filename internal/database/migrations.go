package database

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"time"
)

//go:embed migrations/system/*.sql
var systemMigrations embed.FS

//go:embed migrations/event/*.sql
var eventMigrations embed.FS

// RunMigrations applies all SQL migrations for the given scope ("system" or "event").
func RunMigrations(db *sql.DB, scope string) error {
	var migrations embed.FS
	switch scope {
	case "system":
		migrations = systemMigrations
	case "event":
		migrations = eventMigrations
	default:
		return fmt.Errorf("unknown migration scope: %s", scope)
	}

	// Ensure migration tracking table exists.
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		filename TEXT PRIMARY KEY,
		applied_at TEXT NOT NULL
	)`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	dir := fmt.Sprintf("migrations/%s", scope)
	entries, err := fs.ReadDir(migrations, dir)
	if err != nil {
		return fmt.Errorf("read migrations dir %s: %w", dir, err)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		// Skip already-applied migrations.
		var count int
		if err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE filename = ?", entry.Name()).Scan(&count); err != nil {
			return fmt.Errorf("check migration %s: %w", entry.Name(), err)
		}
		if count > 0 {
			continue
		}

		content, err := fs.ReadFile(migrations, dir+"/"+entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		if _, err := db.Exec(string(content)); err != nil {
			return fmt.Errorf("execute migration %s: %w", entry.Name(), err)
		}

		// Record as applied.
		if _, err := db.Exec(
			"INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)",
			entry.Name(), time.Now().UTC().Format(time.RFC3339),
		); err != nil {
			return fmt.Errorf("record migration %s: %w", entry.Name(), err)
		}
	}

	return nil
}
