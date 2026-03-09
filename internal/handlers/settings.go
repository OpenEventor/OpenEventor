package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// GetSettings returns all key-value pairs from the event's settings table.
func (h *Handler) GetSettings(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "event database not found"})
	}

	rows, err := db.Query("SELECT key, value FROM settings")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	settings := make(fiber.Map)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		settings[key] = value
	}

	return c.JSON(settings)
}

type updateSettingsRequest struct {
	Settings map[string]string `json:"settings"`
}

// UpdateSettings updates event settings and syncs cached fields to system.db.
func (h *Handler) UpdateSettings(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	var req updateSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "event database not found"})
	}

	for key, value := range req.Settings {
		if value == "" {
			_, _ = db.Exec("DELETE FROM settings WHERE key = ?", key)
		} else {
			_, _ = db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value)
		}
	}

	// Sync cached fields to system.db for fast listing.
	sysDB := h.DB.SystemDB()
	if name, ok := req.Settings["event_name"]; ok {
		_, _ = sysDB.Exec("UPDATE events SET display_name = ? WHERE id = ?", name, eventID)
	}
	if date, ok := req.Settings["event_date"]; ok {
		_, _ = sysDB.Exec("UPDATE events SET date = ? WHERE id = ?", date, eventID)
	}

	// Return all settings after update.
	rows, err := db.Query("SELECT key, value FROM settings")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	settings := make(fiber.Map)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		settings[key] = value
	}

	return c.JSON(settings)
}
