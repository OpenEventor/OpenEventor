package handlers

import (
	crypto_rand "crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
)

func (h *Handler) ListEvents(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)

	db := h.DB.SystemDB()
	rows, err := db.Query(
		`SELECT e.id, e.display_name, e.date, e.status, COALESCE(e.token, ''), e.created_at
		 FROM events e
		 JOIN event_access ea ON e.id = ea.event_id
		 WHERE ea.user_id = ?
		 ORDER BY e.created_at DESC`,
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	events := make([]models.Event, 0)
	for rows.Next() {
		var ev models.Event
		if err := rows.Scan(&ev.ID, &ev.DisplayName, &ev.Date, &ev.Status, &ev.Token, &ev.CreatedAt); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		events = append(events, ev)
	}

	return c.JSON(events)
}

type createEventRequest struct {
	DisplayName string `json:"displayName"`
	Date        string `json:"date"`
	Timezone    string `json:"timezone"`
}

func (h *Handler) CreateEvent(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)

	var req createEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.DisplayName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "displayName is required"})
	}
	if req.Date == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "date is required"})
	}
	if req.Timezone == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "timezone is required"})
	}

	id := uuid.New().String()
	filename := "event_" + id + ".db"
	now := time.Now().UTC().Format(time.RFC3339)

	eventToken, err := generateEventToken()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate event token"})
	}

	db := h.DB.SystemDB()

	_, err = db.Exec(
		"INSERT INTO events (id, filename, display_name, date, status, token, created_at) VALUES (?, ?, ?, ?, 'active', ?, ?)",
		id, filename, req.DisplayName, req.Date, eventToken, now,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create event"})
	}

	_, err = db.Exec(
		"INSERT INTO event_access (event_id, user_id, role) VALUES (?, ?, 'admin')",
		id, userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to set event access"})
	}

	// Create event database file and run migrations.
	eventDB, err := h.DB.CreateEventDB(id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create event database"})
	}

	// Store event name, date, timezone, and token in event settings.
	_, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('event_name', ?)", req.DisplayName)
	_, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('event_date', ?)", req.Date)
	_, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('event_timezone', ?)", req.Timezone)
	_, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('event_token', ?)", eventToken)

	return c.Status(fiber.StatusCreated).JSON(models.Event{
		ID:          id,
		DisplayName: req.DisplayName,
		Date:        req.Date,
		Status:      "active",
		Token:       eventToken,
		CreatedAt:   now,
	})
}

// ReloadEvents scans the data directory for event_*.db files and syncs with system.db.
// - Removes entries from system.db whose files don't exist on disk.
// - Adds entries for files found on disk that aren't in system.db.
func (h *Handler) ReloadEvents(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	sysDB := h.DB.SystemDB()
	dataDir := h.DB.DataDir()

	// 1. Get all events currently in system.db.
	rows, err := sysDB.Query("SELECT id, filename FROM events")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	// Map: filename → eventID for known events.
	knownByFile := make(map[string]string)
	knownIDs := make(map[string]string) // id → filename
	for rows.Next() {
		var id, filename string
		if err := rows.Scan(&id, &filename); err != nil {
			rows.Close()
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		knownByFile[filename] = id
		knownIDs[id] = filename
	}
	rows.Close()

	// 2. Remove entries whose .db file no longer exists.
	var removed int
	for id, filename := range knownIDs {
		path := filepath.Join(dataDir, filename)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			h.DB.CloseEventDB(id)
			_, _ = sysDB.Exec("DELETE FROM event_access WHERE event_id = ?", id)
			_, _ = sysDB.Exec("DELETE FROM events WHERE id = ?", id)
			removed++
		}
	}

	// 3. Scan directory for event_*.db files not in system.db.
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read data directory"})
	}

	var added int
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasPrefix(name, "event_") || !strings.HasSuffix(name, ".db") {
			continue
		}
		if _, known := knownByFile[name]; known {
			continue
		}

		// Extract event ID from filename: event_<uuid>.db
		id := strings.TrimSuffix(strings.TrimPrefix(name, "event_"), ".db")
		if id == "" {
			continue
		}

		// Read display name and date from the event DB settings.
		eventDB, err := h.DB.EventDB(id)
		if err != nil {
			continue // Skip unreadable files.
		}

		var displayName, date, eventToken string
		_ = eventDB.QueryRow("SELECT value FROM settings WHERE key = 'event_name'").Scan(&displayName)
		_ = eventDB.QueryRow("SELECT value FROM settings WHERE key = 'event_date'").Scan(&date)
		_ = eventDB.QueryRow("SELECT value FROM settings WHERE key = 'event_token'").Scan(&eventToken)
		if displayName == "" {
			displayName = name // Fallback to filename.
		}
		// Generate token if the event DB doesn't have one.
		if eventToken == "" {
			eventToken, _ = generateEventToken()
			_, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('event_token', ?)", eventToken)
		}

		now := time.Now().UTC().Format(time.RFC3339)
		_, err = sysDB.Exec(
			"INSERT INTO events (id, filename, display_name, date, status, token, created_at) VALUES (?, ?, ?, ?, 'active', ?, ?)",
			id, name, displayName, date, eventToken, now,
		)
		if err != nil {
			continue
		}

		// Give current user admin access.
		_, _ = sysDB.Exec(
			"INSERT OR IGNORE INTO event_access (event_id, user_id, role) VALUES (?, ?, 'admin')",
			id, userID,
		)
		added++
	}

	return c.JSON(fiber.Map{
		"added":   added,
		"removed": removed,
	})
}

func (h *Handler) GetEvent(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	db := h.DB.SystemDB()

	var ev models.Event
	err := db.QueryRow(
		"SELECT id, display_name, date, status, COALESCE(token, ''), created_at FROM events WHERE id = ?",
		eventID,
	).Scan(&ev.ID, &ev.DisplayName, &ev.Date, &ev.Status, &ev.Token, &ev.CreatedAt)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "event not found"})
	}

	return c.JSON(ev)
}

func (h *Handler) UpdateEvent(c *fiber.Ctx) error {
	// TODO: implement update event
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) DeleteEvent(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	eventID := c.Params("eventId")

	db := h.DB.SystemDB()

	// Check that user has admin role for this event.
	var role string
	err := db.QueryRow(
		"SELECT role FROM event_access WHERE event_id = ? AND user_id = ?",
		eventID, userID,
	).Scan(&role)
	if err != nil || role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "admin access required"})
	}

	// Get filename before deleting the record.
	var filename string
	_ = db.QueryRow("SELECT filename FROM events WHERE id = ?", eventID).Scan(&filename)

	// Close the event DB connection, remove access entries, then the event record.
	h.DB.CloseEventDB(eventID)
	_, _ = db.Exec("DELETE FROM event_access WHERE event_id = ?", eventID)
	_, err = db.Exec("DELETE FROM events WHERE id = ?", eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete event"})
	}

	// Remove the .db file from disk.
	if filename != "" {
		dbPath := filepath.Join(h.DB.DataDir(), filename)
		_ = os.Remove(dbPath)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// generateEventToken creates a random 64-char hex token for event auth.
func generateEventToken() (string, error) {
	b := make([]byte, 32)
	if _, err := crypto_rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
