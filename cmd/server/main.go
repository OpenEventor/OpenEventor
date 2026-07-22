// Command server is the OpenEventor web application entrypoint. It wires the
// database, SSE broker, and HTTP handlers into a Fiber server and serves the
// embedded React frontend.
//
// Rebuilt after the original cmd/server was lost from version control: the bare
// "server" line in .gitignore matched cmd/server/ and the file was never
// tracked. See docs/web-parity-plan.md.
package main

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
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

// injectBasePath adds a runtime <base href> and window.__BASE_PATH__ to the SPA
// shell so it can be served under a reverse-proxy subpath. prefix "" → root.
func injectBasePath(html []byte, prefix string) []byte {
	head := `<head><base href="` + prefix + `/"><script>window.__BASE_PATH__="` + prefix + `";</script>`
	return bytes.Replace(html, []byte("<head>"), []byte(head), 1)
}

// version is stamped at build time via -ldflags "-X main.version=…" (releases
// use the git tag); "dev" for plain `go build`/`go run`.
var version = "dev"

func main() {
	var (
		noBrowser   bool
		portFlag    string
		showVersion bool
	)
	flag.BoolVar(&noBrowser, "no-browser", false, "do not open a browser window on startup")
	flag.StringVar(&portFlag, "port", "", "override the HTTP port (defaults to $PORT or 5050)")
	flag.BoolVar(&showVersion, "version", false, "print version and exit")
	flag.Parse()

	if showVersion {
		fmt.Printf("openeventor %s\n", version)
		return
	}

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
		AllowHeaders: "Origin, Content-Type, Accept",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	h := &handlers.Handler{
		DB:      db,
		Config:  cfg,
		SSE:     broker,
		Version: version,
	}
	h.HubPuller = handlers.NewHubPuller(h)
	handlers.SetupRoutes(app, h)

	// Background puller for the hub timing kind (pull-based, unlike the push
	// receivers on /api/timing/*). Stopped via ctx on shutdown.
	pullerCtx, stopPuller := context.WithCancel(context.Background())
	defer stopPuller()
	go h.HubPuller.Run(pullerCtx)

	// Any /api/* not matched above is a genuine 404 (JSON), never the SPA shell.
	app.Use("/api", func(c *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusNotFound, "not found")
	})

	// Serve the embedded React build. Real files (assets, favicon) are served
	// as-is; every other GET returns the SPA shell (index.html) with a runtime
	// <base href> + window.__BASE_PATH__ injected, so the app can be reverse-
	// proxied under any subpath (X-Forwarded-Prefix header or BASE_PATH env).
	// Empty prefix (the default) = served at root, unchanged.
	if distFS, err := fs.Sub(openeventor.FrontendDist, "frontend/dist"); err != nil {
		log.Printf("warning: embedded frontend unavailable: %v", err)
	} else {
		indexHTML, _ := fs.ReadFile(distFS, "index.html")
		fileServer := filesystem.New(filesystem.Config{Root: http.FS(distFS)})
		basePathEnv := strings.TrimRight(os.Getenv("BASE_PATH"), "/")

		app.Use(func(c *fiber.Ctx) error {
			if c.Method() != fiber.MethodGet && c.Method() != fiber.MethodHead {
				return fiber.ErrNotFound
			}
			// A real static file? Serve it untouched.
			if rel := strings.TrimPrefix(c.Path(), "/"); rel != "" {
				if f, err := distFS.Open(rel); err == nil {
					_ = f.Close()
					return fileServer(c)
				}
			}
			// Otherwise the SPA shell, with the runtime base path.
			prefix := strings.TrimRight(c.Get("X-Forwarded-Prefix"), "/")
			if prefix == "" {
				prefix = basePathEnv
			}
			c.Type("html")
			return c.Send(injectBasePath(indexHTML, prefix))
		})
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
