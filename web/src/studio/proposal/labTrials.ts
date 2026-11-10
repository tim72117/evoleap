// 其他課程（和全環節課程清單不重疊的部分）的試做清單：每一堂一份腳本，放在 content/live/lab/<課程>/。
// 清單是研發基地的資料檔 content/live/data/lab-trials.json（寫入課程資料時進資料庫），這裡只留型別。
// 試做頁沒有逐頁的路由：研發基地找不到路由時（StudioApp 的 *）依網址在清單裡找（LabTrialRoute.tsx）；清單頁 /studio/trials 列出全部並逐一載入檢查。
// 全環節課程清單的試做另外在 fullCourse.ts（/studio/full-course）。

export type LabTrial = {
  /** 課程名稱（分組用） */
  course: string
  /** 課號，例如 1.1、T2.1 */
  code: string
  title: string
  /** 腳本路徑（相對於 content/live/） */
  script: string
  /** 試做頁網址 */
  path: string
  /** 兒童課用兒童版播放器 */
  player?: 'kids'
  /** 返回的頁面 */
  back: { to: string; label: string }
}

/** lab 試做清單的資料檔(研發基地的資料,見 ../studioData.ts) */
export type LabTrialsData = { trials: LabTrial[] }

/** 網址對應的試做(沒有就回傳 undefined);結尾斜線視為同一頁 */
export const trialAt = (trials: LabTrial[], pathname: string): LabTrial | undefined => {
  const p = pathname.replace(/\/+$/, '')
  return trials.find((t) => t.path === p)
}
