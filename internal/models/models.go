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

// Competitor in an event.
type Competitor struct {
	ID       string `json:"id" db:"id"`
	Bib      string `json:"bib" db:"bib"`
	Card     string `json:"card" db:"card"`
	TeamID   string `json:"teamId" db:"team_id"`
	GroupID  string `json:"groupId" db:"group_id"`
	CourseID string `json:"courseId" db:"course_id"`

	FirstName    string `json:"firstName" db:"first_name"`
	LastName     string `json:"lastName" db:"last_name"`
	MiddleName   string `json:"middleName" db:"middle_name"`
	FirstNameInt string `json:"firstNameInt" db:"first_name_int"`
	LastNameInt  string `json:"lastNameInt" db:"last_name_int"`
	Gender       string `json:"gender" db:"gender"`
	BirthDate    string `json:"birthDate" db:"birth_date"`
	BirthYear    int    `json:"birthYear" db:"birth_year"`

	Rank   string  `json:"rank" db:"rank"`
	Rating float64 `json:"rating" db:"rating"`

	Country string `json:"country" db:"country"`
	Region  string `json:"region" db:"region"`
	City    string `json:"city" db:"city"`

	Phone string `json:"phone" db:"phone"`
	Email string `json:"email" db:"email"`

	StartTime      string `json:"startTime" db:"start_time"`
	TimeAdjustment int    `json:"timeAdjustment" db:"time_adjustment"`

	DSQ            int    `json:"dsq" db:"dsq"`
	DSQDescription string `json:"dsqDescription" db:"dsq_description"`
	DNS            int    `json:"dns" db:"dns"`
	DNF            int    `json:"dnf" db:"dnf"`
	OutOfRank      int    `json:"outOfRank" db:"out_of_rank"`

	EntryNumber string  `json:"entryNumber" db:"entry_number"`
	Price       float64 `json:"price" db:"price"`
	IsPaid      int     `json:"isPaid" db:"is_paid"`
	IsCheckin   int     `json:"isCheckin" db:"is_checkin"`

	Notes     string `json:"notes" db:"notes"`
	CreatedAt string `json:"createdAt" db:"created_at"`
	UpdatedAt string `json:"updatedAt" db:"updated_at"`
}

// Team within an event.
type Team struct {
	ID          string `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	Country     string `json:"country" db:"country"`
	Region      string `json:"region" db:"region"`
	City        string `json:"city" db:"city"`
	Description string `json:"description" db:"description"`
	CreatedAt   string `json:"createdAt" db:"created_at"`
	UpdatedAt   string `json:"updatedAt" db:"updated_at"`
}

// Group (category) within an event.
type Group struct {
	ID       string `json:"id" db:"id"`
	Name     string `json:"name" db:"name"`
	CourseID string `json:"courseId" db:"course_id"`
	ParentID string `json:"parentId" db:"parent_id"`

	Gender   string `json:"gender" db:"gender"`
	YearFrom int    `json:"yearFrom" db:"year_from"`
	YearTo   int    `json:"yearTo" db:"year_to"`

	StartTime string  `json:"startTime" db:"start_time"`
	Price     float64 `json:"price" db:"price"`

	Description string `json:"description" db:"description"`
	SortOrder   int    `json:"sortOrder" db:"sort_order"`
	CreatedAt   string `json:"createdAt" db:"created_at"`
	UpdatedAt   string `json:"updatedAt" db:"updated_at"`
}

// Course defines a route with ordered checkpoints.
type Course struct {
	ID             string `json:"id" db:"id"`
	Name           string `json:"name" db:"name"`
	Checkpoints    string `json:"checkpoints" db:"checkpoints"` // JSON array
	ValidationMode string `json:"validationMode" db:"validation_mode"`

	GeoTrack string  `json:"geoTrack" db:"geo_track"` // GeoJSON
	Length   float64 `json:"length" db:"length"`       // meters
	Altitude float64 `json:"altitude" db:"altitude"`   // max altitude, meters
	Climb    float64 `json:"climb" db:"climb"`         // elevation gain, meters

	StartTime string  `json:"startTime" db:"start_time"`
	Price     float64 `json:"price" db:"price"`

	Description string `json:"description" db:"description"`
	CreatedAt   string `json:"createdAt" db:"created_at"`
	UpdatedAt   string `json:"updatedAt" db:"updated_at"`
}

// Passing is a timing mark from an external device.
type Passing struct {
	ID           string `json:"id" db:"id"`
	Card         string `json:"card" db:"card"`
	Checkpoint   string `json:"checkpoint" db:"checkpoint"`
	TimestampUTC string `json:"timestamp" db:"timestamp_utc"`
	Enabled      int    `json:"enabled" db:"enabled"`
	Source       string `json:"source" db:"source"`
	CreatedAt    string `json:"createdAt" db:"created_at"`
	UpdatedAt    string `json:"updatedAt" db:"updated_at"`
}

// Checkin records a check-in status change for a competitor.
type Checkin struct {
	ID           string `json:"id" db:"id"`
	CompetitorID string `json:"competitorId" db:"competitor_id"`
	UserID        string `json:"userId" db:"user_id"`
	Status        int    `json:"status" db:"status"` // 1 = checked in, 0 = unchecked
	CreatedAt     string `json:"createdAt" db:"created_at"`
}

// Payment records a payment or refund for a competitor.
type Payment struct {
	ID           string  `json:"id" db:"id"`
	CompetitorID string  `json:"competitorId" db:"competitor_id"`
	UserID        string  `json:"userId" db:"user_id"`
	Amount        float64 `json:"amount" db:"amount"` // positive = payment, negative = refund
	CreatedAt     string  `json:"createdAt" db:"created_at"`
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
