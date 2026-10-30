import type { JSX } from 'react'
import { PrivacyPage } from './PrivacyPage'
import { TermsPage } from './TermsPage'

export const legalRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
]
