// Package fixture 是手寫的小型測試資料(主題、課程、單元、課),Go 測試、前端測試與 e2e 共用。
// 它不是正式站內容的複本:每種行為(課的 open/draft/planned、存取方式、隱藏單元、沒有課程總覽頁、
// 沒有課的單元、簡介影片、附屬檔)放一兩個代表就好;課號與腳本路徑只保留前端寫死或測試用到的少數幾個。
// 測試需要新的情境時才改這裡。
package fixture

import _ "embed"

//go:embed topics.json
var Topics []byte

//go:embed courses.json
var Courses []byte
