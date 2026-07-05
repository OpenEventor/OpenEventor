package results

import (
	"testing"

	"github.com/openeventor/openeventor/internal/models"
)

// course builds a course fixture with a JSON checkpoint sequence.
func course(id, name, mode string, checkpoints string, start float64) models.Course {
	return models.Course{ID: id, Name: name, ValidationMode: mode, Checkpoints: checkpoints, StartTime: start}
}

// punch builds an enabled passing.
func punch(card, checkpoint string, ts float64) models.Passing {
	return models.Passing{Card: card, Checkpoint: checkpoint, Timestamp: ts, Enabled: 1}
}

// findByID returns the computed result for a competitor id.
func findByID(t *testing.T, rs []CompetitorResult, id string) CompetitorResult {
	t.Helper()
	for _, r := range rs {
		if r.Competitor.ID == id {
			return r
		}
	}
	t.Fatalf("no result for competitor %q", id)
	return CompetitorResult{}
}

func TestCompute_CleanOKFinish(t *testing.T) {
	courses := []models.Course{course("c1", "Course A", "strict", `["START","31","FINISH"]`, 0)}
	competitors := []models.Competitor{
		{ID: "a", Bib: "1", Card1: "100", CourseID: "c1", LastName: "Ivanov", FirstName: "Ivan", StartTime: 1000},
	}
	passings := []models.Passing{
		punch("100", "START", 1000),
		punch("100", "31", 1060),
		punch("100", "FINISH", 1123),
	}

	got := Compute(competitors, courses, nil, passings)
	r := findByID(t, got, "a")

	if r.Status != "OK" {
		t.Fatalf("status = %q, want OK", r.Status)
	}
	if r.TotalTime != 123000 {
		t.Fatalf("totalTime = %d, want 123000", r.TotalTime)
	}
	if r.Place != 1 {
		t.Fatalf("place = %d, want 1", r.Place)
	}
	if r.StartSource != StartSourceCompetitor {
		t.Fatalf("startSource = %q, want competitor", r.StartSource)
	}
	if len(r.Splits) != 3 {
		t.Fatalf("splits = %d, want 3", len(r.Splits))
	}
	// Absolute times measured from start 1000, and per-leg deltas.
	want := []SplitTime{
		{Checkpoint: "START", Time: 0, Leg: 0},
		{Checkpoint: "31", Time: 60000, Leg: 60000},
		{Checkpoint: "FINISH", Time: 123000, Leg: 63000},
	}
	for i, w := range want {
		if r.Splits[i] != w {
			t.Errorf("split[%d] = %+v, want %+v", i, r.Splits[i], w)
		}
	}
}

func TestCompute_TimeAdjustmentOnlyOnOK(t *testing.T) {
	courses := []models.Course{course("c1", "Course A", "strict", `["FINISH"]`, 0)}
	competitors := []models.Competitor{
		{ID: "a", Card1: "100", CourseID: "c1", StartTime: 1000, TimeAdjustment: 30},
	}
	passings := []models.Passing{punch("100", "FINISH", 1100)}

	r := findByID(t, Compute(competitors, courses, nil, passings), "a")
	if r.Status != "OK" || r.TotalTime != 100000+30000 {
		t.Fatalf("got status=%q total=%d, want OK 130000", r.Status, r.TotalTime)
	}
}

func TestCompute_StrictMissingCheckpointDSQvsDNF(t *testing.T) {
	// Reached FINISH (last control) but skipped 31 → DSQ.
	// Never reached FINISH → DNF.
	courses := []models.Course{course("c1", "Course A", "strict", `["31","FINISH"]`, 0)}
	competitors := []models.Competitor{
		{ID: "dsq", Card1: "100", CourseID: "c1", StartTime: 1000},
		{ID: "dnf", Card1: "200", CourseID: "c1", StartTime: 1000},
	}
	passings := []models.Passing{
		punch("100", "FINISH", 1100), // skipped 31 but hit finish → DSQ
		punch("200", "31", 1050),     // hit 31 but no finish → DNF
	}

	got := Compute(competitors, courses, nil, passings)
	if r := findByID(t, got, "dsq"); r.Status != "DSQ" {
		t.Errorf("dsq competitor status = %q, want DSQ", r.Status)
	}
	if r := findByID(t, got, "dnf"); r.Status != "DNF" {
		t.Errorf("dnf competitor status = %q, want DNF", r.Status)
	}
}

func TestCompute_RelaxedToleratesMissingIntermediate(t *testing.T) {
	// Missing intermediate 31, but reached FINISH → OK under relaxed.
	courses := []models.Course{course("c1", "Course A", "relaxed", `["31","FINISH"]`, 0)}
	competitors := []models.Competitor{
		{ID: "a", Card1: "100", CourseID: "c1", StartTime: 1000},
	}
	passings := []models.Passing{punch("100", "FINISH", 1090)}

	r := findByID(t, Compute(competitors, courses, nil, passings), "a")
	if r.Status != "OK" {
		t.Fatalf("status = %q, want OK", r.Status)
	}
	if r.MatchedAll {
		t.Errorf("matchedAll = true, want false (31 missing)")
	}
	if r.TotalTime != 90000 {
		t.Errorf("totalTime = %d, want 90000", r.TotalTime)
	}
	if len(r.Splits) != 1 || r.Splits[0].Checkpoint != "FINISH" {
		t.Errorf("splits = %+v, want single FINISH", r.Splits)
	}
}

