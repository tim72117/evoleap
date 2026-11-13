// 單課的存取規則(2026-11-13 決定):每一門課依順序的前兩課不用登入就能看,第三課起要登入(第三課登入後免費);
// 第四課之後維持各課原本的設定(登入後免費或訂閱)。
//
// 伺服器照資料庫的 lessons.access 把關(courses_seed.json 只補新的課;已經存在的課要用 evoleap lesson set -access 改)。
// 這裡是前端「讀不到資料庫時的備援」與課程總覽頁的標籤(免費預覽 / 登入後學習),要和種子、資料庫一致(content/courseMap.test.ts 檢查種子)。

/** 依順序前幾課不用登入 */
export const FREE_LESSON_COUNT = 2

/** 這一課在這門課(依課程順序的課號清單)裡是不是不用登入就能看的前幾課;不在清單裡視為要登入 */
export function isFreeByOrder(orderedIds: readonly string[], id: string): boolean {
  const i = orderedIds.indexOf(id)
  return i >= 0 && i < FREE_LESSON_COUNT
}
