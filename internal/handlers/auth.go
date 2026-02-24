package handlers

import "github.com/gofiber/fiber/v2"

func (h *Handler) Login(c *fiber.Ctx) error {
	// TODO: implement login
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) RefreshToken(c *fiber.Ctx) error {
	// TODO: implement token refresh
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) Logout(c *fiber.Ctx) error {
	// TODO: implement logout
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}
