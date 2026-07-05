package problems

import (
	"testing"

	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/results"
)

// kindsOf indexes detected problems by kind for easy assertions.
func kindsOf(ps []Problem) map[string]Problem {
	m := make(map[string]Problem, len(ps))
	for _, p := range ps {
		m[p.Kind] = p
	}
	return m
}

func TestScanEventLevel(t *testing.T) {
	// No date, no place, competitors present but no courses.
	ps := Scan(
		map[string]string{}, // empty settings
		[]models.Competitor{{ID: "c1", Bib: "1"}},
		nil, nil, nil, nil,
	)
	got := kindsOf(ps)
	for _, want := range []string{KindEventNoDate, KindEventNoPlace, KindEventNoCourses} {
		if _, ok := got[want]; !ok {
			t.Errorf("expected %s, not found in %v", want, keys(got))
		}
	}
	// eventNoCourses is critical and must sort first.
	if len(ps) > 0 && ps[0].Kind != KindEventNoCourses {
		t.Errorf("expected critical eventNoCourses first, got %s", ps[0].Kind)
	}
}

func TestScanStructural(t *testing.T) {
	settings := map[string]string{"date": "2026-07-05", "place": "Forest"}
	courses := []models.Course{
		{ID: "a", Name: "Blue", Checkpoints: `["START","FINISH"]`},
		{ID: "b", Name: "blue", Checkpoints: `["START","FINISH"]`}, // dup name (case-insensitive)
		{ID: "c", Name: "Empty", Checkpoints: `[]`},                // empty sequence
	}
	groups := []models.Group{
		{ID: "g1", Name: "M21", CourseID: "a"},
		{ID: "g2", Name: "m21", CourseID: "b"},          // dup name
		{ID: "g3", Name: "Both", CourseID: "a", ParentID: "g1"}, // course + parent
	}
	ps := Scan(settings, nil, courses, groups, nil, nil)
	got := kindsOf(ps)
	for _, want := range []string{KindCourseEmpty, KindCourseDupName, KindGroupDupName, KindGroupCourseAndParent} {
		if _, ok := got[want]; !ok {
			t.Errorf("expected %s, not found in %v", want, keys(got))
		}
	}
	// No event-level problems when date+place present and courses exist.
	if _, ok := got[KindEventNoCourses]; ok {
		t.Error("did not expect eventNoCourses")
	}
}

func TestScanCardsAndBibs(t *testing.T) {
	settings := map[string]string{"date": "d", "place": "p"}
	competitors := []models.Competitor{
		{ID: "c1", Bib: "1", Card1: "100", GroupID: "g1"},
		{ID: "c2", Bib: "1", Card1: "100", GroupID: "g1"}, // same card (collision) + same bib in group (dup)
	}
	courses := []models.Course{{ID: "crs", Name: "A", Checkpoints: `["FINISH"]`}}
	groups := []models.Group{{ID: "g1", Name: "M", CourseID: "crs"}}
	passings := []models.Passing{
		{ID: "p1", Card: "100", Checkpoint: "FINISH", Timestamp: 10, Enabled: 1},
		{ID: "p2", Card: "999", Checkpoint: "FINISH", Timestamp: 20, Enabled: 1}, // unknown card
	}
	ps := Scan(settings, competitors, courses, groups, passings, nil)
	got := kindsOf(ps)
	for _, want := range []string{KindCardCollision, KindUnknownCardPunches, KindCompetitorDupBib} {
		if _, ok := got[want]; !ok {
			t.Errorf("expected %s, not found in %v", want, keys(got))
		}
	}
	if p, ok := got[KindUnknownCardPunches]; ok {
		if p.Params["card"] != "999" || p.Params["count"] != "1" {
			t.Errorf("unknownCardPunches params = %v, want card=999 count=1", p.Params)
		}
	}
	if p, ok := got[KindCardCollision]; ok && p.Severity != SeverityCritical {
		t.Errorf("cardCollision should be critical, got %s", p.Severity)
	}
}

func TestScanPerCompetitorNoCourseNoCard(t *testing.T) {
	settings := map[string]string{"date": "d", "place": "p"}
	courses := []models.Course{{ID: "crs", Name: "A", Checkpoints: `["FINISH"]`}}
	competitors := []models.Competitor{
		{ID: "orphan", Bib: "7"},                       // no group, no course → noCourse
		{ID: "nochip", Bib: "8", CourseID: "crs"},      // has course but no card, punches exist → noCard
	}
	passings := []models.Passing{{ID: "p1", Card: "500", Checkpoint: "FINISH", Timestamp: 5, Enabled: 1}}
	ps := Scan(settings, competitors, courses, nil, passings, nil)
	got := kindsOf(ps)
	for _, want := range []string{KindCompetitorNoCourse, KindCompetitorNoCard} {
		if _, ok := got[want]; !ok {
			t.Errorf("expected %s, not found in %v", want, keys(got))
		}
	}
}

func TestScanBrokenOrderAndNegativeTime(t *testing.T) {
	settings := map[string]string{"date": "d", "place": "p"}
	courses := []models.Course{{ID: "crs", Name: "A", Checkpoints: `["START","31","FINISH"]`, ValidationMode: "strict"}}
	groups := []models.Group{{ID: "g1", Name: "M", CourseID: "crs"}}
	broken := models.Competitor{ID: "cbroken", Bib: "11", Card1: "10", GroupID: "g1"}
	neg := models.Competitor{ID: "cneg", Bib: "12", Card1: "20", GroupID: "g1"}
	competitors := []models.Competitor{broken, neg}
	passings := []models.Passing{
		// broken: START + FINISH but missing 31 → matchedAll false, reached finish
		{ID: "p1", Card: "10", Checkpoint: "START", Timestamp: 100, Enabled: 1},
		{ID: "p2", Card: "10", Checkpoint: "FINISH", Timestamp: 200, Enabled: 1},
		{ID: "p3", Card: "20", Checkpoint: "FINISH", Timestamp: 50, Enabled: 1},
	}
	// Hand-built results: broken didn't match all; neg has a negative total.
	computed := []results.CompetitorResult{
		{Competitor: broken, MatchedAll: false, TotalTime: 100000, Status: "DSQ"},
		{Competitor: neg, MatchedAll: false, TotalTime: -3000, Status: "OK"},
	}
	ps := Scan(settings, competitors, courses, groups, passings, computed)
	got := kindsOf(ps)
	if _, ok := got[KindCompetitorBrokenOrder]; !ok {
		t.Errorf("expected competitorBrokenOrder, got %v", keys(got))
	}
	if _, ok := got[KindCompetitorNegativeTime]; !ok {
		t.Errorf("expected competitorNegativeTime, got %v", keys(got))
	}
	// A manual terminal status should suppress broken-order for that competitor.
	broken2 := broken
	broken2.DSQ = 1
	computed2 := []results.CompetitorResult{{Competitor: broken2, MatchedAll: false, TotalTime: 100000, Status: "DSQ"}}
	ps2 := Scan(settings, []models.Competitor{broken2}, courses, groups, passings, computed2)
	if _, ok := kindsOf(ps2)[KindCompetitorBrokenOrder]; ok {
		t.Error("brokenOrder should be suppressed when the competitor has a manual terminal status")
	}
}

func keys(m map[string]Problem) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
