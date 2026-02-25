package handlers

import (
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/auth"
	"github.com/openeventor/openeventor/internal/models"
)

type loginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token        string      `json:"token"`
	RefreshToken string      `json:"refreshToken"`
	User         models.User `json:"user"`
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var req loginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Login == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "login and password are required"})
	}

	db := h.DB.SystemDB()

	var user models.User
	var passwordHash string
	err := db.QueryRow(
		"SELECT id, login, password_hash, name, created_at FROM users WHERE login = ?",
		req.Login,
	).Scan(&user.ID, &user.Login, &passwordHash, &user.Name, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}

	if !auth.CheckPassword(req.Password, passwordHash) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}

	accessToken, err := auth.GenerateAccessToken(user.ID, h.Config.JWTSecret, h.Config.AccessTokenTTL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate token"})
	}

	refreshToken := uuid.New().String()
	expiresAt := time.Now().Add(h.Config.RefreshTokenTTL).UTC().Format(time.RFC3339)
	sessionID := uuid.New().String()

	_, err = db.Exec(
		"INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
		sessionID, user.ID, refreshToken, expiresAt,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create session"})
	}

	return c.JSON(loginResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
		User:         user,
	})
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

func (h *Handler) RefreshToken(c *fiber.Ctx) error {
	var req refreshRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.RefreshToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "refreshToken is required"})
	}

	db := h.DB.SystemDB()

	var userID, expiresAt string
	err := db.QueryRow(
		"SELECT user_id, expires_at FROM sessions WHERE refresh_token = ?",
		req.RefreshToken,
	).Scan(&userID, &expiresAt)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid refresh token"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}

	expires, err := time.Parse(time.RFC3339, expiresAt)
	if err != nil || time.Now().After(expires) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "refresh token expired"})
	}

	accessToken, err := auth.GenerateAccessToken(userID, h.Config.JWTSecret, h.Config.AccessTokenTTL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate token"})
	}

	return c.JSON(fiber.Map{"token": accessToken})
}

func (h *Handler) Logout(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	if userID == "" {
		return c.SendStatus(fiber.StatusNoContent)
	}

	db := h.DB.SystemDB()
	_, _ = db.Exec("DELETE FROM sessions WHERE user_id = ?", userID)

	return c.SendStatus(fiber.StatusNoContent)
}
