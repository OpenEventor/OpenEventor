package handlers

import (
	"bytes"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/importers"
	"github.com/openeventor/openeventor/internal/sse"
)

const maxImportFileSize = 2 * 1024 * 1024 // 2 MB

// ParseImportFile accepts a multipart file upload (.xlsx or .csv),
// parses it into raw string rows, and returns JSON.
func (h *Handler) ParseImportFile(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "file field is required"})
	}

	if file.Size > maxImportFileSize {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "file too large (max 2MB)"})
	}

	f, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open uploaded file"})
	}
	defer f.Close()

	// Read into memory so we can pass to parsers.
	data, err := io.ReadAll(f)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read uploaded file"})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	var rows [][]string

	switch ext {
	case ".xlsx":
		rows, err = importers.ParseXLSX(bytes.NewReader(data))
	case ".csv", ".txt":
		rows, err = importers.ParseCSV(bytes.NewReader(data))
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unsupported file format (use .xlsx or .csv)"})
	}

	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("parse error: %v", err)})
	}

	return c.JSON(fiber.Map{
		"rows":      rows,
		"totalRows": len(rows),
	})
}

type importExecuteRequest struct {
	Mode         string            `json:"mode"`
	StartFromRow int               `json:"startFromRow"`
	Mapping      map[string]string `json:"mapping"` // column index (string) -> field name
	Rows         [][]string        `json:"rows"`
}

