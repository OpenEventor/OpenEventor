package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/openeventor/openeventor/internal/auth"
	"github.com/openeventor/openeventor/internal/config"
	"github.com/openeventor/openeventor/internal/database"
)

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	DB     *database.Manager
	Config *config.Config
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
	api := app.Group("/api", auth.RequireJWT(h.Config.JWTSecret))

	// Events
	api.Get("/events", h.ListEvents)
	api.Post("/events", h.CreateEvent)

	// Event-scoped routes
	event := api.Group("/events/:eventId")
	event.Get("/", h.GetEvent)
	event.Put("/", h.UpdateEvent)
	event.Delete("/", h.DeleteEvent)

	// Competitors
	event.Get("/competitors", h.ListCompetitors)
	event.Post("/competitors", h.CreateCompetitor)
	event.Put("/competitors/:competitorId", h.UpdateCompetitor)
	event.Delete("/competitors/:competitorId", h.DeleteCompetitor)

	// Passings (event-token auth, separate from user JWT)
	passings := app.Group("/api/events/:eventId/passings", auth.RequireEventToken())
	passings.Post("/", h.CreatePassings)

	// Results (public with event-token)
	results := app.Group("/api/events/:eventId/results", auth.RequireEventToken())
	results.Get("/", h.GetResults)

	// SSE stream (public with event-token)
	stream := app.Group("/api/events/:eventId/stream", auth.RequireEventToken())
	stream.Get("/", h.Stream)
}
