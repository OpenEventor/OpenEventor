package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
)

func (h *Handler) ListCourses(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	rows, err := db.Query(
		`SELECT id, name, checkpoints, validation_mode, geo_track,
		        length, altitude, climb, start_time, price, description,
		        created_at, updated_at
		 FROM courses ORDER BY created_at`,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	courses := make([]models.Course, 0)
	for rows.Next() {
		var co models.Course
		if err := rows.Scan(
			&co.ID, &co.Name, &co.Checkpoints, &co.ValidationMode, &co.GeoTrack,
			&co.Length, &co.Altitude, &co.Climb, &co.StartTime, &co.Price, &co.Description,
			&co.CreatedAt, &co.UpdatedAt,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		courses = append(courses, co)
	}

	return c.JSON(courses)
}

type courseRequest struct {
	Name           string  `json:"name"`
	Checkpoints    string  `json:"checkpoints"`
	ValidationMode string  `json:"validationMode"`
	GeoTrack       string  `json:"geoTrack"`
	Length         float64 `json:"length"`
	Altitude       float64 `json:"altitude"`
	Climb          float64 `json:"climb"`
	StartTime      float64 `json:"startTime"`
	Price          float64 `json:"price"`
	Description    string  `json:"description"`
}

func (h *Handler) CreateCourse(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	var req courseRequest
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
		`INSERT INTO courses (id, name, checkpoints, validation_mode, geo_track,
		 length, altitude, climb, start_time, price, description,
		 created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Name, req.Checkpoints, req.ValidationMode, req.GeoTrack,
		req.Length, req.Altitude, req.Climb, req.StartTime, req.Price, req.Description,
		now, now,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create course"})
	}

	return c.Status(fiber.StatusCreated).JSON(models.Course{
		ID: id, Name: req.Name, Checkpoints: req.Checkpoints,
		ValidationMode: req.ValidationMode, GeoTrack: req.GeoTrack,
		Length: req.Length, Altitude: req.Altitude, Climb: req.Climb,
		StartTime: req.StartTime, Price: req.Price, Description: req.Description,
		CreatedAt: now, UpdatedAt: now,
	})
}

func (h *Handler) UpdateCourse(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	courseID := c.Params("courseId")

	var req courseRequest
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
		`UPDATE courses SET
			name = ?, checkpoints = ?, validation_mode = ?, geo_track = ?,
			length = ?, altitude = ?, climb = ?,
			start_time = ?, price = ?, description = ?, updated_at = ?
		WHERE id = ?`,
		req.Name, req.Checkpoints, req.ValidationMode, req.GeoTrack,
		req.Length, req.Altitude, req.Climb,
		req.StartTime, req.Price, req.Description, now,
		courseID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update course"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "course not found"})
	}

	var createdAt string
	_ = db.QueryRow("SELECT created_at FROM courses WHERE id = ?", courseID).Scan(&createdAt)

	return c.JSON(models.Course{
		ID: courseID, Name: req.Name, Checkpoints: req.Checkpoints,
		ValidationMode: req.ValidationMode, GeoTrack: req.GeoTrack,
		Length: req.Length, Altitude: req.Altitude, Climb: req.Climb,
		StartTime: req.StartTime, Price: req.Price, Description: req.Description,
		CreatedAt: createdAt, UpdatedAt: now,
	})
}

func (h *Handler) DeleteCourse(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	courseID := c.Params("courseId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	result, err := db.Exec("DELETE FROM courses WHERE id = ?", courseID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete course"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "course not found"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
