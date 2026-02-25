package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
)

func (h *Handler) ListEvents(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)

	db := h.DB.SystemDB()
	rows, err := db.Query(
		`SELECT e.id, e.display_name, e.date, e.status, e.created_at
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
		if err := rows.Scan(&ev.ID, &ev.DisplayName, &ev.Date, &ev.Status, &ev.CreatedAt); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		events = append(events, ev)
	}

	return c.JSON(events)
}

type createEventRequest struct {
	DisplayName string `json:"displayName"`
	Date        string `json:"date"`
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

	id := uuid.New().String()
	filename := "event_" + id + ".db"
	now := time.Now().UTC().Format(time.RFC3339)

	db := h.DB.SystemDB()

	_, err := db.Exec(
		"INSERT INTO events (id, filename, display_name, date, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)",
		id, filename, req.DisplayName, req.Date, now,
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
	eventDB, err := h.DB.EventDB(id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create event database"})
	}

	// Store event name and date in event settings.
	_, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('event_name', ?)", req.DisplayName)
	if req.Date != "" {
		_, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('event_date', ?)", req.Date)
	}

	return c.Status(fiber.StatusCreated).JSON(models.Event{
		ID:          id,
		DisplayName: req.DisplayName,
		Date:        req.Date,
		Status:      "active",
		CreatedAt:   now,
	})
}

func (h *Handler) GetEvent(c *fiber.Ctx) error {
	// TODO: implement get event
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
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

	// Remove access entries, then the event record. Keep the .db file.
	_, _ = db.Exec("DELETE FROM event_access WHERE event_id = ?", eventID)
	_, err = db.Exec("DELETE FROM events WHERE id = ?", eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete event"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
