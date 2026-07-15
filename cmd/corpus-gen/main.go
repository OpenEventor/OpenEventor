// Command corpus-gen writes the OpenEventor conformance corpus (results block) as
// JSON cases into the directory given as the first argument, e.g.:
//
//	go run ./cmd/corpus-gen ../spec/conformance/cases
//
// Each case's expected output is produced by the Go Core engine (the bootstrap
// oracle). Regenerate only when behavior intentionally changes; then bump the spec
// version and re-run every platform's conformance runner. See spec conformance/README.md.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/openeventor/openeventor/internal/conformance"
	"github.com/openeventor/openeventor/internal/demo"
)

const since = "v1.0.0"

// demoBase is fixed so the golden case is deterministic (same frame as the iOS
// OEProtocolFixtureCheck golden master).
const demoBase = 1_752_000_000.0

func off() *int { z := 0; return &z }

func courseC() conformance.CourseIn {
	return conformance.CourseIn{ID: "C", Name: "Course C", Checkpoints: []string{"START", "31", "32", "FINISH"}}
}

func fullPunches(card string) []conformance.PassingIn {
	return []conformance.PassingIn{
		{Card: card, Checkpoint: "START", Timestamp: 1010},
		{Card: card, Checkpoint: "31", Timestamp: 1020},
		{Card: card, Checkpoint: "32", Timestamp: 1030},
		{Card: card, Checkpoint: "FINISH", Timestamp: 1090},
	}
}

func comp1() conformance.CompetitorIn {
	return conformance.CompetitorIn{ID: "c1", Bib: "1", Card1: "1", GroupID: "g", LastName: "Ivanov", FirstName: "Ivan"}
}

// oneInGroupC scaffolds a single competitor in class g whose (group-inherited) course
// is C, with the given group/course mass-start times and punches.
func oneInGroupC(comp conformance.CompetitorIn, groupStart, courseStart float64, punches []conformance.PassingIn) conformance.Input {
	c := courseC()
	c.StartTime = courseStart
	return conformance.Input{
		Competitors: []conformance.CompetitorIn{comp},
		Courses:     []conformance.CourseIn{c},
		Groups:      []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C", StartTime: groupStart}},
		Passings:    punches,
	}
}

func rc(id, desc string, in conformance.Input) conformance.Case {
	return conformance.Case{ID: "results/" + id, Block: "results", Since: since, Description: desc, Input: in}
}

