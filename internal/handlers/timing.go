package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/sse"
)

// ─── Timing systems: CRUD (user JWT) ────────────────────────────────────────

const timingSelect = `SELECT id, kind, name, COALESCE(event_id, ''), enabled, rules, hub_url, hub_session, hub_cursor, created_at FROM timing_systems`

// scanner is satisfied by both *sql.Row and *sql.Rows.
type scanner interface{ Scan(dest ...interface{}) error }

func scanTimingSystem(row scanner) (models.TimingSystem, error) {
	var s models.TimingSystem
	var rulesJSON string
	if err := row.Scan(&s.ID, &s.Kind, &s.Name, &s.EventID, &s.Enabled, &rulesJSON, &s.HubURL, &s.HubSession, &s.HubCursor, &s.CreatedAt); err != nil {
		return s, err
	}
	if strings.TrimSpace(rulesJSON) == "" {
		rulesJSON = "[]"
	}
	_ = json.Unmarshal([]byte(rulesJSON), &s.Rules)
	if s.Rules == nil {
		s.Rules = []models.RenameRule{}
	}
	return s, nil
}

func validTimingKind(kind string) bool {
	return kind == "universal" || kind == "ostis" || kind == "hub"
}

// pushTimingKind reports whether hardware pushes punches to us on the fixed
// /api/timing/<kind> URL. The hub kind is pull-based (see hub_puller.go).
func pushTimingKind(kind string) bool {
	return kind == "universal" || kind == "ostis"
}

func (h *Handler) timingSystemByID(id string) (models.TimingSystem, error) {
	return scanTimingSystem(h.DB.SystemDB().QueryRow(timingSelect+" WHERE id = ?", id))
}

// activeTimingSystem returns the single enabled instance of a kind (the one that
// receives punches on that kind's fixed URL), or an error if none is active.
func (h *Handler) activeTimingSystem(kind string) (models.TimingSystem, error) {
	return scanTimingSystem(h.DB.SystemDB().QueryRow(
		timingSelect+" WHERE kind = ? AND enabled = 1 ORDER BY created_at ASC LIMIT 1", kind))
}

// ListTimingSystems returns every configured timing-system instance.
func (h *Handler) ListTimingSystems(c *fiber.Ctx) error {
	rows, err := h.DB.SystemDB().Query(timingSelect + " ORDER BY created_at ASC")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	systems := make([]models.TimingSystem, 0)
	for rows.Next() {
		s, err := scanTimingSystem(rows)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		systems = append(systems, s)
	}
	return c.JSON(systems)
}

type createTimingReq struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// CreateTimingSystem adds a new instance (disabled, unrouted).
func (h *Handler) CreateTimingSystem(c *fiber.Ctx) error {
	var req createTimingReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if !validTimingKind(req.Kind) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "kind must be 'universal', 'ostis' or 'hub'"})
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		switch req.Kind {
		case "ostis":
			name = "OSTIS LOOP"
		case "hub":
			name = "OpenEventor HUB"
		default:
			name = "Timing system"
		}
	}
	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	if _, err := h.DB.SystemDB().Exec(
		`INSERT INTO timing_systems (id, kind, name, event_id, enabled, rules, created_at)
		 VALUES (?, ?, ?, '', 0, '[]', ?)`,
		id, req.Kind, name, now,
	); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create timing system"})
	}

	return c.Status(fiber.StatusCreated).JSON(models.TimingSystem{
		ID: id, Kind: req.Kind, Name: name, EventID: "",
		Enabled: 0, Rules: []models.RenameRule{}, CreatedAt: now,
	})
}

type updateTimingReq struct {
	Name    string              `json:"name"`
	EventID string              `json:"eventId"`
	Enabled int                 `json:"enabled"`
	Rules   []models.RenameRule `json:"rules"`
	HubURL  string              `json:"hubUrl"`
}

