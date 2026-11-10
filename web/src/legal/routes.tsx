import type { JSX } from 'react'
import { lazyPage } from '../site/lazyPage'

// 法務頁內容長、很少人打開:打開時才下載(site/lazyPage.tsx)
const PrivacyPage = lazyPage(() => import('./PrivacyPage').then((m) => m.PrivacyPage))
const TermsPage = lazyPage(() => import('./TermsPage').then((m) => m.TermsPage))
const RefundPage = lazyPage(() => import('./RefundPage').then((m) => m.RefundPage))

export const legalRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/refund', element: <RefundPage /> },
]