func TestCompute_ManualFlagPriority(t *testing.T) {
	courses := []models.Course{course("c1", "Course A", "strict", `["FINISH"]`, 0)}
	base := models.Competitor{Card1: "100", CourseID: "c1", StartTime: 1000}
	passings := []models.Passing{punch("100", "FINISH", 1100)}

	cases := []struct {
		name       string
		dsq        int
		dnf        int
		dns        int
		wantStatus string
		wantTotal  int64
	}{
		{"dsq wins over dnf+dns", 1, 1, 1, "DSQ", 100000}, // DSQ keeps total
		{"dnf wins over dns", 0, 1, 1, "DNF", 0},
		{"dns only", 0, 0, 1, "DNS", 0},
		{"no flags stays OK", 0, 0, 0, "OK", 100000},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			comp := base
			comp.ID = "a"
			comp.DSQ, comp.DNF, comp.DNS = tc.dsq, tc.dnf, tc.dns
			r := findByID(t, Compute([]models.Competitor{comp}, courses, nil, passings), "a")
			if r.Status != tc.wantStatus {
				t.Errorf("status = %q, want %q", r.Status, tc.wantStatus)
			}
			if r.TotalTime != tc.wantTotal {
				t.Errorf("totalTime = %d, want %d", r.TotalTime, tc.wantTotal)
			}
		})
	}
}

func TestCompute_OutOfRankExcludedFromPlacing(t *testing.T) {
	courses := []models.Course{course("c1", "Course A", "strict", `["FINISH"]`, 0)}
	competitors := []models.Competitor{
		{ID: "fast_oor", Card1: "100", CourseID: "c1", StartTime: 1000, OutOfRank: 1},
		{ID: "slow", Card1: "200", CourseID: "c1", StartTime: 1000},
	}
	passings := []models.Passing{
		punch("100", "FINISH", 1050), // fastest but out of rank
		punch("200", "FINISH", 1100),
	}

	got := Compute(competitors, courses, nil, passings)
	if r := findByID(t, got, "fast_oor"); r.Place != 0 {
		t.Errorf("out-of-rank place = %d, want 0", r.Place)
	}
	if r := findByID(t, got, "slow"); r.Place != 1 {
		t.Errorf("in-rank place = %d, want 1 (should be first despite slower time)", r.Place)
	}
}

func TestCompute_TieGetsSequentialPlaces(t *testing.T) {
	courses := []models.Course{course("c1", "Course A", "strict", `["FINISH"]`, 0)}
	competitors := []models.Competitor{
		{ID: "x", Card1: "100", CourseID: "c1", StartTime: 1000},
		{ID: "y", Card1: "200", CourseID: "c1", StartTime: 1000},
	}
	passings := []models.Passing{
		punch("100", "FINISH", 1100),
		punch("200", "FINISH", 1100),
	}
	got := Compute(competitors, courses, nil, passings)
	places := map[int]int{}
	for _, r := range got {
		places[r.Place]++
	}
	if places[1] != 1 || places[2] != 1 {
		t.Errorf("expected sequential places 1 and 2, got %+v", places)
	}
}

func TestCompute_GroupInheritedCourse(t *testing.T) {
	// child group -> parent group (holds course). Competitor has no direct course.
	courses := []models.Course{course("c1", "Inherited", "strict", `["FINISH"]`, 0)}
	groups := []models.Group{
		{ID: "parent", Name: "Parent", CourseID: "c1"},
		{ID: "child", Name: "Child", ParentID: "parent"},
	}
	competitors := []models.Competitor{
		{ID: "a", Card1: "100", GroupID: "child", StartTime: 1000},
	}
	passings := []models.Passing{punch("100", "FINISH", 1100)}

	r := findByID(t, Compute(competitors, courses, groups, passings), "a")
	if r.CourseID != "c1" {
		t.Fatalf("resolved courseID = %q, want c1", r.CourseID)
	}
	if r.Status != "OK" || r.TotalTime != 100000 {
		t.Fatalf("got status=%q total=%d, want OK 100000", r.Status, r.TotalTime)
	}
	if r.CourseName != "Inherited" {
		t.Errorf("courseName = %q, want Inherited", r.CourseName)
	}
}

