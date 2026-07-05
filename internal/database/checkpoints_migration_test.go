package database

import (
	"database/sql"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

// applyLegacySchema builds an event DB frozen at migration 002 (no checkpoints
// table, no passings.raw_code), recording only 001+002 in schema_migrations —
// the state a pre-checkpoints web DB (or an old file on disk) is in.
func applyLegacySchema(t *testing.T, db *sql.DB) {
	t.Helper()
	for _, name := range []string{"001_init.sql", "002_start_time_to_real.sql"} {
		content, err := eventMigrations.ReadFile("migrations/event/" + name)
		if err != nil {
			t.Fatalf("read embedded %s: %v", name, err)
		}
		if _, err := db.Exec(string(content)); err != nil {
			t.Fatalf("exec %s: %v", name, err)
		}
	}
	if _, err := db.Exec(`CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(
		`INSERT INTO schema_migrations (filename, applied_at) VALUES
		 ('001_init.sql','2026-01-01T00:00:00Z'),
		 ('002_start_time_to_real.sql','2026-01-01T00:00:00Z')`,
	); err != nil {
		t.Fatal(err)
	}
}

// TestMigrateLegacyToCheckpoints verifies that running the full migration set on
// a legacy (002) DB adds the checkpoints table + passings.raw_code and
// materializes one checkpoint per distinct name — courses first (in sequence
// order), then any passing-only names — matching the iOS conversion.
func TestMigrateLegacyToCheckpoints(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "event_legacy.db")
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	applyLegacySchema(t, db)

	// A course whose sequence names four control points (FINISH repeated later
	// would be a lap; here they're distinct), plus a passing at an off-course
	// control ("99") that isn't in any course.
	if _, err := db.Exec(
		`INSERT INTO courses (id, name, checkpoints, created_at, updated_at)
		 VALUES ('c1', 'Course A', '["START","31","32","FINISH"]', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(
		`INSERT INTO passings (id, card, checkpoint, timestamp, enabled, source, sort_order, created_at, updated_at)
		 VALUES
		 ('p1','101','START',100,1,'device',0,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z'),
		 ('p2','101','99',   200,1,'device',0,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`,
	); err != nil {
		t.Fatal(err)
	}

	// Run the real migration path (003 SQL + hook, 004).
	if err := RunMigrations(db, "event"); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}

	// Ledger now includes 003 + 004.
	got := migrationLedger(t, db)
	want := []string{"001_init.sql", "002_start_time_to_real.sql", "003_control_points.sql", "004_checkpoints_by_name.sql"}
	if len(got) != len(want) {
		t.Fatalf("ledger = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("ledger[%d] = %q, want %q (full: %v)", i, got[i], want[i], got)
		}
	}

	// passings.raw_code now exists.
	if !hasColumn(t, db, "passings", "raw_code") {
		t.Fatal("passings.raw_code was not added")
	}

	// Checkpoints materialized: course sequence in order, then the passing-only
	// name, each with an incrementing sort_order.
	names := checkpointNamesOrdered(t, db)
	wantNames := []string{"START", "31", "32", "FINISH", "99"}
	if len(names) != len(wantNames) {
		t.Fatalf("checkpoint names = %v, want %v", names, wantNames)
	}
	for i := range wantNames {
		if names[i] != wantNames[i] {
			t.Fatalf("checkpoint[%d] = %q, want %q (full: %v)", i, names[i], wantNames[i], names)
		}
	}

	// Re-running is a no-op (idempotent) — no duplicate checkpoints.
	if err := RunMigrations(db, "event"); err != nil {
		t.Fatalf("second RunMigrations: %v", err)
	}
	if again := checkpointNamesOrdered(t, db); len(again) != len(wantNames) {
		t.Fatalf("after re-run, checkpoints = %v, want stable %v", again, wantNames)
	}
}

// TestFreshEventHasCheckpoints confirms a brand-new event DB (all migrations
// from empty) ends up with the checkpoints table, the index, and raw_code.
func TestFreshEventHasCheckpoints(t *testing.T) {
	dir := t.TempDir()
	db, err := sql.Open("sqlite3", filepath.Join(dir, "event_fresh.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := RunMigrations(db, "event"); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}

	if !tableExists(t, db, "checkpoints") {
		t.Fatal("checkpoints table missing on fresh DB")
	}
	if !hasColumn(t, db, "passings", "raw_code") {
		t.Fatal("passings.raw_code missing on fresh DB")
	}
	var idx string
	if err := db.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_checkpoints_name'`,
	).Scan(&idx); err != nil {
		t.Fatalf("idx_checkpoints_name missing: %v", err)
	}
}

// --- helpers ---

func migrationLedger(t *testing.T, db *sql.DB) []string {
	t.Helper()
	rows, err := db.Query("SELECT filename FROM schema_migrations ORDER BY filename")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		out = append(out, s)
	}
	return out
}

func checkpointNamesOrdered(t *testing.T, db *sql.DB) []string {
	t.Helper()
	rows, err := db.Query("SELECT name FROM checkpoints ORDER BY sort_order ASC")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		out = append(out, s)
	}
	return out
}

func hasColumn(t *testing.T, db *sql.DB, table, column string) bool {
	t.Helper()
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			cid, notnull, pk int
			name, ctype      string
			dflt             sql.NullString
		)
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			t.Fatal(err)
		}
		if name == column {
			return true
		}
	}
	return false
}

func tableExists(t *testing.T, db *sql.DB, table string) bool {
	t.Helper()
	var name string
	err := db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table).Scan(&name)
	if err == sql.ErrNoRows {
		return false
	}
	if err != nil {
		t.Fatal(err)
	}
	return name == table
}
