package handlers

import "github.com/gofiber/fiber/v2"

func (h *Handler) CreatePunches(c *fiber.Ctx) error {
	// TODO: implement batch punch creation
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}
