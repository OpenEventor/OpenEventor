package results

import (
	"sort"

	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/validation"
)

// Results are ALWAYS computed on the fly, never stored. This package mirrors the
// iOS engine in OpenEventorKit/Sources/OpenEventorStore/Results.swift
// (CourseResolver, StartResolver, ResultsEngine). Times are milliseconds.

// StartSource records where a competitor's start time was resolved from, in
// priority order.
type StartSource string

const (
	StartSourceCompetitor StartSource = "competitor" // set on the competitor
	StartSourceGroup      StartSource = "group"      // inherited from the group
	StartSourceCourse     StartSource = "course"     // inherited from the course
	StartSourcePunch      StartSource = "punch"      // no assigned time — first punch
	StartSourceNone       StartSource = "none"       // no start anywhere
)

// ResolvedStart is the outcome of start-time resolution.
type ResolvedStart struct {
	Time   float64     // unix seconds; 0 when unknown
	Source StartSource
}

// SplitTime is a computed split for a checkpoint. Time is absolute from the start
// reference; Leg is the delta from the previous split (first leg from the start).
type SplitTime struct {
	Checkpoint string
	Time       int64 // milliseconds from the resolved start
	Leg        int64 // milliseconds since the previous split
}

// CompetitorResult holds the computed result row for a single competitor.
// Status is OK | DSQ | DNF | DNS | NC (no course). Place 0 means unranked.
type CompetitorResult struct {
	Competitor  models.Competitor
	CourseID    string
	CourseName  string
	GroupID     string
	GroupName   string
	StartTime   float64
	StartSource StartSource
	Status      string
	TotalTime   int64 // milliseconds
	Place       int   // 0 = unranked
	Splits      []SplitTime
	MatchedAll  bool
}

// ResultsData holds results for rendering or API response.
type ResultsData struct {
	EventName string
	Results   []CompetitorResult
}

// GroupCourseID returns the effective course id for a group, following the
// parentID chain until a course is found or the root is reached. Empty when
// neither the group nor any ancestor has one. Cycle-safe.
func GroupCourseID(group *models.Group, groups []models.Group) string {
	if group == nil {
		return ""
	}
	byID := make(map[string]models.Group, len(groups))
	for _, g := range groups {
		if _, ok := byID[g.ID]; !ok {
			byID[g.ID] = g
		}
	}
	current := group
	visited := make(map[string]struct{})
	for current != nil {
		if current.CourseID != "" {
			return current.CourseID
		}
		if _, seen := visited[current.ID]; seen {
			return "" // cycle guard
		}
		visited[current.ID] = struct{}{}
		if current.ParentID == "" {
			return ""
		}
		parent, ok := byID[current.ParentID]
		if !ok {
			return ""
		}
		current = &parent
	}
	return ""
}

// ResolvedCourseID returns a competitor's scoring course id: the group's
// (inherited) course if any, otherwise the competitor's own course id.
func ResolvedCourseID(comp models.Competitor, group *models.Group, groups []models.Group) string {
	if gc := GroupCourseID(group, groups); gc != "" {
		return gc
	}
	return comp.CourseID
}

// ResolveStart resolves the start time used for a competitor: competitor → group
// → course → first punch → none. firstPunch is nil when the competitor has no
// punches. A start time of 0 means unassigned.
func ResolveStart(comp models.Competitor, group *models.Group, course *models.Course, firstPunch *float64) ResolvedStart {
	if comp.StartTime > 0 {
		return ResolvedStart{Time: comp.StartTime, Source: StartSourceCompetitor}
	}
	if group != nil && group.StartTime > 0 {
		return ResolvedStart{Time: group.StartTime, Source: StartSourceGroup}
	}
	if course != nil && course.StartTime > 0 {
		return ResolvedStart{Time: course.StartTime, Source: StartSourceCourse}
	}
	if firstPunch != nil && *firstPunch > 0 {
		return ResolvedStart{Time: *firstPunch, Source: StartSourcePunch}
	}
	return ResolvedStart{Time: 0, Source: StartSourceNone}
}

