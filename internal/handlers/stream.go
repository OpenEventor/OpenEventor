package handlers

import (
	"bufio"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/openeventor/openeventor/internal/auth"
	"github.com/valyala/fasthttp"
)

// Stream handles SSE connections for real-time event updates.
// Auth: JWT via ?jwt= query param (for monitor UI).
func (h *Handler) Stream(c *fiber.Ctx) error {
	// Authenticate via JWT query param.
	jwtToken := c.Query("jwt")
	if jwtToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing jwt query param"})
	}
	_, err := auth.ValidateAccessToken(jwtToken, h.Config.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
	}

	eventID := c.Params("eventId")

	// Verify event DB exists.
	if _, err := h.DB.EventDB(eventID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "event not found"})
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(fasthttp.StreamWriter(func(w *bufio.Writer) {
		clientCh := h.SSE.Register(eventID)
		defer h.SSE.Unregister(eventID, clientCh)

		// Send initial keepalive so the client knows the connection is established.
		fmt.Fprintf(w, ": connected\n\n")
		if err := w.Flush(); err != nil {
			return
		}

		// Heartbeat ticker — sends SSE comment every 15s so the client
		// can detect a dead connection quickly (instead of waiting for TCP timeout).
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case msg, ok := <-clientCh:
				if !ok {
					return
				}
				_, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", msg.Event, msg.Data)
				if err != nil {
					log.Printf("SSE write error (event %s): %v", eventID, err)
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			case <-ticker.C:
				// SSE comment line — ignored by EventSource parser but
				// keeps the TCP connection alive and detects broken pipes.
				if _, err := fmt.Fprintf(w, ": ping\n\n"); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	}))

	return nil
}
