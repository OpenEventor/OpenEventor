package protocols_test

import (
	"testing"
	"time"

	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/protocols"
	"github.com/openeventor/openeventor/internal/results"
)

var t0 = time.Unix(0, 0)

// --- fixtures ---------------------------------------------------------------

type crOpt func(*results.CompetitorResult)

func withCourse(id string) crOpt   { return func(r *results.CompetitorResult) { r.CourseID = id } }
func withStart(s float64) crOpt    { return func(r *results.CompetitorResult) { r.StartTime = s } }
func withRating(v float64) crOpt   { return func(r *results.CompetitorResult) { r.Competitor.Rating = v } }
func withOutOfRank() crOpt         { return func(r *results.CompetitorResult) { r.Competitor.OutOfRank = 1 } }
func withGroup(id, name string) crOpt {
	return func(r *results.CompetitorResult) { r.Competitor.GroupID = id; r.GroupName = name }
}

// mkCR builds a computed result the way results.Compute would emit one.
func mkCR(id, bib, status string, totalMs int64, opts ...crOpt) results.CompetitorResult {
	r := results.CompetitorResult{
		Competitor: models.Competitor{ID: id, Bib: bib, LastName: id},
		Status:     status,
		TotalTime:  totalMs,
	}
	for _, o := range opts {
		o(&r)
	}
	return r
}

func courseC1() []models.Course { return []models.Course{{ID: "c1", Name: "Course A"}} }

func findRow(t *testing.T, sec protocols.Section, id string) protocols.Row {
	t.Helper()
	for _, r := range sec.Rows {
		if r.CompetitorID == id {
			return r
		}
	}
	t.Fatalf("no row for competitor %q", id)
	return protocols.Row{}
}

func rowOrder(sec protocols.Section) []string {
	ids := make([]string, len(sec.Rows))
	for i, r := range sec.Rows {
		ids[i] = r.CompetitorID
	}
	return ids
}

func placeOf(t *testing.T, r protocols.Row) int {
	t.Helper()
	if r.Place == nil {
		t.Fatalf("row %q: expected a place, got nil", r.CompetitorID)
	}
	return *r.Place
}

// --- tests ------------------------------------------------------------------

// Competition ranking 1-2-2-4 (equal tenths share a place, then skip) plus
// gap-to-leader / gap-to-previous.
func TestBuild_CompetitionRankingAndGaps(t *testing.T) {
	computed := []results.CompetitorResult{
		mkCR("A", "1", "OK", 1000, withCourse("c1")),
		mkCR("B", "2", "OK", 2000, withCourse("c1")),
		mkCR("C", "3", "OK", 2080, withCourse("c1")), // ties with B (same tenth)
		mkCR("D", "4", "OK", 3000, withCourse("c1")),
	}
	cfg := protocols.Config{Type: protocols.TypeResults, Grouping: protocols.GroupingCourse}
	doc := protocols.Build(cfg, computed, courseC1(), nil, nil, nil, t0)

	if len(doc.Sections) != 1 {
		t.Fatalf("want 1 section, got %d", len(doc.Sections))
	}
	sec := doc.Sections[0]
	if got := rowOrder(sec); got[0] != "A" || got[1] != "B" || got[2] != "C" || got[3] != "D" {
		t.Fatalf("row order = %v", got)
	}
	wantPlace := map[string]int{"A": 1, "B": 2, "C": 2, "D": 4}
	for id, want := range wantPlace {
		if got := placeOf(t, findRow(t, sec, id)); got != want {
			t.Errorf("place[%s] = %d, want %d", id, got, want)
		}
	}

	a := findRow(t, sec, "A")
	if a.GapToLeader != nil || a.GapToPrev != nil {
		t.Errorf("leader gaps = %v/%v, want nil/nil", a.GapToLeader, a.GapToPrev)
	}
	c := findRow(t, sec, "C")
	if c.GapToLeader == nil || *c.GapToLeader != 1080 {
		t.Errorf("C gapToLeader = %v, want 1080", c.GapToLeader)
	}
	if c.GapToPrev == nil || *c.GapToPrev != 80 { // previous is B (2000)
		t.Errorf("C gapToPrev = %v, want 80", c.GapToPrev)
	}
}

