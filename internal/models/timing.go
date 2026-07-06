package models

// RenameRule maps a raw station/loop code (as it arrives in a punch) to a
// canonical checkpoint name, and shifts that point's clock by ±seconds. Mirrors
// the iOS RenameRule.
type RenameRule struct {
	RawID          string `json:"rawId"`
	Name           string `json:"name"`
	TimeAdjustment int    `json:"timeAdjustment"` // ± seconds applied to punches at this code
}

// TimingSystem is one configured instance of a timing system (universal or
// OSTIS). Several instances of the same kind may exist, but the receive URL is
// fixed per kind (/api/timing/<kind>), so at most one per kind is active
// (Enabled) at a time. Stored globally in system.db.
type TimingSystem struct {
	ID        string       `json:"id"`
	Kind      string       `json:"kind"` // "universal" | "ostis"
	Name      string       `json:"name"`
	EventID   string       `json:"eventId"` // target event, "" = not routed
	Enabled   int          `json:"enabled"` // 0 | 1 (the active instance of its kind)
	Rules     []RenameRule `json:"rules"`
	CreatedAt string       `json:"createdAt"`
}