// ExecuteImport applies mapped import data to the competitors table.
func (h *Handler) ExecuteImport(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	var req importExecuteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	validModes := map[string]bool{
		"append":              true,
		"replace_by_bib_ignore": true,
		"replace_by_bib_add":   true,
		"clear_and_import":    true,
	}
	if !validModes[req.Mode] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid import mode"})
	}

	if len(req.Rows) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "no rows to import"})
	}

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	tx, err := db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to start transaction"})
	}
	defer tx.Rollback() //nolint:errcheck

	// For replace modes, build bib->id map.
	bibToID := make(map[string]string)
	if req.Mode == "replace_by_bib_ignore" || req.Mode == "replace_by_bib_add" {
		rows, err := tx.Query("SELECT id, bib FROM competitors WHERE bib != ''")
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
		}
		for rows.Next() {
			var id, bib string
			if err := rows.Scan(&id, &bib); err != nil {
				rows.Close()
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
			}
			bibToID[bib] = id
		}
		rows.Close()
	}

	// Clear all competitors for clear_and_import mode.
	if req.Mode == "clear_and_import" {
		if _, err := tx.Exec("DELETE FROM competitors"); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to clear competitors"})
		}
	}

	created, updated, skipped := 0, 0, 0
	var errors []string
	now := time.Now().UTC().Format(time.RFC3339)

	for rowIdx := req.StartFromRow; rowIdx < len(req.Rows); rowIdx++ {
		row := req.Rows[rowIdx]
		comp := applyMapping(row, req.Mapping)

		switch req.Mode {
		case "append", "clear_and_import":
			id := uuid.New().String()
			_, err := tx.Exec(
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
				id, comp.Bib, comp.Card1, comp.Card2, comp.TeamID, comp.GroupID, comp.CourseID,
				comp.FirstName, comp.LastName, comp.MiddleName, comp.FirstNameInt, comp.LastNameInt,
				comp.Gender, comp.BirthDate, comp.BirthYear,
				comp.Rank, comp.Rating,
				comp.Country, comp.Region, comp.City,
				comp.Phone, comp.Email,
				comp.StartTime, comp.TimeAdjustment,
				comp.DSQ, comp.DSQDescription, comp.DNS, comp.DNF, comp.OutOfRank,
				comp.EntryNumber, comp.Price, comp.IsPaid, comp.IsCheckin,
				comp.Notes, now, now,
			)
			if err != nil {
				errors = append(errors, fmt.Sprintf("row %d: %v", rowIdx+1, err))
				continue
			}
			created++

		case "replace_by_bib_ignore":
			if comp.Bib == "" {
				skipped++
				continue
			}
			existingID, exists := bibToID[comp.Bib]
			if !exists {
				skipped++
				continue
			}
			_, err := tx.Exec(
				`UPDATE competitors SET
					card1 = ?, card2 = ?, team_id = ?, group_id = ?, course_id = ?,
					first_name = ?, last_name = ?, middle_name = ?, first_name_int = ?, last_name_int = ?,
					gender = ?, birth_date = ?, birth_year = ?,
					rank = ?, rating = ?,
					country = ?, region = ?, city = ?,
					phone = ?, email = ?,
					start_time = ?, time_adjustment = ?,
					entry_number = ?, price = ?,
					notes = ?, updated_at = ?
				WHERE id = ?`,
				comp.Card1, comp.Card2, comp.TeamID, comp.GroupID, comp.CourseID,
				comp.FirstName, comp.LastName, comp.MiddleName, comp.FirstNameInt, comp.LastNameInt,
				comp.Gender, comp.BirthDate, comp.BirthYear,
				comp.Rank, comp.Rating,
				comp.Country, comp.Region, comp.City,
				comp.Phone, comp.Email,
				comp.StartTime, comp.TimeAdjustment,
				comp.EntryNumber, comp.Price,
				comp.Notes, now,
				existingID,
			)
			if err != nil {
				errors = append(errors, fmt.Sprintf("row %d: %v", rowIdx+1, err))
				continue
			}
			updated++

		case "replace_by_bib_add":
			if comp.Bib == "" {
				// No bib — insert as new.
				id := uuid.New().String()
				_, err := tx.Exec(
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
					id, comp.Bib, comp.Card1, comp.Card2, comp.TeamID, comp.GroupID, comp.CourseID,
					comp.FirstName, comp.LastName, comp.MiddleName, comp.FirstNameInt, comp.LastNameInt,
					comp.Gender, comp.BirthDate, comp.BirthYear,
					comp.Rank, comp.Rating,
					comp.Country, comp.Region, comp.City,
					comp.Phone, comp.Email,
					comp.StartTime, comp.TimeAdjustment,
					comp.DSQ, comp.DSQDescription, comp.DNS, comp.DNF, comp.OutOfRank,
					comp.EntryNumber, comp.Price, comp.IsPaid, comp.IsCheckin,
					comp.Notes, now, now,
				)
				if err != nil {
					errors = append(errors, fmt.Sprintf("row %d: %v", rowIdx+1, err))
					continue
				}
				created++
				continue
			}

			existingID, exists := bibToID[comp.Bib]
			if exists {
				_, err := tx.Exec(
					`UPDATE competitors SET
						card1 = ?, card2 = ?, team_id = ?, group_id = ?, course_id = ?,
						first_name = ?, last_name = ?, middle_name = ?, first_name_int = ?, last_name_int = ?,
						gender = ?, birth_date = ?, birth_year = ?,
						rank = ?, rating = ?,
						country = ?, region = ?, city = ?,
						phone = ?, email = ?,
						start_time = ?, time_adjustment = ?,
						entry_number = ?, price = ?,
						notes = ?, updated_at = ?
					WHERE id = ?`,
					comp.Card1, comp.Card2, comp.TeamID, comp.GroupID, comp.CourseID,
					comp.FirstName, comp.LastName, comp.MiddleName, comp.FirstNameInt, comp.LastNameInt,
					comp.Gender, comp.BirthDate, comp.BirthYear,
					comp.Rank, comp.Rating,
					comp.Country, comp.Region, comp.City,
					comp.Phone, comp.Email,
					comp.StartTime, comp.TimeAdjustment,
					comp.EntryNumber, comp.Price,
					comp.Notes, now,
					existingID,
				)
				if err != nil {
					errors = append(errors, fmt.Sprintf("row %d: %v", rowIdx+1, err))
					continue
				}
				updated++
			} else {
				id := uuid.New().String()
				_, err := tx.Exec(
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
					id, comp.Bib, comp.Card1, comp.Card2, comp.TeamID, comp.GroupID, comp.CourseID,
					comp.FirstName, comp.LastName, comp.MiddleName, comp.FirstNameInt, comp.LastNameInt,
					comp.Gender, comp.BirthDate, comp.BirthYear,
					comp.Rank, comp.Rating,
					comp.Country, comp.Region, comp.City,
					comp.Phone, comp.Email,
					comp.StartTime, comp.TimeAdjustment,
					comp.DSQ, comp.DSQDescription, comp.DNS, comp.DNF, comp.OutOfRank,
					comp.EntryNumber, comp.Price, comp.IsPaid, comp.IsCheckin,
					comp.Notes, now, now,
				)
				if err != nil {
					errors = append(errors, fmt.Sprintf("row %d: %v", rowIdx+1, err))
					continue
				}
				created++
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to commit transaction"})
	}

	// Broadcast import event so frontend can refetch.
	h.SSE.Broadcast(eventID, sse.Message{
		Event: "import",
		Data: sse.MustJSON(fiber.Map{
			"action":  "complete",
			"created": created,
			"updated": updated,
			"skipped": skipped,
		}),
	})

	return c.JSON(fiber.Map{
		"created": created,
		"updated": updated,
		"skipped": skipped,
		"errors":  errors,
	})
}

// applyMapping converts a raw row into a competitorRequest using the column→field mapping.
func applyMapping(row []string, mapping map[string]string) competitorRequest {
	var comp competitorRequest

	for colIdxStr, field := range mapping {
		colIdx, err := strconv.Atoi(colIdxStr)
		if err != nil || colIdx < 0 || colIdx >= len(row) {
			continue
		}
		val := strings.TrimSpace(row[colIdx])
		if val == "" {
			continue
		}

		switch field {
		case "bib":
			comp.Bib = val
		case "card1":
			comp.Card1 = val
		case "card2":
			comp.Card2 = val
		case "firstName":
			comp.FirstName = val
		case "lastName":
			comp.LastName = val
		case "middleName":
			comp.MiddleName = val
		case "firstNameInt":
			comp.FirstNameInt = val
		case "lastNameInt":
			comp.LastNameInt = val
		case "gender":
			comp.Gender = val
		case "birthDate":
			comp.BirthDate = val
		case "birthYear":
			if v, err := strconv.Atoi(val); err == nil {
				comp.BirthYear = v
			}
		case "rank":
			comp.Rank = val
		case "rating":
			if v, err := strconv.ParseFloat(val, 64); err == nil {
				comp.Rating = v
			}
		case "country":
			comp.Country = val
		case "region":
			comp.Region = val
		case "city":
			comp.City = val
		case "phone":
			comp.Phone = val
		case "email":
			comp.Email = val
		case "startTime":
			comp.StartTime = val
		case "timeAdjustment":
			if v, err := strconv.Atoi(val); err == nil {
				comp.TimeAdjustment = v
			}
		case "entryNumber":
			comp.EntryNumber = val
		case "price":
			if v, err := strconv.ParseFloat(val, 64); err == nil {
				comp.Price = v
			}
		case "notes":
			comp.Notes = val
		case "teamId":
			comp.TeamID = val
		case "groupId":
			comp.GroupID = val
		case "courseId":
			comp.CourseID = val
		}
	}

	return comp
}