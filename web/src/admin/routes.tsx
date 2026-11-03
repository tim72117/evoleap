import type { JSX } from 'react'
import { AdminPage } from './AdminPage'
import { ADMIN_PATH } from './paths'

export const adminRoutes: { path: string; element: JSX.Element }[] = [{ path: ADMIN_PATH, element: <AdminPage /> }]
