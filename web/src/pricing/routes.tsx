import type { JSX } from 'react'
import { lazyPage } from '../site/lazyPage'
import { PRICING_PATH } from './plans'

// 方案頁不是每個人都會打開:打開時才下載(site/lazyPage.tsx)
const PricingPage = lazyPage(() => import('./PricingPage').then((m) => m.PricingPage))

export const pricingRoutes: { path: string; element: JSX.Element }[] = [{ path: PRICING_PATH, element: <PricingPage /> }]
