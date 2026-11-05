import type { JSX } from 'react'
import { PricingPage } from './PricingPage'

export const pricingRoutes: { path: string; element: JSX.Element }[] = [{ path: '/pricing', element: <PricingPage /> }]
