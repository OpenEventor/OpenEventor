// Package demo builds and seeds the golden-master demo event — the SAME fixture
// the iOS app ships (2 courses, 8 groups incl. 2 parents, 44 athletes) covering
// OK / computed-DSQ / computed-DNF / manual DSQ/DNF/DNS / out-of-rank, a tie, a
// points class, and every start-time source. Ported from the iOS DemoFixture.
package demo

import (
	"encoding/json"
	"math"

	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/models"
)

// Intent constants mirror the iOS FixtureIntent — they drive the manual status
// flags; computed statuses emerge from the engine validating the punches.
const (
	intentOK          = "ok"
	intentOKOutOfRank = "okOutOfRank"
	intentComputedDSQ = "computedDSQ"
	intentComputedDNF = "computedDNF"
	intentManualDSQ   = "manualDSQ"
	intentManualDNF   = "manualDNF"
	intentManualDNS   = "manualDNS"
)

type punch struct {
	cp      string
	elapsed float64
}

type compDecl struct {
	bib, last, first, group, card string
	ownStart                      *float64 // nil = inherit from group/course/punch
	punches                       []punch
	intent                        string
	rating                        float64
	note                          string
}

type groupDecl struct {
	key, name, courseKey, parentKey, gender string
	startOffset                             *float64
	sortOrder                               int
}

type courseDecl struct {
	key, name     string
	checkpoints   []string
	validation    string
	startOffset   *float64
	length, climb float64
}

// Fixture is the materialised demo, ready to insert into an event DB.
type Fixture struct {
	Courses     []models.Course
	Groups      []models.Group
	Teams       []models.Team
	Checkpoints []models.Checkpoint
	Competitors []models.Competitor
	Passings    []models.Passing
}

func fp(v float64) *float64 { return &v }

// r10 rounds to the nearest 10 s — tidy, well-separated intermediate splits.
func r10(x float64) float64 { return math.Round(x/10) * 10 }

func longClean(finish float64) []punch {
	return []punch{{"START", 0}, {"31", r10(finish * 0.20)}, {"32", r10(finish * 0.45)}, {"33", r10(finish * 0.70)}, {"FINISH", finish}}
}
func skiClean(finish float64) []punch {
	return []punch{{"START", 0}, {"LAP", r10(finish * 0.30)}, {"LAP", r10(finish * 0.55)}, {"LAP", r10(finish * 0.80)}, {"FINISH", finish}}
}

var demoCourses = []courseDecl{
	{key: "Long", name: "Long", checkpoints: []string{"START", "31", "32", "33", "FINISH"}, validation: "strict", startOffset: fp(600), length: 6800, climb: 210},
	{key: "Ski", name: "Ski", checkpoints: []string{"START", "LAP", "LAP", "LAP", "FINISH"}, validation: "strict", startOffset: nil, length: 6000, climb: 90},
}

var demoGroups = []groupDecl{
	{key: "OL", name: "Общий-Long", courseKey: "Long", parentKey: "", gender: "", startOffset: nil, sortOrder: 0},
	{key: "M21", name: "M21", courseKey: "", parentKey: "OL", gender: "M", startOffset: fp(500), sortOrder: 1},
	{key: "W21", name: "W21", courseKey: "", parentKey: "OL", gender: "F", startOffset: nil, sortOrder: 2},
	{key: "M40", name: "M40", courseKey: "", parentKey: "OL", gender: "M", startOffset: nil, sortOrder: 3},
	{key: "W40", name: "W40", courseKey: "", parentKey: "OL", gender: "F", startOffset: nil, sortOrder: 4},
	{key: "OS", name: "Общий-Ski", courseKey: "Ski", parentKey: "", gender: "", startOffset: nil, sortOrder: 5},
	{key: "MSki", name: "M-Ski", courseKey: "", parentKey: "OS", gender: "M", startOffset: fp(400), sortOrder: 6},
	{key: "WSki", name: "W-Ski", courseKey: "", parentKey: "OS", gender: "F", startOffset: nil, sortOrder: 7},
}

