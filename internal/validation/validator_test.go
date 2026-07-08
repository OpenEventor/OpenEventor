package validation

import (
	"testing"

	"github.com/openeventor/openeventor/internal/models"
)

func p(card, cp string, ts float64) models.Passing {
	return models.Passing{Card: card, Checkpoint: cp, Timestamp: ts, Enabled: 1}
}

func TestValidatorFor(t *testing.T) {
	if ValidatorFor("relaxed").Name() != "relaxed" {
		t.Error("relaxed mode should select RelaxedValidator")
	}
	if ValidatorFor("strict").Name() != "strict" {
		t.Error("strict mode should select StrictValidator")
	}
	if ValidatorFor("").Name() != "strict" {
		t.Error("empty mode should default to strict")
	}
}

func TestStrictValidator(t *testing.T) {
	crs := models.Course{Checkpoints: `["31","32","FINISH"]`, ValidationMode: "strict"}
	cases := []struct {
		name       string
		passings   []models.Passing
		wantStatus string
		wantAll    bool
		wantTotal  int64
	}{
		{
			name:       "clean finish",
			passings:   []models.Passing{p("1", "31", 1010), p("1", "32", 1020), p("1", "FINISH", 1090)},
			wantStatus: "OK", wantAll: true, wantTotal: 90000,
		},
		{
			name:       "out of order but reached finish -> DSQ",
			passings:   []models.Passing{p("1", "32", 1010), p("1", "31", 1020), p("1", "FINISH", 1090)},
			wantStatus: "DSQ", wantAll: false, wantTotal: 20000, // only 31 matched (at 1020)
		},
		{
			name:       "missing finish -> DNF",
			passings:   []models.Passing{p("1", "31", 1010), p("1", "32", 1020)},
			wantStatus: "DNF", wantAll: false, wantTotal: 20000,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := StrictValidator{}.Validate(crs, 1000, tc.passings)
			if got.Status != tc.wantStatus {
				t.Errorf("status = %q, want %q", got.Status, tc.wantStatus)
			}
			if got.MatchedAll != tc.wantAll {
				t.Errorf("matchedAll = %v, want %v", got.MatchedAll, tc.wantAll)
			}
			if got.TotalTime != tc.wantTotal {
				t.Errorf("totalTime = %d, want %d", got.TotalTime, tc.wantTotal)
			}
		})
	}
}

func TestRelaxedValidator_MissingIntermediate(t *testing.T) {
	crs := models.Course{Checkpoints: `["31","32","FINISH"]`, ValidationMode: "relaxed"}
	// 32 missing, but FINISH reached -> OK, matchedAll false, FINISH time still counted.
	got := RelaxedValidator{}.Validate(crs, 1000, []models.Passing{p("1", "31", 1010), p("1", "FINISH", 1090)})
	if got.Status != "OK" {
		t.Fatalf("status = %q, want OK", got.Status)
	}
	if got.MatchedAll {
		t.Errorf("matchedAll = true, want false")
	}
	if got.TotalTime != 90000 {
		t.Errorf("totalTime = %d, want 90000 (FINISH not hidden by missing 32)", got.TotalTime)
	}
	if len(got.Splits) != 2 {
		t.Errorf("splits = %d, want 2 (31 + FINISH)", len(got.Splits))
	}
}

func TestRelaxedValidator_NoFinishIsDNF(t *testing.T) {
	crs := models.Course{Checkpoints: `["31","FINISH"]`, ValidationMode: "relaxed"}
	got := RelaxedValidator{}.Validate(crs, 1000, []models.Passing{p("1", "31", 1010)})
	if got.Status != "DNF" {
		t.Errorf("status = %q, want DNF", got.Status)
	}
}

// pso builds an enabled passing carrying an explicit sortOrder (the chip's physical
// punch sequence, as stamped by an SF-R/SportIdent reader).
func pso(cp string, ts float64, so int) models.Passing {
	return models.Passing{Card: "1", Checkpoint: cp, Timestamp: ts, Enabled: 1, SortOrder: so}
}

// A desynced station reports a time earlier than the previous control, so a pure
// time-sort would reorder the punches and DSQ a clean run. sortOrder carries the
// chip's physical sequence and must rescue it — a negative split, but not a false
// out-of-order DSQ. See the PUNCH spec.
func TestStrictValidatorHonorsSortOrder(t *testing.T) {
	crs := models.Course{Checkpoints: `["31","32","FINISH"]`, ValidationMode: "strict"}

	// Chip order 31 → 32 → FINISH, but station 32 is desynced (1010 < 31's 1020).
	desynced := []models.Passing{
		pso("31", 1020, 1),
		pso("32", 1010, 2),
		pso("FINISH", 1090, 3),
	}
	got := StrictValidator{}.Validate(crs, 1000, desynced)
	if got.Status != "OK" || !got.MatchedAll {
		t.Errorf("with chip sortOrder: status=%q matchedAll=%v, want OK/true", got.Status, got.MatchedAll)
	}
	if got.TotalTime != 90000 {
		t.Errorf("totalTime = %d, want 90000 (FINISH at 1090)", got.TotalTime)
	}

	// The very same punches without sortOrder (all 0) fall back to time order and
	// DSQ — proving it is sortOrder, not the timestamps, that saves the run.
	timeOnly := []models.Passing{
		p("1", "31", 1020),
		p("1", "32", 1010),
		p("1", "FINISH", 1090),
	}
	if got := (StrictValidator{}).Validate(crs, 1000, timeOnly); got.Status != "DSQ" {
		t.Errorf("without sortOrder: status=%q, want DSQ", got.Status)
	}
}
