// 主題「從做好到上線」(課程總覽頁 /courses/launch,courses/CourseOverviewPage.tsx)的前端資料:只剩有課程頁的課號與腳本命名規則。
// 課名、一句話、單元結構、哪些課開放、播哪個腳本、要不要登入,一律看資料庫(server/internal/store/courses_seed.json 的 launch);草稿(draft)只有管理員看得到、點得進去。
// (原本的單元大綱 LAUNCH_UNITS 已刪:執行期沒有使用者,和種子重複。全環節課程清單的環節編號 from 只存在 git 歷史。)

/**
 * 有課程頁的課(/courses/launch/0-1):路由與 SEO 用。能不能上、播哪個腳本不看這裡,看資料庫(status、script);
 * 和種子資料裡有 script 的課一致,由 content/courseMap.test.ts 檢查。
 */
export const LAUNCH_LESSON_PAGES = ['0.1', '0.2', '0.3', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9']

/** 課號 → 課程頁網址 */
export const launchLessonPath = (id: string): string => `/courses/launch/${id.replace('.', '-')}`

/** 課號 → 訪客上課紀錄的名稱(InteractiveScenePage 記成 live:<腳本>);後台標課名用,腳本照這個規則命名 */
export const launchScriptKey = (id: string): string => `live:launch/${id}.json`