func demoCompetitors() []compDecl {
	c := func(bib, last, first, group, card string, own *float64, punches []punch, intent string, rating float64, note string) compDecl {
		return compDecl{bib: bib, last: last, first: first, group: group, card: card, ownStart: own, punches: punches, intent: intent, rating: rating, note: note}
	}
	return []compDecl{
		// M21 — group start 500; 101 has its own (latest) start so it tops the monitor.
		c("101", "Smith", "John", "M21", "1001", fp(5000), longClean(1500), intentOK, 0, "clean winner; own start (latest → monitor top)"),
		c("102", "Johnson", "Michael", "M21", "1002", nil, longClean(1600), intentOK, 0, "clean; group start"),
		c("103", "Brown", "David", "M21", "1003", nil, longClean(1750), intentOK, 0, "clean; group start"),
		c("104", "Davis", "James", "M21", "1004", nil, []punch{{"START", 0}, {"31", 280}, {"33", 840}, {"FINISH", 1400}}, intentComputedDSQ, 0, "reached FINISH but skipped 32 → DSQ"),
		c("105", "Miller", "Robert", "M21", "1005", nil, []punch{{"START", 0}, {"31", 400}, {"32", 800}}, intentComputedDNF, 0, "stopped after 32, never finished → DNF"),
		c("106", "Wilson", "Kevin", "M21", "1006", nil, longClean(1450), intentOKOutOfRank, 0, "fastest raw time but out_of_rank → NC, no place"),

		// W21 — course start (Long); 110 own start; a TIE at 1650 (111 & 112).
		c("110", "Taylor", "Anna", "W21", "1010", fp(700), longClean(1550), intentOK, 0, "clean; own start"),
		c("111", "Anderson", "Bella", "W21", "1011", nil, longClean(1650), intentOK, 0, "TIE with 112 (1650) → shared place"),
		c("112", "Thomas", "Clara", "W21", "1012", nil, longClean(1650), intentOK, 0, "TIE with 111 (1650) → shared place, next skips"),
		c("113", "Jackson", "Diana", "W21", "1013", nil, longClean(1900), intentOK, 0, "clean; ranks after the tie (place skips)"),
		c("114", "White", "Emma", "W21", "1014", nil, longClean(1800), intentManualDNF, 0, "valid full course but judge set DNF"),
		c("115", "Harris", "Fiona", "W21", "1015", nil, nil, intentManualDNS, 0, "manual DNS, no punches (start via course)"),

		// M40 — course start; 120 own start; two DSQ (computed + manual).
		c("120", "Martin", "George", "M40", "1020", fp(800), longClean(1700), intentOK, 0, "clean; own start"),
		c("121", "Lee", "Harry", "M40", "1021", nil, longClean(1850), intentOK, 0, "clean; course start"),
		c("122", "Walker", "Ian", "M40", "1022", nil, longClean(2000), intentOK, 0, "clean; course start"),
		c("123", "Hall", "Jack", "M40", "1023", nil, []punch{{"START", 0}, {"31", 380}, {"33", 1140}, {"FINISH", 1900}}, intentComputedDSQ, 0, "skipped 32 → DSQ"),
		c("124", "Young", "Karl", "M40", "1024", nil, longClean(2050), intentManualDSQ, 0, "valid full course but judge set DSQ"),
		c("125", "King", "Leo", "M40", "1025", nil, longClean(2100), intentOK, 0, "clean; course start"),

		// W40 — course start; 130 own start; a computed DNF and an out-of-rank finisher.
		c("130", "Scott", "Mary", "W40", "1030", fp(650), longClean(1650), intentOK, 0, "clean; own start"),
		c("131", "Green", "Nina", "W40", "1031", nil, longClean(1750), intentOK, 0, "clean; course start"),
		c("132", "Adams", "Olive", "W40", "1032", nil, longClean(1950), intentOK, 0, "clean; course start"),
		c("133", "Baker", "Paula", "W40", "1033", nil, []punch{{"START", 0}, {"31", 420}, {"32", 900}}, intentComputedDNF, 0, "never reached FINISH → DNF"),
		c("134", "Nelson", "Rita", "W40", "1034", nil, longClean(1600), intentOKOutOfRank, 0, "fastest raw time but out_of_rank → NC"),
		c("135", "Carter", "Sara", "W40", "1035", nil, longClean(2050), intentOK, 0, "clean; course start"),

		// M-Ski — the POINTS class (ratings). 201 own start; group start otherwise.
		c("201", "Ross", "Alex", "MSki", "2001", fp(300), skiClean(2400), intentOK, 100, "points 100 (slower than 202 but ranks ahead on points)"),
		c("202", "Reed", "Ben", "MSki", "2002", nil, skiClean(2300), intentOK, 90, "points 90; fastest raw time"),
		c("203", "Cook", "Carl", "MSki", "2003", nil, skiClean(2500), intentOK, 95, "points 95"),
		c("204", "Bell", "Dan", "MSki", "2004", nil, skiClean(2600), intentOK, 80, "points 80"),
		c("205", "Ward", "Eric", "MSki", "2005", nil, skiClean(2700), intentOK, 85, "points 85"),
		c("206", "Gray", "Fred", "MSki", "2006", nil, skiClean(2800), intentOK, 75, "points 75"),
		c("207", "Cole", "Greg", "MSki", "2007", nil, []punch{{"START", 0}, {"LAP", 500}, {"LAP", 1100}, {"FINISH", 1700}}, intentComputedDSQ, 0, "only 2 laps then FINISH → DSQ"),
		c("208", "Fox", "Hank", "MSki", "2008", nil, []punch{{"START", 0}, {"LAP", 500}, {"LAP", 1100}}, intentComputedDNF, 0, "2 laps, no finish → DNF"),
		c("209", "Dean", "Ivan", "MSki", "2009", nil, skiClean(2900), intentManualDSQ, 0, "valid full course but judge set DSQ"),
		c("210", "Pope", "Jon", "MSki", "2010", nil, skiClean(2200), intentOKOutOfRank, 70, "out_of_rank → NC (rating ignored, not a finisher)"),

		// W-Ski — no points; punch-source starts; 220 own; 227 is a DNS with no start.
		c("220", "Hunt", "Kate", "WSki", "2020", fp(200), skiClean(2200), intentOK, 0, "clean; own start"),
		c("221", "Webb", "Lucy", "WSki", "2021", nil, skiClean(2350), intentOK, 0, "clean; start from first punch"),
		c("222", "Pratt", "Mia", "WSki", "2022", nil, skiClean(2500), intentOK, 0, "clean; start from first punch"),
		c("223", "Shaw", "Nora", "WSki", "2023", nil, skiClean(2650), intentOK, 0, "clean; start from first punch"),
		c("224", "Boyd", "Pam", "WSki", "2024", nil, skiClean(2800), intentOK, 0, "clean; start from first punch"),
		c("225", "Rhys", "Quin", "WSki", "2025", nil, skiClean(2950), intentOK, 0, "clean; start from first punch"),
		c("226", "Frost", "Rose", "WSki", "2026", nil, []punch{{"START", 0}, {"LAP", 520}, {"LAP", 1150}}, intentComputedDNF, 0, "2 laps, no finish → DNF"),
		c("227", "Kerr", "Sara", "WSki", "2027", nil, nil, intentManualDNS, 0, "manual DNS; no punches, no assigned start → sinks in start list"),
		c("228", "Lyon", "Tina", "WSki", "2028", nil, skiClean(2700), intentManualDNF, 0, "valid full course but judge set DNF"),
		c("229", "Munro", "Uma", "WSki", "2029", nil, skiClean(2100), intentOKOutOfRank, 0, "fastest raw time but out_of_rank → NC"),
	}
}

