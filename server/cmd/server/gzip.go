package main

import (
	"bytes"
	"compress/gzip"
	"io/fs"
	"net/http"
	"path"
	"strconv"
	"strings"
)

// 前端的文字檔(JS、CSS、HTML、SVG、JSON…)用 gzip 壓縮後傳送:Cloud Run 不會替我們壓縮,
// 不壓的話手機在慢速網路上光下載 JS 就要好幾秒(Lighthouse 的 FCP、LCP 主要卡在這裡)。
// build 產物不會變,所以啟動時壓一次放在記憶體,每次請求不用再花 CPU。

// gzipMinSize 以下的檔案不壓:省下的位元組比不上 gzip 標頭與解壓縮的成本。
const gzipMinSize = 1024

// compressibleExt 是值得壓縮的副檔名(圖片、音訊、字型本身已經壓縮過,不在這裡)。
var compressibleExt = map[string]bool{
	".js": true, ".mjs": true, ".css": true, ".html": true, ".svg": true, ".json": true,
	".xml": true, ".txt": true, ".map": true, ".webmanifest": true,
}

// contentTypes 是壓縮版要用的 Content-Type:正式環境(distroless)沒有 /etc/mime.types,
// Go 內建的表查不到 .txt、.map、.webmanifest,查不到時 ServeContent 會去猜壓縮後的內容,標成 gzip 下載檔。
var contentTypes = map[string]string{
	".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json",
	".xml": "text/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".map": "application/json",
	".webmanifest": "application/manifest+json",
}

// gzipBytes 回傳 b 的 gzip 壓縮結果(最高壓縮等級,啟動時用);太小或壓不小時回傳 nil(照原檔傳)。
func gzipBytes(b []byte) []byte { return gzipLevel(b, gzip.BestCompression) }

// gzipFast 同 gzipBytes,用較快的等級:請求當下才產生的頁面用,不讓同時的請求等太久。
func gzipFast(b []byte) []byte { return gzipLevel(b, gzip.DefaultCompression) }

func gzipLevel(b []byte, level int) []byte {
	if len(b) < gzipMinSize {
		return nil
	}
	var buf bytes.Buffer
	zw, err := gzip.NewWriterLevel(&buf, level)
	if err != nil {
		return nil
	}
	if _, err := zw.Write(b); err != nil {
		return nil
	}
	if err := zw.Close(); err != nil {
		return nil
	}
	// 至少要省下一成才值得
	if buf.Len() >= len(b)*9/10 {
		return nil
	}
	return buf.Bytes()
}

// gzipAssets 把 dist 裡值得壓縮的靜態檔(頁面的 index.html 由 page 自己處理)先壓好:路徑("/assets/x.js")→ 壓縮後的內容。
func gzipAssets(dist fs.FS) map[string][]byte {
	out := map[string][]byte{}
	_ = fs.WalkDir(dist, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !compressibleExt[path.Ext(p)] {
			return nil
		}
		body, err := fs.ReadFile(dist, p)
		if err != nil {
			return nil
		}
		if gz := gzipBytes(body); gz != nil {
			out["/"+p] = gz
		}
		return nil
	})
	return out
}

// acceptsGzip:瀏覽器的 Accept-Encoding 有 gzip(或 *),而且沒有明說 q=0。
func acceptsGzip(r *http.Request) bool {
	for _, part := range strings.Split(r.Header.Get("Accept-Encoding"), ",") {
		name, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		name = strings.ToLower(strings.TrimSpace(name))
		if name != "gzip" && name != "*" {
			continue
		}
		q := 1.0
		for _, p := range strings.Split(params, ";") {
			if k, v, ok := strings.Cut(strings.TrimSpace(p), "="); ok && strings.TrimSpace(k) == "q" {
				if f, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
					q = f
				}
			}
		}
		if q > 0 {
			return true
		}
	}
	return false
}

// useGzip 決定這次回應要不要送壓縮版:有壓縮版就先加 Vary(快取要依 Accept-Encoding 分開存),
// 瀏覽器接受 gzip、也不是要一段範圍(Range 的位置是原檔的位置,不能套在壓縮檔上)時送壓縮版並加上 Content-Encoding。
func useGzip(w http.ResponseWriter, r *http.Request, gz []byte) bool {
	if gz == nil {
		return false
	}
	w.Header().Add("Vary", "Accept-Encoding")
	if !acceptsGzip(r) || r.Header.Get("Range") != "" {
		return false
	}
	w.Header().Set("Content-Encoding", "gzip")
	return true
}

// gzipETag 是壓縮版的 ETag:內容不同,ETag 也要不同(原本的 ETag 後面加 -gz)。
func gzipETag(etag string) string {
	return strings.TrimSuffix(etag, `"`) + `-gz"`
}
