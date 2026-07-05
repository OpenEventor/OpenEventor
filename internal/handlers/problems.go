package handlers

import (
	"database/sql"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/openeventor/openeventor/internal/problems"
	"github.com/openeventor/openeventor/internal/results"
)

// GetProblems scans an event for data-quality problems on the fly (nothing
// stored), mirroring the iOS «Разбор проблем». Results are computed first so the
// scanner can flag negative times and broken-order finishes.
func (h *Handler) GetProblems(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	settings, err := loadSettings(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load settings"})
	}
	competitors, err := loadCompetitors(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load competitors"})
	}
	courses, err := loadCourses(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load courses"})
	}
	groups, err := loadGroups(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load groups"})
	}
	passings, err := loadPassings(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load passings"})
	}

	computed := results.Compute(competitors, courses, groups, passings)
	found := problems.Scan(settings, competitors, courses, groups, passings, computed)

	return c.JSON(fiber.Map{"problems": found})
}

// loadSettings reads the event's key/value settings into a map.
func loadSettings(db *sql.DB) (map[string]string, error) {
	rows, err := db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, fmt.Errorf("query settings: %w", err)
	}
	defer rows.Close()

	out := make(map[string]string)
	for rows.Next() {
		var key string
		var value sql.NullString
		if err := rows.Scan(&key, &value); err != nil {
			return nil, fmt.Errorf("scan setting: %w", err)
		}
		out[key] = value.String
	}
	return out, rows.Err()
}
