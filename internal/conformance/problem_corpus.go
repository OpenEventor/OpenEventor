package conformance

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"sort"

	"github.com/openeventor/openeventor/internal/problems"
	"github.com/openeventor/openeventor/internal/results"
)

// ProblemInput is the full input for a problems-block case: engine data plus the
// event's key/value settings (event-level checks read "date"/"place").
type ProblemInput struct {
	Settings    map[string]string `json:"settings,omitempty"`
	Competitors []CompetitorIn    `json:"competitors,omitempty"`
	Courses     []CourseIn        `json:"courses,omitempty"`
	Groups      []GroupIn         `json:"groups,omitempty"`
	Passings    []PassingIn       `json:"passings,omitempty"`
}

func (p ProblemInput) base() Input {
	return Input{Competitors: p.Competitors, Courses: p.Courses, Groups: p.Groups, Passings: p.Passings}
}

// ProblemCase pins the problem scanner for a given input.
type ProblemCase struct {
	ID          string             `json:"id"`
	Block       string             `json:"block"`
	Since       string             `json:"since"`
	Description string             `json:"description"`
	Input       ProblemInput       `json:"input"`
	Expected    []problems.Problem `json:"expected"`
}

// EvaluateProblems runs Compute + problems.Scan and returns the detected problems
// (already sorted critical-first by the scanner).
func EvaluateProblems(in ProblemInput) []problems.Problem {
	comps, courses, groups, passings := in.base().toModels()
	computed := results.Compute(comps, courses, groups, passings)
	out := problems.Scan(in.Settings, comps, courses, groups, passings, computed)
	if out == nil {
		out = []problems.Problem{}
	}
	return out
}

// WriteProblemCase fills Expected from the scanner (oracle) and writes the case.
func WriteProblemCase(dir string, c ProblemCase) error {
	c.Expected = EvaluateProblems(c.Input)
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

// LoadProblems reads every *.json problem case under dir (recursively), sorted by ID.
func LoadProblems(dir string) ([]ProblemCase, error) {
	var cases []ProblemCase
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
		var c ProblemCase
		if err := json.Unmarshal(b, &c); err != nil {
			return err
		}
		cases = append(cases, c)
		return nil
	})
	sort.Slice(cases, func(i, j int) bool { return cases[i].ID < cases[j].ID })
	return cases, err
}
