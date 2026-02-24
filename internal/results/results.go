package results

import "github.com/openeventor/openeventor/internal/models"

// ParticipantResult holds computed result for a single participant.
type ParticipantResult struct {
	Participant models.Participant
	CourseName  string
	GroupName   string
	Status      string // OK | DSQ | DNF | DNS
	TotalTime   int64  // milliseconds
	Place       int
	Splits      []SplitTime
}

// SplitTime is a computed split for a checkpoint.
type SplitTime struct {
	Checkpoint string
	Time       int64 // milliseconds from start
}

// ResultsData holds results for rendering or API response.
type ResultsData struct {
	EventName string
	Results   []ParticipantResult
}
