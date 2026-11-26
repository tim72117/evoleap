package store

import "testing"

// 主題 content 的欄位型別打錯要擋下(前端靠這些型別顯示)。
func TestTopicContentTypes(t *testing.T) {
	if err := checkTopicContent([]byte(`{"flow":["a"],"learn":["x",{"level":"l","text":"t"}],"custom":1}`)); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{`{"learn":"a"}`, `{"flow":[1]}`, `{"learn":[3]}`, `{"start":"x"}`} {
		if checkTopicContent([]byte(bad)) == nil {
			t.Errorf("%s 要擋下", bad)
		}
	}
}
