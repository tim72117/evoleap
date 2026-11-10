import type { JSX } from 'react'
import { CliAuthPage } from './CliAuthPage'
import { LoginPage } from './LoginPage'
import { CLI_AUTH_PATH, LOGIN_PATH } from './paths'


export const authRoutes: { path: string; element: JSX.Element }[] = [
  { path: LOGIN_PATH, element: <LoginPage /> },
  { path: CLI_AUTH_PATH, element: <CliAuthPage /> },
]
