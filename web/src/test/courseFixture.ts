// 測試用的固定課程資料(和 Go 測試、e2e 同一份:server/internal/store/fixture/courses.json)。
import courses from '../../../server/internal/store/fixture/courses.json'

export type SeedLesson = { id: string; title: string; summary: string; access?: string; status: 'open' | 'draft' | 'planned'; script?: string; files?: string[]; minutes?: number }
export type SeedUnit = { id: string; title: string; subtitle: string; label?: string; hidden?: boolean; lessons: SeedLesson[] }
export type SeedCourse = {
  id: string
  title: string
  access: string
  tier?: string
  summary?: string
  about?: string[]
  seoTitle?: string
  description?: string
  art?: string
  introScript?: string
  units: SeedUnit[]
}


export const FIXTURE_COURSES: SeedCourse[] = courses as SeedCourse[]

export function fixtureCourse(id: string): SeedCourse {
  const c = FIXTURE_COURSES.find((x) => x.id === id)
  if (!c) throw new Error(`測試資料沒有課程 ${id}`)
  return c
}
