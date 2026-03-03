package importers

import (
	"fmt"
	"io"

	"github.com/xuri/excelize/v2"
)

// ParseXLSX reads an xlsx file and returns all rows as string slices.
// Uses the first (active) sheet. Normalizes column count across rows.
func ParseXLSX(reader io.Reader) ([][]string, error) {
	f, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, fmt.Errorf("open xlsx: %w", err)
	}
	defer f.Close()

	sheet := f.GetSheetName(f.GetActiveSheetIndex())
	if sheet == "" {
		return nil, fmt.Errorf("no active sheet found")
	}

	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, fmt.Errorf("read rows: %w", err)
	}

	if len(rows) == 0 {
		return [][]string{}, nil
	}

	// Find max column count.
	maxCols := 0
	for _, row := range rows {
		if len(row) > maxCols {
			maxCols = len(row)
		}
	}

	// Normalize: pad short rows with empty strings.
	result := make([][]string, len(rows))
	for i, row := range rows {
		normalized := make([]string, maxCols)
		copy(normalized, row)
		result[i] = normalized
	}

	return result, nil
}
