import type { JSX } from 'react'
import { AdminRedirect } from './AdminPage'
import { LEGACY_ADMIN_PATH } from './paths'

// 管理後台本身在研發基地(studio/proposal/routes.tsx 的 /studio/members),這裡只留舊網址的轉址。
export const adminRoutes: { path: string; element: JSX.Element }[] = [{ path: LEGACY_ADMIN_PATH, element: <AdminRedirect /> }]
