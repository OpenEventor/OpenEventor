package protocols

// Package protocols builds structured start-list / results protocol documents on
// the fly from already-computed results. It mirrors the iOS
// OpenEventorKit/Sources/OpenEventorStore/ProtocolBuilder.swift: grouping (by
// course or by group, with a parent group combining its whole subtree),
// competition ranking with 1-2-2-4 ties, gap-to-leader / gap-to-previous, points
// (competitor.rating) and DSQ/DNF/DNS placement + print-flag filtering.
//
// Like iOS ProtocolBuilder, this layer carries NO prose and NO localization: it
// emits type/grouping keywords, section names (data) and a machine-readable
// `columns` list. The frontend turns that into a localized preview / PDF. Times
// are milliseconds; start times are unix seconds (0 = unknown).

import (
	"encoding/json"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/openeventor/openeventor/internal/models"
	"github.com/openeventor/openeventor/internal/results"
)

// Type selects which protocol to generate.
type Type string

const (
	TypeStart   Type = "start"   // startlist, ordered by resolved start time
	TypeResults Type = "results" // ranked by result time (points optional)
)

// Grouping selects how competitors are split into sections.
type Grouping string

const (
	GroupingGroup  Grouping = "group"  // one section per group (parent combines subtree)
	GroupingCourse Grouping = "course" // one section per course
)

// Config holds the type/grouping choice and the column/behaviour switches,
// mirroring the iOS ProtocolOptions + the persisted protocol_* settings keys.
type Config struct {
	Type        Type
	Grouping    Grouping
	SelectedIDs map[string]bool // section ids to emit; empty = all

	ShowTeam            bool
	ShowCountry         bool
	ShowStartTime       bool // results: add a start-of-day column
	ShowRank            bool
	ShowComment         bool
	ShowGapToLeader     bool // results only
	ShowGapToPrevious   bool // results only
	UsePoints           bool // sort by rating DESC then time; show «Очки»
	PrintDSQ            bool
	PrintDNF            bool
	PrintDNS            bool
	PageBreakPerSection bool
}

// ConfigFromSettings builds a Config from the event's protocol_* settings,
// replicating the iOS defaults (results/by-group, team on, points on).
func ConfigFromSettings(s map[string]string) Config {
	on := func(key string, dflt bool) bool {
		v, ok := s[key]
		if !ok {
			return dflt
		}
		return v == "1"
	}
	cfg := Config{
		Type:                TypeResults,
		Grouping:            GroupingGroup,
		ShowTeam:            on("protocol_show_team", true),
		ShowCountry:         on("protocol_show_country", false),
		ShowStartTime:       on("protocol_show_start", false),
		ShowRank:            on("protocol_show_rank", false),
		ShowComment:         on("protocol_show_comment", false),
		ShowGapToLeader:     on("protocol_gap_leader", false),
		ShowGapToPrevious:   on("protocol_gap_prev", false),
		UsePoints:           on("protocol_use_points", true),
		PrintDSQ:            on("protocol_print_dsq", false),
		PrintDNF:            on("protocol_print_dnf", false),
		PrintDNS:            on("protocol_print_dns", false),
		PageBreakPerSection: on("protocol_page_break", false),
	}
	if s["protocol_type"] == "start" {
		cfg.Type = TypeStart
	}
	if s["protocol_grouping"] == "course" {
		cfg.Grouping = GroupingCourse
	}
	return cfg
}

// Options echoes the applied switches back to the client (camelCase JSON).
type Options struct {
	ShowTeam            bool `json:"showTeam"`
	ShowCountry         bool `json:"showCountry"`
	ShowStartTime       bool `json:"showStartTime"`
	ShowRank            bool `json:"showRank"`
	ShowComment         bool `json:"showComment"`
	ShowGapToLeader     bool `json:"showGapToLeader"`
	ShowGapToPrevious   bool `json:"showGapToPrevious"`
	UsePoints           bool `json:"usePoints"`
	PrintDSQ            bool `json:"printDsq"`
	PrintDNF            bool `json:"printDnf"`
	PrintDNS            bool `json:"printDns"`
	PageBreakPerSection bool `json:"pageBreakPerSection"`
}

