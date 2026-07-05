package handlers

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
)

// ImportEvent accepts an uploaded OpenEventor event .db (multipart field "file"),
// validates it, stores it under a NEW event id (so it never collides with an
// existing event), migrates it up to the current schema, and registers it in
// system.db with admin access for the current user. Interchangeable with the iOS
// app's exported files.
func (h *Handler) ImportEvent(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	if !userExists(h.DB.SystemDB(), userID) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "your session is no longer valid — please log in again"})
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "file is required (multipart field 'file')"})
	}

	newID := uuid.New().String()
	filename := "event_" + newID + ".db"
	dstPath := filepath.Join(h.DB.DataDir(), filename)

	if err := c.SaveFile(fh, dstPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to store uploaded file"})
	}

	// Validate before adopting; remove the file if it isn't a real OE event DB.
	if err := validateOpenEventorDB(dstPath); err != nil {
		_ = os.Remove(dstPath)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// Open + migrate (brings older DBs up to checkpoints/raw_code) and cache it.
	eventDB, err := h.DB.EventDB(newID)
	if err != nil {
		_ = os.Remove(dstPath)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open imported database"})
	}

	// Read metadata using the canonical (iOS) keys, falling back to legacy web keys.
	var displayName, date string
	_ = eventDB.QueryRow(`SELECT COALESCE((SELECT value FROM settings WHERE key='display_name'),(SELECT value FROM settings WHERE key='event_name'),'')`).Scan(&displayName)
	_ = eventDB.QueryRow(`SELECT COALESCE((SELECT value FROM settings WHERE key='date'),(SELECT value FROM settings WHERE key='event_date'),'')`).Scan(&date)
	if displayName == "" {
		displayName = fh.Filename
	}
	// Always mint a FRESH token: the imported copy is a distinct event, and reusing
	// the source's token would collide with the source's system.db registration
	// (events.token is UNIQUE).
	token, err := generateEventToken()
	if err != nil {
		h.DB.CloseEventDB(newID)
		_ = os.Remove(dstPath)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate event token"})
	}
	// Persist the new token + id under the canonical keys.
	_, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('token', ?)", token)
	_, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('id', ?)", newID)

	now := time.Now().UTC().Format(time.RFC3339)
	sysDB := h.DB.SystemDB()
	if _, err := sysDB.Exec(
		"INSERT INTO events (id, filename, display_name, date, status, token, created_at) VALUES (?, ?, ?, ?, 'active', ?, ?)",
		newID, filename, displayName, date, token, now,
	); err != nil {
		h.DB.CloseEventDB(newID)
		_ = os.Remove(dstPath)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to register imported event"})
	}
	if _, err := sysDB.Exec(
		"INSERT INTO event_access (event_id, user_id, role) VALUES (?, ?, 'admin')",
		newID, userID,
	); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to set event access"})
	}

	return c.Status(fiber.StatusCreated).JSON(models.Event{
		ID: newID, DisplayName: displayName, Date: date, Status: "active", Token: token, CreatedAt: now,
	})
}

// userExists reports whether a user id is present in system.db. Guards against a
// valid-signature JWT whose user no longer exists (e.g. after a data reset),
// which would otherwise FK-fail the event_access insert with a cryptic 500.
func userExists(db *sql.DB, id string) bool {
	if id == "" {
		return false
	}
	var n int
	if err := db.QueryRow("SELECT COUNT(1) FROM users WHERE id = ?", id).Scan(&n); err != nil {
		return false
	}
	return n > 0
}

// validateOpenEventorDB confirms path is a SQLite file that looks like an
// OpenEventor event database: the SQLite header, the core tables, and the
// migration ledger. Returns a user-facing error describing the first failure.
func validateOpenEventorDB(path string) error {
	if !hasSQLiteHeader(path) {
		return fmt.Errorf("file is not a SQLite database")
	}
	db, err := sql.Open("sqlite3", path+"?mode=ro&_foreign_keys=ON")
	if err != nil {
		return fmt.Errorf("cannot open database")
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		return fmt.Errorf("cannot read database")
	}
	// Core tables that every OpenEventor event DB has, plus the migration ledger.
	required := []string{"competitors", "courses", "groups", "passings", "settings", "schema_migrations"}
	for _, t := range required {
		var name string
		if err := db.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?", t,
		).Scan(&name); err != nil {
			return fmt.Errorf("not an OpenEventor event database (missing table %q)", t)
		}
	}
	return nil
}

// hasSQLiteHeader reports whether the file begins with the SQLite magic string.
func hasSQLiteHeader(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()
	buf := make([]byte, 16)
	if _, err := f.Read(buf); err != nil {
		return false
	}
	return string(buf) == "SQLite format 3\x00"
}
