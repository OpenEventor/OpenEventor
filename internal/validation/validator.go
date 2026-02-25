package validation

import "github.com/openeventor/openeventor/internal/models"

// ValidationResult holds the outcome of course validation for a competitor.
type ValidationResult struct {
	Status     string  // OK | DSQ | DNF
	Splits     []Split // ordered split times
	TotalTime  int64   // total time in milliseconds
	DSQReason  string  // reason if DSQ
	MatchedAll bool    // all checkpoints matched
}

// Split represents a single checkpoint timing.
type Split struct {
	Checkpoint string
	Time       int64 // milliseconds from start
}

// CourseValidator validates passings against a course definition.
type CourseValidator interface {
	Validate(course models.Course, passings []models.Passing) ValidationResult
	Name() string
}
