package conformance

import (
	"os"
	"reflect"
	"testing"
)

// TestCorpusMatchesEngine runs every corpus case through the Core engine and checks
// the output equals the stored expected. It is the Go end of the cross-platform
// conformance suite: Swift and Kotlin runners load the identical JSON cases.
//
// Point OE_CORPUS_DIR at the spec repo's conformance/cases directory, e.g.:
//
//	OE_CORPUS_DIR=../../../spec/conformance/cases go test ./internal/conformance/
//
// Skips when unset so the default `go test ./...` doesn't depend on the spec checkout.
func TestCorpusMatchesEngine(t *testing.T) {
	dir := os.Getenv("OE_CORPUS_DIR")
	if dir == "" {
		t.Skip("OE_CORPUS_DIR not set; point it at the spec conformance/cases dir to run the corpus")
	}
	cases, err := Load(dir)
	if err != nil {
		t.Fatalf("load corpus from %s: %v", dir, err)
	}
	if len(cases) == 0 {
		t.Fatalf("no cases found under %s", dir)
	}
	for _, c := range cases {
		t.Run(c.ID, func(t *testing.T) {
			got := Evaluate(c.Input)
			if !reflect.DeepEqual(got, c.Expected) {
				t.Errorf("engine output != expected\n got: %s\nwant: %s", mustJSON(got), mustJSON(c.Expected))
			}
		})
	}
	t.Logf("corpus: %d cases matched the Go engine", len(cases))
}
