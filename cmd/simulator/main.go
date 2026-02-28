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
	"time"
)

type passing struct {
	Card       string  `json:"card"`
	Checkpoint string  `json:"checkpoint"`
	Timestamp  float64 `json:"timestamp"`
	Source     string  `json:"source"`
}

func main() {
	serverURL := flag.String("url", "http://localhost:5050", "server base URL")
	eventID := flag.String("event", "", "event ID (required)")
	token := flag.String("token", "", "event token (required)")
	numCards := flag.Int("cards", 10, "number of simulated cards")
	batchSize := flag.Int("batch", 1, "number of passings to send per tick")
	minDelay := flag.Float64("min-delay", 1.0, "minimum delay between sends (seconds)")
	maxDelay := flag.Float64("max-delay", 3.0, "maximum delay between sends (seconds)")
	flag.Parse()

	if *eventID == "" || *token == "" {
		log.Fatal("both -event and -token are required")
	}

	checkpoints := []string{"START", "CP1", "CP2", "CP3", "CP4", "CP5", "FINISH"}

	// Track progress per card: which checkpoint index they're at.
	cardProgress := make(map[string]int)
	cards := make([]string, *numCards)
	for i := range *numCards {
		cards[i] = fmt.Sprintf("%d", 10000+i)
		cardProgress[cards[i]] = 0
	}

	url := fmt.Sprintf("%s/api/events/%s/passings/?token=%s", *serverURL, *eventID, *token)

	log.Printf("Simulator started: %d cards, %d checkpoints, sending to %s", *numCards, len(checkpoints), url)

	for {
		// Pick a random active card.
		active := make([]string, 0)
		for _, card := range cards {
			if cardProgress[card] < len(checkpoints) {
				active = append(active, card)
			}
		}
		if len(active) == 0 {
			log.Println("All cards have finished the course. Exiting.")
			return
		}

		batch := make([]passing, 0, *batchSize)
		for range *batchSize {
			if len(active) == 0 {
				break
			}
			idx := rand.Intn(len(active))
			card := active[idx]
			cpIdx := cardProgress[card]
			checkpoint := checkpoints[cpIdx]
			cardProgress[card]++

			batch = append(batch, passing{
				Card:       card,
				Checkpoint: checkpoint,
				Timestamp:  float64(time.Now().UnixMilli()) / 1000.0,
				Source:     "simulator",
			})

			// Remove card from active if it finished all checkpoints.
			if cardProgress[card] >= len(checkpoints) {
				active = append(active[:idx], active[idx+1:]...)
			}
		}

		if len(batch) == 0 {
			continue
		}

		body, _ := json.Marshal(batch)
		resp, err := http.Post(url, "application/json", bytes.NewReader(body))
		if err != nil {
			log.Printf("Error: %v", err)
		} else {
			respBody, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode == 201 {
				for _, p := range batch {
					log.Printf("card=%s checkpoint=%s", p.Card, p.Checkpoint)
				}
				log.Printf("  sent %d passings (%d/%d active)", len(batch), len(active), *numCards)
			} else {
				log.Printf("Server error %d: %s", resp.StatusCode, string(respBody))
			}
		}

		delay := *minDelay + rand.Float64()*(*maxDelay-*minDelay)
		time.Sleep(time.Duration(delay * float64(time.Second)))
	}
}
