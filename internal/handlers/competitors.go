package handlers

import "github.com/gofiber/fiber/v2"

func (h *Handler) ListCompetitors(c *fiber.Ctx) error {
	// TODO: implement list competitors
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) CreateCompetitor(c *fiber.Ctx) error {
	// TODO: implement create competitor
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) UpdateCompetitor(c *fiber.Ctx) error {
	// TODO: implement update competitor
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) DeleteCompetitor(c *fiber.Ctx) error {
	// TODO: implement delete competitor
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}
