package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// RequireJWT returns Fiber middleware that validates the Authorization header.
func RequireJWT(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing authorization header"})
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid authorization format"})
		}

		claims, err := ValidateAccessToken(parts[1], secret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
		}

		c.Locals("userId", claims.UserID)
		return c.Next()
	}
}

// RequireEventToken returns Fiber middleware that checks the event-token query param or header.
func RequireEventToken() fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Query("token")
		if token == "" {
			token = c.Get("X-Event-Token")
		}
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing event token"})
		}

		// TODO: validate token against event settings in DB
		c.Locals("eventToken", token)
		return c.Next()
	}
}
