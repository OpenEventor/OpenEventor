// Package problems scans an event for data-quality issues on the fly (nothing is
// stored), mirroring the iOS ProblemScanner in
// OpenEventorKit/Sources/OpenEventorStore/Problems.swift.
//
// Detection is language-neutral: each problem carries a stable `kind` code plus
// structured `params` (names, cards, counts — verbatim data, not prose). The
// frontend renders kind+params into localized text, so the same scan works in any
// language.
package problems

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/results"
)

// Severity of a detected problem. critical blocks a clean protocol; warning is
// worth a look; info is cosmetic/administrative.
type Severity string

const (
	SeverityInfo     Severity = "info"
	SeverityWarning  Severity = "warning"
	SeverityCritical Severity = "critical"
)

func severityRank(s Severity) int {
	switch s {
	case SeverityCritical:
		return 2
	case SeverityWarning:
		return 1
	default:
		return 0
	}
}

// Subject is what a problem is about — drives "fix it" navigation in the UI.
// Type is one of: event, competitor, course, group, card. ID is the entity id
// (or the card value for card subjects); empty for event.
type Subject struct {
	Type string `json:"type"`
	ID   string `json:"id,omitempty"`
}

// Problem kind codes — mirror the iOS ProblemKind enum cases.
const (
	KindEventNoDate            = "eventNoDate"
	KindEventNoPlace           = "eventNoPlace"
	KindEventNoCourses         = "eventNoCourses"
	KindCourseEmpty            = "courseEmpty"
	KindCourseDupName          = "courseDupName"
	KindGroupDupName           = "groupDupName"
	KindGroupCourseAndParent   = "groupCourseAndParent"
	KindCardCollision          = "cardCollision"
	KindUnknownCardPunches     = "unknownCardPunches"
	KindCompetitorNoCourse     = "competitorNoCourse"
	KindCompetitorNoCard       = "competitorNoCard"
	KindCompetitorNegativeTime = "competitorNegativeTime"
	KindCompetitorDupBib       = "competitorDupBib"
	KindCompetitorBrokenOrder  = "competitorBrokenOrder"
)

// Problem is a language-neutral description of a detected issue.
type Problem struct {
	ID       string            `json:"id"`
	Severity Severity          `json:"severity"`
	Subject  Subject           `json:"subject"`
	Kind     string            `json:"kind"`
	Params   map[string]string `json:"params,omitempty"`
}

