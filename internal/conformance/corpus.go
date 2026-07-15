// Package conformance defines the OpenEventor conformance corpus: portable
// input→expected cases that pin the Core results engine's behavior. The same JSON
// cases are meant to be run by every platform's engine (Go, Swift, Kotlin); this
// package is the Go generator + runner. See the spec repo: conformance/README.md.
//
// Cases use a compact, language-neutral input schema (only the fields the engine
// reads) so the JSON stays readable and portable; `Expected` is the engine's own
// output, captured at generation time (the web engine is the bootstrap oracle).
package conformance

import (
	"encoding/json"
	"io/fs"
	"path/filepath"
	"os"
	"sort"

	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/results"
)

// CompetitorIn is the compact input form of a competitor (engine-relevant fields only).
type CompetitorIn struct {
	ID             string  `json:"id"`
	Bib            string  `json:"bib,omitempty"`
	Card1          string  `json:"card1,omitempty"`
	Card2          string  `json:"card2,omitempty"`
	GroupID        string  `json:"groupId,omitempty"`
	CourseID       string  `json:"courseId,omitempty"`
	TeamID         string  `json:"teamId,omitempty"`
	LastName       string  `json:"lastName,omitempty"`
	FirstName      string  `json:"firstName,omitempty"`
	Rank           string  `json:"rank,omitempty"`
	StartTime      float64 `json:"startTime,omitempty"`
	TimeAdjustment int     `json:"timeAdjustment,omitempty"`
	Rating         float64 `json:"rating,omitempty"`
	DSQ            int     `json:"dsq,omitempty"`
	DNF            int     `json:"dnf,omitempty"`
	DNS            int     `json:"dns,omitempty"`
	OutOfRank      int     `json:"outOfRank,omitempty"`
}

// CourseIn holds checkpoints as a plain string array (nicer than an escaped JSON string).
type CourseIn struct {
	ID             string   `json:"id"`
	Name           string   `json:"name,omitempty"`
	Checkpoints    []string `json:"checkpoints"`
	ValidationMode string   `json:"validationMode,omitempty"` // default "strict"
	StartTime      float64  `json:"startTime,omitempty"`
}

// GroupIn is the compact input form of a class/group.
type GroupIn struct {
	ID        string  `json:"id"`
	Name      string  `json:"name,omitempty"`
	CourseID  string  `json:"courseId,omitempty"`
	ParentID  string  `json:"parentId,omitempty"`
	StartTime float64 `json:"startTime,omitempty"`
}

// PassingIn is the compact input form of a punch. Enabled defaults to 1 when nil.
type PassingIn struct {
	Card       string  `json:"card"`
	Checkpoint string  `json:"checkpoint"`
	Timestamp  float64 `json:"timestamp"`
	Enabled    *int    `json:"enabled,omitempty"`
	SortOrder  int     `json:"sortOrder,omitempty"`
}

// Input is the full engine input for one case.
type Input struct {
	Competitors []CompetitorIn `json:"competitors"`
	Courses     []CourseIn     `json:"courses,omitempty"`
	Groups      []GroupIn      `json:"groups,omitempty"`
	Passings    []PassingIn    `json:"passings,omitempty"`
}

// Case is one conformance case: given Input, the Core engine must produce exactly
// Expected (the display-ordered results rows).
type Case struct {
	ID          string              `json:"id"`
	Block       string              `json:"block"`
	Since       string              `json:"since"`
	Description string              `json:"description"`
	Input       Input               `json:"input"`
	Expected    []results.ResultRow `json:"expected"`
}

func mustJSON(v any) string { b, _ := json.Marshal(v); return string(b) }

func (in Input) toModels() ([]models.Competitor, []models.Course, []models.Group, []models.Passing) {
	comps := make([]models.Competitor, 0, len(in.Competitors))
	for _, c := range in.Competitors {
		comps = append(comps, models.Competitor{
			ID: c.ID, Bib: c.Bib, Card1: c.Card1, Card2: c.Card2,
			GroupID: c.GroupID, CourseID: c.CourseID, TeamID: c.TeamID,
			LastName: c.LastName, FirstName: c.FirstName, Rank: c.Rank,
			StartTime: c.StartTime, TimeAdjustment: c.TimeAdjustment, Rating: c.Rating,
			DSQ: c.DSQ, DNF: c.DNF, DNS: c.DNS, OutOfRank: c.OutOfRank,
		})
	}
	courses := make([]models.Course, 0, len(in.Courses))
	for _, c := range in.Courses {
		vm := c.ValidationMode
		if vm == "" {
			vm = "strict"
		}
		cps, _ := json.Marshal(c.Checkpoints)
		courses = append(courses, models.Course{
			ID: c.ID, Name: c.Name, Checkpoints: string(cps),
			ValidationMode: vm, StartTime: c.StartTime,
		})
	}
	groups := make([]models.Group, 0, len(in.Groups))
	for _, g := range in.Groups {
		groups = append(groups, models.Group{
			ID: g.ID, Name: g.Name, CourseID: g.CourseID, ParentID: g.ParentID, StartTime: g.StartTime,
		})
	}
	passings := make([]models.Passing, 0, len(in.Passings))
	for _, p := range in.Passings {
		en := 1
		if p.Enabled != nil {
			en = *p.Enabled
		}
		passings = append(passings, models.Passing{
			Card: p.Card, Checkpoint: p.Checkpoint, Timestamp: p.Timestamp,
			Enabled: en, SortOrder: p.SortOrder,
		})
	}
	return comps, courses, groups, passings
}

// Evaluate runs the Core engine on the input and returns the display-ordered rows.
func Evaluate(in Input) []results.ResultRow {
	comps, courses, groups, passings := in.toModels()
	rows := results.ToResponse(results.Compute(comps, courses, groups, passings), "", "").Results
	if rows == nil {
		rows = []results.ResultRow{}
	}
	return rows
}

// WriteCase fills c.Expected from the engine (the oracle) and writes it as pretty
// JSON under dir/<block>/<leaf>.json, where leaf is the last segment of c.ID.
func WriteCase(dir string, c Case) error {
	c.Expected = Evaluate(c.Input)
	leaf := filepath.Base(c.ID)
	sub := filepath.Join(dir, c.Block)
	if err := os.MkdirAll(sub, 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(sub, leaf+".json"), append(b, '\n'), 0o644)
}

// Load reads every *.json case under dir (recursively), sorted by ID.
func Load(dir string) ([]Case, error) {
	var cases []Case
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || filepath.Ext(path) != ".json" {
			return nil
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		var c Case
		if err := json.Unmarshal(b, &c); err != nil {
			return err
		}
		cases = append(cases, c)
		return nil
	})
	sort.Slice(cases, func(i, j int) bool { return cases[i].ID < cases[j].ID })
	return cases, err
}