func cases() []conformance.Case {
	compAdj := comp1()
	compAdj.TimeAdjustment = 30
	compAdjDnf := comp1()
	compAdjDnf.TimeAdjustment = 30
	compAdjDnf.DNF = 1
	compStartOwn := comp1()
	compStartOwn.StartTime = 1005
	compDsq := comp1()
	compDsq.DSQ = 1
	compDnf := comp1()
	compDnf.DNF = 1
	compDns := comp1()
	compDns.DNS = 1
	compBoth := comp1()
	compBoth.DSQ, compBoth.DNF = 1, 1
	compOOR := comp1()
	compOOR.OutOfRank = 1

	// out-of-order (by time) with no sortOrder → DSQ.
	outOfOrder := []conformance.PassingIn{
		{Card: "1", Checkpoint: "START", Timestamp: 1010},
		{Card: "1", Checkpoint: "32", Timestamp: 1020},
		{Card: "1", Checkpoint: "31", Timestamp: 1030},
		{Card: "1", Checkpoint: "FINISH", Timestamp: 1090},
	}
	// station 32 desynced (1015 < 31's 1020), but chip sortOrder is correct → OK.
	desync := []conformance.PassingIn{
		{Card: "1", Checkpoint: "START", Timestamp: 1010, SortOrder: 1},
		{Card: "1", Checkpoint: "31", Timestamp: 1020, SortOrder: 2},
		{Card: "1", Checkpoint: "32", Timestamp: 1015, SortOrder: 3},
		{Card: "1", Checkpoint: "FINISH", Timestamp: 1090, SortOrder: 4},
	}
	noFinish := []conformance.PassingIn{
		{Card: "1", Checkpoint: "START", Timestamp: 1010},
		{Card: "1", Checkpoint: "31", Timestamp: 1020},
		{Card: "1", Checkpoint: "32", Timestamp: 1030},
	}
	finishDisabled := []conformance.PassingIn{
		{Card: "1", Checkpoint: "START", Timestamp: 1010},
		{Card: "1", Checkpoint: "31", Timestamp: 1020},
		{Card: "1", Checkpoint: "32", Timestamp: 1030},
		{Card: "1", Checkpoint: "FINISH", Timestamp: 1090, Enabled: off()},
	}

	// relaxed course, tolerant of a missing intermediate control.
	relaxedTolerant := conformance.Input{
		Competitors: []conformance.CompetitorIn{comp1()},
		Courses:     []conformance.CourseIn{{ID: "C", Name: "Ski", Checkpoints: []string{"START", "31", "32", "FINISH"}, ValidationMode: "relaxed", StartTime: 1000}},
		Groups:      []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C"}},
		Passings: []conformance.PassingIn{
			{Card: "1", Checkpoint: "START", Timestamp: 1010},
			{Card: "1", Checkpoint: "31", Timestamp: 1020},
			{Card: "1", Checkpoint: "FINISH", Timestamp: 1090},
		},
	}
	relaxedNoFinish := conformance.Input{
		Competitors: []conformance.CompetitorIn{comp1()},
		Courses:     []conformance.CourseIn{{ID: "C", Name: "Ski", Checkpoints: []string{"START", "31", "FINISH"}, ValidationMode: "relaxed", StartTime: 1000}},
		Groups:      []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C"}},
		Passings: []conformance.PassingIn{
			{Card: "1", Checkpoint: "START", Timestamp: 1010},
			{Card: "1", Checkpoint: "31", Timestamp: 1020},
		},
	}

	// group course wins over the competitor's own courseId.
	groupWins := conformance.Input{
		Competitors: []conformance.CompetitorIn{{ID: "c1", Bib: "1", Card1: "1", GroupID: "g", CourseID: "A", LastName: "Ivanov", FirstName: "Ivan"}},
		Courses: []conformance.CourseIn{
			{ID: "A", Name: "Course A", Checkpoints: []string{"START", "A1", "FINISH"}},
			{ID: "B", Name: "Course B", Checkpoints: []string{"START", "B1", "FINISH"}},
		},
		Groups: []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "B"}},
		Passings: []conformance.PassingIn{
			{Card: "1", Checkpoint: "START", Timestamp: 1010},
			{Card: "1", Checkpoint: "B1", Timestamp: 1020},
			{Card: "1", Checkpoint: "FINISH", Timestamp: 1090},
		},
	}
	// child class inherits its parent's course up the chain.
	parentInherit := conformance.Input{
		Competitors: []conformance.CompetitorIn{{ID: "c1", Bib: "1", Card1: "1", GroupID: "child", LastName: "Ivanov", FirstName: "Ivan"}},
		Courses:     []conformance.CourseIn{courseC()},
		Groups: []conformance.GroupIn{
			{ID: "parent", Name: "Общий", CourseID: "C"},
			{ID: "child", Name: "M21", ParentID: "parent"},
		},
		Passings: fullPunches("1"),
	}
	// no group course and no competitor course → NC.
	noCourse := conformance.Input{
		Competitors: []conformance.CompetitorIn{{ID: "c1", Bib: "1", Card1: "1", LastName: "Ivanov", FirstName: "Ivan"}},
	}
	// two finishers ranked by time.
	ranking := conformance.Input{
		Competitors: []conformance.CompetitorIn{
			{ID: "c1", Bib: "1", Card1: "1", GroupID: "g", LastName: "Fast", FirstName: "F"},
			{ID: "c2", Bib: "2", Card1: "2", GroupID: "g", LastName: "Slow", FirstName: "S"},
		},
		Courses: []conformance.CourseIn{{ID: "C", Name: "Course C", Checkpoints: []string{"START", "31", "32", "FINISH"}, StartTime: 1000}},
		Groups:  []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C"}},
		Passings: append(fullPunches("1"), []conformance.PassingIn{
			{Card: "2", Checkpoint: "START", Timestamp: 1010},
			{Card: "2", Checkpoint: "31", Timestamp: 1020},
			{Card: "2", Checkpoint: "32", Timestamp: 1030},
			{Card: "2", Checkpoint: "FINISH", Timestamp: 1100},
		}...),
	}

	return []conformance.Case{
		rc("start-competitor-wins", "Личный старт участника перебивает старт группы и дистанции → source=competitor.", oneInGroupC(compStartOwn, 1002, 1001, fullPunches("1"))),
		rc("start-group-wins", "Нет личного старта → берётся старт группы → source=group.", oneInGroupC(comp1(), 1002, 1001, fullPunches("1"))),
		rc("start-course-wins", "Нет личного и группового старта → старт дистанции → source=course.", oneInGroupC(comp1(), 0, 1001, fullPunches("1"))),
		rc("start-punch-wins", "Стартов нет → берётся время первой отсечки → source=punch.", oneInGroupC(comp1(), 0, 0, fullPunches("1"))),
		rc("start-none", "Стартов нет и отсечек нет → source=none, start=0 (и DNF по дистанции).", oneInGroupC(comp1(), 0, 0, nil)),

		rc("strict-clean-ok", "Строгая дистанция, все КП по порядку → OK.", oneInGroupC(comp1(), 0, 1000, fullPunches("1"))),
		rc("strict-out-of-order-dsq", "Строгая, порядок нарушен (по времени), sortOrder=0 → DSQ.", oneInGroupC(comp1(), 0, 1000, outOfOrder)),
		rc("strict-missing-finish-dnf", "Строгая, финиш не достигнут → DNF.", oneInGroupC(comp1(), 0, 1000, noFinish)),
		rc("strict-sortorder-desync-ok", "Рассинхрон станции 32 (время меньше), но sortOrder с чипа верный → OK, отрицательный сплит.", oneInGroupC(comp1(), 0, 1000, desync)),
		rc("relaxed-tolerant-ok", "Мягкая дистанция, пропущен промежуточный КП, финиш достигнут → OK.", relaxedTolerant),
		rc("relaxed-no-finish-dnf", "Мягкая дистанция, финиш не достигнут → DNF.", relaxedNoFinish),

		rc("manual-dsq-overrides-ok", "Валидное прохождение, но ручной DSQ → статус DSQ.", oneInGroupC(compDsq, 0, 1000, fullPunches("1"))),
		rc("manual-dnf-zeroes-time", "Ручной DNF обнуляет время.", oneInGroupC(compDnf, 0, 1000, fullPunches("1"))),
		rc("manual-dns", "Ручной DNS: не стартовал, время 0.", oneInGroupC(compDns, 0, 1000, fullPunches("1"))),
		rc("status-priority-dsq-over-dnf", "Стоят оба флага DSQ и DNF → сильнейший DSQ.", oneInGroupC(compBoth, 0, 1000, fullPunches("1"))),

		rc("adjustment-penalty-on-ok", "Поправка +30 c применяется к валидному финишу (OK).", oneInGroupC(compAdj, 0, 1000, fullPunches("1"))),
		rc("adjustment-ignored-on-non-ok", "Поправка не применяется к не-OK (ручной DNF) → время 0.", oneInGroupC(compAdjDnf, 0, 1000, fullPunches("1"))),

		rc("course-group-wins-over-competitor", "Дистанция группы (B) перебивает courseId участника (A) → зачёт по B.", groupWins),
		rc("course-parent-inherits", "Дочерняя группа наследует дистанцию родителя вверх по цепочке.", parentInherit),
		rc("course-none-nc", "Нет ни групповой, ни личной дистанции → статус NC.", noCourse),

		rc("ranking-by-time-places", "Два финишёра: места по возрастанию времени (1, 2).", ranking),
		rc("out-of-rank-ok-no-place", "OK-финишёр вне зачёта: статус OK, outOfRank=1, места нет (NC — забота протоколов).", oneInGroupC(compOOR, 0, 1000, fullPunches("1"))),
		rc("disabled-punch-ignored", "Отключённая отсечка FINISH игнорируется → финиш не достигнут → DNF.", oneInGroupC(comp1(), 0, 1000, finishDisabled)),
	}
}

