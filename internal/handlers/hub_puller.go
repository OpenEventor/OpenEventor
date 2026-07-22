package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/openeventor/openeventor/internal/models"
)

// The hub kind is pull-based: an OpenEventor Hub (a utility inside an OpenWRT
// router) owns the timing hardware and keeps a durable, ordered punch log. This
// puller long-polls GET <hub>/v1/stream?since=<seq>&wait=25 for the active hub
// instance, ingests punches through the same pipeline as pushed punches, and
// advances a persisted cursor (hub_session + hub_cursor in system.db) so a
// restart resumes loss-free. See hub/docs/PROTOCOL.md.

const (
	hubLongPollWait = 25 * time.Second
	hubIdleSleep    = 3 * time.Second // between config re-checks when not streaming
	hubErrorSleep   = 5 * time.Second // backoff after a failed request
)

// hubStreamResp is the body of GET /v1/stream.
type hubStreamResp struct {
	Session string     `json:"session"`
	Head    int64      `json:"head"`
	Punches []hubPunch `json:"punches"`
}

// hubPunch is the hub's canonical punch (PROTOCOL.md §4).
type hubPunch struct {
	Seq    int64  `json:"seq"`
	Card   string `json:"card"`
	Code   string `json:"code"`
	T      string `json:"t"`      // hub UTC timestamp, RFC3339 with ms
	Source string `json:"source"` // e.g. "CHAFON CF816"
}

// hubPullerState is a snapshot of the puller for diagnostics / the UI.
type hubPullerState struct {
	Streaming    bool   `json:"streaming"` // an active hub instance is being polled
	SystemID     string `json:"systemId"`
	Session      string `json:"session"`
	Cursor       int64  `json:"cursor"`
	LastError    string `json:"lastError"`
	LastIngestAt string `json:"lastIngestAt"` // RFC3339, "" = none yet
}

// HubPuller runs as a single background goroutine (started from main).
type HubPuller struct {
	h      *Handler
	client *http.Client

	mu        sync.Mutex
	state     hubPullerState
	lastReset time.Time // last time a log reset forced a re-pull from 0
}

// NewHubPuller wires a puller to the shared handler (DB + SSE broker).
func NewHubPuller(h *Handler) *HubPuller {
	return &HubPuller{
		h: h,
		// Timeout must exceed the long-poll wait; covers connect + drain too.
		client: &http.Client{Timeout: hubLongPollWait + 15*time.Second},
	}
}

// State returns a snapshot for the status endpoint.
func (p *HubPuller) State() hubPullerState {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.state
}

func (p *HubPuller) setState(mut func(*hubPullerState)) {
	p.mu.Lock()
	mut(&p.state)
	p.mu.Unlock()
}

// Run polls until ctx is cancelled. One cycle = reload config, then at most one
// long-poll request, so config changes (URL, target event, enable/disable) take
// effect within a cycle.
func (p *HubPuller) Run(ctx context.Context) {
	for ctx.Err() == nil {
		sys, err := p.h.activeTimingSystem("hub")
		if err != nil || strings.TrimSpace(sys.HubURL) == "" || strings.TrimSpace(sys.EventID) == "" {
			p.setState(func(s *hubPullerState) {
				s.Streaming = false
				s.SystemID = ""
			})
			sleepCtx(ctx, hubIdleSleep)
			continue
		}
		if err := p.pollOnce(ctx, sys); err != nil && ctx.Err() == nil {
			p.setState(func(s *hubPullerState) { s.LastError = err.Error() })
			log.Printf("hub puller: %v", err)
			sleepCtx(ctx, hubErrorSleep)
		}
	}
}

