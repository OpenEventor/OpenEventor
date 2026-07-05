package handlers

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
)

// maxFileSize caps a stored BLOB (logo/header/etc.) at 2 MB, matching the
// platform's per-file limit.
const maxFileSize = 2 * 1024 * 1024

// ListFiles returns file metadata (never the BLOB data) for an event, optionally
// filtered by ?purpose= (e.g. "logo").
func (h *Handler) ListFiles(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	query := "SELECT id, name, mime_type, COALESCE(purpose, ''), created_at FROM files"
	var args []interface{}
	if purpose := c.Query("purpose"); purpose != "" {
		query += " WHERE purpose = ?"
		args = append(args, purpose)
	}
	query += " ORDER BY created_at"

	rows, err := db.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	files := make([]models.File, 0)
	for rows.Next() {
		var f models.File
		if err := rows.Scan(&f.ID, &f.Name, &f.MimeType, &f.Purpose, &f.CreatedAt); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		files = append(files, f)
	}
	return c.JSON(files)
}

// GetFile streams a single file's raw bytes with its stored content type (for
// <img>/download). JWT-protected — the frontend fetches it with the bearer token
// and builds an object URL.
func (h *Handler) GetFile(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	fileID := c.Params("fileId")
	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	var name, mimeType string
	var data []byte
	err = db.QueryRow(
		"SELECT name, mime_type, data FROM files WHERE id = ?", fileID,
	).Scan(&name, &mimeType, &data)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "file not found"})
	}

	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}
	c.Set("Content-Type", mimeType)
	c.Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, sanitizeFilename(name)))
	c.Set("Cache-Control", "no-cache")
	return c.Send(data)
}

// UploadFile stores an uploaded file as a BLOB. Multipart field "file"; optional
// form field "purpose". When a purpose is given it behaves as a single slot —
// any existing file with the same purpose is replaced.
func (h *Handler) UploadFile(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "file is required (multipart field 'file')"})
	}
	if fh.Size > maxFileSize {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "file exceeds the 2 MB limit"})
	}

	f, err := fh.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read upload"})
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxFileSize+1))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read upload"})
	}
	if len(data) > maxFileSize {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "file exceeds the 2 MB limit"})
	}

	mimeType := fh.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}
	purpose := c.FormValue("purpose")

	// A purpose is a single slot (logo/header/footer/bib_template): replace any existing one.
	if purpose != "" {
		if _, err := db.Exec("DELETE FROM files WHERE purpose = ?", purpose); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to replace existing file"})
		}
	}

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := db.Exec(
		"INSERT INTO files (id, name, mime_type, purpose, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		id, fh.Filename, mimeType, purpose, data, now,
	); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to store file"})
	}

	return c.Status(fiber.StatusCreated).JSON(models.File{
		ID: id, Name: fh.Filename, MimeType: mimeType, Purpose: purpose, CreatedAt: now,
	})
}

// DeleteFile removes a stored file.
func (h *Handler) DeleteFile(c *fiber.Ctx) error {
	eventID := c.Params("eventId")
	fileID := c.Params("fileId")
	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	result, err := db.Exec("DELETE FROM files WHERE id = ?", fileID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete file"})
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "file not found"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