// remapIDs maps the demo fixture's random UUIDs to stable, order-based slugs so the
// golden cases are deterministic across regenerations (the fixture's declaration
// order is fixed; only its uuids are random). Cards/checkpoints are already stable strings.
func remapIDs(f demo.Fixture) map[string]string {
	m := map[string]string{}
	for i, c := range f.Courses {
		m[c.ID] = fmt.Sprintf("course-%d", i+1)
	}
	for i, g := range f.Groups {
		m[g.ID] = fmt.Sprintf("group-%d", i+1)
	}
	for i, t := range f.Teams {
		m[t.ID] = fmt.Sprintf("team-%d", i+1)
	}
	for i, c := range f.Competitors {
		m[c.ID] = fmt.Sprintf("comp-%03d", i+1)
	}
	return m
}

func mid(m map[string]string, orig string) string {
	if v, ok := m[orig]; ok {
		return v
	}
	return orig
}

func inputFromFixture(f demo.Fixture) conformance.Input {
	m := remapIDs(f)
	in := conformance.Input{}
	for _, c := range f.Competitors {
		in.Competitors = append(in.Competitors, conformance.CompetitorIn{
			ID: mid(m, c.ID), Bib: c.Bib, Card1: c.Card1, Card2: c.Card2,
			GroupID: mid(m, c.GroupID), CourseID: mid(m, c.CourseID), TeamID: mid(m, c.TeamID),
			LastName: c.LastName, FirstName: c.FirstName, Rank: c.Rank,
			StartTime: c.StartTime, TimeAdjustment: c.TimeAdjustment, Rating: c.Rating,
			DSQ: c.DSQ, DNF: c.DNF, DNS: c.DNS, OutOfRank: c.OutOfRank,
		})
	}
	for _, c := range f.Courses {
		var cps []string
		_ = json.Unmarshal([]byte(c.Checkpoints), &cps)
		in.Courses = append(in.Courses, conformance.CourseIn{
			ID: mid(m, c.ID), Name: c.Name, Checkpoints: cps,
			ValidationMode: c.ValidationMode, StartTime: c.StartTime,
		})
	}
	for _, g := range f.Groups {
		in.Groups = append(in.Groups, conformance.GroupIn{
			ID: mid(m, g.ID), Name: g.Name, CourseID: mid(m, g.CourseID), ParentID: mid(m, g.ParentID), StartTime: g.StartTime,
		})
	}
	for _, p := range f.Passings {
		pi := conformance.PassingIn{Card: p.Card, Checkpoint: p.Checkpoint, Timestamp: p.Timestamp, SortOrder: p.SortOrder}
		if p.Enabled != 1 {
			v := p.Enabled
			pi.Enabled = &v
		}
		in.Passings = append(in.Passings, pi)
	}
	return in
}

