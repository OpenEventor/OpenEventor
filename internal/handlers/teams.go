package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
)

func (h *Handler) ListTeams(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	rows, err := db.Query(
		`SELECT id, name, country, region, city, description, created_at, updated_at
		 FROM teams ORDER BY name`,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	teams := make([]models.Team, 0)
	for rows.Next() {
		var t models.Team
		if err := rows.Scan(
			&t.ID, &t.Name, &t.Country, &t.Region, &t.City, &t.Description,
			&t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		teams = append(teams, t)
	}

	return c.JSON(teams)
}

type teamRequest struct {
	Name        string `json:"name"`
	Country     string `json:"country"`
	Region      string `json:"region"`
	City        string `json:"city"`
	Description string `json:"description"`
}

func (h *Handler) CreateTeam(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	var req teamRequest
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
		`INSERT INTO teams (id, name, country, region, city, description, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Name, req.Country, req.Region, req.City, req.Description, now, now,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create team"})
	}

	return c.Status(fiber.StatusCreated).JSON(models.Team{
		ID: id, Name: req.Name, Country: req.Country, Region: req.Region,
		City: req.City, Description: req.Description,
		CreatedAt: now, UpdatedAt: now,
	})
}

func (h *Handler) UpdateTeam(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	teamID := c.Params("teamId")

	var req teamRequest
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
		`UPDATE teams SET name = ?, country = ?, region = ?, city = ?, description = ?, updated_at = ?
		WHERE id = ?`,
		req.Name, req.Country, req.Region, req.City, req.Description, now,
		teamID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update team"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "team not found"})
	}

	var createdAt string
	_ = db.QueryRow("SELECT created_at FROM teams WHERE id = ?", teamID).Scan(&createdAt)

	return c.JSON(models.Team{
		ID: teamID, Name: req.Name, Country: req.Country, Region: req.Region,
		City: req.City, Description: req.Description,
		CreatedAt: createdAt, UpdatedAt: now,
	})
}

func (h *Handler) DeleteTeam(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	teamID := c.Params("teamId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	result, err := db.Exec("DELETE FROM teams WHERE id = ?", teamID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete team"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "team not found"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