func TestResolvedCourseID_GroupOverridesDirect(t *testing.T) {
	groups := []models.Group{{ID: "g", CourseID: "group_course"}}
	comp := models.Competitor{GroupID: "g", CourseID: "direct_course"}
	g := groups[0]
	if got := ResolvedCourseID(comp, &g, groups); got != "group_course" {
		t.Fatalf("resolved = %q, want group_course (group wins over direct)", got)
	}

	// No group course -> falls back to competitor's direct course.
	groups2 := []models.Group{{ID: "g"}}
	g2 := groups2[0]
	if got := ResolvedCourseID(comp, &g2, groups2); got != "direct_course" {
		t.Fatalf("resolved = %q, want direct_course", got)
	}
}

func TestGroupCourseID_CycleSafe(t *testing.T) {
	groups := []models.Group{
		{ID: "a", ParentID: "b"},
		{ID: "b", ParentID: "a"},
	}
	g := groups[0]
	if got := GroupCourseID(&g, groups); got != "" {
		t.Fatalf("cycle should resolve to empty, got %q", got)
	}
}

func TestResolveStart_SourceCascade(t *testing.T) {
	fp := 5000.0
	comp := models.Competitor{StartTime: 1000}
	group := &models.Group{StartTime: 2000}
	crs := &models.Course{StartTime: 3000}

	cases := []struct {
		name       string
		comp       models.Competitor
		group      *models.Group
		course     *models.Course
		firstPunch *float64
		wantTime   float64
		wantSource StartSource
	}{
		{"competitor wins", comp, group, crs, &fp, 1000, StartSourceCompetitor},
		{"group next", models.Competitor{}, group, crs, &fp, 2000, StartSourceGroup},
		{"course next", models.Competitor{}, nil, crs, &fp, 3000, StartSourceCourse},
		{"punch next", models.Competitor{}, nil, nil, &fp, 5000, StartSourcePunch},
		{"none", models.Competitor{}, nil, nil, nil, 0, StartSourceNone},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ResolveStart(tc.comp, tc.group, tc.course, tc.firstPunch)
			if got.Time != tc.wantTime || got.Source != tc.wantSource {
				t.Errorf("got {%v %q}, want {%v %q}", got.Time, got.Source, tc.wantTime, tc.wantSource)
			}
		})
	}
}

func TestCompute_NoCourseIsNC(t *testing.T) {
	competitors := []models.Competitor{{ID: "a", Card1: "100", StartTime: 1000}}
	passings := []models.Passing{punch("100", "FINISH", 1100)}
	r := findByID(t, Compute(competitors, nil, nil, passings), "a")
	if r.Status != "NC" {
		t.Fatalf("status = %q, want NC", r.Status)
	}
	if r.Place != 0 {
		t.Errorf("place = %d, want 0 (NC never ranked)", r.Place)
	}
}

func TestCompute_StartFromFirstPunchWhenUnassigned(t *testing.T) {
	courses := []models.Course{course("c1", "Course A", "strict", `["31","FINISH"]`, 0)}
	competitors := []models.Competitor{{ID: "a", Card1: "100", CourseID: "c1"}} // no start time
	passings := []models.Passing{
		punch("100", "31", 1000),
		punch("100", "FINISH", 1075),
	}
	r := findByID(t, Compute(competitors, courses, nil, passings), "a")
	if r.StartSource != StartSourcePunch {
		t.Fatalf("startSource = %q, want punch", r.StartSource)
	}
	// Measured from first punch (1000): 31 at 0ms, FINISH at 75000ms.
	if r.TotalTime != 75000 {
		t.Fatalf("totalTime = %d, want 75000", r.TotalTime)
	}
	if r.Splits[0].Time != 0 || r.Splits[1].Time != 75000 {
		t.Errorf("splits = %+v, want 0 and 75000", r.Splits)
	}
}

func TestToResponse_Filters(t *testing.T) {
	courses := []models.Course{
		course("c1", "Course A", "strict", `["FINISH"]`, 0),
		course("c2", "Course B", "strict", `["FINISH"]`, 0),
	}
	competitors := []models.Competitor{
		{ID: "a", Card1: "100", CourseID: "c1", GroupID: "g1", StartTime: 1000, LastName: "A"},
		{ID: "b", Card1: "200", CourseID: "c2", GroupID: "g2", StartTime: 1000, LastName: "B"},
	}
	passings := []models.Passing{
		punch("100", "FINISH", 1100),
		punch("200", "FINISH", 1100),
	}
	computed := Compute(competitors, courses, nil, passings)

	if got := ToResponse(computed, "c1", ""); len(got.Results) != 1 || got.Results[0].CompetitorID != "a" {
		t.Errorf("course filter: got %+v", got.Results)
	}
	if got := ToResponse(computed, "", "g2"); len(got.Results) != 1 || got.Results[0].CompetitorID != "b" {
		t.Errorf("group filter: got %+v", got.Results)
	}
	if got := ToResponse(computed, "", ""); len(got.Results) != 2 {
		t.Errorf("no filter: want 2 rows, got %d", len(got.Results))
	}
	// Row shape sanity.
	row := ToResponse(computed, "c1", "").Results[0]
	if row.Name != "A" || row.Card != "100" || row.Status != "OK" || row.Place != 1 {
		t.Errorf("row = %+v", row)
	}
}
