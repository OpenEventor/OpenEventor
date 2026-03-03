package importers

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"io"
	"strings"
)

// ParseCSV reads a CSV file and returns all rows as string slices.
// Auto-detects delimiter (comma, semicolon, tab) by counting occurrences in the first line.
func ParseCSV(reader io.Reader) ([][]string, error) {
	// Buffer the reader so we can peek at the first line for delimiter detection.
	buf := bufio.NewReader(reader)
	firstLine, err := buf.ReadString('\n')
	if err != nil && err != io.EOF {
		return nil, fmt.Errorf("read first line: %w", err)
	}
	if strings.TrimSpace(firstLine) == "" {
		return [][]string{}, nil
	}

	delimiter := detectDelimiter(firstLine)

	// Reconstruct the full reader (first line + rest).
	combined := io.MultiReader(strings.NewReader(firstLine), buf)

	r := csv.NewReader(combined)
	r.Comma = delimiter
	r.LazyQuotes = true
	r.FieldsPerRecord = -1 // allow variable field count

	rows, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parse csv: %w", err)
	}

	if len(rows) == 0 {
		return [][]string{}, nil
	}

	// Normalize column count.
	maxCols := 0
	for _, row := range rows {
		if len(row) > maxCols {
			maxCols = len(row)
		}
	}
	for i, row := range rows {
		if len(row) < maxCols {
			padded := make([]string, maxCols)
			copy(padded, row)
			rows[i] = padded
		}
	}

	return rows, nil
}

// detectDelimiter counts occurrences of common delimiters in a line
// and returns the most likely one.
func detectDelimiter(line string) rune {
	candidates := []rune{'\t', ';', ','}
	maxCount := 0
	best := ','

	for _, d := range candidates {
		count := strings.Count(line, string(d))
		if count > maxCount {
			maxCount = count
			best = d
		}
	}

	return best
}