func (c Config) options() Options {
	return Options{
		ShowTeam:            c.ShowTeam,
		ShowCountry:         c.ShowCountry,
		ShowStartTime:       c.ShowStartTime,
		ShowRank:            c.ShowRank,
		ShowComment:         c.ShowComment,
		ShowGapToLeader:     c.ShowGapToLeader,
		ShowGapToPrevious:   c.ShowGapToPrevious,
		UsePoints:           c.UsePoints,
		PrintDSQ:            c.PrintDSQ,
		PrintDNF:            c.PrintDNF,
		PrintDNS:            c.PrintDNS,
		PageBreakPerSection: c.PageBreakPerSection,
	}
}

// Split is one checkpoint split carried on a row (ms from the resolved start).
type Split struct {
	Checkpoint string `json:"checkpoint"`
	Time       int64  `json:"time"`
	Leg        int64  `json:"leg"`
}

// Row is one already-ranked table row. Optional numeric values are pointers so an
// absent value (no place, no official time, gap to the leader, 0 points…) is null
// in JSON rather than a misleading zero.
type Row struct {
	CompetitorID string `json:"competitorId"`

	Place      *int   `json:"place"`      // nil = unranked / non-finisher / start list
	Status     string `json:"status"`     // "OK"/"DSQ"/"DNF"/"DNS"/"NC"; "" for start
	OutOfRank  bool   `json:"outOfRank"`  // ranked out of competition
	IsFinisher bool   `json:"isFinisher"` // ranked OK finisher

	Bib       string `json:"bib"`
	LastName  string `json:"lastName"`
	FirstName string `json:"firstName"`
	Name      string `json:"name"` // "Last First"
	GroupName string `json:"groupName"`
	TeamName  string `json:"teamName"`
	Country   string `json:"country"`
	Rank      string `json:"rank"`
	Comment   string `json:"comment"`
	BirthYear int    `json:"birthYear"` // 0 = unknown

	StartTime     float64  `json:"startTime"`     // unix seconds; 0 = unknown
	TotalTime     *int64   `json:"totalTime"`     // ms; finishers only
	ReferenceTime *int64   `json:"referenceTime"` // ms; non-finisher's finish-for-reference
	GapToLeader   *int64   `json:"gapToLeader"`   // ms; >0 only
	GapToPrev     *int64   `json:"gapToPrev"`     // ms; >0 only
	Points        *float64 `json:"points"`        // competitor rating; nil when 0
	Splits        []Split  `json:"splits,omitempty"`
}

// Section is one group or course, with its title and rows.
type Section struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle,omitempty"`
	Rows     []Row  `json:"rows"`
}

// Document is the full structured protocol, ready for the frontend to render.
type Document struct {
	Type             string    `json:"type"`
	Grouping         string    `json:"grouping"`
	GeneratedAt      string    `json:"generatedAt"` // RFC3339 UTC
	Columns          []string  `json:"columns"`     // ordered active column keys
	ShowGroupColumn  bool      `json:"showGroupColumn"`
	ShowPointsColumn bool      `json:"showPointsColumn"`
	Options          Options   `json:"options"`
	Sections         []Section `json:"sections"`
}

