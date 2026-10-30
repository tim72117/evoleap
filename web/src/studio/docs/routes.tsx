import type { JSX } from 'react'
import { DocIndexPage, DocPage } from './DocPage'
import { docs } from './registry'

export const docsRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/docs', element: <DocIndexPage /> },
  ...docs.map((doc) => ({ path: `/docs/${doc.slug}`, element: <DocPage doc={doc} /> })),
]