// pollOnce performs one long-poll request for sys and ingests the result.
func (p *HubPuller) pollOnce(ctx context.Context, sys models.TimingSystem) error {
	base, err := NormalizeHubURL(sys.HubURL)
	if err != nil {
		return fmt.Errorf("hub url: %w", err)
	}
	p.setState(func(s *hubPullerState) {
		s.Streaming = true
		s.SystemID = sys.ID
		s.Session = sys.HubSession
		s.Cursor = sys.HubCursor
	})

	streamURL := fmt.Sprintf("%s/v1/stream?since=%d&wait=%d", base, sys.HubCursor, int(hubLongPollWait.Seconds()))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, streamURL, nil)
	if err != nil {
		return err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("stream request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return fmt.Errorf("stream read: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("stream: hub answered %d", resp.StatusCode)
	}
	var sr hubStreamResp
	if err := json.Unmarshal(body, &sr); err != nil {
		return fmt.Errorf("stream decode: %w", err)
	}

	// Reset detection (PROTOCOL.md §5): a new session or a head behind our
	// cursor means the hub log was reset — re-pull from 0. The batch we just got
	// may be missing seq ≤ cursor of the new log, so discard it.
	if (sys.HubSession != "" && sr.Session != sys.HubSession) || sr.Head < sys.HubCursor {
		// Repeated resets mean an unstable hub (e.g. two hub processes behind one
		// address reporting diverging heads) — without this guard the puller
		// would re-ingest the full log in a tight loop. Hold off instead.
		if time.Since(p.lastReset) < time.Minute {
			return fmt.Errorf("hub log reset AGAIN within a minute (session %q → %q, head %d, cursor %d) — hub looks unstable, holding off", sys.HubSession, sr.Session, sr.Head, sys.HubCursor)
		}
		p.lastReset = time.Now()
		log.Printf("hub puller: log reset detected (session %q → %q), re-pulling from 0", sys.HubSession, sr.Session)
		return p.saveCursor(sys.ID, sr.Session, 0)
	}

	maxSeq := sys.HubCursor
	if len(sr.Punches) > 0 {
		punches := make([]incomingPunch, 0, len(sr.Punches))
		for _, hp := range sr.Punches {
			if hp.Seq <= sys.HubCursor || hp.Card == "" {
				continue // idempotence: already ingested (at-least-once delivery)
			}
			if hp.Seq > maxSeq {
				maxSeq = hp.Seq
			}
			var ts *float64
			if t, err := time.Parse(time.RFC3339Nano, hp.T); err == nil {
				u := float64(t.UnixMilli()) / 1000
				ts = &u
			}
			punches = append(punches, incomingPunch{card: hp.Card, code: hp.Code, ts: ts, source: hp.Source})
		}
		// A pull from 0 (first connect or after a log reset) may contain punches
		// this event already has — drop them so re-pulls stay idempotent even
		// though passings carry no hub seq.
		if sys.HubCursor == 0 && len(punches) > 0 {
			var err error
			if punches, err = p.dropAlreadyIngested(sys, punches); err != nil {
				return fmt.Errorf("dedup: %w", err)
			}
		}
		if len(punches) > 0 {
			if err := p.h.ingestPunches(sys, punches); err != nil {
				return fmt.Errorf("ingest: %w", err) // cursor NOT advanced → retried next cycle
			}
			p.setState(func(s *hubPullerState) {
				s.LastIngestAt = time.Now().UTC().Format(time.RFC3339)
				s.LastError = ""
			})
		}
	}

	// Advance the cursor only after a successful ingest (or heartbeat). The
	// protocol says "set since = head", but a split-brain hub (two processes
	// over one store) can serve punches with seq ABOVE its reported head — a
	// cursor stuck at that head would re-receive the same tail on every poll.
	// Advancing to max(head, highest ingested seq) is identical on a healthy
	// hub (seq ≤ head always) and breaks the loop on a broken one.
	next := sr.Head
	if maxSeq > next {
		log.Printf("hub puller: hub served seq %d above its head %d (split-brain hub?) — advancing cursor to %d", maxSeq, sr.Head, maxSeq)
		next = maxSeq
	}
	if sr.Session != sys.HubSession || next != sys.HubCursor {
		return p.saveCursor(sys.ID, sr.Session, next)
	}
	p.setState(func(s *hubPullerState) { s.LastError = "" })
	return nil
}

