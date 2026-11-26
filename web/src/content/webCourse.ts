// 「網頁怎麼運作」裡資料庫沒有的版面設定。
// 課號、課名、一句話、單元、腳本、開放與否一律讀資料庫(課程地圖 API);研發基地的看/做/名詞大綱在 studio/proposal/webBasics.ts。

/** 用靜態版面(不是舞台互動)的課號 */
export const WEB_STATIC_LESSONS: ReadonlySet<string> = new Set(['1.1', '1.2'])