// UpdateTimingSystem edits name / target event / enabled / rename rules. Enabling
// an instance disables the other instances of the same kind (single active per
// kind, since they share a fixed receive URL).
func (h *Handler) UpdateTimingSystem(c *fiber.Ctx) error {
	id := c.Params("id")
	var req updateTimingReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}
	if req.Rules == nil {
		req.Rules = []models.RenameRule{}
	}
	rulesJSON, _ := json.Marshal(req.Rules)
	enabled := 0
	if req.Enabled == 1 {
		enabled = 1
	}

	var kind, prevHubURL string
	if err := h.DB.SystemDB().QueryRow("SELECT kind, hub_url FROM timing_systems WHERE id = ?", id).Scan(&kind, &prevHubURL); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "timing system not found"})
	}
	hubURL := strings.TrimSpace(req.HubURL)

	tx, err := h.DB.SystemDB().Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to start transaction"})
	}
	defer tx.Rollback()

	if enabled == 1 {
		// Only one active instance per kind — deactivate siblings.
		if _, err := tx.Exec("UPDATE timing_systems SET enabled = 0 WHERE kind = ? AND id <> ?", kind, id); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update"})
		}
	}
	if _, err := tx.Exec(
		`UPDATE timing_systems SET name = ?, event_id = ?, enabled = ?, rules = ?, hub_url = ? WHERE id = ?`,
		name, req.EventID, enabled, string(rulesJSON), hubURL, id,
	); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update timing system"})
	}
	if hubURL != prevHubURL {
		// A different hub means the stored (session, cursor) no longer applies —
		// reset so the puller re-pulls that hub's log from 0.
		if _, err := tx.Exec(`UPDATE timing_systems SET hub_session = '', hub_cursor = 0 WHERE id = ?`, id); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update timing system"})
		}
	}
	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to commit"})
	}

	s, err := h.timingSystemByID(id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "reload error"})
	}
	return c.JSON(s)
}

// DeleteTimingSystem removes an instance.
func (h *Handler) DeleteTimingSystem(c *fiber.Ctx) error {
	id := c.Params("id")
	res, err := h.DB.SystemDB().Exec(`DELETE FROM timing_systems WHERE id = ?`, id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete timing system"})
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "timing system not found"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ─── Receiving punches (fixed URL per kind, no token) ───────────────────────

type incomingPunch struct {
	card   string
	code   string
	ts     *float64 // Unix seconds; nil = use receipt time
	source string
}

// ReceivePunches ingests punches from timing hardware. The kind is fixed in the
// URL (/api/timing/ostis | /api/timing/universal); punches go to that kind's
// currently-active instance and its target event. The dialect follows the kind.
func (h *Handler) ReceivePunches(c *fiber.Ctx) error {
	kind := c.Params("kind")
	if !pushTimingKind(kind) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "unknown timing kind"})
	}
	ostis := kind == "ostis"

	sys, err := h.activeTimingSystem(kind)
	if err != nil {
		// Retryable (503) so the sender re-sends once a system is activated.
		return dialectReply(c, ostis, fiber.StatusServiceUnavailable, false, "no active "+kind+" timing system", nil)
	}

	body := bytes.TrimSpace(c.Body())
	var punches []incomingPunch
	if ostis {
		punches = parseOstisBatch(body)
	} else if p, ok := parseUniversalPunch(c, body); ok {
		punches = []incomingPunch{p}
	}

	if len(punches) == 0 {
		return dialectReply(c, ostis, fiber.StatusBadRequest, false, "card and code required", nil)
	}
	if strings.TrimSpace(sys.EventID) == "" {
		return dialectReply(c, ostis, fiber.StatusServiceUnavailable, false, "no receiving event selected", nil)
	}
	if err := h.ingestPunches(sys, punches); err != nil {
		return dialectReply(c, ostis, fiber.StatusServiceUnavailable, false, "receiving event unavailable", nil)
	}
	return dialectReply(c, ostis, fiber.StatusOK, true, "", punches)
}