// ── protocols block ──────────────────────────────────────────────────────────

func pc(id, desc string, in conformance.ProtocolInput) conformance.ProtocolCase {
	return conformance.ProtocolCase{ID: "protocols/" + id, Block: "protocols", Since: since, Description: desc, Input: in}
}

func punchesFinish(card string, finish float64) []conformance.PassingIn {
	return []conformance.PassingIn{
		{Card: card, Checkpoint: "START", Timestamp: 1010},
		{Card: card, Checkpoint: "31", Timestamp: 1020},
		{Card: card, Checkpoint: "32", Timestamp: 1030},
		{Card: card, Checkpoint: "FINISH", Timestamp: finish},
	}
}

func cat(ss ...[]conformance.PassingIn) []conformance.PassingIn {
	var out []conformance.PassingIn
	for _, s := range ss {
		out = append(out, s...)
	}
	return out
}

func groupCourse(start float64) []conformance.CourseIn {
	c := courseC()
	c.StartTime = start
	return []conformance.CourseIn{c}
}

func protocolCases() []conformance.ProtocolCase {
	tie := conformance.ProtocolInput{
		Competitors: []conformance.CompetitorIn{
			{ID: "c1", Bib: "1", Card1: "1", GroupID: "g", LastName: "A"},
			{ID: "c2", Bib: "2", Card1: "2", GroupID: "g", LastName: "B"},
			{ID: "c3", Bib: "3", Card1: "3", GroupID: "g", LastName: "C"},
			{ID: "c4", Bib: "4", Card1: "4", GroupID: "g", LastName: "D"},
		},
		Courses:  groupCourse(1000),
		Groups:   []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C"}},
		Passings: cat(punchesFinish("1", 1080), punchesFinish("2", 1090), punchesFinish("3", 1090), punchesFinish("4", 1100)),
		Config:   conformance.ProtocolConfig{Type: "results", Grouping: "group"},
	}
	points := conformance.ProtocolInput{
		Competitors: []conformance.CompetitorIn{
			{ID: "c1", Bib: "1", Card1: "1", GroupID: "g", LastName: "Slow", Rating: 100},
			{ID: "c2", Bib: "2", Card1: "2", GroupID: "g", LastName: "Fast", Rating: 50},
		},
		Courses:  groupCourse(1000),
		Groups:   []conformance.GroupIn{{ID: "g", Name: "M-Ski", CourseID: "C"}},
		Passings: cat(punchesFinish("1", 1100), punchesFinish("2", 1090)),
		Config:   conformance.ProtocolConfig{Type: "results", Grouping: "group", UsePoints: true},
	}
	subtree := conformance.ProtocolInput{
		Competitors: []conformance.CompetitorIn{
			{ID: "a1", Bib: "1", Card1: "1", GroupID: "A", LastName: "A1"},
			{ID: "a2", Bib: "2", Card1: "2", GroupID: "A", LastName: "A2"},
			{ID: "b1", Bib: "3", Card1: "3", GroupID: "B", LastName: "B1"},
		},
		Courses: groupCourse(1000),
		Groups: []conformance.GroupIn{
			{ID: "P", Name: "Общий", CourseID: "C"},
			{ID: "A", Name: "M21", ParentID: "P"},
			{ID: "B", Name: "W21", ParentID: "P"},
		},
		Passings: cat(punchesFinish("1", 1080), punchesFinish("2", 1100), punchesFinish("3", 1090)),
		Config:   conformance.ProtocolConfig{Type: "results", Grouping: "group"},
	}
	nonfin := conformance.ProtocolInput{
		Competitors: []conformance.CompetitorIn{
			{ID: "c1", Bib: "1", Card1: "1", GroupID: "g", LastName: "Ok"},
			{ID: "c2", Bib: "2", Card1: "2", GroupID: "g", LastName: "Dsq"},
			{ID: "c3", Bib: "3", Card1: "3", GroupID: "g", LastName: "Dnf", DNF: 1},
		},
		Courses: groupCourse(1000),
		Groups:  []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C"}},
		Passings: cat(
			punchesFinish("1", 1090),
			[]conformance.PassingIn{ // missing 32 but reaches FINISH → computed DSQ
				{Card: "2", Checkpoint: "START", Timestamp: 1010},
				{Card: "2", Checkpoint: "31", Timestamp: 1020},
				{Card: "2", Checkpoint: "FINISH", Timestamp: 1090},
			},
			punchesFinish("3", 1095),
		),
		Config: conformance.ProtocolConfig{Type: "results", Grouping: "group", PrintDSQ: true},
	}
	startlist := conformance.ProtocolInput{
		Competitors: []conformance.CompetitorIn{
			{ID: "c1", Bib: "1", Card1: "1", GroupID: "g", LastName: "Mid", StartTime: 1005},
			{ID: "c2", Bib: "2", Card1: "2", GroupID: "g", LastName: "First", StartTime: 1002},
			{ID: "c3", Bib: "3", Card1: "3", GroupID: "g", LastName: "Last", StartTime: 1008},
		},
		Courses: groupCourse(0),
		Groups:  []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C"}},
		Config:  conformance.ProtocolConfig{Type: "start", Grouping: "group"},
	}
	columns := conformance.ProtocolInput{
		Competitors: []conformance.CompetitorIn{
			{ID: "c1", Bib: "1", Card1: "1", GroupID: "g", TeamID: "t1", LastName: "One", Rank: "MS", Rating: 30},
			{ID: "c2", Bib: "2", Card1: "2", GroupID: "g", TeamID: "t1", LastName: "Two", Rank: "KMS", Rating: 20},
		},
		Courses:  groupCourse(1000),
		Groups:   []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C"}},
		Teams:    []conformance.TeamIn{{ID: "t1", Name: "Red Fox", Country: "RUS"}},
		Passings: cat(punchesFinish("1", 1090), punchesFinish("2", 1100)),
		Config: conformance.ProtocolConfig{
			Type: "results", Grouping: "course",
			ShowTeam: true, ShowCountry: true, ShowRank: true, ShowStartTime: true, ShowComment: true,
			ShowGapToLeader: true, ShowGapToPrevious: true, UsePoints: true,
		},
	}

	return []conformance.ProtocolCase{
		pc("ranking-tie-1-2-2-4", "Ничья по десятым: два равных делят место, следующее пропускается → 1,2,2,4.", tie),
		pc("points-over-time", "usePoints: сортировка по очкам DESC перебивает время — медленный, но с бо́льшими очками, выше.", points),
		pc("parent-subtree-combines", "Родительская группа объединяет всё поддерево в одну секцию; дочерние отдельно не эмитятся.", subtree),
		pc("nonfinisher-print-flags", "Финишёры сверху; DSQ печатается (printDsq=on), DNF скрыт (printDnf=off).", nonfin),
		pc("start-list-by-start", "Стартовый протокол: порядок по разрешённому старту, без мест и результата.", startlist),
		pc("columns-full", "Полный набор колонок: место/номер/фамилия/имя/группа/команда/страна/разряд/старт/результат/отставания/очки/комментарий/статус.", columns),
	}
}

