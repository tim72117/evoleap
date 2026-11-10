import type { JSX } from 'react'
import { Navigate } from 'react-router-dom'
import { ADMIN_PATH, LEGACY_ADMIN_PATH } from './paths'

// 管理後台本身在研發基地(studio/proposal/routes.tsx 的 /studio/members),這裡只留舊網址的轉址。
// 轉址直接寫在這裡,不 import AdminPage:後台只有進研發基地才下載,不放進公開頁面的主程式。
export const adminRoutes: { path: string; element: JSX.Element }[] = [{ path: LEGACY_ADMIN_PATH, element: <Navigate to={ADMIN_PATH} replace /> }]