// A parent group's section combines every descendant group; a leaf section
// contains only its own competitors.
func TestBuild_ParentGroupSubtree(t *testing.T) {
	groups := []models.Group{
		{ID: "P", Name: "Parent"},
		{ID: "M", Name: "M21", ParentID: "P"},
		{ID: "W", Name: "W21", ParentID: "P"},
	}
	computed := []results.CompetitorResult{
		mkCR("a", "1", "OK", 1000, withGroup("M", "M21"), withCourse("c1")),
		mkCR("b", "2", "OK", 1500, withGroup("W", "W21"), withCourse("c1")),
		mkCR("c", "3", "OK", 1200, withGroup("M", "M21"), withCourse("c1")),
	}

	// Selecting the parent combines M + W, ranked together.
	parentCfg := protocols.Config{
		Type: protocols.TypeResults, Grouping: protocols.GroupingGroup,
		SelectedIDs: map[string]bool{"P": true},
	}
	doc := protocols.Build(parentCfg, computed, courseC1(), groups, nil, nil, t0)
	if len(doc.Sections) != 1 || doc.Sections[0].ID != "P" {
		t.Fatalf("want single P section, got %+v", doc.Sections)
	}
	sec := doc.Sections[0]
	if got := rowOrder(sec); len(got) != 3 || got[0] != "a" || got[1] != "c" || got[2] != "b" {
		t.Fatalf("combined order = %v, want [a c b]", got)
	}
	if p := placeOf(t, findRow(t, sec, "b")); p != 3 {
		t.Errorf("b place = %d, want 3", p)
	}

	// Selecting a leaf emits just that class.
	leafCfg := protocols.Config{
		Type: protocols.TypeResults, Grouping: protocols.GroupingGroup,
		SelectedIDs: map[string]bool{"M": true},
	}
	leaf := protocols.Build(leafCfg, computed, courseC1(), groups, nil, nil, t0)
	if len(leaf.Sections) != 1 || leaf.Sections[0].ID != "M" {
		t.Fatalf("want single M section, got %+v", leaf.Sections)
	}
	if got := rowOrder(leaf.Sections[0]); len(got) != 2 || got[0] != "a" || got[1] != "c" {
		t.Fatalf("leaf order = %v, want [a c]", got)
	}

	// Regression: with NO explicit selection (all groups), a child is absorbed
	// into its parent's section — the parent must not be duplicated by its
	// children. Expect a single combined "P" section holding all competitors.
	allCfg := protocols.Config{Type: protocols.TypeResults, Grouping: protocols.GroupingGroup}
	allDoc := protocols.Build(allCfg, computed, courseC1(), groups, nil, nil, t0)
	if len(allDoc.Sections) != 1 {
		ids := make([]string, len(allDoc.Sections))
		for i, s := range allDoc.Sections {
			ids[i] = s.ID
		}
		t.Fatalf("selectAll: want 1 combined section, got sections %v", ids)
	}
	if allDoc.Sections[0].ID != "P" {
		t.Fatalf("selectAll: section id = %q, want P", allDoc.Sections[0].ID)
	}
	if got := rowOrder(allDoc.Sections[0]); len(got) != 3 {
		t.Fatalf("selectAll: combined section should hold all 3 competitors, got %v", got)
	}
}

// Start list: assigned start ascending, absent (0) at the bottom, ties by bib.
func TestBuild_StartOrdering(t *testing.T) {
	computed := []results.CompetitorResult{
		mkCR("a", "5", "OK", 0, withCourse("c1"), withStart(300)),
		mkCR("b", "2", "OK", 0, withCourse("c1"), withStart(100)),
		mkCR("c", "3", "OK", 0, withCourse("c1"), withStart(0)),   // absent → bottom
		mkCR("d", "1", "OK", 0, withCourse("c1"), withStart(100)), // ties b at 100, bib 1 first
	}
	cfg := protocols.Config{Type: protocols.TypeStart, Grouping: protocols.GroupingCourse}
	doc := protocols.Build(cfg, computed, courseC1(), nil, nil, nil, t0)

	sec := doc.Sections[0]
	if got := rowOrder(sec); got[0] != "d" || got[1] != "b" || got[2] != "a" || got[3] != "c" {
		t.Fatalf("start order = %v, want [d b a c]", got)
	}
	for _, r := range sec.Rows {
		if r.Place != nil {
			t.Errorf("start row %q has a place", r.CompetitorID)
		}
		if r.Status != "" {
			t.Errorf("start row %q status = %q, want empty", r.CompetitorID, r.Status)
		}
	}
}

