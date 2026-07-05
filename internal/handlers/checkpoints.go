package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
)

// ListCheckpoints returns all control points for an event, ordered for display.
func (h *Handler) ListCheckpoints(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	rows, err := db.Query(
		`SELECT id, name, latitude, longitude, COALESCE(description, ''), sort_order,
		        created_at, updated_at
		 FROM checkpoints ORDER BY sort_order, name`,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	checkpoints := make([]models.Checkpoint, 0)
	for rows.Next() {
		var cp models.Checkpoint
		if err := rows.Scan(
			&cp.ID, &cp.Name, &cp.Latitude, &cp.Longitude, &cp.Description, &cp.SortOrder,
			&cp.CreatedAt, &cp.UpdatedAt,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		checkpoints = append(checkpoints, cp)
	}

	return c.JSON(checkpoints)
}

type checkpointRequest struct {
	Name        string   `json:"name"`
	Latitude    *float64 `json:"latitude"`
	Longitude   *float64 `json:"longitude"`
	Description string   `json:"description"`
	SortOrder   int      `json:"sortOrder"`
}

func (h *Handler) CreateCheckpoint(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	var req checkpointRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	_, err = db.Exec(
		`INSERT INTO checkpoints (id, name, latitude, longitude, description, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Name, req.Latitude, req.Longitude, req.Description, req.SortOrder, now, now,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create checkpoint"})
	}

	return c.Status(fiber.StatusCreated).JSON(models.Checkpoint{
		ID: id, Name: req.Name, Latitude: req.Latitude, Longitude: req.Longitude,
		Description: req.Description, SortOrder: req.SortOrder,
		CreatedAt: now, UpdatedAt: now,
	})
}

func (h *Handler) UpdateCheckpoint(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	checkpointID := c.Params("checkpointId")

	var req checkpointRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	now := time.Now().UTC().Format(time.RFC3339)

	result, err := db.Exec(
		`UPDATE checkpoints SET
			name = ?, latitude = ?, longitude = ?, description = ?, sort_order = ?, updated_at = ?
		WHERE id = ?`,
		req.Name, req.Latitude, req.Longitude, req.Description, req.SortOrder, now,
		checkpointID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update checkpoint"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "checkpoint not found"})
	}

	var createdAt string
	_ = db.QueryRow("SELECT created_at FROM checkpoints WHERE id = ?", checkpointID).Scan(&createdAt)

	return c.JSON(models.Checkpoint{
		ID: checkpointID, Name: req.Name, Latitude: req.Latitude, Longitude: req.Longitude,
		Description: req.Description, SortOrder: req.SortOrder,
		CreatedAt: createdAt, UpdatedAt: now,
	})
}

func (h *Handler) DeleteCheckpoint(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	checkpointID := c.Params("checkpointId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	result, err := db.Exec("DELETE FROM checkpoints WHERE id = ?", checkpointID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete checkpoint"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "checkpoint not found"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
