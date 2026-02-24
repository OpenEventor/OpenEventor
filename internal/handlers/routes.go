package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/openeventor/openeventor/internal/auth"
	"github.com/openeventor/openeventor/internal/database"
)

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	DB     *database.Manager
	Secret string
}

// SetupRoutes registers all API routes on the Fiber app.
func SetupRoutes(app *fiber.App, h *Handler) {
	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Auth (public)
	authGroup := app.Group("/api/auth")
	authGroup.Post("/login", h.Login)
	authGroup.Post("/refresh", h.RefreshToken)
	authGroup.Post("/logout", h.Logout)

	// Protected routes
	api := app.Group("/api", auth.RequireJWT(h.Secret))

	// Events
	api.Get("/events", h.ListEvents)
	api.Post("/events", h.CreateEvent)

	// Event-scoped routes
	event := api.Group("/events/:eventId")
	event.Get("/", h.GetEvent)
	event.Put("/", h.UpdateEvent)
	event.Delete("/", h.DeleteEvent)

	// Participants
	event.Get("/participants", h.ListParticipants)
	event.Post("/participants", h.CreateParticipant)
	event.Put("/participants/:participantId", h.UpdateParticipant)
	event.Delete("/participants/:participantId", h.DeleteParticipant)

	// Punches (event-token auth, separate from user JWT)
	punches := app.Group("/api/events/:eventId/punches", auth.RequireEventToken())
	punches.Post("/", h.CreatePunches)

	// Results (public with event-token)
	results := app.Group("/api/events/:eventId/results", auth.RequireEventToken())
	results.Get("/", h.GetResults)

	// SSE stream (public with event-token)
	stream := app.Group("/api/events/:eventId/stream", auth.RequireEventToken())
	stream.Get("/", h.Stream)
}
