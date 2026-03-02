package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/openeventor/openeventor/internal/auth"
	"github.com/openeventor/openeventor/internal/config"
	"github.com/openeventor/openeventor/internal/database"
	"github.com/openeventor/openeventor/internal/sse"
)

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	DB     *database.Manager
	Config *config.Config
	SSE    *sse.Broker
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

	// SSE stream (standalone — registered before JWT middleware so it's matched first)
	app.Get("/api/events/:eventId/stream", h.Stream)

	// Event-token validator: checks token against system.db.
	validateToken := auth.TokenValidator(func(eventID, token string) bool {
		var stored string
		err := h.DB.SystemDB().QueryRow(
			"SELECT token FROM events WHERE id = ? AND status = 'active'", eventID,
		).Scan(&stored)
		return err == nil && stored != "" && stored == token
	})

	// Event-token routes (individual routes, not groups, to avoid catching other methods)
	eventTokenMw := auth.RequireEventToken(validateToken)
	app.Post("/api/events/:eventId/passings", eventTokenMw, h.CreatePassings)
	app.Get("/api/events/:eventId/results", eventTokenMw, h.GetResults)

	// Protected routes
	api := app.Group("/api", auth.RequireJWT(h.Config.JWTSecret))

	// Events
	api.Get("/events", h.ListEvents)
	api.Post("/events", h.CreateEvent)
	api.Post("/events/reload", h.ReloadEvents)

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

	// Import
	event.Post("/import/parse", h.ParseImportFile)
	event.Post("/import/execute", h.ExecuteImport)

	// Courses
	event.Get("/courses", h.ListCourses)
	event.Post("/courses", h.CreateCourse)
	event.Put("/courses/:courseId", h.UpdateCourse)
	event.Delete("/courses/:courseId", h.DeleteCourse)

	// Groups
	event.Get("/groups", h.ListGroups)
	event.Post("/groups", h.CreateGroup)
	event.Put("/groups/:groupId", h.UpdateGroup)
	event.Delete("/groups/:groupId", h.DeleteGroup)

	// Teams
	event.Get("/teams", h.ListTeams)
	event.Post("/teams", h.CreateTeam)
	event.Put("/teams/:teamId", h.UpdateTeam)
	event.Delete("/teams/:teamId", h.DeleteTeam)

	// Passings (user JWT — manual CRUD)
	event.Get("/passings", h.ListPassings)
	event.Post("/passings/manual", h.CreatePassing)
	event.Put("/passings/:passingId", h.UpdatePassing)
	event.Delete("/passings/:passingId", h.DeletePassing)

}
