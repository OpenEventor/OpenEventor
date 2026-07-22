package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/openeventor/openeventor/internal/config"
	"github.com/openeventor/openeventor/internal/database"
	"github.com/openeventor/openeventor/internal/sse"
)

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	DB        *database.Manager
	Config    *config.Config
	SSE       *sse.Broker
	HubPuller *HubPuller // background puller for the hub timing kind (may be nil in tests)
	Version   string     // build version (git tag), "dev" for local builds
}

// SetupRoutes registers all API routes on the Fiber app.
func SetupRoutes(app *fiber.App, h *Handler) {
	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})
	// Server build version — the About dialog compares it with the frontend's
	// baked-in version to catch a stale browser-cached UI.
	app.Get("/api/version", func(c *fiber.Ctx) error {
		v := h.Version
		if v == "" {
			v = "dev"
		}
		return c.JSON(fiber.Map{"version": v})
	})

	// No authentication anywhere: OpenEventor is LAN-local timing software for
	// race admins — whoever can reach the server is trusted. The network
	// boundary (the event LAN / router) is the access boundary.

	// SSE stream for real-time consumers (monitor UI, scoreboards, overlays).
	app.Get("/api/events/:eventId/stream", h.Stream)

	// External producers/consumers (timing devices, online results).
	app.Post("/api/events/:eventId/passings", h.CreatePassings)
	app.Get("/api/events/:eventId/results", h.GetResults)

	// Timing-system punch receiver — fixed URL per kind (/api/timing/ostis,
	// /api/timing/universal); punches route to that kind's active instance +
	// its event. The wildcard variant accepts a trailing path (e.g. OSTIS …/addSplit).
	app.Post("/api/timing/:kind", h.ReceivePunches)
	app.Get("/api/timing/:kind", h.ReceivePunches)
	app.Post("/api/timing/:kind/*", h.ReceivePunches)
	app.Get("/api/timing/:kind/*", h.ReceivePunches)

	api := app.Group("/api")

	// Events
	api.Get("/events", h.ListEvents)
	api.Post("/events", h.CreateEvent)
	api.Post("/events/reload", h.ReloadEvents)
	api.Post("/events/import", h.ImportEvent)

	// Timing systems (global config: instances that receive punches into an event)
	api.Get("/timing-systems", h.ListTimingSystems)
	api.Post("/timing-systems", h.CreateTimingSystem)
	api.Put("/timing-systems/:id", h.UpdateTimingSystem)
	api.Delete("/timing-systems/:id", h.DeleteTimingSystem)
	api.Get("/timing-systems/:id/hub-status", h.HubStatus)

	// Event-scoped routes
	event := api.Group("/events/:eventId")
	event.Get("/", h.GetEvent)
	event.Put("/", h.UpdateEvent)
	event.Delete("/", h.DeleteEvent)

	// Competitors
	event.Get("/competitors", h.ListCompetitors)
	event.Get("/competitors/:competitorId", h.GetCompetitor)
	event.Post("/competitors", h.CreateCompetitor)
	event.Put("/competitors/:competitorId", h.UpdateCompetitor)
	event.Delete("/competitors/:competitorId", h.DeleteCompetitor)

	// Import
	event.Post("/import/parse", h.ParseImportFile)
	event.Post("/import/execute", h.ExecuteImport)

	// Checkpoints (control points)
	event.Get("/checkpoints", h.ListCheckpoints)
	event.Post("/checkpoints", h.CreateCheckpoint)
	event.Put("/checkpoints/:checkpointId", h.UpdateCheckpoint)
	event.Delete("/checkpoints/:checkpointId", h.DeleteCheckpoint)

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

	// Settings
	event.Get("/settings", h.GetSettings)
	event.Put("/settings", h.UpdateSettings)

	// Files (logo/header/etc. stored as BLOBs in the event DB)
	event.Get("/files", h.ListFiles)
	event.Post("/files", h.UploadFile)
	event.Get("/files/:fileId", h.GetFile)
	event.Delete("/files/:fileId", h.DeleteFile)

	// Passings (user JWT — manual CRUD)
	event.Get("/passings", h.ListPassings)
	event.Post("/passings/manual", h.CreatePassing)
	event.Put("/passings/:passingId", h.UpdatePassing)
	event.Delete("/passings/:passingId", h.DeletePassing)

	// Problems (computed «Разбор проблем»)
	event.Get("/problems", h.GetProblems)

	// Protocols (start-list / results, generated on the fly)
	event.Get("/protocols", h.GetProtocol)

	// Export / backup (streams the self-contained .db)
	event.Get("/export", h.ExportEvent)

}
