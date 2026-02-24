package handlers

import "github.com/gofiber/fiber/v2"

func (h *Handler) ListEvents(c *fiber.Ctx) error {
	// TODO: implement list events
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) CreateEvent(c *fiber.Ctx) error {
	// TODO: implement create event
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) GetEvent(c *fiber.Ctx) error {
	// TODO: implement get event
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) UpdateEvent(c *fiber.Ctx) error {
	// TODO: implement update event
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}

func (h *Handler) DeleteEvent(c *fiber.Ctx) error {
	// TODO: implement delete event
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented"})
}
