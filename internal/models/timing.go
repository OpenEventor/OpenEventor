package models

// RenameRule maps a raw station/loop code (as it arrives in a punch) to a
// canonical checkpoint name, and shifts that point's clock by ±seconds. Mirrors
// the iOS RenameRule.
type RenameRule struct {
	RawID          string `json:"rawId"`
	Name           string `json:"name"`
	TimeAdjustment int    `json:"timeAdjustment"` // ± seconds applied to punches at this code
}

// TimingSystem is one configured instance of a timing system. Push kinds
// (universal, ostis) receive punches on a fixed URL (/api/timing/<kind>); the
// hub kind instead PULLS punches from an OpenEventor Hub (HubURL) with a
// persisted resume cursor (HubSession/HubCursor). Several instances of the same
// kind may exist, but at most one per kind is active (Enabled) at a time.
// Stored globally in system.db.
type TimingSystem struct {
	ID         string       `json:"id"`
	Kind       string       `json:"kind"` // "universal" | "ostis" | "hub"
	Name       string       `json:"name"`
	EventID    string       `json:"eventId"` // target event, "" = not routed
	Enabled    int          `json:"enabled"` // 0 | 1 (the active instance of its kind)
	Rules      []RenameRule `json:"rules"`
	HubURL     string       `json:"hubUrl"`     // hub kind only: base address of the hub (host[:port] or URL)
	HubSession string       `json:"hubSession"` // hub kind only: session id of the hub log being consumed
	HubCursor  int64        `json:"hubCursor"`  // hub kind only: highest seq already ingested
	CreatedAt  string       `json:"createdAt"`
}