// Build assembles the structured document. `computed` is the full results table
// (results.Compute output) — one entry per competitor. courses/groups/teams
// supply names and the parent-group subtree; passings feed the non-finisher
// reference-finish time.
func Build(
	cfg Config,
	computed []results.CompetitorResult,
	courses []models.Course,
	groups []models.Group,
	teams []models.Team,
	passings []models.Passing,
	generatedAt time.Time,
) Document {
	courseByID := make(map[string]models.Course, len(courses))
	for _, c := range courses {
		if _, ok := courseByID[c.ID]; !ok {
			courseByID[c.ID] = c
		}
	}
	groupByID := make(map[string]models.Group, len(groups))
	for _, g := range groups {
		if _, ok := groupByID[g.ID]; !ok {
			groupByID[g.ID] = g
		}
	}
	teamByID := make(map[string]models.Team, len(teams))
	for _, t := range teams {
		if _, ok := teamByID[t.ID]; !ok {
			teamByID[t.ID] = t
		}
	}

	// Enabled passings grouped by card, and per-competitor time-sorted marks (for
	// the non-finisher reference-finish time only).
	byCard := make(map[string][]models.Passing)
	for _, p := range passings {
		if p.Enabled == 1 {
			byCard[p.Card] = append(byCard[p.Card], p)
		}
	}
	marksFor := func(c models.Competitor) []models.Passing {
		var m []models.Passing
		if c.Card1 != "" {
			m = append(m, byCard[c.Card1]...)
		}
		if c.Card2 != "" {
			m = append(m, byCard[c.Card2]...)
		}
		sort.SliceStable(m, func(i, j int) bool { return m[i].Timestamp < m[j].Timestamp })
		return m
	}

	// Section source list, in the natural order of groups / courses.
	type entry struct{ id, title string }
	var order []entry
	if cfg.Grouping == GroupingCourse {
		for _, c := range courses {
			order = append(order, entry{c.ID, c.Name})
		}
	} else {
		for _, g := range groups {
			order = append(order, entry{g.ID, g.Name})
		}
	}

	// Course grouping buckets by the resolved (possibly inherited) course id.
	membersByCourse := make(map[string][]results.CompetitorResult)
	if cfg.Grouping == GroupingCourse {
		for _, r := range computed {
			membersByCourse[r.CourseID] = append(membersByCourse[r.CourseID], r)
		}
	}

	selectAll := len(cfg.SelectedIDs) == 0

	// For group grouping, a group nested under another emitted group is absorbed
	// into that ancestor's subtree-combining section, so it must not be emitted on
	// its own (else its competitors appear twice). Compute the emitted-group set.
	emittedGroups := map[string]bool{}
	if cfg.Grouping == GroupingGroup {
		if selectAll {
			for _, g := range groups {
				emittedGroups[g.ID] = true
			}
		} else {
			emittedGroups = cfg.SelectedIDs
		}
	}

	sections := make([]Section, 0, len(order))
	docHasPoints := false
	docHasGroup := false

	for _, e := range order {
		if !selectAll && !cfg.SelectedIDs[e.id] {
			continue
		}
		// Skip a group whose competitors are already covered by an emitted ancestor.
		if cfg.Grouping == GroupingGroup && hasAncestorInSet(e.id, emittedGroups, groupByID) {
			continue
		}
		var members []results.CompetitorResult
		if cfg.Grouping == GroupingCourse {
			members = membersByCourse[e.id]
		} else {
			// A group section pulls in that group plus every group nested under it.
			for _, r := range computed {
				if isInSubtree(r.Competitor.GroupID, e.id, groupByID) {
					members = append(members, r)
				}
			}
		}
		if len(members) == 0 {
			continue
		}

		var rows []Row
		if cfg.Type == TypeStart {
			rows = startRows(members, teamByID)
		} else {
			rows = resultRows(members, cfg, courseByID, teamByID, marksFor)
		}
		if len(rows) == 0 {
			continue
		}
		for i := range rows {
			if rows[i].Points != nil && *rows[i].Points > 0 {
				docHasPoints = true
			}
			if rows[i].GroupName != "" {
				docHasGroup = true
			}
		}
		sections = append(sections, Section{ID: e.id, Title: e.title, Rows: rows})
	}

	showGroupColumn := cfg.Grouping == GroupingCourse && docHasGroup
	showPointsColumn := cfg.Type == TypeResults && cfg.UsePoints && docHasPoints

	return Document{
		Type:             string(cfg.Type),
		Grouping:         string(cfg.Grouping),
		GeneratedAt:      generatedAt.UTC().Format(time.RFC3339),
		Columns:          buildColumns(cfg, showGroupColumn, showPointsColumn),
		ShowGroupColumn:  showGroupColumn,
		ShowPointsColumn: showPointsColumn,
		Options:          cfg.options(),
		Sections:         sections,
	}
}

