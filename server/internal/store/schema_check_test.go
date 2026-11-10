package store

import (
	"context"
	"testing"
)

// 剛建好的資料庫:每張表都和定義一致,沒有遺留表
func TestCheckSchemaClean(t *testing.T) {
	st := openSeeded(t)
	r, err := st.CheckSchema(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !r.OK || len(r.Tables) != len(models()) || len(r.Orphans) != 0 {
		t.Fatalf("%+v", r)
	}
}

// 欄位改名(多一欄、少一欄)、遺留表、主鍵不一致都要抓得到
func TestCheckSchemaDrift(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	for _, sql := range []string{
		`ALTER TABLE course_changes RENAME COLUMN detail TO details`,
		`CREATE TABLE old_stuff (id INTEGER PRIMARY KEY)`,
		`DROP TABLE studio_files`,
		`CREATE TABLE studio_files (path TEXT, content TEXT PRIMARY KEY)`,
	} {
		if err := st.db.Exec(sql).Error; err != nil {
			t.Fatal(sql, err)
		}
	}
	r, err := st.CheckSchema(ctx)
	if err != nil {
		t.Fatal(err)
	}
	byName := map[string]SchemaCheck{}
	for _, c := range r.Tables {
		byName[c.Table] = c
	}
	if c := byName["course_changes"]; c.OK || len(c.Missing) != 1 || c.Missing[0] != "detail" || len(c.Extra) != 1 || c.Extra[0] != "details" {
		t.Errorf("欄位改名: %+v", c)
	}
	if c := byName["studio_files"]; c.OK || c.PrimaryKey == nil {
		t.Errorf("主鍵不一致(預期 path、實際 content): %+v", c)
	}
	if r.OK || len(r.Orphans) != 1 || r.Orphans[0] != "old_stuff" {
		t.Errorf("遺留表: %+v", r.Orphans)
	}
}
