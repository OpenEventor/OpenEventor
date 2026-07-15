package conformance

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// TestProtocolCorpusMatchesEngine runs every protocol-block case through
// Compute + protocols.Build and checks the document equals the stored expected.
// Same OE_CORPUS_DIR contract as the results runner. Swift/Kotlin load the same cases.
func TestProtocolCorpusMatchesEngine(t *testing.T) {
	dir := os.Getenv("OE_CORPUS_DIR")
	if dir == "" {
		t.Skip("OE_CORPUS_DIR not set; point it at the spec conformance/cases dir")
	}
	cases, err := LoadProtocols(filepath.Join(dir, "protocols"))
	if err != nil {
		t.Fatalf("load protocols block from %s: %v", dir, err)
	}
	if len(cases) == 0 {
		t.Fatalf("no protocol cases found under %s/protocols", dir)
	}
	for _, c := range cases {
		t.Run(c.ID, func(t *testing.T) {
			got := EvaluateProtocol(c.Input)
			if !reflect.DeepEqual(got, c.Expected) {
				t.Errorf("protocol document != expected\n got: %s\nwant: %s", mustJSON(got), mustJSON(c.Expected))
			}
		})
	}
	t.Logf("protocols corpus: %d cases matched the Go engine", len(cases))
}