// startRows orders a section for a start list: assigned start ascending, absent
// starts (0) sink to the bottom, ties broken by bib then name.
func startRows(members []results.CompetitorResult, teamByID map[string]models.Team) []Row {
	sorted := make([]results.CompetitorResult, len(members))
	copy(sorted, members)
	sort.SliceStable(sorted, func(i, j int) bool {
		a, b := sorted[i], sorted[j]
		sa, sb := a.StartTime, b.StartTime
		if sa <= 0 {
			sa = math.MaxFloat64
		}
		if sb <= 0 {
			sb = math.MaxFloat64
		}
		if sa != sb {
			return sa < sb
		}
		if a.Competitor.Bib != b.Competitor.Bib {
			return bibLess(a.Competitor.Bib, b.Competitor.Bib)
		}
		return fullName(a.Competitor) < fullName(b.Competitor)
	})

	rows := make([]Row, 0, len(sorted))
	for _, r := range sorted {
		c := r.Competitor
		rows = append(rows, Row{
			CompetitorID: c.ID,
			Status:       "",
			OutOfRank:    c.OutOfRank != 0,
			Bib:          c.Bib,
			LastName:     c.LastName,
			FirstName:    c.FirstName,
			Name:         fullName(c),
			GroupName:    r.GroupName,
			TeamName:     teamName(teamByID, c.TeamID),
			Country:      c.Country,
			Rank:         c.Rank,
			Comment:      c.Notes,
			BirthYear:    c.BirthYear,
			StartTime:    r.StartTime,
			Points:       pointsPtr(c.Rating),
		})
	}
	return rows
}

// resultRows ranks a section's finishers (competition ranking, 1-2-2-4 ties) and
// appends filtered non-finishers below.
func resultRows(
	members []results.CompetitorResult,
	cfg Config,
	courseByID map[string]models.Course,
	teamByID map[string]models.Team,
	marksFor func(models.Competitor) []models.Passing,
) []Row {
	var finishers, others []results.CompetitorResult
	code := make(map[string]string, len(members))
	for _, r := range members {
		status := r.Status
		finisher := status == "OK" && r.Competitor.OutOfRank == 0
		switch {
		case finisher:
			code[r.Competitor.ID] = "OK"
		case status == "OK": // OK-but-out-of-rank → not counted
			code[r.Competitor.ID] = "NC"
		default:
			code[r.Competitor.ID] = status
		}
		if finisher {
			finishers = append(finishers, r)
		} else {
			others = append(others, r)
		}
	}

	sectionHasPoints := false
	for _, r := range finishers {
		if r.Competitor.Rating > 0 {
			sectionHasPoints = true
			break
		}
	}
	usePoints := cfg.UsePoints && sectionHasPoints

	// Rank: points DESC (optional) → time (tenths) → full ms → bib → name.
	ranked := make([]results.CompetitorResult, len(finishers))
	copy(ranked, finishers)
	sort.SliceStable(ranked, func(i, j int) bool {
		a, b := ranked[i], ranked[j]
		if usePoints && a.Competitor.Rating != b.Competitor.Rating {
			return a.Competitor.Rating > b.Competitor.Rating
		}
		if ta, tb := tenths(a.TotalTime), tenths(b.TotalTime); ta != tb {
			return ta < tb
		}
		if a.TotalTime != b.TotalTime {
			return a.TotalTime < b.TotalTime
		}
		if a.Competitor.Bib != b.Competitor.Bib {
			return bibLess(a.Competitor.Bib, b.Competitor.Bib)
		}
		return fullName(a.Competitor) < fullName(b.Competitor)
	})

	// Competition ranking (1,2,2,4): equal rank key shares a place, then skips.
	sameRank := func(a, b results.CompetitorResult) bool {
		if usePoints && a.Competitor.Rating != b.Competitor.Rating {
			return false
		}
		return tenths(a.TotalTime) == tenths(b.TotalTime)
	}
	places := make([]int, len(ranked))
	for i := range ranked {
		if i > 0 && sameRank(ranked[i], ranked[i-1]) {
			places[i] = places[i-1]
		} else {
			places[i] = i + 1
		}
	}
	var leaderMs int64
	if len(ranked) > 0 {
		leaderMs = ranked[0].TotalTime
	}

	rows := make([]Row, 0, len(members))
	for i, r := range ranked {
		total := r.TotalTime
		prevMs := total
		if i > 0 {
			prevMs = ranked[i-1].TotalTime
		}
		c := r.Competitor
		place := places[i]
		rows = append(rows, Row{
			CompetitorID:  c.ID,
			Place:         &place,
			Status:        "OK",
			IsFinisher:    true,
			Bib:           c.Bib,
			LastName:      c.LastName,
			FirstName:     c.FirstName,
			Name:          fullName(c),
			GroupName:     r.GroupName,
			TeamName:      teamName(teamByID, c.TeamID),
			Country:       c.Country,
			Rank:          c.Rank,
			Comment:       c.Notes,
			BirthYear:     c.BirthYear,
			StartTime:     r.StartTime,
			TotalTime:     int64Ptr(total),
			GapToLeader:   gapPtr(total - leaderMs),
			GapToPrev:     gapPtr(total - prevMs),
			Points:        pointsPtr(c.Rating),
			Splits:        splitsOf(r.Splits),
		})
	}

	// Non-finishers at the bottom: DSQ, DNF, DNS, then NC/other; bib within.
	var bottom []results.CompetitorResult
	for _, r := range others {
		if includedStatus(code[r.Competitor.ID], cfg) {
			bottom = append(bottom, r)
		}
	}
	sort.SliceStable(bottom, func(i, j int) bool {
		a, b := bottom[i], bottom[j]
		if pa, pb := statusPriority(code[a.Competitor.ID]), statusPriority(code[b.Competitor.ID]); pa != pb {
			return pa < pb
		}
		if a.Competitor.Bib != b.Competitor.Bib {
			return bibLess(a.Competitor.Bib, b.Competitor.Bib)
		}
		return fullName(a.Competitor) < fullName(b.Competitor)
	})
	for _, r := range bottom {
		c := r.Competitor
		var course *models.Course
		if r.CourseID != "" {
			if co, ok := courseByID[r.CourseID]; ok {
				course = &co
			}
		}
		rows = append(rows, Row{
			CompetitorID:  c.ID,
			Status:        code[c.ID],
			OutOfRank:     c.OutOfRank != 0,
			Bib:           c.Bib,
			LastName:      c.LastName,
			FirstName:     c.FirstName,
			Name:          fullName(c),
			GroupName:     r.GroupName,
			TeamName:      teamName(teamByID, c.TeamID),
			Country:       c.Country,
			Rank:          c.Rank,
			Comment:       c.Notes,
			BirthYear:     c.BirthYear,
			StartTime:     r.StartTime,
			ReferenceTime: referenceFinishMs(course, r.StartTime, marksFor(c)),
			Points:        pointsPtr(c.Rating),
		})
	}
	return rows
}