// dropAlreadyIngested filters out punches whose (card, raw code, timestamp)
// already exists in the target event. Timestamps are compared in centiseconds
// after applying the same rename-rule adjustment the ingest would apply, so a
// re-pull produces the exact keys of the earlier ingest. Punches without a hub
// timestamp are kept (their ts would be the receipt time — unknowable here).
func (p *HubPuller) dropAlreadyIngested(sys models.TimingSystem, punches []incomingPunch) ([]incomingPunch, error) {
	db, err := p.h.DB.EventDB(sys.EventID)
	if err != nil {
		return nil, err
	}
	rows, err := db.Query(`SELECT card, COALESCE(NULLIF(raw_code, ''), checkpoint), CAST(ROUND(timestamp*100) AS INTEGER) FROM passings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := make(map[string]bool)
	for rows.Next() {
		var card, code string
		var cs int64
		if err := rows.Scan(&card, &code, &cs); err != nil {
			return nil, err
		}
		seen[fmt.Sprintf("%s|%s|%d", card, code, cs)] = true
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	kept := punches[:0]
	dropped := 0
	for _, pn := range punches {
		if pn.ts == nil {
			kept = append(kept, pn)
			continue
		}
		adj := 0
		for _, r := range sys.Rules {
			if r.RawID == pn.code {
				adj = r.TimeAdjustment
				break
			}
		}
		ts := roundCs(*pn.ts + float64(adj))
		if seen[fmt.Sprintf("%s|%s|%d", pn.card, pn.code, int64(math.Round(ts*100)))] {
			dropped++
			continue
		}
		kept = append(kept, pn)
	}
	if dropped > 0 {
		log.Printf("hub puller: re-pull from 0 — skipped %d already-ingested punches, %d new", dropped, len(kept))
	}
	return kept, nil
}

func (p *HubPuller) saveCursor(id, session string, cursor int64) error {
	if _, err := p.h.DB.SystemDB().Exec(
		`UPDATE timing_systems SET hub_session = ?, hub_cursor = ? WHERE id = ?`,
		session, cursor, id,
	); err != nil {
		return fmt.Errorf("save cursor: %w", err)
	}
	p.setState(func(s *hubPullerState) {
		s.Session = session
		s.Cursor = cursor
	})
	return nil
}

// NormalizeHubURL turns user input ("192.168.8.1", "openeventor.local:8080",
// "http://…/") into a scheme-prefixed base URL without a trailing slash.
func NormalizeHubURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("empty hub url")
	}
	if !strings.Contains(raw, "://") {
		raw = "http://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return "", fmt.Errorf("invalid hub url %q", raw)
	}
	if u.Port() == "" {
		u.Host += ":8080" // the hub's default port
	}
	u.Path = strings.TrimRight(u.Path, "/")
	u.RawQuery, u.Fragment = "", ""
	return u.String(), nil
}

func sleepCtx(ctx context.Context, d time.Duration) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}

// ─── Status endpoint (UI) ───────────────────────────────────────────────────

// HubStatus proxies GET <hub>/v1/hello server-side (the browser may not reach
// the hub's LAN) and merges the puller's own state. Never errors on an
// unreachable hub — reachability is the payload.
func (h *Handler) HubStatus(c *fiber.Ctx) error {
	sys, err := h.timingSystemByID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "timing system not found"})
	}
	if sys.Kind != "hub" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "not a hub timing system"})
	}

	var puller interface{}
	if h.HubPuller != nil {
		puller = h.HubPuller.State()
	}
	base, err := NormalizeHubURL(sys.HubURL)
	if err != nil {
		return c.JSON(fiber.Map{"reachable": false, "error": "no hub address configured", "puller": puller})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 3*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/v1/hello", nil)
	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		return c.JSON(fiber.Map{"reachable": false, "error": err.Error(), "puller": puller})
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var hello map[string]interface{}
	if resp.StatusCode != http.StatusOK || json.Unmarshal(body, &hello) != nil {
		return c.JSON(fiber.Map{
			"reachable": false,
			"error":     fmt.Sprintf("hub answered %d", resp.StatusCode),
			"puller":    puller,
		})
	}
	return c.JSON(fiber.Map{"reachable": true, "hello": hello, "puller": puller})
}
