package handlers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/protocols"
	"github.com/openeventor/openeventor/internal/results"
)

// GetProtocol builds a start-list or results protocol for an event on the fly
// (nothing stored), mirroring the iOS «Протоколы». Defaults come from the event's
// protocol_* settings; query params override them:
//
//	type=start|results, by|grouping=group|course, ids=<comma section ids>,
//	showTeam, showCountry, showStart, showRank, showComment,
//	gapLeader, gapPrev, usePoints, printDsq, printDnf, printDns, pageBreak
//
// (each boolean flag as 1/0/true/false).
func (h *Handler) GetProtocol(c *fiber.Ctx) error {
	eventID := c.Params("eventId")

	db, err := h.DB.EventDB(eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open event database"})
	}

	settings, err := loadSettings(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load settings"})
	}
	competitors, err := loadCompetitors(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load competitors"})
	}
	courses, err := loadCourses(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load courses"})
	}
	groups, err := loadGroups(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load groups"})
	}
	passings, err := loadPassings(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load passings"})
	}
	teams, err := loadTeams(db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load teams"})
	}

	cfg := protocols.ConfigFromSettings(settings)
	applyProtocolQuery(c, &cfg)

	computed := results.Compute(competitors, courses, groups, passings)
	doc := protocols.Build(cfg, computed, courses, groups, teams, passings, time.Now())

	return c.JSON(doc)
}

// applyProtocolQuery overlays query-param overrides onto a settings-derived config.
func applyProtocolQuery(c *fiber.Ctx, cfg *protocols.Config) {
	switch c.Query("type") {
	case "start":
		cfg.Type = protocols.TypeStart
	case "results":
		cfg.Type = protocols.TypeResults
	}
	grouping := c.Query("by")
	if grouping == "" {
		grouping = c.Query("grouping")
	}
	switch grouping {
	case "course":
		cfg.Grouping = protocols.GroupingCourse
	case "group":
		cfg.Grouping = protocols.GroupingGroup
	}

	cfg.ShowTeam = queryBool(c, "showTeam", cfg.ShowTeam)
	cfg.ShowCountry = queryBool(c, "showCountry", cfg.ShowCountry)
	cfg.ShowStartTime = queryBool(c, "showStart", cfg.ShowStartTime)
	cfg.ShowRank = queryBool(c, "showRank", cfg.ShowRank)
	cfg.ShowComment = queryBool(c, "showComment", cfg.ShowComment)
	cfg.ShowGapToLeader = queryBool(c, "gapLeader", cfg.ShowGapToLeader)
	cfg.ShowGapToPrevious = queryBool(c, "gapPrev", cfg.ShowGapToPrevious)
	cfg.UsePoints = queryBool(c, "usePoints", cfg.UsePoints)
	cfg.PrintDSQ = queryBool(c, "printDsq", cfg.PrintDSQ)
	cfg.PrintDNF = queryBool(c, "printDnf", cfg.PrintDNF)
	cfg.PrintDNS = queryBool(c, "printDns", cfg.PrintDNS)
	cfg.PageBreakPerSection = queryBool(c, "pageBreak", cfg.PageBreakPerSection)

	if ids := c.Query("ids"); ids != "" {
		sel := make(map[string]bool)
		for _, id := range strings.Split(ids, ",") {
			if id = strings.TrimSpace(id); id != "" {
				sel[id] = true
			}
		}
		cfg.SelectedIDs = sel
	}
}

// queryBool reads a 1/0/true/false query flag, keeping cur when absent/unparsable.
func queryBool(c *fiber.Ctx, key string, cur bool) bool {
	switch c.Query(key) {
	case "":
		return cur
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return cur
	}
}

// loadTeams reads teams (id + name) for the team column.
func loadTeams(db *sql.DB) ([]models.Team, error) {
	rows, err := db.Query(`SELECT id, name FROM teams`)
	if err != nil {
		return nil, fmt.Errorf("query teams: %w", err)
	}
	defer rows.Close()

	teams := make([]models.Team, 0)
	for rows.Next() {
		var t models.Team
		if err := rows.Scan(&t.ID, &t.Name); err != nil {
			return nil, fmt.Errorf("scan team: %w", err)
		}
		teams = append(teams, t)
	}
	return teams, rows.Err()
}
