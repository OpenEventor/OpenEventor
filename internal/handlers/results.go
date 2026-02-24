package handlers

import "github.com/gofiber/fiber/v2"

func (h *Handler) GetResults(c *fiber.Ctx) error {
	// TODO: implement result computation and response
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}
