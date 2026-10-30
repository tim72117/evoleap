import type { JSX } from 'react'
import { HomePage } from './HomePage'

export const homeRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/', element: <HomePage /> },
]
