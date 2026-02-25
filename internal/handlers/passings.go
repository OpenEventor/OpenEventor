package handlers

import "github.com/gofiber/fiber/v2"

func (h *Handler) CreatePassings(c *fiber.Ctx) error {
	// TODO: implement batch passing creation
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}
