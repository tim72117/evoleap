import type { JSX } from 'react'
import { CourseMapPage } from './CourseMapPage'
import { CoverCropperPage } from './CoverCropperPage'
import { CoverDesignerPage } from './CoverDesignerPage'
import { MaterialsIndexPage } from './MaterialsIndexPage'
import { PromoPage } from './PromoPage'

export const materialsRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/materials', element: <MaterialsIndexPage /> },
  { path: '/materials/course-map', element: <CourseMapPage /> },
  { path: '/materials/cover-designer', element: <CoverDesignerPage /> },
  { path: '/materials/promo', element: <PromoPage /> },
  { path: '/materials/cover-cropper', element: <CoverCropperPage /> },
]
