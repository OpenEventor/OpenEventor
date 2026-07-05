package handlers

import (
	"database/sql"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/results"
)

// GetResults computes and returns the results table for an event on the fly
// (results are never stored). Optional query params: ?course=<id> filters by the
// resolved course id, ?group=<id> filters by the competitor's group id.
func (h *Handler) GetResults(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
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
	resp := results.ToResponse(computed, c.Query("course"), c.Query("group"))

	return c.JSON(resp)
}

// loadCompetitors reads all competitors needed for result computation.
func loadCompetitors(db *sql.DB) ([]models.Competitor, error) {
	rows, err := db.Query(
		`SELECT id,
		        COALESCE(bib,''), COALESCE(card1,''), COALESCE(card2,''),
		        COALESCE(team_id,''), COALESCE(group_id,''), COALESCE(course_id,''),
		        COALESCE(first_name,''), COALESCE(last_name,''), COALESCE(birth_year,0),
		        COALESCE(rank,''), COALESCE(rating,0), COALESCE(country,''), COALESCE(notes,''),
		        COALESCE(start_time,0), COALESCE(time_adjustment,0),
		        COALESCE(dsq,0), COALESCE(dns,0), COALESCE(dnf,0), COALESCE(out_of_rank,0)
		 FROM competitors`,
	)
	if err != nil {
		return nil, fmt.Errorf("query competitors: %w", err)
	}
	defer rows.Close()

	competitors := make([]models.Competitor, 0)
	for rows.Next() {
		var comp models.Competitor
		if err := rows.Scan(
			&comp.ID, &comp.Bib, &comp.Card1, &comp.Card2, &comp.TeamID, &comp.GroupID, &comp.CourseID,
			&comp.FirstName, &comp.LastName, &comp.BirthYear,
			&comp.Rank, &comp.Rating, &comp.Country, &comp.Notes,
			&comp.StartTime, &comp.TimeAdjustment,
			&comp.DSQ, &comp.DNS, &comp.DNF, &comp.OutOfRank,
		); err != nil {
			return nil, fmt.Errorf("scan competitor: %w", err)
		}
		competitors = append(competitors, comp)
	}
	return competitors, rows.Err()
}

// loadCourses reads all courses (id, name, checkpoint sequence, validation mode,
// start time) for result computation.
func loadCourses(db *sql.DB) ([]models.Course, error) {
	rows, err := db.Query(
		`SELECT id, name, checkpoints, COALESCE(validation_mode,'strict'), COALESCE(start_time,0) FROM courses`,
	)
	if err != nil {
		return nil, fmt.Errorf("query courses: %w", err)
	}
	defer rows.Close()

	courses := make([]models.Course, 0)
	for rows.Next() {
		var co models.Course
		if err := rows.Scan(&co.ID, &co.Name, &co.Checkpoints, &co.ValidationMode, &co.StartTime); err != nil {
			return nil, fmt.Errorf("scan course: %w", err)
		}
		courses = append(courses, co)
	}
	return courses, rows.Err()
}

// loadGroups reads all groups (for course inheritance and start-time resolution).
func loadGroups(db *sql.DB) ([]models.Group, error) {
	rows, err := db.Query(
		`SELECT id, name, COALESCE(course_id,''), COALESCE(parent_id,''), COALESCE(start_time,0) FROM groups`,
	)
	if err != nil {
		return nil, fmt.Errorf("query groups: %w", err)
	}
	defer rows.Close()

	groups := make([]models.Group, 0)
	for rows.Next() {
		var g models.Group
		if err := rows.Scan(&g.ID, &g.Name, &g.CourseID, &g.ParentID, &g.StartTime); err != nil {
			return nil, fmt.Errorf("scan group: %w", err)
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

// loadPassings reads all passings (the engine filters to enabled ones itself).
func loadPassings(db *sql.DB) ([]models.Passing, error) {
	rows, err := db.Query(
		`SELECT id, card, checkpoint, timestamp, COALESCE(enabled,1) FROM passings`,
	)
	if err != nil {
		return nil, fmt.Errorf("query passings: %w", err)
	}
	defer rows.Close()

	passings := make([]models.Passing, 0)
	for rows.Next() {
		var p models.Passing
		if err := rows.Scan(&p.ID, &p.Card, &p.Checkpoint, &p.Timestamp, &p.Enabled); err != nil {
			return nil, fmt.Errorf("scan passing: %w", err)
		}
		passings = append(passings, p)
	}
	return passings, rows.Err()
}