// Scan classifies data-quality problems for an event. Pass the already-computed
// results so statuses aren't recomputed. Output is sorted critical-first, ties
// broken by the stable id (deterministic).
func Scan(
	settings map[string]string,
	competitors []models.Competitor,
	courses []models.Course,
	groups []models.Group,
	passings []models.Passing,
	computed []results.CompetitorResult,
) []Problem {
	var out []Problem

	resultByID := make(map[string]results.CompetitorResult, len(computed))
	for _, r := range computed {
		if _, ok := resultByID[r.Competitor.ID]; !ok {
			resultByID[r.Competitor.ID] = r
		}
	}
	groupByID := make(map[string]models.Group, len(groups))
	for _, g := range groups {
		if _, ok := groupByID[g.ID]; !ok {
			groupByID[g.ID] = g
		}
	}
	hasPassings := len(passings) > 0

	passingsByCard := make(map[string][]models.Passing)
	for _, p := range passings {
		passingsByCard[p.Card] = append(passingsByCard[p.Card], p)
	}

	// --- Event ---
	if strings.TrimSpace(settings["date"]) == "" {
		out = append(out, Problem{ID: "event.date", Severity: SeverityWarning, Subject: Subject{Type: "event"}, Kind: KindEventNoDate})
	}
	if strings.TrimSpace(settings["place"]) == "" {
		out = append(out, Problem{ID: "event.place", Severity: SeverityInfo, Subject: Subject{Type: "event"}, Kind: KindEventNoPlace})
	}
	if len(courses) == 0 && (hasPassings || len(competitors) > 0) {
		out = append(out, Problem{ID: "event.nocourses", Severity: SeverityCritical, Subject: Subject{Type: "event"}, Kind: KindEventNoCourses})
	}

	// --- Courses / groups structure ---
	for _, course := range courses {
		if len(checkpointList(course)) == 0 {
			out = append(out, Problem{
				ID: "course.empty." + course.ID, Severity: SeverityCritical,
				Subject: Subject{Type: "course", ID: course.ID},
				Kind:    KindCourseEmpty, Params: map[string]string{"courseName": course.Name},
			})
		}
	}
	for _, grp := range groupByLowerName(courseNames(courses)) {
		if len(grp) > 1 {
			first := grp[0]
			out = append(out, Problem{
				ID: "course.dupname." + strings.ToLower(first.name), Severity: SeverityWarning,
				Subject: Subject{Type: "course", ID: first.id},
				Kind:    KindCourseDupName, Params: map[string]string{"courseName": first.name},
			})
		}
	}
	for _, grp := range groupByLowerName(groupNames(groups)) {
		if len(grp) > 1 {
			first := grp[0]
			out = append(out, Problem{
				ID: "group.dupname." + strings.ToLower(first.name), Severity: SeverityWarning,
				Subject: Subject{Type: "group", ID: first.id},
				Kind:    KindGroupDupName, Params: map[string]string{"groupName": first.name},
			})
		}
	}
	// A group must hold EITHER a course OR a parent, never both (the parent's
	// inherited course silently wins, so a direct course is a misleading leftover).
	for _, g := range groups {
		if g.CourseID != "" && g.ParentID != "" {
			out = append(out, Problem{
				ID: "group.courseandparent." + g.ID, Severity: SeverityWarning,
				Subject: Subject{Type: "group", ID: g.ID},
				Kind:    KindGroupCourseAndParent, Params: map[string]string{"groupName": g.Name},
			})
		}
	}

	// --- Card collisions + unknown cards ---
	cardOwners := make(map[string][]models.Competitor)
	for _, c := range competitors {
		for _, card := range []string{c.Card1, c.Card2} {
			if card != "" {
				cardOwners[card] = append(cardOwners[card], c)
			}
		}
	}
	for card, owners := range cardOwners {
		if len(owners) > 1 {
			bibs := make([]string, len(owners))
			for i, o := range owners {
				if o.Bib == "" {
					bibs[i] = "—"
				} else {
					bibs[i] = o.Bib
				}
			}
			out = append(out, Problem{
				ID: "card.collision." + card, Severity: SeverityCritical,
				Subject: Subject{Type: "competitor", ID: owners[0].ID},
				Kind:    KindCardCollision, Params: map[string]string{"card": card, "bibs": strings.Join(bibs, ", ")},
			})
		}
	}
	var unknown []string
	seenUnknown := make(map[string]struct{})
	for _, p := range passings {
		if p.Card == "" {
			continue
		}
		if _, known := cardOwners[p.Card]; known {
			continue
		}
		if _, dup := seenUnknown[p.Card]; dup {
			continue
		}
		seenUnknown[p.Card] = struct{}{}
		unknown = append(unknown, p.Card)
	}
	sort.Strings(unknown)
	for _, card := range unknown {
		out = append(out, Problem{
			ID: "card.unknown." + card, Severity: SeverityWarning,
			Subject: Subject{Type: "card", ID: card},
			Kind:    KindUnknownCardPunches,
			Params:  map[string]string{"card": card, "count": fmt.Sprintf("%d", len(passingsByCard[card]))},
		})
	}

	// --- Duplicate bibs within a group ---
	bibKey := make(map[string][]models.Competitor)
	for _, c := range competitors {
		if c.Bib != "" {
			bibKey[c.GroupID+"|"+c.Bib] = append(bibKey[c.GroupID+"|"+c.Bib], c)
		}
	}
	for _, cs := range bibKey {
		if len(cs) > 1 {
			first := cs[0]
			out = append(out, Problem{
				ID: "competitor.dupbib." + first.GroupID + "." + first.Bib, Severity: SeverityWarning,
				Subject: Subject{Type: "competitor", ID: first.ID},
				Kind:    KindCompetitorDupBib,
				Params:  map[string]string{"bib": first.Bib, "count": fmt.Sprintf("%d", len(cs))},
			})
		}
	}

	// --- Per-competitor ---
	courseByID := make(map[string]models.Course, len(courses))
	for _, co := range courses {
		if _, ok := courseByID[co.ID]; !ok {
			courseByID[co.ID] = co
		}
	}
	for _, c := range competitors {
		manualTerminal := c.DSQ == 1 || c.DNF == 1 || c.DNS == 1
		var group *models.Group
		if c.GroupID != "" {
			if g, ok := groupByID[c.GroupID]; ok {
				group = &g
			}
		}
		courseID := results.ResolvedCourseID(c, group, groups)
		var course *models.Course
		if co, ok := courseByID[courseID]; ok {
			course = &co
		}
		var myPassings []models.Passing
		for _, card := range []string{c.Card1, c.Card2} {
			if card != "" {
				myPassings = append(myPassings, passingsByCard[card]...)
			}
		}
		hasCard := c.Card1 != "" || c.Card2 != ""
		r, hasResult := resultByID[c.ID]

		if c.GroupID == "" && courseID == "" {
			out = append(out, Problem{
				ID: "competitor.nocourse." + c.ID, Severity: SeverityWarning,
				Subject: Subject{Type: "competitor", ID: c.ID},
				Kind:    KindCompetitorNoCourse, Params: map[string]string{"competitor": label(c)},
			})
		}
		if !hasCard && hasPassings && !manualTerminal {
			out = append(out, Problem{
				ID: "competitor.nocard." + c.ID, Severity: SeverityWarning,
				Subject: Subject{Type: "competitor", ID: c.ID},
				Kind:    KindCompetitorNoCard, Params: map[string]string{"competitor": label(c)},
			})
		}
		if hasResult && r.TotalTime < 0 {
			out = append(out, Problem{
				ID: "competitor.negtime." + c.ID, Severity: SeverityCritical,
				Subject: Subject{Type: "competitor", ID: c.ID},
				Kind:    KindCompetitorNegativeTime, Params: map[string]string{"competitor": label(c)},
			})
		}
		// Broken order — ambiguous: reached the finish but the sequence is invalid,
		// and no manual terminal status resolves it yet.
		if hasResult && course != nil && len(myPassings) > 0 && !r.MatchedAll && !manualTerminal {
			seq := checkpointList(*course)
			if len(seq) > 0 {
				finishName := seq[len(seq)-1]
				reachedFinish := false
				for _, p := range myPassings {
					if p.Checkpoint == finishName && p.Enabled == 1 {
						reachedFinish = true
						break
					}
				}
				if reachedFinish {
					out = append(out, Problem{
						ID: "competitor.brokenorder." + c.ID, Severity: SeverityCritical,
						Subject: Subject{Type: "competitor", ID: c.ID},
						Kind:    KindCompetitorBrokenOrder, Params: map[string]string{"competitor": label(c)},
					})
				}
			}
		}
	}

	// Stable ordering: critical first, then by the language-neutral id.
	sort.SliceStable(out, func(i, j int) bool {
		si, sj := severityRank(out[i].Severity), severityRank(out[j].Severity)
		if si != sj {
			return si > sj
		}
		return out[i].ID < out[j].ID
	})
	return out
}