// buildColumns returns the ordered, active column keys for the chosen type and
// options — the same set/order the iOS renderer uses.
func buildColumns(cfg Config, showGroup, showPoints bool) []string {
	cols := make([]string, 0, 12)
	if cfg.Type == TypeResults {
		cols = append(cols, "place")
	}
	cols = append(cols, "bib", "lastName", "firstName")
	if showGroup {
		cols = append(cols, "group")
	}
	if cfg.ShowTeam {
		cols = append(cols, "team")
	}
	if cfg.ShowCountry {
		cols = append(cols, "country")
	}
	if cfg.ShowRank {
		cols = append(cols, "rank")
	}
	if cfg.Type == TypeStart {
		if cfg.ShowComment {
			cols = append(cols, "comment")
		}
		return append(cols, "start")
	}
	if cfg.ShowStartTime {
		cols = append(cols, "start")
	}
	cols = append(cols, "result")
	if cfg.ShowGapToLeader {
		cols = append(cols, "gapLeader")
	}
	if cfg.ShowGapToPrevious {
		cols = append(cols, "gapPrev")
	}
	if showPoints {
		cols = append(cols, "points")
	}
	if cfg.ShowComment {
		cols = append(cols, "comment")
	}
	return append(cols, "status")
}

// isInSubtree reports whether groupID is root itself or nested (transitively)
// under it, walking the parentID chain. Cycle-safe; an empty groupID is never in
// any subtree. Mirrors iOS ProtocolBuilder.isInSubtree.
func isInSubtree(groupID, root string, groupByID map[string]models.Group) bool {
	if groupID == "" {
		return false
	}
	current := groupID
	visited := make(map[string]struct{})
	for current != "" {
		if current == root {
			return true
		}
		if _, seen := visited[current]; seen {
			return false // cycle guard
		}
		visited[current] = struct{}{}
		current = groupByID[current].ParentID
	}
	return false
}