// Build materialises the fixture into canonical entities. `base` shifts every
// absolute time; the seeder passes a recent base so the monitor looks live.
func Build(base float64) Fixture {
	courseByKey := map[string]courseDecl{}
	courseIDByKey := map[string]string{}
	var courses []models.Course
	for _, cd := range demoCourses {
		id := uuid.New().String()
		courseIDByKey[cd.key] = id
		courseByKey[cd.key] = cd
		cps, _ := json.Marshal(cd.checkpoints)
		st := 0.0
		if cd.startOffset != nil {
			st = base + *cd.startOffset
		}
		courses = append(courses, models.Course{
			ID: id, Name: cd.name, Checkpoints: string(cps), ValidationMode: cd.validation,
			Length: cd.length, Climb: cd.climb, StartTime: st,
		})
	}

	groupByKey := map[string]groupDecl{}
	groupIDByKey := map[string]string{}
	for _, gd := range demoGroups {
		groupByKey[gd.key] = gd
		groupIDByKey[gd.key] = uuid.New().String()
	}
	var groups []models.Group
	for _, gd := range demoGroups {
		cid := ""
		if gd.courseKey != "" {
			cid = courseIDByKey[gd.courseKey]
		}
		pid := ""
		if gd.parentKey != "" {
			pid = groupIDByKey[gd.parentKey]
		}
		st := 0.0
		if gd.startOffset != nil {
			st = base + *gd.startOffset
		}
		groups = append(groups, models.Group{
			ID: groupIDByKey[gd.key], Name: gd.name, CourseID: cid, ParentID: pid,
			Gender: gd.gender, StartTime: st, SortOrder: gd.sortOrder,
		})
	}

	teams := []models.Team{
		{ID: uuid.New().String(), Name: "Red Fox OC", Country: "RUS", City: "Bend"},
		{ID: uuid.New().String(), Name: "Blue River SC", Country: "RUS", City: "Eugene"},
		{ID: uuid.New().String(), Name: "Green Hill AC", Country: "DEU", City: "Salem"},
		{ID: uuid.New().String(), Name: "Silver Lake TC", Country: "USA", City: "Portland"},
	}
	countries := []string{"RUS", "RUS", "DEU", "USA", "GBR", "FRA"}

	resolvedCourseKey := func(gk string) string {
		g := groupByKey[gk]
		if g.courseKey != "" {
			return g.courseKey
		}
		if g.parentKey != "" {
			return groupByKey[g.parentKey].courseKey
		}
		return ""
	}
	anchor := func(d compDecl) float64 {
		if d.ownStart != nil {
			return base + *d.ownStart
		}
		if g := groupByKey[d.group]; g.startOffset != nil {
			return base + *g.startOffset
		}
		if cd, ok := courseByKey[resolvedCourseKey(d.group)]; ok && cd.startOffset != nil {
			return base + *cd.startOffset
		}
		return base
	}

	var competitors []models.Competitor
	var passings []models.Passing
	for i, d := range demoCompetitors() {
		g := groupByKey[d.group]
		st := 0.0
		if d.ownStart != nil {
			st = base + *d.ownStart
		}
		comp := models.Competitor{
			ID: uuid.New().String(), Bib: d.bib, Card1: d.card,
			TeamID: teams[i%len(teams)].ID, GroupID: groupIDByKey[d.group],
			FirstName: d.first, LastName: d.last, Gender: g.gender,
			BirthYear: 1980 + (i % 30), Rating: d.rating, Country: countries[i%len(countries)],
			StartTime: st, Notes: d.note,
		}
		switch d.intent {
		case intentManualDSQ:
			comp.DSQ = 1
			comp.DSQDescription = d.note
		case intentManualDNS:
			comp.DNS = 1
		case intentManualDNF:
			comp.DNF = 1
		case intentOKOutOfRank:
			comp.OutOfRank = 1
		}
		competitors = append(competitors, comp)

		a := anchor(d)
		for j, p := range d.punches {
			passings = append(passings, models.Passing{
				ID: uuid.New().String(), Card: d.card, Checkpoint: p.cp,
				Timestamp: math.Round((a+p.elapsed)*100) / 100,
				Enabled:   1, Source: "demo", SortOrder: j,
			})
		}
	}

	// 31/32 carry geo coordinates; the rest are plain.
	lat31, lon31 := 44.0582, -121.3153
	lat32, lon32 := 44.0611, -121.3098
	checkpoints := []models.Checkpoint{
		{ID: uuid.New().String(), Name: "START", SortOrder: 0},
		{ID: uuid.New().String(), Name: "31", Latitude: &lat31, Longitude: &lon31, SortOrder: 1},
		{ID: uuid.New().String(), Name: "32", Latitude: &lat32, Longitude: &lon32, SortOrder: 2},
		{ID: uuid.New().String(), Name: "33", SortOrder: 3},
		{ID: uuid.New().String(), Name: "LAP", SortOrder: 4},
		{ID: uuid.New().String(), Name: "FINISH", SortOrder: 5},
	}

	return Fixture{Courses: courses, Groups: groups, Teams: teams, Checkpoints: checkpoints, Competitors: competitors, Passings: passings}
}
