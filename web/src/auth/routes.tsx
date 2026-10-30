import type { JSX } from 'react'
import { LoginPage } from './LoginPage'
import { LOGIN_PATH } from './paths'


export const authRoutes: { path: string; element: JSX.Element }[] = [{ path: LOGIN_PATH, element: <LoginPage /> }]
