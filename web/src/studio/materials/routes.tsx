import type { JSX } from 'react'
import { CoverCropperPage } from './CoverCropperPage'
import { CoverDesignerPage } from './CoverDesignerPage'
import { MaterialsIndexPage } from './MaterialsIndexPage'

export const materialsRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/materials', element: <MaterialsIndexPage /> },
  { path: '/materials/cover-designer', element: <CoverDesignerPage /> },
  { path: '/materials/cover-cropper', element: <CoverCropperPage /> },
]
