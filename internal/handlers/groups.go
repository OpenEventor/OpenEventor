package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
)

func (h *Handler) ListGroups(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	rows, err := db.Query(
		`SELECT id, name, course_id, parent_id, gender, year_from, year_to,
		        start_time, price, description, sort_order,
		        created_at, updated_at
		 FROM groups ORDER BY sort_order, name`,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	groups := make([]models.Group, 0)
	for rows.Next() {
		var g models.Group
		if err := rows.Scan(
			&g.ID, &g.Name, &g.CourseID, &g.ParentID, &g.Gender, &g.YearFrom, &g.YearTo,
			&g.StartTime, &g.Price, &g.Description, &g.SortOrder,
			&g.CreatedAt, &g.UpdatedAt,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		groups = append(groups, g)
	}

	return c.JSON(groups)
}

type groupRequest struct {
	Name        string  `json:"name"`
	CourseID    string  `json:"courseId"`
	ParentID    string  `json:"parentId"`
	Gender      string  `json:"gender"`
	YearFrom    int     `json:"yearFrom"`
	YearTo      int     `json:"yearTo"`
	StartTime   float64 `json:"startTime"`
	Price       float64 `json:"price"`
	Description string  `json:"description"`
	SortOrder   int     `json:"sortOrder"`
}

func (h *Handler) CreateGroup(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	var req groupRequest
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
		`INSERT INTO groups (id, name, course_id, parent_id, gender, year_from, year_to,
		 start_time, price, description, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Name, req.CourseID, req.ParentID, req.Gender, req.YearFrom, req.YearTo,
		req.StartTime, req.Price, req.Description, req.SortOrder, now, now,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create group"})
	}

	return c.Status(fiber.StatusCreated).JSON(models.Group{
		ID: id, Name: req.Name, CourseID: req.CourseID, ParentID: req.ParentID,
		Gender: req.Gender, YearFrom: req.YearFrom, YearTo: req.YearTo,
		StartTime: req.StartTime, Price: req.Price, Description: req.Description,
		SortOrder: req.SortOrder, CreatedAt: now, UpdatedAt: now,
	})
}

func (h *Handler) UpdateGroup(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	groupID := c.Params("groupId")

	var req groupRequest
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
		`UPDATE groups SET
			name = ?, course_id = ?, parent_id = ?, gender = ?,
			year_from = ?, year_to = ?,
			start_time = ?, price = ?, description = ?, sort_order = ?, updated_at = ?
		WHERE id = ?`,
		req.Name, req.CourseID, req.ParentID, req.Gender,
		req.YearFrom, req.YearTo,
		req.StartTime, req.Price, req.Description, req.SortOrder, now,
		groupID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update group"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "group not found"})
	}

	var createdAt string
	_ = db.QueryRow("SELECT created_at FROM groups WHERE id = ?", groupID).Scan(&createdAt)

	return c.JSON(models.Group{
		ID: groupID, Name: req.Name, CourseID: req.CourseID, ParentID: req.ParentID,
		Gender: req.Gender, YearFrom: req.YearFrom, YearTo: req.YearTo,
		StartTime: req.StartTime, Price: req.Price, Description: req.Description,
		SortOrder: req.SortOrder, CreatedAt: createdAt, UpdatedAt: now,
	})
}

func (h *Handler) DeleteGroup(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	groupID := c.Params("groupId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	result, err := db.Exec("DELETE FROM groups WHERE id = ?", groupID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete group"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "group not found"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
