// 主題「從做好到上線」(課程總覽頁 /courses/launch,courses/CourseOverviewPage.tsx)的前端資料:只剩網址與腳本命名規則。
// 有哪些課、課名、一句話、單元結構、哪些課開放、播哪個腳本、要不要登入,一律看資料庫(launch 這門課);草稿(draft)只有管理員看得到、點得進去。
// (原本的單元大綱 LAUNCH_UNITS 已刪:執行期沒有使用者,和種子重複。全環節課程清單的環節編號 from 只存在 git 歷史。)

/** 課號 → 課程頁網址 */
export const launchLessonPath = (id: string): string => `/courses/launch/${id.replace('.', '-')}`

/** 課號 → 訪客上課紀錄的名稱(InteractiveScenePage 記成 live:<腳本>);後台標課名用,腳本照這個規則命名 */
export const launchScriptKey = (id: string): string => `live:launch/${id}.json`


