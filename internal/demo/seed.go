package demo

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/database"
)

// SeedDemoEventIfEmpty creates the golden-master demo event (the same fixture the
// iOS app ships) when the system has no events yet — so a fresh install opens
// with a fully-populated event to explore. No-op once any event exists.
func SeedDemoEventIfEmpty(m *database.Manager) error {
	sysDB := m.SystemDB()

	var count int
	if err := sysDB.QueryRow("SELECT COUNT(*) FROM events").Scan(&count); err != nil {
		return fmt.Errorf("count events: %w", err)
	}
	if count > 0 {
		return nil
	}

	var userID string
	if err := sysDB.QueryRow("SELECT id FROM users ORDER BY created_at LIMIT 1").Scan(&userID); err != nil {
		return fmt.Errorf("no user to own the demo event: %w", err)
	}

	// A recent base so the split monitor looks live (competitor 101 carries the
	// latest punch and tops the monitor).
	base := float64(time.Now().Unix()) - 7200
	fx := Build(base)

	eventID := uuid.New().String()
	filename := "event_" + eventID + ".db"
	token, err := randomToken()
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)

	eventDB, err := m.CreateEventDB(eventID)
	if err != nil {
		return fmt.Errorf("create demo event db: %w", err)
	}

	set := func(k, v string) { _, _ = eventDB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", k, v) }
	set("display_name", "Demo Event")
	set("date", "2026-06-14")
	set("place", "Springfield")
	set("director", "John Director")
	set("chief_judge", "Sarah Judge")
	set("chief_secretary", "Mia Secretary")
	set("timezone", "Europe/Moscow")
	set("token", token)
	set("oe_format", "openeventor/1")
	set("id", eventID)

	if err := insertFixture(eventDB, fx, now); err != nil {
		m.CloseEventDB(eventID)
		return err
	}

	if _, err := sysDB.Exec(
		"INSERT INTO events (id, filename, display_name, date, status, token, created_at) VALUES (?, ?, ?, ?, 'active', ?, ?)",
		eventID, filename, "Demo Event", "2026-06-14", token, now,
	); err != nil {
		return fmt.Errorf("register demo event: %w", err)
	}
	if _, err := sysDB.Exec(
		"INSERT INTO event_access (event_id, user_id, role) VALUES (?, ?, 'admin')",
		eventID, userID,
	); err != nil {
		return fmt.Errorf("grant demo access: %w", err)
	}

	log.Printf("seeded demo event: %d competitors, %d passings, %d courses, %d groups",
		len(fx.Competitors), len(fx.Passings), len(fx.Courses), len(fx.Groups))
	return nil
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// insertFixture writes all fixture rows into the event DB in one transaction.
func insertFixture(db *sql.DB, fx Fixture, now string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, c := range fx.Courses {
		if _, err := tx.Exec(
			`INSERT INTO courses (id,name,checkpoints,validation_mode,geo_track,length,altitude,climb,start_time,price,description,created_at,updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			c.ID, c.Name, c.Checkpoints, c.ValidationMode, c.GeoTrack, c.Length, c.Altitude, c.Climb, c.StartTime, c.Price, c.Description, now, now,
		); err != nil {
			return fmt.Errorf("insert course: %w", err)
		}
	}
	for _, g := range fx.Groups {
		if _, err := tx.Exec(
			`INSERT INTO groups (id,name,course_id,parent_id,gender,year_from,year_to,start_time,price,description,sort_order,created_at,updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			g.ID, g.Name, g.CourseID, g.ParentID, g.Gender, g.YearFrom, g.YearTo, g.StartTime, g.Price, g.Description, g.SortOrder, now, now,
		); err != nil {
			return fmt.Errorf("insert group: %w", err)
		}
	}
	for _, t := range fx.Teams {
		if _, err := tx.Exec(
			`INSERT INTO teams (id,name,country,region,city,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
			t.ID, t.Name, t.Country, t.Region, t.City, t.Description, now, now,
		); err != nil {
			return fmt.Errorf("insert team: %w", err)
		}
	}
	for _, cp := range fx.Checkpoints {
		if _, err := tx.Exec(
			`INSERT INTO checkpoints (id,name,latitude,longitude,description,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
			cp.ID, cp.Name, cp.Latitude, cp.Longitude, cp.Description, cp.SortOrder, now, now,
		); err != nil {
			return fmt.Errorf("insert checkpoint: %w", err)
		}
	}
	for _, c := range fx.Competitors {
		if _, err := tx.Exec(
			`INSERT INTO competitors
			 (id,bib,card1,card2,team_id,group_id,course_id,first_name,last_name,middle_name,first_name_int,last_name_int,
			  gender,birth_date,birth_year,rank,rating,country,region,city,phone,email,start_time,time_adjustment,
			  dsq,dsq_description,dns,dnf,out_of_rank,entry_number,price,is_paid,is_checkin,notes,created_at,updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			c.ID, c.Bib, c.Card1, c.Card2, c.TeamID, c.GroupID, c.CourseID, c.FirstName, c.LastName, c.MiddleName, c.FirstNameInt, c.LastNameInt,
			c.Gender, c.BirthDate, c.BirthYear, c.Rank, c.Rating, c.Country, c.Region, c.City, c.Phone, c.Email, c.StartTime, c.TimeAdjustment,
			c.DSQ, c.DSQDescription, c.DNS, c.DNF, c.OutOfRank, c.EntryNumber, c.Price, c.IsPaid, c.IsCheckin, c.Notes, now, now,
		); err != nil {
			return fmt.Errorf("insert competitor: %w", err)
		}
	}
	for _, p := range fx.Passings {
		if _, err := tx.Exec(
			`INSERT INTO passings (id,card,checkpoint,raw_code,timestamp,enabled,source,sort_order,created_at,updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?)`,
			p.ID, p.Card, p.Checkpoint, p.RawCode, p.Timestamp, p.Enabled, p.Source, p.SortOrder, now, now,
		); err != nil {
			return fmt.Errorf("insert passing: %w", err)
		}
	}
	return tx.Commit()
}
