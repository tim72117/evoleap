import type { JSX } from 'react'
import { CoursesSection } from './CoursesSection'
import { KidsSection } from './KidsSection'
import { MemberLayout } from './MemberLayout'
import { ProfileSection } from './ProfileSection'
import { MEMBER_SECTIONS } from './sections'

// 會員空間:每個分頁一個路由,外框(登入檢查、會員卡、分頁列)都由 MemberLayout 處理。
const ELEMENTS: Record<string, JSX.Element> = {
  account: <ProfileSection />,
  courses: <CoursesSection />,
  kids: <KidsSection />,
}

export const memberRoutes: { path: string; element: JSX.Element }[] = MEMBER_SECTIONS.map((s) => ({
  path: s.path,
  element: <MemberLayout section={s}>{ELEMENTS[s.id]}</MemberLayout>,
}))
