package store

import (
	"context"
	"sort"
	"strings"

	"gorm.io/gorm"
)

// 資料庫結構檢查(仿照 tripace 的 schema-check):比對程式裡每張表的定義和資料庫實際的欄位、主鍵。
// GORM 的 AutoMigrate 只會新增缺少的表與欄位,欄位改名、刪欄位、改主鍵都不會處理,也不會報錯
// (改名時會多出一個新欄位,舊的留著),所以要主動比對才看得出資料庫和程式對不上。
// 也反過來列出資料庫裡沒有對應定義的遺留表(AutoMigrate 不會刪表)。

// models 是所有資料表的定義:Connect 的 AutoMigrate 與 CheckSchema 共用同一份,新增資料表只要加在這裡。
func models() []any {
	return []any{
		&userRow{}, &progressRow{}, &guestViewRow{},
		&courseRow{}, &unitRow{}, &lessonRow{}, &lessonFileRow{}, &studioFileRow{},
		&cliAuthSessionRow{}, &cliTokenRow{}, &courseChangeRow{},
	}
}

// SchemaCheck 是一張表的比對結果。
type SchemaCheck struct {
	Table string `json:"table"`
	// Missing:程式有定義、資料庫沒有的欄位(AutoMigrate 沒跑過或失敗)
	Missing []string `json:"missing,omitempty"`
	// Extra:資料庫有、程式已經沒有的欄位(常見是欄位改名後舊的留著,或棄用後沒清)
	Extra []string `json:"extra,omitempty"`
	// PrimaryKey:主鍵欄位不一致時,程式預期的與資料庫實際的(AutoMigrate 不會改既有表的主鍵)
	PrimaryKey *PrimaryKeyMismatch `json:"primaryKey,omitempty"`
	OK         bool                `json:"ok"`
}

type PrimaryKeyMismatch struct {
	Expected []string `json:"expected"`
	Actual   []string `json:"actual"`
}

// SchemaReport 是整個資料庫的檢查結果:每張表,以及沒有對應定義的遺留表。OK 是全部沒問題。
type SchemaReport struct {
	OK      bool          `json:"ok"`
	Tables  []SchemaCheck `json:"tables"`
	Orphans []string      `json:"orphans"`
}

// CheckSchema 逐表比對程式的定義與資料庫實際的欄位、主鍵,並列出遺留表。
func (s *Store) CheckSchema(ctx context.Context) (SchemaReport, error) {
	db := s.db.WithContext(ctx)
	report := SchemaReport{OK: true, Orphans: []string{}}
	known := map[string]bool{}
	for _, m := range models() {
		c, err := checkTable(db, m)
		if err != nil {
			return SchemaReport{}, err
		}
		known[c.Table] = true
		report.Tables = append(report.Tables, c)
		report.OK = report.OK && c.OK
	}
	tables, err := db.Migrator().GetTables()
	if err != nil {
		return SchemaReport{}, err
	}
	for _, t := range tables {
		if !known[t] && !strings.HasPrefix(t, "sqlite_") {
			report.Orphans = append(report.Orphans, t)
		}
	}
	sort.Strings(report.Orphans)
	report.OK = report.OK && len(report.Orphans) == 0
	return report, nil
}

func checkTable(db *gorm.DB, model any) (SchemaCheck, error) {
	stmt := &gorm.Statement{DB: db}
	if err := stmt.Parse(model); err != nil {
		return SchemaCheck{}, err
	}
	c := SchemaCheck{Table: stmt.Schema.Table}
	want := map[string]bool{}
	var wantPK []string
	for _, f := range stmt.Schema.Fields {
		if f.DBName == "" {
			continue
		}
		want[f.DBName] = true
		if f.PrimaryKey {
			wantPK = append(wantPK, f.DBName)
		}
	}
	if !db.Migrator().HasTable(model) {
		for col := range want {
			c.Missing = append(c.Missing, col)
		}
		sort.Strings(c.Missing)
		return c, nil
	}
	cols, err := db.Migrator().ColumnTypes(model)
	if err != nil {
		return SchemaCheck{}, err
	}
	have := map[string]bool{}
	var havePK []string
	for _, ct := range cols {
		have[ct.Name()] = true
		if pk, ok := ct.PrimaryKey(); ok && pk {
			havePK = append(havePK, ct.Name())
		}
	}
	for col := range want {
		if !have[col] {
			c.Missing = append(c.Missing, col)
		}
	}
	for col := range have {
		if !want[col] {
			c.Extra = append(c.Extra, col)
		}
	}
	sort.Strings(c.Missing)
	sort.Strings(c.Extra)
	sort.Strings(wantPK)
	sort.Strings(havePK)
	if strings.Join(wantPK, ",") != strings.Join(havePK, ",") {
		c.PrimaryKey = &PrimaryKeyMismatch{Expected: wantPK, Actual: havePK}
	}
	c.OK = len(c.Missing) == 0 && len(c.Extra) == 0 && c.PrimaryKey == nil
	return c, nil
}
