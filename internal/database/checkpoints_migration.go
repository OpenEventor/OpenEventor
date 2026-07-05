package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// migrationHooks run Go logic immediately after a migration's SQL is applied and
// before the migration is recorded as done. They exist for migrations that need
// more than static SQL — e.g. a guarded ADD COLUMN or JSON parsing.
//
// Keyed by "<scope>/<filename>".
var migrationHooks = map[string]func(*sql.DB) error{
	"event/003_control_points.sql": materializeCheckpoints,
}

// materializeCheckpoints is the Go half of migration 003. It ensures the
// passings.raw_code column exists and, when the checkpoints table is still
// empty, seeds it with a row per distinct checkpoint name already used by a
// course sequence or a passing — mirroring the iOS OpenEventorStore's
// convertLegacyCheckpoints(). Idempotent: safe to run again on a converted DB.
func materializeCheckpoints(db *sql.DB) error {
	// Older event DBs predate raw_code; iOS-created DBs already have it. Guard so
	// ADD COLUMN never fails a re-open.
	if err := ensureColumn(db, "passings", "raw_code", "TEXT"); err != nil {
		return fmt.Errorf("ensure passings.raw_code: %w", err)
	}

	// One-shot: only seed when no checkpoints exist yet.
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM checkpoints").Scan(&count); err != nil {
		return fmt.Errorf("count checkpoints: %w", err)
	}
	if count > 0 {
		return nil
	}

	// Collect distinct names, first from course sequences (in order), then from
	// passings — preserving first-seen order, exactly like iOS.
	var names []string
	seen := map[string]struct{}{}
	add := func(n string) {
		n = strings.TrimSpace(n)
		if n == "" {
			return
		}
		if _, ok := seen[n]; ok {
			return
		}
		seen[n] = struct{}{}
		names = append(names, n)
	}

	courseSeqs, err := queryStrings(db, "SELECT checkpoints FROM courses ORDER BY created_at, id")
	if err != nil {
		return fmt.Errorf("read course checkpoints: %w", err)
	}
	for _, seq := range courseSeqs {
		if strings.TrimSpace(seq) == "" {
			continue
		}
		var arr []string
		if err := json.Unmarshal([]byte(seq), &arr); err != nil {
			// Tolerate a malformed sequence — skip it rather than fail the open.
			continue
		}
		for _, n := range arr {
			add(n)
		}
	}

	passNames, err := queryStrings(db, "SELECT DISTINCT checkpoint FROM passings")
	if err != nil {
		return fmt.Errorf("read passing checkpoints: %w", err)
	}
	for _, n := range passNames {
		add(n)
	}

	if len(names) == 0 {
		return nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO checkpoints (id, name, latitude, longitude, description, sort_order, created_at, updated_at)
		 VALUES (?, ?, NULL, NULL, '', ?, ?, ?)`,
	)
	if err != nil {
		return fmt.Errorf("prepare insert: %w", err)
	}
	defer stmt.Close()

	for i, name := range names {
		if _, err := stmt.Exec(uuid.New().String(), name, i, now, now); err != nil {
			return fmt.Errorf("insert checkpoint %q: %w", name, err)
		}
	}
	return tx.Commit()
}

// ensureColumn adds a column to a table if it isn't already present. SQLite has
// no "ADD COLUMN IF NOT EXISTS", so we inspect the schema first.
func ensureColumn(db *sql.DB, table, column, columnType string) error {
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		return fmt.Errorf("table_info %s: %w", table, err)
	}
	exists := false
	for rows.Next() {
		var (
			cid, notnull, pk int
			name, ctype      string
			dflt             sql.NullString
		)
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return fmt.Errorf("scan table_info: %w", err)
		}
		if name == column {
			exists = true
		}
	}
	rowsErr := rows.Err()
	rows.Close()
	if rowsErr != nil {
		return rowsErr
	}
	if exists {
		return nil
	}
	_, err = db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, columnType))
	return err
}

// queryStrings runs a single-column query and returns the column values.
func queryStrings(db *sql.DB, query string) ([]string, error) {
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s sql.NullString
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		out = append(out, s.String)
	}
	return out, rows.Err()
}
