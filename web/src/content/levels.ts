// 課程頁共用的型別與小工具。主題頁的文案(大標、卡片、條列)在資料庫的區塊(content/topicPage.ts)。

export type CourseStatus = 'available' | 'planned'

/** 'free' = 免費;'login-free' = 登入後免費;'subscription' = 訂閱客戶才能存取;'tbd' = 尚未決定(不顯示價格標籤) */
export type CourseAccess = 'free' | 'login-free' | 'subscription' | 'tbd'

/** 圖卡插圖樣式(對應 LevelArt.tsx 內的 SVG 插圖) */
export type CourseArt = 'tools' | 'chat' | 'build' | 'agent' | 'advanced'

/** 階段在課程頁上的位置:課程頁每個單元的 id */
export const stageAnchor = (id: string): string => `stage-${id}`

export const ACCESS_LABEL: Record<CourseAccess, string | null> = {
  free: '免費',
  // 2026-11-07 起每門課都是「序章免登入、第 0 課登入後免費、其餘訂閱」,整門課不再標「登入後免費」「訂閱專屬」
  // (哪些單課頁要登入照資料庫每一課的 access;單課的標示在課程總覽頁)
  'login-free': null,
  subscription: null,
  tbd: null,
}
