package conformance

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// TestProblemCorpusMatchesEngine runs every problems-block case through
// Compute + problems.Scan and checks the detected problems equal the stored expected.
func TestProblemCorpusMatchesEngine(t *testing.T) {
	dir := os.Getenv("OE_CORPUS_DIR")
	if dir == "" {
		t.Skip("OE_CORPUS_DIR not set; point it at the spec conformance/cases dir")
	}
	cases, err := LoadProblems(filepath.Join(dir, "problems"))
	if err != nil {
		t.Fatalf("load problems block from %s: %v", dir, err)
	}
	if len(cases) == 0 {
		t.Fatalf("no problem cases found under %s/problems", dir)
	}
	for _, c := range cases {
		t.Run(c.ID, func(t *testing.T) {
			got := EvaluateProblems(c.Input)
			if !reflect.DeepEqual(got, c.Expected) {
				t.Errorf("problems != expected\n got: %s\nwant: %s", mustJSON(got), mustJSON(c.Expected))
			}
		})
	}
	t.Logf("problems corpus: %d cases matched the Go engine", len(cases))
}
