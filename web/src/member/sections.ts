import { MEMBER_PATH } from './paths'

// 會員空間的分頁。之後要加功能時:在這裡加一筆、在 routes.tsx 的 ELEMENTS 加對應的頁面元件,
// seo/pages.ts 的會員頁會跟著這份清單產生(noindex)。分頁只有一個時不顯示分頁列。

export interface MemberSection {
  id: string
  label: string
  path: string
  /** SEO 的 description(noindex,但分享或書籤時仍會用到) */
  description: string
}

export const MEMBER_SECTIONS: MemberSection[] = [
  { id: 'account', label: '帳號', path: MEMBER_PATH, description: '管理你的 evoleap.io 帳號與個人資料（需要登入）。' },
  { id: 'courses', label: '課程', path: `${MEMBER_PATH}/courses`, description: '你在 evoleap.io 的課程（需要登入）。' },
  { id: 'kids', label: '兒童', path: `${MEMBER_PATH}/kids`, description: '替孩子排上課時間、開啟兒童模式（需要登入）。' },
]

/** 頁面標題:只有一個分頁時就是「會員空間」 */
export function memberSectionTitle(s: MemberSection): string {
  return MEMBER_SECTIONS.length > 1 ? `${s.label}｜會員空間` : '會員空間'
}
