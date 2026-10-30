import type { JSX } from 'react'
import { CourseGoalsPage } from './pages/CourseGoalsPage'
import { MethodologyPage } from './pages/MethodologyPage'
import { RecordingPage } from './pages/RecordingPage'
import { ResearchReportPage } from './pages/ResearchReportPage'
import { ScriptTemplatePage } from './pages/ScriptTemplatePage'

// slug 對應 registry.ts 的 articles。
const PAGES: Record<string, JSX.Element> = {
  'course-goals': <CourseGoalsPage />,
  'research-report': <ResearchReportPage />,
  'research/methodology': <MethodologyPage />,
  'research/recording': <RecordingPage />,
  'research/script-template': <ScriptTemplatePage />,
}

export const articleRoutes: { path: string; element: JSX.Element }[] = Object.entries(PAGES).map(
  ([slug, element]) => ({ path: `/docs/${slug}`, element }),
)