// Non-finishers: filtered by the print flags, appended after ranked rows in
// DSQ→DNF→DNS→NC order; NC always shown.
func TestBuild_NonFinisherPlacementAndFilter(t *testing.T) {
	computed := []results.CompetitorResult{
		mkCR("ok1", "1", "OK", 1000, withCourse("c1")),
		mkCR("dsq1", "2", "DSQ", 0, withCourse("c1")),
		mkCR("dnf1", "3", "DNF", 0, withCourse("c1")),
		mkCR("dns1", "4", "DNS", 0, withCourse("c1")),
		mkCR("nc1", "5", "NC", 0, withCourse("c1")),
		mkCR("oor1", "6", "OK", 1200, withCourse("c1"), withOutOfRank()), // OK but out of rank → NC
	}

	// Default flags: only the ranked finisher and the always-on NC rows.
	def := protocols.Config{Type: protocols.TypeResults, Grouping: protocols.GroupingCourse}
	doc := protocols.Build(def, computed, courseC1(), nil, nil, nil, t0)
	if got := rowOrder(doc.Sections[0]); len(got) != 3 || got[0] != "ok1" || got[1] != "nc1" || got[2] != "oor1" {
		t.Fatalf("filtered order = %v, want [ok1 nc1 oor1]", got)
	}
	oor := findRow(t, doc.Sections[0], "oor1")
	if oor.Place != nil || oor.Status != "NC" || !oor.OutOfRank {
		t.Errorf("oor1 = place %v status %q outOfRank %v, want nil/NC/true", oor.Place, oor.Status, oor.OutOfRank)
	}

	// All print flags on: every non-finisher, ordered DSQ, DNF, DNS, NC, NC.
	all := protocols.Config{
		Type: protocols.TypeResults, Grouping: protocols.GroupingCourse,
		PrintDSQ: true, PrintDNF: true, PrintDNS: true,
	}
	full := protocols.Build(all, computed, courseC1(), nil, nil, nil, t0)
	want := []string{"ok1", "dsq1", "dnf1", "dns1", "nc1", "oor1"}
	got := rowOrder(full.Sections[0])
	if len(got) != len(want) {
		t.Fatalf("full order = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("full order = %v, want %v", got, want)
		}
	}
	for _, id := range []string{"dsq1", "dnf1", "dns1", "nc1"} {
		if r := findRow(t, full.Sections[0], id); r.Place != nil {
			t.Errorf("%s has a place, want nil", id)
		}
	}
}

// Points: usePoints sorts by rating DESC and differing ratings break a time tie;
// without it, equal tenths tie and no points column is shown.
func TestBuild_Points(t *testing.T) {
	computed := []results.CompetitorResult{
		mkCR("a", "1", "OK", 1000, withCourse("c1"), withRating(50)),
		mkCR("b", "2", "OK", 1000, withCourse("c1"), withRating(80)),
	}

	off := protocols.Config{Type: protocols.TypeResults, Grouping: protocols.GroupingCourse, UsePoints: false}
	docOff := protocols.Build(off, computed, courseC1(), nil, nil, nil, t0)
	if docOff.ShowPointsColumn {
		t.Errorf("points column shown with usePoints off")
	}
	// Equal time (same tenth) → shared place 1.
	if placeOf(t, findRow(t, docOff.Sections[0], "a")) != 1 ||
		placeOf(t, findRow(t, docOff.Sections[0], "b")) != 1 {
		t.Errorf("without points both should be place 1")
	}

	on := protocols.Config{Type: protocols.TypeResults, Grouping: protocols.GroupingCourse, UsePoints: true}
	docOn := protocols.Build(on, computed, courseC1(), nil, nil, nil, t0)
	if !docOn.ShowPointsColumn {
		t.Errorf("points column not shown with usePoints on and ratings present")
	}
	sec := docOn.Sections[0]
	if got := rowOrder(sec); got[0] != "b" || got[1] != "a" { // higher rating first
		t.Fatalf("points order = %v, want [b a]", got)
	}
	if placeOf(t, findRow(t, sec, "b")) != 1 || placeOf(t, findRow(t, sec, "a")) != 2 {
		t.Errorf("differing ratings must not tie: b=1, a=2")
	}
	if b := findRow(t, sec, "b"); b.Points == nil || *b.Points != 80 {
		t.Errorf("b points = %v, want 80", b.Points)
	}
}

// Column set and ordering per type / options, incl. the group column (course
// grouping with groups present).
func TestBuild_Columns(t *testing.T) {
	members := []results.CompetitorResult{
		mkCR("a", "1", "OK", 1000, withGroup("g1", "M21"), withCourse("c1")),
	}

	// Results, by course, group present → group + status columns, no team.
	rescfg := protocols.Config{Type: protocols.TypeResults, Grouping: protocols.GroupingCourse}
	doc := protocols.Build(rescfg, members, courseC1(), []models.Group{{ID: "g1", Name: "M21"}}, nil, nil, t0)
	if !doc.ShowGroupColumn {
		t.Errorf("group column should show for course grouping with a group present")
	}
	wantRes := []string{"place", "bib", "lastName", "firstName", "group", "result", "status"}
	assertCols(t, doc.Columns, wantRes)

	// Start, by group, showComment → comment before start, no place/result/status.
	startcfg := protocols.Config{Type: protocols.TypeStart, Grouping: protocols.GroupingGroup, ShowComment: true}
	sdoc := protocols.Build(startcfg, members, courseC1(), []models.Group{{ID: "g1", Name: "M21"}}, nil, nil, t0)
	assertCols(t, sdoc.Columns, []string{"bib", "lastName", "firstName", "comment", "start"})
}

func assertCols(t *testing.T, got, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("columns = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("columns = %v, want %v", got, want)
		}
	}
}
