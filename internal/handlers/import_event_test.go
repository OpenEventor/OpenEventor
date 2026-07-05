package handlers

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"

	"github.com/openeventor/openeventor/internal/database"
)

// TestValidateOpenEventorDB covers the import gatekeeper: junk is rejected, a
// plain SQLite file without the OE tables is rejected, and a real event DB (all
// migrations applied) is accepted.
func TestValidateOpenEventorDB(t *testing.T) {
	dir := t.TempDir()

	// 1. Not a SQLite file at all.
	junk := filepath.Join(dir, "junk.txt")
	if err := os.WriteFile(junk, []byte("this is not a database"), 0644); err != nil {
		t.Fatal(err)
	}
	if hasSQLiteHeader(junk) {
		t.Error("junk file reported a SQLite header")
	}
	if err := validateOpenEventorDB(junk); err == nil {
		t.Error("junk file should be rejected")
	}

	// 2. A valid SQLite file, but not an OpenEventor event DB.
	plain := filepath.Join(dir, "plain.db")
	pdb, err := sql.Open("sqlite3", plain)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pdb.Exec("CREATE TABLE x(a)"); err != nil {
		t.Fatal(err)
	}
	pdb.Close()
	if !hasSQLiteHeader(plain) {
		t.Error("plain SQLite file should have a SQLite header")
	}
	if err := validateOpenEventorDB(plain); err == nil {
		t.Error("plain SQLite (missing OE tables) should be rejected")
	}

	// 3. A real OpenEventor event DB (full migration set applied).
	oe := filepath.Join(dir, "event.db")
	odb, err := sql.Open("sqlite3", oe)
	if err != nil {
		t.Fatal(err)
	}
	if err := database.RunMigrations(odb, "event"); err != nil {
		t.Fatalf("migrate event db: %v", err)
	}
	odb.Close()
	if !hasSQLiteHeader(oe) {
		t.Error("event DB should have a SQLite header")
	}
	if err := validateOpenEventorDB(oe); err != nil {
		t.Errorf("valid OpenEventor event DB was rejected: %v", err)
	}
}
