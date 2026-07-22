// ostis-sim — an OSTIS LOOP timing-system emulator.
//
// Streams punches in the OSTIS batch-JSON dialect to the tokenless receive URL
// (default http://localhost:5050/api/timing/ostis) so you can watch them flow
// into the split monitor live.
//
// By default it discovers what to send from the server: it finds the
// currently-active OSTIS system's target event, and uses that event's
// competitor chips (card1/card2) and checkpoint names. Override any of that with
// flags (the API is open — no auth).
//
//	go run ./cmd/ostis-sim                       # auto-discover, stream forever-ish
//	go run ./cmd/ostis-sim -interval 300ms -max 8
//	go run ./cmd/ostis-sim -chips 7203114,7203115 -loops 31,32,FINISH
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"time"
)

func main() {
	var (
		url      = flag.String("url", "http://localhost:5050/api/timing/ostis", "OSTIS receive endpoint")
		apiBase  = flag.String("api", "http://localhost:5050", "API base (to auto-discover chips & checkpoints)")
		event    = flag.String("event", "", "event id (default: the active OSTIS system's event)")
		chipsCSV = flag.String("chips", "", "comma-separated chips (skips discovery when set)")
		loopsCSV = flag.String("loops", "TY5TEVFA,TD6WRF4Q", "comma-separated OSTIS station/loop codes, in order")
		interval = flag.Duration("interval", 700*time.Millisecond, "delay between punches")
		maxChips = flag.Int("max", 0, "use at most N chips (0 = all)")
		rounds   = flag.Int("rounds", 3, "how many times to run the whole checkpoint sequence (0 = forever)")
		shuffle  = flag.Bool("shuffle", true, "shuffle chip order on each checkpoint")
	)
	flag.Parse()

	chips := splitCSV(*chipsCSV)
	loops := splitCSV(*loopsCSV)

	// Discover competitor chips from the active OSTIS event unless -chips was given.
	if len(chips) == 0 {
		evID := *event
		var err error
		if evID == "" {
			evID, err = activeOstisEvent(*apiBase)
			if err != nil {
				log.Fatalf("%v", err)
			}
		}
		chips, err = eventCards(*apiBase, evID)
		if err != nil || len(chips) == 0 {
			log.Fatalf("no competitor chips in event %s (%v); pass -chips", evID, err)
		}
	}

	if *maxChips > 0 && *maxChips < len(chips) {
		chips = chips[:*maxChips]
	}

	log.Printf("OSTIS emulator → %s", *url)
	log.Printf("  %d chips, checkpoints %v, every %s", len(chips), loops, *interval)

	client := &http.Client{Timeout: 5 * time.Second}
	sent, ok := 0, 0

	for round := 0; *rounds == 0 || round < *rounds; round++ {
		for _, loop := range loops {
			order := append([]string(nil), chips...)
			if *shuffle {
				rand.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })
			}
			for _, chip := range order {
				ts := float64(time.Now().UnixMilli()) / 1000.0
				// arr[0] loop_uid = the station code, so each batch reads as if from that station.
				status, reply := post(client, *url, ostisBatch(loop, loop, chip, ts))
				sent++
				if strings.Contains(reply, `"ok":true`) {
					ok++
				}
				log.Printf("  chip %-12s @ %-8s → %s %s", chip, loop, status, strings.TrimSpace(reply))
				time.Sleep(*interval)
			}
		}
	}
	log.Printf("done: %d sent, %d accepted", sent, ok)
}

// ostisBatch builds the OSTIS LOOP array:
//
//	["<uid>", <loop>, <device_ts>, [["<chip>", <loop>, "<utc_time>", 95,0,3,-70]]]
func ostisBatch(uid, loop, chip string, ts float64) []byte {
	split := []interface{}{chip, loop, fmt.Sprintf("%.2f", ts), 95, 0, 3, -70}
	batch := []interface{}{uid, loop, int64(ts), []interface{}{split}}
	b, _ := json.Marshal(batch)
	return b
}

func post(client *http.Client, url string, body []byte) (string, string) {
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return "ERR", err.Error()
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.Status, string(b)
}

// ── discovery helpers (open API, no auth) ───────────────────────────────────

func getJSON(apiBase, path string, dst interface{}) error {
	resp, err := http.Get(apiBase + path)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("GET %s → HTTP %d", path, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(dst)
}

func activeOstisEvent(apiBase string) (string, error) {
	var systems []struct {
		Kind    string `json:"kind"`
		Enabled int    `json:"enabled"`
		EventID string `json:"eventId"`
		Name    string `json:"name"`
	}
	if err := getJSON(apiBase, "/api/timing-systems", &systems); err != nil {
		return "", err
	}
	for _, s := range systems {
		if s.Kind == "ostis" && s.Enabled == 1 {
			if s.EventID == "" {
				return "", fmt.Errorf("active OSTIS system %q has no event selected — pick one in /timing", s.Name)
			}
			return s.EventID, nil
		}
	}
	return "", fmt.Errorf("no active OSTIS system — add one and toggle it active in /timing")
}

func eventCards(apiBase, eventID string) ([]string, error) {
	var comps []struct {
		Card1 string `json:"card1"`
		Card2 string `json:"card2"`
	}
	if err := getJSON(apiBase, "/api/events/"+eventID+"/competitors", &comps); err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var cards []string
	for _, c := range comps {
		for _, card := range []string{c.Card1, c.Card2} {
			if card != "" && !seen[card] {
				seen[card] = true
				cards = append(cards, card)
			}
		}
	}
	return cards, nil
}

func splitCSV(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}
