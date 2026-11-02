import type { JSX } from 'react'
import { DocPage } from './DocPage'
import { docs } from './registry'

export const docsRoutes: { path: string; element: JSX.Element }[] = [
  ...docs.map((doc) => ({ path: `/docs/${doc.slug}`, element: <DocPage doc={doc} /> })),
]
