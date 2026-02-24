package database

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"sort"
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
		content, err := fs.ReadFile(migrations, dir+"/"+entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		if _, err := db.Exec(string(content)); err != nil {
			return fmt.Errorf("execute migration %s: %w", entry.Name(), err)
		}
	}

	return nil
}
