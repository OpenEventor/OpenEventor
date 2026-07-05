package validation

import (
	"encoding/json"
	"math"
	"sort"

	"github.com/openeventor/openeventor/internal/models"
)

// ValidationResult holds the outcome of course validation for a competitor.
// Times are milliseconds, measured from startRef. Mirrors the iOS
// ValidationOutcome in OpenEventorStore/Results.swift.
type ValidationResult struct {
	Status     string  // OK | DSQ | DNF
	Splits     []Split // ordered split times (matched checkpoints)
	TotalTime  int64   // total time in milliseconds (last split, 0 if none)
	DSQReason  string  // reason if DSQ
	MatchedAll bool    // every course checkpoint was matched in order
}

// Split represents a single matched checkpoint timing.
type Split struct {
	Checkpoint string
	Time       int64 // milliseconds from startRef
}

// CourseValidator validates passings against a course definition.
// startRef is the unix time (seconds) that splits are measured from — the
// resolved start, or the first punch when there is no assigned start.
type CourseValidator interface {
	Validate(course models.Course, startRef float64, passings []models.Passing) ValidationResult
	Name() string
}

// ValidatorFor returns the validator selected by a course's validation mode.
// "relaxed" tolerates missing intermediate checkpoints; anything else (including
// the empty default) is strict orienteering validation.
func ValidatorFor(mode string) CourseValidator {
	if mode == "relaxed" {
		return RelaxedValidator{}
	}
	return StrictValidator{}
}

// checkpointList decodes a course's JSON checkpoint-name sequence. Order is the
// sequence; a repeated name is a lap. Returns nil on a malformed value (matching
// the iOS `checkpointList` which yields [] on decode failure).
func checkpointList(course models.Course) []string {
	var list []string
	if err := json.Unmarshal([]byte(course.Checkpoints), &list); err != nil {
		return nil
	}
	return list
}

// splitMs converts a passing timestamp to milliseconds from startRef, rounding
// half away from zero (matching Swift's Double.rounded()).
func splitMs(timestamp, startRef float64) int64 {
	return int64(math.Round((timestamp - startRef) * 1000))
}

// sortedByTime returns a time-sorted copy of passings, leaving the caller's
// slice untouched.
func sortedByTime(passings []models.Passing) []models.Passing {
	marks := make([]models.Passing, len(passings))
	copy(marks, passings)
	sort.SliceStable(marks, func(i, j int) bool { return marks[i].Timestamp < marks[j].Timestamp })
	return marks
}

// reachedLastControl reports whether the competitor punched the course's last
// checkpoint (the finish, by POSITION in the sequence — not by the name
// "FINISH"). Drives the DNF-vs-DSQ split: no last control → DNF; last control
// present but the sequence is invalid → DSQ.
func reachedLastControl(course models.Course, passings []models.Passing) bool {
	list := checkpointList(course)
	if len(list) == 0 {
		return false
	}
	last := list[len(list)-1]
	for _, p := range passings {
		if p.Checkpoint == last {
			return true
		}
	}
	return false
}

// matchCheckpoints greedily matches time-sorted passings against the course
// checkpoint sequence in order (laps == repeated checkpoints). Extra/out-of-order
// punches are skipped; matchedAll is true only when every checkpoint was consumed.
func matchCheckpoints(course models.Course, startRef float64, passings []models.Passing) (splits []Split, matchedAll bool) {
	expected := checkpointList(course)
	ptr := 0
	for _, p := range sortedByTime(passings) {
		if ptr >= len(expected) {
			break
		}
		if p.Checkpoint == expected[ptr] {
			splits = append(splits, Split{Checkpoint: expected[ptr], Time: splitMs(p.Timestamp, startRef)})
			ptr++
		}
	}
	return splits, ptr == len(expected)
}

// matchTolerant matches each expected checkpoint to the next later punch of that
// name, skipping ones with no punch — so a missing CP1 doesn't hide the FINISH
// time. matchedAll is false when any checkpoint had no punch.
func matchTolerant(course models.Course, startRef float64, passings []models.Passing) (splits []Split, matchedAll bool) {
	expected := checkpointList(course)
	marks := sortedByTime(passings)
	from := 0
	missing := false
	for _, cp := range expected {
		found := false
		for j := from; j < len(marks); j++ {
			if marks[j].Checkpoint == cp {
				splits = append(splits, Split{Checkpoint: cp, Time: splitMs(marks[j].Timestamp, startRef)})
				from = j + 1
				found = true
				break
			}
		}
		if !found {
			missing = true
		}
	}
	return splits, !missing
}

// lastTotal returns the last split's time, or 0 when there are none.
func lastTotal(splits []Split) int64 {
	if len(splits) == 0 {
		return 0
	}
	return splits[len(splits)-1].Time
}

// StrictValidator (orienteering): every checkpoint must be matched in order.
// If not: reached the last control (finish) but out-of-order/missing → DSQ;
// never reached the last control → DNF.
type StrictValidator struct{}

// Name identifies the validator.
func (StrictValidator) Name() string { return "strict" }

// Validate applies strict in-order matching.
func (StrictValidator) Validate(course models.Course, startRef float64, passings []models.Passing) ValidationResult {
	splits, all := matchCheckpoints(course, startRef, passings)
	total := lastTotal(splits)
	if all {
		return ValidationResult{Status: "OK", Splits: splits, TotalTime: total, MatchedAll: true}
	}
	if reachedLastControl(course, passings) {
		return ValidationResult{
			Status: "DSQ", Splits: splits, TotalTime: total,
			DSQReason: "missing or out-of-order checkpoint", MatchedAll: false,
		}
	}
	return ValidationResult{Status: "DNF", Splits: splits, TotalTime: total, MatchedAll: false}
}

// RelaxedValidator (ski racing): a missing intermediate checkpoint is tolerated
// (likely a system glitch), so reaching the finish still counts as OK. Never
// reaching the last control is a DNF, same as strict.
type RelaxedValidator struct{}

// Name identifies the validator.
func (RelaxedValidator) Name() string { return "relaxed" }

// Validate applies order-preserving matching that tolerates missing checkpoints.
func (RelaxedValidator) Validate(course models.Course, startRef float64, passings []models.Passing) ValidationResult {
	splits, all := matchTolerant(course, startRef, passings)
	total := lastTotal(splits)
	if reachedLastControl(course, passings) {
		return ValidationResult{Status: "OK", Splits: splits, TotalTime: total, MatchedAll: all}
	}
	return ValidationResult{Status: "DNF", Splits: splits, TotalTime: total, MatchedAll: false}
}
