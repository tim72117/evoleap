package main

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"strings"
	"testing"
	"testing/fstest"
)

func gunzip(t *testing.T, b []byte) string {
	t.Helper()
	zr, err := gzip.NewReader(bytes.NewReader(b))
	if err != nil {
		t.Fatalf("不是 gzip:%v", err)
	}
	out, err := io.ReadAll(zr)
	if err != nil {
		t.Fatal(err)
	}
	return string(out)
}

func gzipDist() fstest.MapFS {
	big := strings.Repeat("console.log('evoleap');\n", 200)
	page := "<title>home</title>" + strings.Repeat("<p>課程</p>", 300)
	d := testDist()
	d["assets/big-abc123.js"] = &fstest.MapFile{Data: []byte(big)}
	d["assets/style-abc123.css"] = &fstest.MapFile{Data: []byte(strings.Repeat(".a{color:red}\n", 200))}
	d["materials/big.png"] = &fstest.MapFile{Data: []byte(strings.Repeat("x", 4000))}
	d["index.html"] = &fstest.MapFile{Data: []byte(page)}
	return d
}

func TestGzipStaticFiles(t *testing.T) {
	h := newStaticHandler(gzipDist(), openAccess)
	want := strings.Repeat("console.log('evoleap');\n", 200)

	// 瀏覽器接受 gzip:送壓縮版,內容解開後和原檔一樣
	rec := get(h, http.MethodGet, "/assets/big-abc123.js", map[string]string{"Accept-Encoding": "gzip, deflate, br"})
	if rec.Code != 200 || rec.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("應該送 gzip:%d %q", rec.Code, rec.Header().Get("Content-Encoding"))
	}
	if got := gunzip(t, rec.Body.Bytes()); got != want {
		t.Fatal("解壓縮後的內容不對")
	}
	if rec.Body.Len() >= len(want) {
		t.Fatalf("壓縮後沒有變小:%d", rec.Body.Len())
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "javascript") {
		t.Fatalf("Content-Type 要照副檔名:%q", ct)
	}
	if rec.Header().Get("Vary") != "Accept-Encoding" {
		t.Fatal("要加 Vary: Accept-Encoding")
	}
	if !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Fatal("assets 的長期快取要保留")
	}

	// 不接受 gzip(或 q=0):送原檔,但一樣加 Vary
	for _, ae := range []string{"", "identity", "gzip;q=0"} {
		rec := get(h, http.MethodGet, "/assets/big-abc123.js", map[string]string{"Accept-Encoding": ae})
		if rec.Header().Get("Content-Encoding") != "" || rec.Body.String() != want {
			t.Fatalf("Accept-Encoding %q 應該送原檔", ae)
		}
		if rec.Header().Get("Vary") != "Accept-Encoding" {
			t.Fatalf("Accept-Encoding %q 也要加 Vary", ae)
		}
	}

	// 要一段範圍時送原檔(Range 的位置是原檔的位置)
	rec = get(h, http.MethodGet, "/assets/big-abc123.js", map[string]string{"Accept-Encoding": "gzip", "Range": "bytes=0-9"})
	if rec.Header().Get("Content-Encoding") != "" || rec.Code != http.StatusPartialContent || rec.Body.String() != want[:10] {
		t.Fatalf("Range 請求應該送原檔的那一段:%d %q", rec.Code, rec.Body.String())
	}

	// CSS 也壓;小檔案、圖片不壓
	if rec := get(h, http.MethodGet, "/assets/style-abc123.css", map[string]string{"Accept-Encoding": "gzip"}); rec.Header().Get("Content-Encoding") != "gzip" {
		t.Fatal("CSS 要壓縮")
	}
	for _, p := range []string{"/assets/index-abc123.js", "/materials/big.png"} {
		rec := get(h, http.MethodGet, p, map[string]string{"Accept-Encoding": "gzip"})
		if rec.Header().Get("Content-Encoding") != "" || rec.Header().Get("Vary") != "" {
			t.Fatalf("%s 不該壓縮", p)
		}
	}
}

func TestGzipPages(t *testing.T) {
	h := newStaticHandler(gzipDist(), openAccess)
	plain := get(h, http.MethodGet, "/", nil)
	zipped := get(h, http.MethodGet, "/", map[string]string{"Accept-Encoding": "gzip"})
	if zipped.Header().Get("Content-Encoding") != "gzip" || gunzip(t, zipped.Body.Bytes()) != plain.Body.String() {
		t.Fatal("頁面要送壓縮版,解開後和原本一樣")
	}
	if zipped.Header().Get("Content-Type") != "text/html; charset=utf-8" {
		t.Fatalf("頁面的 Content-Type 不變:%q", zipped.Header().Get("Content-Type"))
	}
	// 兩種版本的 ETag 不同,各自的 If-None-Match 都能回 304
	e1, e2 := plain.Header().Get("ETag"), zipped.Header().Get("ETag")
	if e1 == "" || e1 == e2 {
		t.Fatalf("ETag 要分開:%q %q", e1, e2)
	}
	if rec := get(h, http.MethodGet, "/", map[string]string{"Accept-Encoding": "gzip", "If-None-Match": e2}); rec.Code != http.StatusNotModified {
		t.Fatalf("壓縮版的 ETag 要能回 304:%d", rec.Code)
	}
	if rec := get(h, http.MethodGet, "/", map[string]string{"If-None-Match": e1}); rec.Code != http.StatusNotModified {
		t.Fatalf("原本的 ETag 要能回 304:%d", rec.Code)
	}
}

func TestAcceptsGzip(t *testing.T) {
	cases := map[string]bool{
		"gzip": true, "gzip, deflate, br": true, "br;q=1.0, gzip;q=0.8": true, "*": true,
		"": false, "br": false, "identity": false, "gzip;q=0": false, "GZIP": true,
	}
	for ae, want := range cases {
		r, _ := http.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Accept-Encoding", ae)
		if got := acceptsGzip(r); got != want {
			t.Errorf("%q:要 %v,得到 %v", ae, want, got)
		}
	}
}

func TestGzipContentType(t *testing.T) {
	d := testDist()
	d["ads.txt"] = &fstest.MapFile{Data: []byte(strings.Repeat("google.com, pub-1, DIRECT\n", 100))}
	d["site.webmanifest"] = &fstest.MapFile{Data: []byte(`{"name":"` + strings.Repeat("e", 2000) + `"}`)}
	h := newStaticHandler(d, openAccess)
	for p, want := range map[string]string{"/ads.txt": "text/plain; charset=utf-8", "/site.webmanifest": "application/manifest+json"} {
		rec := get(h, http.MethodGet, p, map[string]string{"Accept-Encoding": "gzip"})
		if rec.Header().Get("Content-Encoding") != "gzip" || rec.Header().Get("Content-Type") != want {
			t.Errorf("%s:Content-Type 要是 %q,得到 %q", p, want, rec.Header().Get("Content-Type"))
		}
	}
}