// Compute builds the full results table for an event on the fly, mirroring
// iOS ResultsEngine.compute.
func Compute(
	competitors []models.Competitor,
	courses []models.Course,
	groups []models.Group,
	passings []models.Passing,
) []CompetitorResult {
	courseByID := make(map[string]models.Course, len(courses))
	for _, co := range courses {
		if _, ok := courseByID[co.ID]; !ok {
			courseByID[co.ID] = co
		}
	}
	groupByID := make(map[string]models.Group, len(groups))
	for _, g := range groups {
		if _, ok := groupByID[g.ID]; !ok {
			groupByID[g.ID] = g
		}
	}

	// Enabled passings grouped by card.
	byCard := make(map[string][]models.Passing)
	for _, p := range passings {
		if p.Enabled == 1 {
			byCard[p.Card] = append(byCard[p.Card], p)
		}
	}

	results := make([]CompetitorResult, 0, len(competitors))

	for _, comp := range competitors {
		var group *models.Group
		if comp.GroupID != "" {
			if g, ok := groupByID[comp.GroupID]; ok {
				group = &g
			}
		}

		courseID := ResolvedCourseID(comp, group, groups)
		var course *models.Course
		if courseID != "" {
			if co, ok := courseByID[courseID]; ok {
				course = &co
			}
		}

		// Passings from both chip slots, merged and ordered by [sortOrder, timestamp].
		var marks []models.Passing
		if comp.Card1 != "" {
			marks = append(marks, byCard[comp.Card1]...)
		}
		if comp.Card2 != "" {
			marks = append(marks, byCard[comp.Card2]...)
		}
		// sortOrder carries the chip's physical punch sequence (SF-R/SportIdent), so a
		// desynced station yields a negative split but not a false out-of-order DSQ.
		// Default sortOrder 0 for every punch → this reduces to pure time order.
		sort.SliceStable(marks, func(i, j int) bool {
			if marks[i].SortOrder != marks[j].SortOrder {
				return marks[i].SortOrder < marks[j].SortOrder
			}
			return marks[i].Timestamp < marks[j].Timestamp
		})

		var firstPunch *float64
		if len(marks) > 0 {
			firstPunch = &marks[0].Timestamp
		}
		start := ResolveStart(comp, group, course, firstPunch)

		status := "NC"
		var total int64
		matchedAll := false
		var splits []SplitTime

		if course != nil {
			outcome := validation.ValidatorFor(course.ValidationMode).Validate(*course, start.Time, marks)
			status = outcome.Status
			total = outcome.TotalTime
			matchedAll = outcome.MatchedAll
			splits = withLegs(outcome.Splits)
		}

		// Manual status flags override the computed status. Strongest wins:
		// DSQ > DNF > DNS. DNF/DNS zero the total.
		if comp.DSQ == 1 {
			status = "DSQ"
		} else if comp.DNF == 1 {
			status = "DNF"
			total = 0
		} else if comp.DNS == 1 {
			status = "DNS"
			total = 0
		}

		// Penalty/handicap (seconds) applies only to a valid finish.
		if status == "OK" {
			total += int64(comp.TimeAdjustment) * 1000
		}

		courseName := ""
		if course != nil {
			courseName = course.Name
		}
		groupName := ""
		if group != nil {
			groupName = group.Name
		}

		results = append(results, CompetitorResult{
			Competitor:  comp,
			CourseID:    courseID,
			CourseName:  courseName,
			GroupID:     comp.GroupID,
			GroupName:   groupName,
			StartTime:   start.Time,
			StartSource: start.Source,
			Status:      status,
			TotalTime:   total,
			Place:       0,
			Splits:      splits,
			MatchedAll:  matchedAll,
		})
	}

	assignPlaces(results)
	sortForDisplay(results)
	return results
}

// withLegs annotates absolute splits with per-leg deltas (first leg from the
// resolved start).
func withLegs(splits []validation.Split) []SplitTime {
	if len(splits) == 0 {
		return nil
	}
	out := make([]SplitTime, len(splits))
	var prev int64
	for i, s := range splits {
		out[i] = SplitTime{Checkpoint: s.Checkpoint, Time: s.Time, Leg: s.Time - prev}
		prev = s.Time
	}
	return out
}

// assignPlaces ranks, within each resolved course, only OK & in-rank competitors
// by ascending total time (place 1..n); everyone else keeps place 0.
func assignPlaces(results []CompetitorResult) {
	byCourse := make(map[string][]int)
	for i := range results {
		byCourse[results[i].CourseID] = append(byCourse[results[i].CourseID], i)
	}
	for _, idxs := range byCourse {
		ranked := make([]int, 0, len(idxs))
		for _, i := range idxs {
			if results[i].Status == "OK" && results[i].Competitor.OutOfRank == 0 {
				ranked = append(ranked, i)
			}
		}
		sort.SliceStable(ranked, func(a, b int) bool {
			return results[ranked[a]].TotalTime < results[ranked[b]].TotalTime
		})
		for place, i := range ranked {
			results[i].Place = place + 1
		}
	}
}

// sortForDisplay orders results by course name, ranked first, then the rest by
// total time (mirrors iOS's stable display order).
func sortForDisplay(results []CompetitorResult) {
	sort.SliceStable(results, func(i, j int) bool {
		a, b := results[i], results[j]
		if a.CourseName != b.CourseName {
			return a.CourseName < b.CourseName
		}
		ap, bp := a.Place, b.Place
		if ap == 0 {
			ap = int(^uint(0) >> 1) // max int
		}
		if bp == 0 {
			bp = int(^uint(0) >> 1)
		}
		if ap != bp {
			return ap < bp
		}
		return a.TotalTime < b.TotalTime
	})
}
