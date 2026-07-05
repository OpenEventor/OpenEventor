// Command server is the OpenEventor web application entrypoint. It wires the
// database, SSE broker, and HTTP handlers into a Fiber server and serves the
// embedded React frontend.
//
// Rebuilt after the original cmd/server was lost from version control: the bare
// "server" line in .gitignore matched cmd/server/ and the file was never
// tracked. See docs/web-parity-plan.md.
package main

import (
	"context"
	"errors"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	openeventor "github.com/openeventor/openeventor"
	"github.com/openeventor/openeventor/internal/config"
	"github.com/openeventor/openeventor/internal/database"
	"github.com/openeventor/openeventor/internal/demo"
	"github.com/openeventor/openeventor/internal/handlers"
	"github.com/openeventor/openeventor/internal/sse"
)

func main() {
	var (
		noBrowser bool
		portFlag  string
	)
	flag.BoolVar(&noBrowser, "no-browser", false, "do not open a browser window on startup")
	flag.StringVar(&portFlag, "port", "", "override the HTTP port (defaults to $PORT or 5050)")
	flag.Parse()

	cfg := config.Load()
	if portFlag != "" {
		cfg.Port = portFlag
	}

	// Database: opens/creates system.db and runs the system migrations.
	db, err := database.NewManager(cfg.DataDir)
	if err != nil {
		log.Fatalf("init database: %v", err)
	}
	defer db.Close()

	if err := database.EnsureDefaultUser(db.SystemDB()); err != nil {
		log.Fatalf("seed default user: %v", err)
	}

	// On a fresh install (no events yet), seed the demo event so the app opens
	// with something to explore. Disable with SEED_DEMO=false.
	if seed := os.Getenv("SEED_DEMO"); seed != "false" && seed != "0" {
		if err := demo.SeedDemoEventIfEmpty(db); err != nil {
			log.Printf("demo seed skipped: %v", err)
		}
	}

	broker := sse.NewBroker()

	app := fiber.New(fiber.Config{
		AppName:               "OpenEventor",
		DisableStartupMessage: true,
		// SSE handlers stream indefinitely — no read/write timeouts.
		ReadTimeout:  0,
		WriteTimeout: 0,
		// Event .db uploads (import) can exceed the 4 MB default.
		BodyLimit: 512 * 1024 * 1024,
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Event-Token",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	h := &handlers.Handler{
		DB:     db,
		Config: cfg,
		SSE:    broker,
	}
	handlers.SetupRoutes(app, h)

	// Any /api/* not matched above is a genuine 404 (JSON), never the SPA shell.
	app.Use("/api", func(c *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusNotFound, "not found")
	})

	// Serve the embedded React build; unmatched non-API routes fall back to
	// index.html so client-side routing works.
	if distFS, err := fs.Sub(openeventor.FrontendDist, "frontend/dist"); err != nil {
		log.Printf("warning: embedded frontend unavailable: %v", err)
	} else {
		app.Use("/", filesystem.New(filesystem.Config{
			Root:         http.FS(distFS),
			Index:        "index.html",
			NotFoundFile: "index.html",
		}))
	}

	addr := ":" + cfg.Port
	url := "http://localhost:" + cfg.Port

	// Run the listener on its own goroutine so the main goroutine can open the
	// browser and wait for shutdown signals.
	serverErr := make(chan error, 1)
	go func() {
		log.Printf("OpenEventor listening on %s (data dir: %s)", url, cfg.DataDir)
		serverErr <- app.Listen(addr)
	}()

	if !noBrowser {
		go openBrowser(url)
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	case sig := <-stop:
		log.Printf("received %s, shutting down…", sig)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := app.ShutdownWithContext(ctx); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
		}
	}
}

// openBrowser opens url in the user's default browser. Best-effort — failures
// are logged, not fatal (e.g. headless servers).
func openBrowser(url string) {
	var name string
	var args []string
	switch runtime.GOOS {
	case "darwin":
		name, args = "open", []string{url}
	case "windows":
		name, args = "rundll32", []string{"url.dll,FileProtocolHandler", url}
	default: // linux, bsd, …
		name, args = "xdg-open", []string{url}
	}
	if err := exec.Command(name, args...).Start(); err != nil {
		log.Printf("could not open browser (%s): %v", strings.Join(append([]string{name}, args...), " "), err)
	}
}
