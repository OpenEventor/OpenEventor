package handlers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/sse"
)

// CreatePassings handles batch passing creation from timing devices (event-token auth).
func (h *Handler) CreatePassings(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	var reqs []passingRequest
	if err := c.BodyParser(&reqs); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body: expected JSON array"})
	}
	if len(reqs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "empty passings array"})
	}

	// Validate all before inserting any.
	for i, req := range reqs {
		if req.Card == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("passing[%d]: card is required", i)})
		}
		if req.Checkpoint == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("passing[%d]: checkpoint is required", i)})
		}
		if req.Timestamp == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("passing[%d]: timestamp is required", i)})
		}
	}

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	tx, err := db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to start transaction"})
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO passings (id, card, checkpoint, timestamp, enabled, source, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to prepare statement"})
	}
	defer stmt.Close()

	now := time.Now().UTC().Format(time.RFC3339)
	passings := make([]models.Passing, len(reqs))

	for i, req := range reqs {
		id := uuid.New().String()
		source := req.Source
		if source == "" {
			source = "device"
		}
		enabled := req.Enabled
		if enabled == 0 {
			enabled = 1 // Default: enabled for device passings.
		}

		if _, err := stmt.Exec(id, req.Card, req.Checkpoint, req.Timestamp, enabled, source, now, now); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("failed to insert passing[%d]", i)})
		}

		passings[i] = models.Passing{
			ID: id, Card: req.Card, Checkpoint: req.Checkpoint,
			Timestamp: req.Timestamp, Enabled: enabled, Source: source,
			CreatedAt: now, UpdatedAt: now,
		}
	}

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to commit transaction"})
	}

	// Broadcast SSE after successful commit.
	for _, p := range passings {
		h.SSE.Broadcast(eventID, sse.Message{
			Event: "passing",
			Data:  sse.MustJSON(fiber.Map{"action": "create", "passing": p}),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(passings)
}

// ListPassings returns all passings for an event (user JWT auth).
// Optional query params:
//   - ?updated_after=<ISO8601> — returns only passings with updated_at >= value.
//   - ?card=<value> — filter by card (repeatable, e.g. ?card=123&card=456).
func (h *Handler) ListPassings(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	updatedAfter := c.Query("updated_after")
	cards := c.Context().QueryArgs().PeekMulti("card")

	query := `SELECT id, card, checkpoint, timestamp, enabled, source, sort_order, created_at, updated_at FROM passings`
	var conditions []string
	var args []interface{}

	if updatedAfter != "" {
		conditions = append(conditions, "updated_at >= ?")
		args = append(args, updatedAfter)
	}

	if len(cards) > 0 {
		placeholders := make([]string, len(cards))
		for i, card := range cards {
			placeholders[i] = "?"
			args = append(args, string(card))
		}
		conditions = append(conditions, "card IN ("+strings.Join(placeholders, ",")+")")
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY sort_order ASC, timestamp ASC"

	var rows *sql.Rows
	rows, err = db.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	passings := make([]models.Passing, 0)
	for rows.Next() {
		var p models.Passing
		if err := rows.Scan(
			&p.ID, &p.Card, &p.Checkpoint, &p.Timestamp, &p.Enabled, &p.Source,
			&p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		passings = append(passings, p)
	}

	return c.JSON(passings)
}

type passingRequest struct {
	Card       string  `json:"card"`
	Checkpoint string  `json:"checkpoint"`
	Timestamp  float64 `json:"timestamp"`
	Enabled    int     `json:"enabled"`
	Source     string  `json:"source"`
	SortOrder  int     `json:"sortOrder"`
}

// CreatePassing creates a single passing manually (user JWT auth).
func (h *Handler) CreatePassing(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	var req passingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Card == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "card is required"})
	}
	if req.Checkpoint == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "checkpoint is required"})
	}
	if req.Timestamp == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "timestamp is required"})
	}

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	if req.Source == "" {
		req.Source = "manual"
	}

	_, err = db.Exec(
		`INSERT INTO passings (id, card, checkpoint, timestamp, enabled, source, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Card, req.Checkpoint, req.Timestamp, req.Enabled, req.Source, req.SortOrder, now, now,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create passing"})
	}

	passing := models.Passing{
		ID: id, Card: req.Card, Checkpoint: req.Checkpoint,
		Timestamp: req.Timestamp, Enabled: req.Enabled, Source: req.Source,
		SortOrder: req.SortOrder, CreatedAt: now, UpdatedAt: now,
	}

	h.SSE.Broadcast(eventID, sse.Message{
		Event: "passing",
		Data:  sse.MustJSON(fiber.Map{"action": "create", "passing": passing}),
	})

	return c.Status(fiber.StatusCreated).JSON(passing)
}

// UpdatePassing updates a passing (user JWT auth).
func (h *Handler) UpdatePassing(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	passingID := c.Params("passingId")

	var req passingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Card == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "card is required"})
	}
	if req.Checkpoint == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "checkpoint is required"})
	}
	if req.Timestamp == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "timestamp is required"})
	}

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	now := time.Now().UTC().Format(time.RFC3339)

	result, err := db.Exec(
		`UPDATE passings SET card = ?, checkpoint = ?, timestamp = ?, enabled = ?, source = ?, sort_order = ?, updated_at = ?
		WHERE id = ?`,
		req.Card, req.Checkpoint, req.Timestamp, req.Enabled, req.Source, req.SortOrder, now,
		passingID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update passing"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "passing not found"})
	}

	var createdAt string
	_ = db.QueryRow("SELECT created_at FROM passings WHERE id = ?", passingID).Scan(&createdAt)

	passing := models.Passing{
		ID: passingID, Card: req.Card, Checkpoint: req.Checkpoint,
		Timestamp: req.Timestamp, Enabled: req.Enabled, Source: req.Source,
		SortOrder: req.SortOrder, CreatedAt: createdAt, UpdatedAt: now,
	}

	h.SSE.Broadcast(eventID, sse.Message{
		Event: "passing",
		Data:  sse.MustJSON(fiber.Map{"action": "update", "passing": passing}),
	})

	return c.JSON(passing)
}

// DeletePassing deletes a passing (user JWT auth).
func (h *Handler) DeletePassing(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	passingID := c.Params("passingId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	result, err := db.Exec("DELETE FROM passings WHERE id = ?", passingID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete passing"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "passing not found"})
	}

	h.SSE.Broadcast(eventID, sse.Message{
		Event: "passing",
		Data:  sse.MustJSON(fiber.Map{"action": "delete", "id": passingID}),
	})

	return c.SendStatus(fiber.StatusNoContent)
}
