import type { JSX } from 'react'
import { PrivacyPage } from './PrivacyPage'
import { RefundPage } from './RefundPage'
import { TermsPage } from './TermsPage'

export const legalRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/refund', element: <RefundPage /> },
]
