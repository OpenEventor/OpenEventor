package handlers

import "github.com/gofiber/fiber/v2"

func (h *Handler) Stream(c *fiber.Ctx) error {
	// TODO: implement SSE stream
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}
