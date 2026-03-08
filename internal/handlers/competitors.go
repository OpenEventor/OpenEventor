package handlers

import (
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/sse"
)

// broadcastCompetitor sends a competitor SSE event with the subset of fields relevant to the monitor.
func (h *Handler) broadcastCompetitor(eventID, action string, comp models.Competitor) {
	h.SSE.Broadcast(eventID, sse.Message{
		Event: "competitor",
		Data: sse.MustJSON(fiber.Map{
			"action": action,
			"competitor": fiber.Map{
				"id":        comp.ID,
				"card1":     comp.Card1,
				"card2":     comp.Card2,
				"bib":       comp.Bib,
				"firstName": comp.FirstName,
				"lastName":  comp.LastName,
				"groupId":   comp.GroupID,
				"courseId":   comp.CourseID,
				"startTime": comp.StartTime,
				"dsq":       comp.DSQ,
				"dnf":       comp.DNF,
				"dns":       comp.DNS,
			},
		}),
	})
}

// ListCompetitors returns all competitors for an event (user JWT auth).
// Optional query param: ?updated_after=<ISO8601> — returns only competitors with updated_at >= value.
func (h *Handler) ListCompetitors(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	updatedAfter := c.Query("updated_after")
	columns := `id, bib, card1, card2, team_id, group_id, course_id,
		        first_name, last_name, middle_name, first_name_int, last_name_int,
		        gender, birth_date, birth_year,
		        rank, rating,
		        country, region, city,
		        phone, email,
		        start_time, time_adjustment,
		        dsq, dsq_description, dns, dnf, out_of_rank,
		        entry_number, price, is_paid, is_checkin,
		        notes, created_at, updated_at`

	var rows *sql.Rows
	if updatedAfter != "" {
		rows, err = db.Query(
			`SELECT `+columns+` FROM competitors WHERE updated_at >= ? ORDER BY created_at DESC`,
			updatedAfter,
		)
	} else {
		rows, err = db.Query(
			`SELECT `+columns+` FROM competitors ORDER BY created_at DESC`,
		)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	competitors := make([]models.Competitor, 0)
	for rows.Next() {
		var comp models.Competitor
		if err := rows.Scan(
			&comp.ID, &comp.Bib, &comp.Card1, &comp.Card2, &comp.TeamID, &comp.GroupID, &comp.CourseID,
			&comp.FirstName, &comp.LastName, &comp.MiddleName, &comp.FirstNameInt, &comp.LastNameInt,
			&comp.Gender, &comp.BirthDate, &comp.BirthYear,
			&comp.Rank, &comp.Rating,
			&comp.Country, &comp.Region, &comp.City,
			&comp.Phone, &comp.Email,
			&comp.StartTime, &comp.TimeAdjustment,
			&comp.DSQ, &comp.DSQDescription, &comp.DNS, &comp.DNF, &comp.OutOfRank,
			&comp.EntryNumber, &comp.Price, &comp.IsPaid, &comp.IsCheckin,
			&comp.Notes, &comp.CreatedAt, &comp.UpdatedAt,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		competitors = append(competitors, comp)
	}

	return c.JSON(competitors)
}

// GetCompetitor returns a single competitor by ID.
func (h *Handler) GetCompetitor(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	competitorID := c.Params("competitorId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	columns := `id, bib, card1, card2, team_id, group_id, course_id,
		        first_name, last_name, middle_name, first_name_int, last_name_int,
		        gender, birth_date, birth_year,
		        rank, rating,
		        country, region, city,
		        phone, email,
		        start_time, time_adjustment,
		        dsq, dsq_description, dns, dnf, out_of_rank,
		        entry_number, price, is_paid, is_checkin,
		        notes, created_at, updated_at`

	var comp models.Competitor
	err = db.QueryRow(`SELECT `+columns+` FROM competitors WHERE id = ?`, competitorID).Scan(
		&comp.ID, &comp.Bib, &comp.Card1, &comp.Card2, &comp.TeamID, &comp.GroupID, &comp.CourseID,
		&comp.FirstName, &comp.LastName, &comp.MiddleName, &comp.FirstNameInt, &comp.LastNameInt,
		&comp.Gender, &comp.BirthDate, &comp.BirthYear,
		&comp.Rank, &comp.Rating,
		&comp.Country, &comp.Region, &comp.City,
		&comp.Phone, &comp.Email,
		&comp.StartTime, &comp.TimeAdjustment,
		&comp.DSQ, &comp.DSQDescription, &comp.DNS, &comp.DNF, &comp.OutOfRank,
		&comp.EntryNumber, &comp.Price, &comp.IsPaid, &comp.IsCheckin,
		&comp.Notes, &comp.CreatedAt, &comp.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "competitor not found"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}

	return c.JSON(comp)
}

type competitorRequest struct {
	Bib      string `json:"bib"`
	Card1    string `json:"card1"`
	Card2    string `json:"card2"`
	TeamID   string `json:"teamId"`
	GroupID  string `json:"groupId"`
	CourseID string `json:"courseId"`

	FirstName    string `json:"firstName"`
	LastName     string `json:"lastName"`
	MiddleName   string `json:"middleName"`
	FirstNameInt string `json:"firstNameInt"`
	LastNameInt  string `json:"lastNameInt"`
	Gender       string `json:"gender"`
	BirthDate    string `json:"birthDate"`
	BirthYear    int    `json:"birthYear"`

	Rank   string  `json:"rank"`
	Rating float64 `json:"rating"`

	Country string `json:"country"`
	Region  string `json:"region"`
	City    string `json:"city"`

	Phone string `json:"phone"`
	Email string `json:"email"`

	StartTime      float64 `json:"startTime"`
	TimeAdjustment int     `json:"timeAdjustment"`

	DSQ            int    `json:"dsq"`
	DSQDescription string `json:"dsqDescription"`
	DNS            int    `json:"dns"`
	DNF            int    `json:"dnf"`
	OutOfRank      int    `json:"outOfRank"`

	EntryNumber string  `json:"entryNumber"`
	Price       float64 `json:"price"`
	IsPaid      int     `json:"isPaid"`
	IsCheckin   int     `json:"isCheckin"`

	Notes string `json:"notes"`
}

func (h *Handler) CreateCompetitor(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	var req competitorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.LastName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "lastName is required"})
	}

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	_, err = db.Exec(
		`INSERT INTO competitors (
			id, bib, card1, card2, team_id, group_id, course_id,
			first_name, last_name, middle_name, first_name_int, last_name_int,
			gender, birth_date, birth_year,
			rank, rating,
			country, region, city,
			phone, email,
			start_time, time_adjustment,
			dsq, dsq_description, dns, dnf, out_of_rank,
			entry_number, price, is_paid, is_checkin,
			notes, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Bib, req.Card1, req.Card2, req.TeamID, req.GroupID, req.CourseID,
		req.FirstName, req.LastName, req.MiddleName, req.FirstNameInt, req.LastNameInt,
		req.Gender, req.BirthDate, req.BirthYear,
		req.Rank, req.Rating,
		req.Country, req.Region, req.City,
		req.Phone, req.Email,
		req.StartTime, req.TimeAdjustment,
		req.DSQ, req.DSQDescription, req.DNS, req.DNF, req.OutOfRank,
		req.EntryNumber, req.Price, req.IsPaid, req.IsCheckin,
		req.Notes, now, now,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create competitor"})
	}

	comp := models.Competitor{
		ID: id, Bib: req.Bib, Card1: req.Card1, Card2: req.Card2,
		TeamID: req.TeamID, GroupID: req.GroupID, CourseID: req.CourseID,
		FirstName: req.FirstName, LastName: req.LastName, MiddleName: req.MiddleName,
		FirstNameInt: req.FirstNameInt, LastNameInt: req.LastNameInt,
		Gender: req.Gender, BirthDate: req.BirthDate, BirthYear: req.BirthYear,
		Rank: req.Rank, Rating: req.Rating,
		Country: req.Country, Region: req.Region, City: req.City,
		Phone: req.Phone, Email: req.Email,
		StartTime: req.StartTime, TimeAdjustment: req.TimeAdjustment,
		DSQ: req.DSQ, DSQDescription: req.DSQDescription, DNS: req.DNS, DNF: req.DNF, OutOfRank: req.OutOfRank,
		EntryNumber: req.EntryNumber, Price: req.Price, IsPaid: req.IsPaid, IsCheckin: req.IsCheckin,
		Notes: req.Notes, CreatedAt: now, UpdatedAt: now,
	}

	h.broadcastCompetitor(eventID, "create", comp)

	return c.Status(fiber.StatusCreated).JSON(comp)
}

func (h *Handler) UpdateCompetitor(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	competitorID := c.Params("competitorId")

	var req competitorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.LastName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "lastName is required"})
	}

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	now := time.Now().UTC().Format(time.RFC3339)

	result, err := db.Exec(
		`UPDATE competitors SET
			bib = ?, card1 = ?, card2 = ?, team_id = ?, group_id = ?, course_id = ?,
			first_name = ?, last_name = ?, middle_name = ?, first_name_int = ?, last_name_int = ?,
			gender = ?, birth_date = ?, birth_year = ?,
			rank = ?, rating = ?,
			country = ?, region = ?, city = ?,
			phone = ?, email = ?,
			start_time = ?, time_adjustment = ?,
			dsq = ?, dsq_description = ?, dns = ?, dnf = ?, out_of_rank = ?,
			entry_number = ?, price = ?, is_paid = ?, is_checkin = ?,
			notes = ?, updated_at = ?
		WHERE id = ?`,
		req.Bib, req.Card1, req.Card2, req.TeamID, req.GroupID, req.CourseID,
		req.FirstName, req.LastName, req.MiddleName, req.FirstNameInt, req.LastNameInt,
		req.Gender, req.BirthDate, req.BirthYear,
		req.Rank, req.Rating,
		req.Country, req.Region, req.City,
		req.Phone, req.Email,
		req.StartTime, req.TimeAdjustment,
		req.DSQ, req.DSQDescription, req.DNS, req.DNF, req.OutOfRank,
		req.EntryNumber, req.Price, req.IsPaid, req.IsCheckin,
		req.Notes, now,
		competitorID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update competitor"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "competitor not found"})
	}

	// Read back created_at for the response.
	var createdAt string
	_ = db.QueryRow("SELECT created_at FROM competitors WHERE id = ?", competitorID).Scan(&createdAt)

	comp := models.Competitor{
		ID: competitorID, Bib: req.Bib, Card1: req.Card1, Card2: req.Card2,
		TeamID: req.TeamID, GroupID: req.GroupID, CourseID: req.CourseID,
		FirstName: req.FirstName, LastName: req.LastName, MiddleName: req.MiddleName,
		FirstNameInt: req.FirstNameInt, LastNameInt: req.LastNameInt,
		Gender: req.Gender, BirthDate: req.BirthDate, BirthYear: req.BirthYear,
		Rank: req.Rank, Rating: req.Rating,
		Country: req.Country, Region: req.Region, City: req.City,
		Phone: req.Phone, Email: req.Email,
		StartTime: req.StartTime, TimeAdjustment: req.TimeAdjustment,
		DSQ: req.DSQ, DSQDescription: req.DSQDescription, DNS: req.DNS, DNF: req.DNF, OutOfRank: req.OutOfRank,
		EntryNumber: req.EntryNumber, Price: req.Price, IsPaid: req.IsPaid, IsCheckin: req.IsCheckin,
		Notes: req.Notes, CreatedAt: createdAt, UpdatedAt: now,
	}

	h.broadcastCompetitor(eventID, "update", comp)

	return c.JSON(comp)
}

func (h *Handler) DeleteCompetitor(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	competitorID := c.Params("competitorId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	result, err := db.Exec("DELETE FROM competitors WHERE id = ?", competitorID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete competitor"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "competitor not found"})
	}

	h.SSE.Broadcast(eventID, sse.Message{
		Event: "competitor",
		Data:  sse.MustJSON(fiber.Map{"action": "delete", "id": competitorID}),
	})

	return c.SendStatus(fiber.StatusNoContent)
}
