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
