package conformance

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/protocols"
	"github.com/openeventor/openeventor/internal/results"
)

// protocolTime is fixed so Document.GeneratedAt is deterministic across regenerations.
var protocolTime = time.Unix(1_752_000_000, 0).UTC()

// TeamIn is the compact input form of a team (protocols read it for the team column).
type TeamIn struct {
	ID      string `json:"id"`
	Name    string `json:"name,omitempty"`
	Country string `json:"country,omitempty"`
	Region  string `json:"region,omitempty"`
	City    string `json:"city,omitempty"`
}

// ProtocolConfig is the compact input form of protocols.Config.
type ProtocolConfig struct {
	Type                string   `json:"type"`                  // "start"|"results"
	Grouping            string   `json:"grouping"`              // "group"|"course"
	SelectedIDs         []string `json:"selectedIds,omitempty"` // empty = all sections
	ShowTeam            bool     `json:"showTeam,omitempty"`
	ShowCountry         bool     `json:"showCountry,omitempty"`
	ShowStartTime       bool     `json:"showStartTime,omitempty"`
	ShowRank            bool     `json:"showRank,omitempty"`
	ShowComment         bool     `json:"showComment,omitempty"`
	ShowGapToLeader     bool     `json:"showGapToLeader,omitempty"`
	ShowGapToPrevious   bool     `json:"showGapToPrevious,omitempty"`
	UsePoints           bool     `json:"usePoints,omitempty"`
	PrintDSQ            bool     `json:"printDsq,omitempty"`
	PrintDNF            bool     `json:"printDnf,omitempty"`
	PrintDNS            bool     `json:"printDns,omitempty"`
	PageBreakPerSection bool     `json:"pageBreakPerSection,omitempty"`
}

func (pc ProtocolConfig) toConfig() protocols.Config {
	t := protocols.TypeResults
	if pc.Type == "start" {
		t = protocols.TypeStart
	}
	g := protocols.GroupingGroup
	if pc.Grouping == "course" {
		g = protocols.GroupingCourse
	}
	var sel map[string]bool
	if len(pc.SelectedIDs) > 0 {
		sel = make(map[string]bool, len(pc.SelectedIDs))
		for _, id := range pc.SelectedIDs {
			sel[id] = true
		}
	}
	return protocols.Config{
		Type: t, Grouping: g, SelectedIDs: sel,
		ShowTeam: pc.ShowTeam, ShowCountry: pc.ShowCountry, ShowStartTime: pc.ShowStartTime,
		ShowRank: pc.ShowRank, ShowComment: pc.ShowComment,
		ShowGapToLeader: pc.ShowGapToLeader, ShowGapToPrevious: pc.ShowGapToPrevious,
		UsePoints: pc.UsePoints,
		PrintDSQ: pc.PrintDSQ, PrintDNF: pc.PrintDNF, PrintDNS: pc.PrintDNS,
		PageBreakPerSection: pc.PageBreakPerSection,
	}
}

// ProtocolInput is the full input for a protocol case (engine data + config).
type ProtocolInput struct {
	Competitors []CompetitorIn `json:"competitors"`
	Courses     []CourseIn     `json:"courses,omitempty"`
	Groups      []GroupIn      `json:"groups,omitempty"`
	Passings    []PassingIn    `json:"passings,omitempty"`
	Teams       []TeamIn       `json:"teams,omitempty"`
	Config      ProtocolConfig `json:"config"`
}

func (p ProtocolInput) base() Input {
	return Input{Competitors: p.Competitors, Courses: p.Courses, Groups: p.Groups, Passings: p.Passings}
}

func (p ProtocolInput) teamModels() []models.Team {
	out := make([]models.Team, 0, len(p.Teams))
	for _, t := range p.Teams {
		out = append(out, models.Team{ID: t.ID, Name: t.Name, Country: t.Country, Region: t.Region, City: t.City})
	}
	return out
}

// ProtocolCase pins protocols.Build for a given input+config.
type ProtocolCase struct {
	ID          string             `json:"id"`
	Block       string             `json:"block"`
	Since       string             `json:"since"`
	Description string             `json:"description"`
	Input       ProtocolInput      `json:"input"`
	Expected    protocols.Document `json:"expected"`
}

// EvaluateProtocol runs Compute + Build and returns the structured document.
func EvaluateProtocol(in ProtocolInput) protocols.Document {
	comps, courses, groups, passings := in.base().toModels()
	computed := results.Compute(comps, courses, groups, passings)
	return protocols.Build(in.Config.toConfig(), computed, courses, groups, in.teamModels(), passings, protocolTime)
}

// WriteProtocolCase fills Expected from the engine (oracle) and writes the case.
func WriteProtocolCase(dir string, c ProtocolCase) error {
	c.Expected = EvaluateProtocol(c.Input)
	sub := filepath.Join(dir, c.Block)
	if err := os.MkdirAll(sub, 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(sub, filepath.Base(c.ID)+".json"), append(b, '\n'), 0o644)
}

// LoadProtocols reads every *.json protocol case under dir (recursively), sorted by ID.
func LoadProtocols(dir string) ([]ProtocolCase, error) {
	var cases []ProtocolCase
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
		var c ProtocolCase
		if err := json.Unmarshal(b, &c); err != nil {
			return err
		}
		cases = append(cases, c)
		return nil
	})
	sort.Slice(cases, func(i, j int) bool { return cases[i].ID < cases[j].ID })
	return cases, err
}
