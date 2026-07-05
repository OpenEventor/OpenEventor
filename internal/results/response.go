package results

import "strings"

// ResultsResponse is the JSON body returned by GET /api/events/:eventId/results.
type ResultsResponse struct {
	Results []ResultRow `json:"results"`
}

// ResultRow is one competitor's computed result, shaped for the API (camelCase).
type ResultRow struct {
	CompetitorID string     `json:"competitorId"`
	Bib          string     `json:"bib"`
	Name         string     `json:"name"`
	Card         string     `json:"card"`
	CourseID     string     `json:"courseId"`
	CourseName   string     `json:"courseName"`
	GroupID      string     `json:"groupId"`
	GroupName    string     `json:"groupName"`
	StartTime    float64    `json:"startTime"`   // unix seconds; 0 = unknown
	StartSource  string     `json:"startSource"` // competitor|group|course|punch|none
	Status       string     `json:"status"`      // OK|DSQ|DNF|DNS|NC
	TotalTime    int64      `json:"totalTime"`   // milliseconds
	Place        int        `json:"place"`       // 0 = unranked
	OutOfRank    int        `json:"outOfRank"`
	Splits       []SplitDTO `json:"splits"`
}

// SplitDTO is one checkpoint split in the API response.
type SplitDTO struct {
	Checkpoint string `json:"checkpoint"`
	Time       int64  `json:"time"` // milliseconds from the resolved start
	Leg        int64  `json:"leg"`  // milliseconds since the previous split
}

// primaryCard returns the competitor's primary card (card1, or card2 when card1
// is empty).
func primaryCard(card1, card2 string) string {
	if card1 != "" {
		return card1
	}
	return card2
}

// displayName joins last and first name the way iOS Competitor.fullName does.
func displayName(last, first string) string {
	parts := make([]string, 0, 2)
	if last != "" {
		parts = append(parts, last)
	}
	if first != "" {
		parts = append(parts, first)
	}
	return strings.Join(parts, " ")
}

// ToRow converts a computed result into its API row.
func (r CompetitorResult) ToRow() ResultRow {
	splits := make([]SplitDTO, len(r.Splits))
	for i, s := range r.Splits {
		splits[i] = SplitDTO{Checkpoint: s.Checkpoint, Time: s.Time, Leg: s.Leg}
	}
	return ResultRow{
		CompetitorID: r.Competitor.ID,
		Bib:          r.Competitor.Bib,
		Name:         displayName(r.Competitor.LastName, r.Competitor.FirstName),
		Card:         primaryCard(r.Competitor.Card1, r.Competitor.Card2),
		CourseID:     r.CourseID,
		CourseName:   r.CourseName,
		GroupID:      r.GroupID,
		GroupName:    r.GroupName,
		StartTime:    r.StartTime,
		StartSource:  string(r.StartSource),
		Status:       r.Status,
		TotalTime:    r.TotalTime,
		Place:        r.Place,
		OutOfRank:    r.Competitor.OutOfRank,
		Splits:       splits,
	}
}

// ToResponse builds the API response from computed results, applying optional
// filters. filterCourse matches the resolved course id; filterGroup matches the
// competitor's group id. Empty filters match everything.
func ToResponse(computed []CompetitorResult, filterCourse, filterGroup string) ResultsResponse {
	rows := make([]ResultRow, 0, len(computed))
	for _, r := range computed {
		if filterCourse != "" && r.CourseID != filterCourse {
			continue
		}
		if filterGroup != "" && r.GroupID != filterGroup {
			continue
		}
		rows = append(rows, r.ToRow())
	}
	return ResultsResponse{Results: rows}
}
