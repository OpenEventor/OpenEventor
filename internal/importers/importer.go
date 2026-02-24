package importers

import (
	"io"

	"github.com/openeventor/openeventor/internal/models"
)

// DataImporter parses external files into participant records.
type DataImporter interface {
	Import(reader io.Reader) ([]models.Participant, error)
	SupportedFormats() []string
}