// ingestPunches applies each punch's rename/time rule and inserts a passing into
// the routed event's DB, then broadcasts over SSE (same shape as CreatePassings).
func (h *Handler) ingestPunches(sys models.TimingSystem, punches []incomingPunch) error {
	db, err := h.DB.EventDB(sys.EventID)
	if err != nil {
		return err
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO passings (id, card, checkpoint, raw_code, timestamp, enabled, source, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?)`,
	)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now().UTC().Format(time.RFC3339)
	receiptTS := float64(time.Now().Unix())
	defaultSource := strings.TrimSpace(sys.Name)
	if defaultSource == "" {
		defaultSource = "timing"
	}

	inserted := make([]models.Passing, 0, len(punches))
	for _, p := range punches {
		source := strings.TrimSpace(p.source)
		if source == "" {
			source = defaultSource
		}
		name := p.code
		adj := 0
		for _, r := range sys.Rules {
			if r.RawID == p.code {
				if strings.TrimSpace(r.Name) != "" {
					name = r.Name
				}
				adj = r.TimeAdjustment
				break
			}
		}
		ts := receiptTS
		if p.ts != nil {
			ts = *p.ts
		}
		ts = roundCs(ts + float64(adj))

		id := uuid.New().String()
		if _, err := stmt.Exec(id, p.card, name, p.code, ts, source, now, now); err != nil {
			return err
		}
		inserted = append(inserted, models.Passing{
			ID: id, Card: p.card, Checkpoint: name, RawCode: p.code,
			Timestamp: ts, Enabled: 1, Source: source, CreatedAt: now, UpdatedAt: now,
		})
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	for _, p := range inserted {
		h.SSE.Broadcast(sys.EventID, sse.Message{
			Event: "passing",
			Data:  sse.MustJSON(fiber.Map{"action": "create", "passing": p}),
		})
	}
	return nil
}

// dialectReply answers in the OSTIS ({"ok":…}) or universal ({"status":…}) dialect.
func dialectReply(c *fiber.Ctx, ostis bool, status int, ok bool, msg string, punches []incomingPunch) error {
	if ostis {
		if ok {
			return c.Status(status).JSON(fiber.Map{"ok": true})
		}
		return c.Status(status).JSON(fiber.Map{"ok": false, "error": msg})
	}
	if !ok {
		return c.Status(status).JSON(fiber.Map{"status": "error", "message": msg})
	}
	m := fiber.Map{"status": "ok"}
	if len(punches) > 0 {
		p := punches[0]
		m["card"] = p.card
		m["code"] = p.code
		if p.ts != nil {
			m["ts"] = *p.ts
		}
		if p.source != "" {
			m["source"] = p.source
		}
	}
	return c.Status(status).JSON(m)
}

// parseOstisBatch parses the OSTIS LOOP batch array:
//
//	["<loop_uid>", <loop_number>, <device_ts>,
//	 [["<chip>", <loop_num>, "<utc_time>", <charge>, <error>, <rf_ch>, <rf_rssi>], …]]
func parseOstisBatch(body []byte) []incomingPunch {
	var arr []json.RawMessage
	if err := json.Unmarshal(body, &arr); err != nil || len(arr) < 4 {
		return nil
	}
	outerLoop := rawToString(arr[1])
	var splits []json.RawMessage
	if err := json.Unmarshal(arr[3], &splits); err != nil {
		return nil
	}
	out := make([]incomingPunch, 0, len(splits))
	for _, s := range splits {
		var row []json.RawMessage
		if err := json.Unmarshal(s, &row); err != nil || len(row) < 3 {
			continue
		}
		chip := rawToString(row[0])
		if chip == "" {
			continue
		}
		code := rawToString(row[1])
		if code == "" {
			code = outerLoop
		}
		// No per-punch source — ingest falls back to the instance name.
		out = append(out, incomingPunch{card: chip, code: code, ts: rawToFloatPtr(row[2])})
	}
	return out
}

// parseUniversalPunch reads a single punch from a JSON object, a form body, or
// query params, with field synonyms (card|chip, code|cp|checkpoint, ts|timestamp,
// source|src).
func parseUniversalPunch(c *fiber.Ctx, body []byte) (incomingPunch, bool) {
	var jsonMap map[string]interface{}
	if len(body) > 0 && body[0] == '{' {
		_ = json.Unmarshal(body, &jsonMap)
	}
	pick := func(keys ...string) string {
		for _, k := range keys {
			if jsonMap != nil {
				if v, ok := jsonMap[k]; ok {
					if s := ifaceToString(v); s != "" {
						return s
					}
				}
			}
			if v := c.Query(k); v != "" {
				return v
			}
			if v := c.FormValue(k); v != "" {
				return v
			}
		}
		return ""
	}
	card := pick("card", "chip")
	code := pick("code", "cp", "checkpoint")
	if card == "" || code == "" {
		return incomingPunch{}, false
	}
	var ts *float64
	if v := pick("ts", "timestamp"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			ts = &f
		}
	}
	return incomingPunch{card: card, code: code, ts: ts, source: pick("source", "src")}, true
}

// rawToString renders a JSON value (string or number) as a plain string.
func rawToString(r json.RawMessage) string {
	var s string
	if json.Unmarshal(r, &s) == nil {
		return s
	}
	var f float64
	if json.Unmarshal(r, &f) == nil {
		return ifaceToString(f)
	}
	return strings.Trim(string(r), `"`)
}

func rawToFloatPtr(r json.RawMessage) *float64 {
	var f float64
	if json.Unmarshal(r, &f) == nil {
		return &f
	}
	var s string
	if json.Unmarshal(r, &s) == nil {
		if v, err := strconv.ParseFloat(strings.TrimSpace(s), 64); err == nil {
			return &v
		}
	}
	return nil
}

func ifaceToString(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		if t == math.Trunc(t) && math.Abs(t) < 1e15 {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(t)
	case nil:
		return ""
	default:
		return fmt.Sprint(v)
	}
}
