package reports

import "github.com/openeventor/openeventor/internal/results"

// RenderOptions controls report output.
type RenderOptions struct {
	FilterCourse string
	FilterGroup  string
	Title        string
}

// ReportRenderer produces a report in a specific format.
type ReportRenderer interface {
	Render(data results.ResultsData, opts RenderOptions) ([]byte, error)
	Format() string // e.g. "xlsx", "csv"
}