func protocolInputFromFixture(f demo.Fixture, cfg conformance.ProtocolConfig) conformance.ProtocolInput {
	m := remapIDs(f)
	in := inputFromFixture(f)
	pi := conformance.ProtocolInput{
		Competitors: in.Competitors, Courses: in.Courses, Groups: in.Groups, Passings: in.Passings,
		Config: cfg,
	}
	for _, t := range f.Teams {
		pi.Teams = append(pi.Teams, conformance.TeamIn{ID: mid(m, t.ID), Name: t.Name, Country: t.Country, Region: t.Region, City: t.City})
	}
	return pi
}

// ── problems block ───────────────────────────────────────────────────────────

func prob(id, desc string, in conformance.ProblemInput) conformance.ProblemCase {
	return conformance.ProblemCase{ID: "problems/" + id, Block: "problems", Since: since, Description: desc, Input: in}
}

func cleanSettings() map[string]string { return map[string]string{"date": "2026-06-14", "place": "Springfield"} }

func groupG() []conformance.GroupIn { return []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C"}} }

func problemCases() []conformance.ProblemCase {
	oorder := []conformance.PassingIn{
		{Card: "1", Checkpoint: "START", Timestamp: 1010},
		{Card: "1", Checkpoint: "32", Timestamp: 1020},
		{Card: "1", Checkpoint: "31", Timestamp: 1030},
		{Card: "1", Checkpoint: "FINISH", Timestamp: 1090},
	}
	startFinish := []conformance.PassingIn{
		{Card: "1", Checkpoint: "START", Timestamp: 1010},
		{Card: "1", Checkpoint: "FINISH", Timestamp: 1090},
	}

	return []conformance.ProblemCase{
		prob("clean-none", "Полностью валидное событие → проблем нет (проверка отсутствия ложных срабатываний).", conformance.ProblemInput{
			Settings: cleanSettings(), Competitors: []conformance.CompetitorIn{comp1()},
			Courses: []conformance.CourseIn{courseC()}, Groups: groupG(), Passings: fullPunches("1"),
		}),
		prob("event-no-date", "Не задана дата события → eventNoDate (warning).", conformance.ProblemInput{
			Settings: map[string]string{"place": "Springfield"}, Competitors: []conformance.CompetitorIn{comp1()},
			Courses: []conformance.CourseIn{courseC()}, Groups: groupG(), Passings: fullPunches("1"),
		}),
		prob("event-no-place", "Не задано место → eventNoPlace (info).", conformance.ProblemInput{
			Settings: map[string]string{"date": "2026-06-14"}, Competitors: []conformance.CompetitorIn{comp1()},
			Courses: []conformance.CourseIn{courseC()}, Groups: groupG(), Passings: fullPunches("1"),
		}),
		prob("event-no-courses", "Есть участники, но нет ни одной дистанции → eventNoCourses (critical).", conformance.ProblemInput{
			Settings:    cleanSettings(),
			Competitors: []conformance.CompetitorIn{{ID: "c1", Bib: "1", Card1: "1", GroupID: "g"}},
			Groups:      []conformance.GroupIn{{ID: "g", Name: "M21"}},
		}),
		prob("course-empty", "Дистанция с пустым списком КП → courseEmpty (critical).", conformance.ProblemInput{
			Settings: cleanSettings(), Competitors: []conformance.CompetitorIn{comp1()},
			Courses: []conformance.CourseIn{{ID: "C", Name: "Course C", Checkpoints: []string{}}},
			Groups:  groupG(), Passings: fullPunches("1"),
		}),
		prob("course-dup-name", "Две дистанции с одинаковым именем → courseDupName (warning).", conformance.ProblemInput{
			Settings: cleanSettings(), Competitors: []conformance.CompetitorIn{{ID: "c1", Bib: "1", Card1: "1", GroupID: "g"}},
			Courses: []conformance.CourseIn{
				{ID: "C1", Name: "Course C", Checkpoints: []string{"START", "FINISH"}},
				{ID: "C2", Name: "Course C", Checkpoints: []string{"START", "FINISH"}},
			},
			Groups: []conformance.GroupIn{{ID: "g", Name: "M21", CourseID: "C1"}}, Passings: startFinish,
		}),
		prob("group-dup-name", "Две группы с одинаковым именем → groupDupName (warning).", conformance.ProblemInput{
			Settings: cleanSettings(), Competitors: []conformance.CompetitorIn{{ID: "c1", Bib: "1", Card1: "1", GroupID: "g1"}},
			Courses: []conformance.CourseIn{courseC()},
			Groups:  []conformance.GroupIn{{ID: "g1", Name: "M21", CourseID: "C"}, {ID: "g2", Name: "M21", CourseID: "C"}},
			Passings: fullPunches("1"),
		}),
		prob("group-course-and-parent", "У группы заданы и дистанция, и родитель → groupCourseAndParent (warning).", conformance.ProblemInput{
			Settings: cleanSettings(), Competitors: []conformance.CompetitorIn{{ID: "c1", Bib: "1", Card1: "1", GroupID: "P"}},
			Courses: []conformance.CourseIn{courseC()},
			Groups:  []conformance.GroupIn{{ID: "P", Name: "Общий", CourseID: "C"}, {ID: "X", Name: "M21", CourseID: "C", ParentID: "P"}},
			Passings: fullPunches("1"),
		}),
		prob("card-collision", "Один чип у двух участников → cardCollision (critical).", conformance.ProblemInput{
			Settings: cleanSettings(),
			Competitors: []conformance.CompetitorIn{
				{ID: "c1", Bib: "1", Card1: "1", GroupID: "g"},
				{ID: "c2", Bib: "2", Card1: "1", GroupID: "g"},
			},
			Courses: []conformance.CourseIn{courseC()}, Groups: groupG(), Passings: fullPunches("1"),
		}),
		prob("unknown-card-punches", "Отсечки для карты без участника → unknownCardPunches (warning).", conformance.ProblemInput{
			Settings: cleanSettings(), Competitors: []conformance.CompetitorIn{comp1()},
			Courses: []conformance.CourseIn{courseC()}, Groups: groupG(),
			Passings: cat(fullPunches("1"), []conformance.PassingIn{{Card: "999", Checkpoint: "31", Timestamp: 1050}}),
		}),
		prob("competitor-dup-bib", "Дубль номера внутри группы → competitorDupBib (warning).", conformance.ProblemInput{
			Settings: cleanSettings(),
			Competitors: []conformance.CompetitorIn{
				{ID: "c1", Bib: "5", Card1: "1", GroupID: "g"},
				{ID: "c2", Bib: "5", Card1: "2", GroupID: "g"},
			},
			Courses: []conformance.CourseIn{courseC()}, Groups: groupG(), Passings: cat(fullPunches("1"), fullPunches("2")),
		}),
		prob("competitor-no-course", "Участник без группы и без дистанции → competitorNoCourse (warning).", conformance.ProblemInput{
			Settings: cleanSettings(), Competitors: []conformance.CompetitorIn{{ID: "c1", Bib: "1", Card1: "1"}},
			Courses: []conformance.CourseIn{courseC()},
		}),
		prob("competitor-no-card", "Участник без чипа при наличии отсечек → competitorNoCard (warning).", conformance.ProblemInput{
			Settings: cleanSettings(),
			Competitors: []conformance.CompetitorIn{
				{ID: "c1", Bib: "1", GroupID: "g"},
				{ID: "c2", Bib: "2", Card1: "2", GroupID: "g"},
			},
			Courses: []conformance.CourseIn{courseC()}, Groups: groupG(), Passings: fullPunches("2"),
		}),
		prob("competitor-negative-time", "Старт позже финиша → отрицательное время → competitorNegativeTime (critical).", conformance.ProblemInput{
			Settings:    cleanSettings(),
			Competitors: []conformance.CompetitorIn{{ID: "c1", Bib: "1", Card1: "1", GroupID: "g", StartTime: 2000}},
			Courses:     []conformance.CourseIn{courseC()}, Groups: groupG(), Passings: fullPunches("1"),
		}),
		prob("competitor-broken-order", "Достиг финиша, но порядок нарушен, без ручного статуса → competitorBrokenOrder (critical).", conformance.ProblemInput{
			Settings: cleanSettings(), Competitors: []conformance.CompetitorIn{comp1()},
			Courses: []conformance.CourseIn{courseC()}, Groups: groupG(), Passings: oorder,
		}),
	}
}

func problemInputFromFixture(f demo.Fixture, settings map[string]string) conformance.ProblemInput {
	in := inputFromFixture(f)
	return conformance.ProblemInput{
		Settings:    settings,
		Competitors: in.Competitors, Courses: in.Courses, Groups: in.Groups, Passings: in.Passings,
	}
}

func main() {
	if len(os.Args) < 2 {
		log.Fatalf("usage: corpus-gen <output-dir>")
	}
	dir := os.Args[1]

	all := cases()
	all = append(all, conformance.Case{
		ID:          "golden/demo-results",
		Block:       "golden",
		Since:       since,
		Description: "Полная демо-фикстура (2 дистанции, 8 групп, 44 участника) → таблица результатов. Golden master.",
		Input:       inputFromFixture(demo.Build(demoBase)),
	})
	for _, c := range all {
		if err := conformance.WriteCase(dir, c); err != nil {
			log.Fatalf("write %s: %v", c.ID, err)
		}
	}

	prot := protocolCases()
	prot = append(prot,
		pc("golden-results", "Полная демо-фикстура → итоговый протокол (по группам, команда+очки). Golden master.",
			protocolInputFromFixture(demo.Build(demoBase), conformance.ProtocolConfig{Type: "results", Grouping: "group", ShowTeam: true, UsePoints: true})),
		pc("golden-start", "Полная демо-фикстура → стартовый протокол (по группам).",
			protocolInputFromFixture(demo.Build(demoBase), conformance.ProtocolConfig{Type: "start", Grouping: "group", ShowTeam: true})),
	)
	for _, c := range prot {
		if err := conformance.WriteProtocolCase(dir, c); err != nil {
			log.Fatalf("write %s: %v", c.ID, err)
		}
	}

	probs := problemCases()
	probs = append(probs, prob("golden-demo", "Полная демо-фикстура + корректные settings → список проблем демо. Golden master.",
		problemInputFromFixture(demo.Build(demoBase), cleanSettings())))
	for _, c := range probs {
		if err := conformance.WriteProblemCase(dir, c); err != nil {
			log.Fatalf("write %s: %v", c.ID, err)
		}
	}

	fmt.Printf("wrote %d results + %d protocol + %d problem cases to %s\n", len(all), len(prot), len(probs), dir)
}
