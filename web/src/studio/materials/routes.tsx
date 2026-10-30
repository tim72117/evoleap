import type { JSX } from 'react'
import { CoverCropperPage } from './CoverCropperPage'
import { CoverDesignerPage } from './CoverDesignerPage'

export const materialsRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/materials/cover-designer', element: <CoverDesignerPage /> },
  { path: '/materials/cover-cropper', element: <CoverCropperPage /> },
]