// namedEntity pairs an id with a display name for duplicate-name grouping.
type namedEntity struct {
	id   string
	name string
}

func courseNames(courses []models.Course) []namedEntity {
	out := make([]namedEntity, 0, len(courses))
	for _, c := range courses {
		if c.Name != "" {
			out = append(out, namedEntity{id: c.ID, name: c.Name})
		}
	}
	return out
}

func groupNames(groups []models.Group) []namedEntity {
	out := make([]namedEntity, 0, len(groups))
	for _, g := range groups {
		if g.Name != "" {
			out = append(out, namedEntity{id: g.ID, name: g.Name})
		}
	}
	return out
}

// groupByLowerName buckets entities by lowercased name, preserving first-seen
// order within each bucket so the representative element is deterministic.
func groupByLowerName(items []namedEntity) map[string][]namedEntity {
	buckets := make(map[string][]namedEntity)
	for _, it := range items {
		key := strings.ToLower(it.name)
		buckets[key] = append(buckets[key], it)
	}
	return buckets
}

// checkpointList decodes a course's JSON checkpoint-name sequence (nil on a
// malformed value), matching the iOS checkpointList helper.
func checkpointList(course models.Course) []string {
	var list []string
	if err := json.Unmarshal([]byte(course.Checkpoints), &list); err != nil {
		return nil
	}
	return list
}

// fullName is «LastName FirstName» (non-empty parts), matching iOS Competitor.fullName.
func fullName(c models.Competitor) string {
	var parts []string
	if c.LastName != "" {
		parts = append(parts, c.LastName)
	}
	if c.FirstName != "" {
		parts = append(parts, c.FirstName)
	}
	return strings.Join(parts, " ")
}

// label is a competitor identifier «№101 Smith John» — DATA, may be empty when
// there's no bib and no name (the UI substitutes a localized fallback).
func label(c models.Competitor) string {
	var parts []string
	if c.Bib != "" {
		parts = append(parts, "№"+c.Bib)
	}
	if fn := fullName(c); fn != "" {
		parts = append(parts, fn)
	}
	return strings.Join(parts, " ")
}
