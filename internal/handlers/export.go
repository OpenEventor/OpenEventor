package handlers

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ExportEvent streams the event's self-contained SQLite file for backup/transfer.
// It first checkpoints the WAL into the main file (so the single .db is complete)
// and stamps settings['backup'] with today's date — mirroring the iOS export.
// The downloaded file is fully interchangeable with the iOS app.
func (h *Handler) ExportEvent(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	// Record the backup date (best-effort — don't fail the export over it).
	_, _ = db.Exec(
		"INSERT OR REPLACE INTO settings (key, value) VALUES ('backup', ?)",
		time.Now().UTC().Format("2006-01-02"),
	)

	// Fold the WAL back into the main database file so the single .db we send is
	// complete and self-contained.
	if _, err := db.Exec("PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to checkpoint database"})
	}

	path := filepath.Join(h.DB.DataDir(), fmt.Sprintf("event_%s.db", eventID))
	return c.Download(path, exportFilename(db, eventID))
}

// exportFilename builds a friendly "<name>_<date>.db" download name from event
// settings, falling back to the event id. Tolerates either the iOS or web
// settings-key vocabulary during the transition.
func exportFilename(db *sql.DB, eventID string) string {
	name := ""
	_ = db.QueryRow(
		"SELECT value FROM settings WHERE key IN ('display_name','event_name') AND value <> '' ORDER BY key LIMIT 1",
	).Scan(&name)
	date := ""
	_ = db.QueryRow(
		"SELECT value FROM settings WHERE key IN ('date','event_date') AND value <> '' ORDER BY key LIMIT 1",
	).Scan(&date)

	base := sanitizeFilename(name)
	if base == "" {
		base = "event_" + eventID
	}
	if date != "" {
		base += "_" + sanitizeFilename(date)
	}
	return base + ".db"
}

// sanitizeFilename keeps a filename safe across platforms: strips path separators
// and control/reserved characters, collapses whitespace to underscores.
func sanitizeFilename(s string) string {
	s = strings.TrimSpace(s)
	var b strings.Builder
	for _, r := range s {
		switch {
		case r < 0x20 || r == 0x7f:
			// drop control chars
		case strings.ContainsRune(`/\:*?"<>|`, r):
			// drop path/reserved chars
		case r == ' ' || r == '\t':
			b.WriteRune('_')
		default:
			b.WriteRune(r)
		}
	}
	return strings.Trim(b.String(), "._")
}