// hasAncestorInSet reports whether any ancestor of groupID (via the parentID
// chain) is present in set — i.e. this group's competitors are already covered by
// an emitted ancestor section, so it must not be emitted separately. Cycle-safe.
func hasAncestorInSet(groupID string, set map[string]bool, groupByID map[string]models.Group) bool {
	visited := make(map[string]struct{})
	current := groupByID[groupID].ParentID
	for current != "" {
		if set[current] {
			return true
		}
		if _, seen := visited[current]; seen {
			return false // cycle guard
		}
		visited[current] = struct{}{}
		current = groupByID[current].ParentID
	}
	return false
}

// referenceFinishMs is a non-finisher's finish time "for reference": the first
// punch at the course's last checkpoint at/after the start. nil if none.
func referenceFinishMs(course *models.Course, startRef float64, marks []models.Passing) *int64 {
	if course == nil || startRef <= 0 {
		return nil
	}
	list := checkpointList(*course)
	if len(list) == 0 {
		return nil
	}
	last := list[len(list)-1]
	if last == "" {
		return nil
	}
	for _, p := range marks {
		if p.Checkpoint == last && p.Timestamp >= startRef {
			ms := int64(math.Round((p.Timestamp - startRef) * 1000))
			if ms > 0 {
				return &ms
			}
			return nil
		}
	}
	return nil
}

// checkpointList decodes a course's JSON checkpoint-name sequence (nil on a
// malformed value, matching validation.checkpointList / the iOS behaviour).
func checkpointList(course models.Course) []string {
	var list []string
	if err := json.Unmarshal([]byte(course.Checkpoints), &list); err != nil {
		return nil
	}
	return list
}

// statusPriority orders non-finisher rows: DSQ, DNF, DNS, NC, then anything else.
func statusPriority(code string) int {
	switch code {
	case "DSQ":
		return 0
	case "DNF":
		return 1
	case "DNS":
		return 2
	case "NC":
		return 3
	default:
		return 4
	}
}

// includedStatus reports whether a non-finisher code is printed given the flags.
// NC and anything unrecognised are always listed.
func includedStatus(code string, cfg Config) bool {
	switch code {
	case "DSQ":
		return cfg.PrintDSQ
	case "DNF":
		return cfg.PrintDNF
	case "DNS":
		return cfg.PrintDNS
	default:
		return true
	}
}

func splitsOf(splits []results.SplitTime) []Split {
	if len(splits) == 0 {
		return nil
	}
	out := make([]Split, len(splits))
	for i, s := range splits {
		out[i] = Split{Checkpoint: s.Checkpoint, Time: s.Time, Leg: s.Leg}
	}
	return out
}

func teamName(teamByID map[string]models.Team, id string) string {
	if id == "" {
		return ""
	}
	if t, ok := teamByID[id]; ok {
		return t.Name
	}
	return ""
}

// tenths reduces a millisecond time to tenths of a second: results equal to a
// tenth share a competition place (matches iOS `tenths`).
func tenths(ms int64) int64 { return ms / 100 }

func int64Ptr(v int64) *int64 { return &v }

// gapPtr keeps only a positive gap (iOS shows an empty cell for <= 0).
func gapPtr(v int64) *int64 {
	if v <= 0 {
		return nil
	}
	return &v
}

// pointsPtr treats 0 rating as "no points" (nil), like the iOS points cell.
func pointsPtr(v float64) *float64 {
	if v == 0 {
		return nil
	}
	return &v
}

// fullName joins last and first name the way iOS Competitor.fullName does.
func fullName(c models.Competitor) string {
	parts := make([]string, 0, 2)
	if c.LastName != "" {
		parts = append(parts, c.LastName)
	}
	if c.FirstName != "" {
		parts = append(parts, c.FirstName)
	}
	return strings.Join(parts, " ")
}

// bibLess orders bibs numerically when both parse as ints, lexicographically
// otherwise — stable, matching iOS bibLess.
func bibLess(a, b string) bool {
	if ia, ea := strconv.Atoi(a); ea == nil {
		if ib, eb := strconv.Atoi(b); eb == nil {
			if ia != ib {
				return ia < ib
			}
			return a < b
		}
	}
	return a < b
}
