package main

import (
	"bytes"
	"encoding/json"
	"regexp"
)

// 頁面的結構化資料(JSON-LD)裡,課程清單的每一課要不要附課程頁網址,看資料庫那一課開放了沒有。
// 前端 build(web/src/seo/pages.ts 的 lessonLink)在有課程頁的 ListItem 上放 "evoleapLesson": {course, id, url};
// 這裡在回傳頁面時依資料庫處理:已開放就把 url 寫成 ListItem 的 "url",並一律拿掉 evoleapLesson,不讓它出現在回應裡。

const lessonLinkKey = "evoleapLesson"

var ldScript = regexp.MustCompile(`(?s)(<script type="application/ld\+json"[^>]*>)(.*?)(</script>)`)

// hasLessonLinks 頁面有沒有需要依資料庫處理的課程連結
func hasLessonLinks(body []byte) bool { return bytes.Contains(body, []byte(lessonLinkKey)) }

// patchLessonLinks 依已開放的課(「課程 id/課號」為 key)處理頁面裡的 JSON-LD;opened 為 nil 時所有課都當作沒開放
func patchLessonLinks(body []byte, opened map[string]bool) []byte {
	return ldScript.ReplaceAllFunc(body, func(block []byte) []byte {
		m := ldScript.FindSubmatch(block)
		if !bytes.Contains(m[2], []byte(lessonLinkKey)) {
			return block
		}
		var doc any
		if err := json.Unmarshal(m[2], &doc); err != nil {
			return block
		}
		patchNode(doc, opened)
		out, err := json.Marshal(doc) // 預設會把 < > & 跳脫成 \\u003c 等,不會提早結束 script 元素
		if err != nil {
			return block
		}
		return bytes.Join([][]byte{m[1], out, m[3]}, nil)
	})
}

func patchNode(v any, opened map[string]bool) {
	switch n := v.(type) {
	case []any:
		for _, x := range n {
			patchNode(x, opened)
		}
	case map[string]any:
		if raw, has := n[lessonLinkKey]; has {
			delete(n, lessonLinkKey) // 不論格式對不對都拿掉標記,不讓它出現在回應裡
			if link, ok := raw.(map[string]any); ok {
				course, _ := link["course"].(string)
				id, _ := link["id"].(string)
				if url, _ := link["url"].(string); url != "" && opened[course+"/"+id] {
					n["url"] = url
				}
			}
		}
		for _, x := range n {
			patchNode(x, opened)
		}
	}
}
