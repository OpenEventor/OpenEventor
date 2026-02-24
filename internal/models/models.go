package models

// User represents a system user (organizer, judge).
type User struct {
	ID           string `json:"id" db:"id"`
	Login        string `json:"login" db:"login"`
	PasswordHash string `json:"-" db:"password_hash"`
	Name         string `json:"name" db:"name"`
	CreatedAt    string `json:"createdAt" db:"created_at"`
}

// Event represents an event entry in system.db.
type Event struct {
	ID          string `json:"id" db:"id"`
	Filename    string `json:"-" db:"filename"`
	DisplayName string `json:"displayName" db:"display_name"`
	Date        string `json:"date" db:"date"`
	Status      string `json:"status" db:"status"`
	CreatedAt   string `json:"createdAt" db:"created_at"`
}

// EventAccess links users to events with a role.
type EventAccess struct {
	EventID string `json:"eventId" db:"event_id"`
	UserID  string `json:"userId" db:"user_id"`
	Role    string `json:"role" db:"role"`
}

// Session stores refresh token data.
type Session struct {
	ID           string `json:"id" db:"id"`
	UserID       string `json:"userId" db:"user_id"`
	RefreshToken string `json:"-" db:"refresh_token"`
	ExpiresAt    string `json:"expiresAt" db:"expires_at"`
	CreatedAt    string `json:"createdAt" db:"created_at"`
}

// Participant in an event.
type Participant struct {
	ID             string `json:"id" db:"id"`
	Bib            string `json:"bib" db:"bib"`
	CardNumber     string `json:"cardNumber" db:"card_number"`
	FirstName      string `json:"firstName" db:"first_name"`
	LastName       string `json:"lastName" db:"last_name"`
	BirthDate      string `json:"birthDate" db:"birth_date"`
	Gender         string `json:"gender" db:"gender"`
	TeamID         string `json:"teamId" db:"team_id"`
	GroupID        string `json:"groupId" db:"group_id"`
	CourseID       string `json:"courseId" db:"course_id"`
	DSQ            int    `json:"dsq" db:"dsq"`
	DSQDescription string `json:"dsqDescription" db:"dsq_description"`
	DNS            int    `json:"dns" db:"dns"`
	DNF            int    `json:"dnf" db:"dnf"`
	Notes          string `json:"notes" db:"notes"`
	CreatedAt      string `json:"createdAt" db:"created_at"`
}

// Team within an event.
type Team struct {
	ID          string `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	Description string `json:"description" db:"description"`
	CreatedAt   string `json:"createdAt" db:"created_at"`
}

// AgeGroup (category) within an event.
type AgeGroup struct {
	ID          string `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	CourseID    string `json:"courseId" db:"course_id"`
	Description string `json:"description" db:"description"`
	SortOrder   int    `json:"sortOrder" db:"sort_order"`
	CreatedAt   string `json:"createdAt" db:"created_at"`
}

// Course defines a route with ordered checkpoints.
type Course struct {
	ID             string `json:"id" db:"id"`
	Name           string `json:"name" db:"name"`
	Checkpoints    string `json:"checkpoints" db:"checkpoints"` // JSON array
	ValidationMode string `json:"validationMode" db:"validation_mode"`
	Description    string `json:"description" db:"description"`
	CreatedAt      string `json:"createdAt" db:"created_at"`
}

// Punch is a timing mark from an external device.
type Punch struct {
	ID           string `json:"id" db:"id"`
	CardNumber   string `json:"cardNumber" db:"card_number"`
	Checkpoint   string `json:"checkpoint" db:"checkpoint"`
	TimestampUTC string `json:"timestamp" db:"timestamp_utc"`
	Enabled      int    `json:"enabled" db:"enabled"`
	Source       string `json:"source" db:"source"`
	CreatedAt    string `json:"createdAt" db:"created_at"`
}

// File is an attachment stored as BLOB in the event DB.
type File struct {
	ID        string `json:"id" db:"id"`
	Name      string `json:"name" db:"name"`
	MimeType  string `json:"mimeType" db:"mime_type"`
	Purpose   string `json:"purpose" db:"purpose"`
	Data      []byte `json:"-" db:"data"`
	CreatedAt string `json:"createdAt" db:"created_at"`
}

// Setting is a key-value pair in the event DB.
type Setting struct {
	Key   string `json:"key" db:"key"`
	Value string `json:"value" db:"value"`
}
