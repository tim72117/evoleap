// 「做出自己的軟體」前端寫死的課程內容(單課的目標、步驟、提示詞、規劃中章節大綱):只給研發基地(/studio:課程編排工具)用。
// 學員端(路由、SEO、單課頁、課程總覽)的課程結構一律來自資料庫,不 import 這份,所以這些大檔不進學員的主程式。
// 單課頁的提示詞暫時還從 l0Lessons / l1Lessons 的 steps 取(courses/InteractiveLessonPage.tsx),之後會併進腳本。
import { L0_LESSONS } from './l0Lessons'
import { L1_LESSONS } from './l1Lessons'
import { L2_LESSONS } from './l2Lessons'
import { l2OutlineLessons } from './l2Outline'
import type { PlannedChapter } from './catalog'
import type { CourseLesson } from './lessonTypes'

export type SoftwareStageContent = { id: string; lessons: CourseLesson[]; planned: PlannedChapter[] }

/** 規劃中的基礎階段(Vibe Coding 入門)的章節:寫好內容的課(l2Lessons.ts)放進 lessons,其餘照大綱(l2Outline.ts)是規劃中的章節 */
const VIBE_PLANNED: PlannedChapter[] = l2OutlineLessons()
  .map(({ id, lesson: l }) => ({ slug: id.replace('.', '-'), label: id, title: l.title, summary: l.objective, result: l.result }))
  .filter((ch) => !L2_LESSONS.some((l) => l.id === ch.label))

/** 各階段(單元 id 和資料庫相同)的前端單課步驟與大綱(只給研發基地;學員端不 import) */
export const SOFTWARE_STAGE_CONTENT: SoftwareStageContent[] = [
  { id: 'tools', lessons: L0_LESSONS, planned: [] },
  { id: 'ai-tools', lessons: L1_LESSONS, planned: [] },
  { id: 'vibe-coding-basics', lessons: L2_LESSONS, planned: VIBE_PLANNED },
]
