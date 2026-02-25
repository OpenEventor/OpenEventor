package importers

import (
	"io"

	"github.com/openeventor/openeventor/internal/models"
)

// DataImporter parses external files into competitor records.
type DataImporter interface {
	Import(reader io.Reader) ([]models.Competitor, error)
	SupportedFormats() []string
}
