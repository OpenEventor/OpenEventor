package handlers

import "github.com/gofiber/fiber/v2"

func (h *Handler) ListParticipants(c *fiber.Ctx) error {
	// TODO: implement list participants
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) CreateParticipant(c *fiber.Ctx) error {
	// TODO: implement create participant
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) UpdateParticipant(c *fiber.Ctx) error {
	// TODO: implement update participant
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) DeleteParticipant(c *fiber.Ctx) error {
	// TODO: implement delete participant
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}
