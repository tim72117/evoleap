import { describe, expect, it } from 'vitest'
import SEED_JSON from '../../../server/internal/store/courses_seed.json'
import { KIDS_OPEN_LESSONS, KIDS_PREVIEW_LESSON, KIDS_UNITS } from './kidsCourse'

// 課程地圖的資料在伺服器的種子資料(資料庫);課程頁、SEO、研發基地還是用前端的 kidsCourse.ts。兩邊要一致。
type Seed = { id: string; access: string; units?: { id: string; title: string; metaphor: string; lessons: { id: string; title: string; summary: string; access?: string; status: string }[] }[] }

describe('兒童課的課程地圖(資料庫種子)和前端課程資料一致', () => {
  const kids = (SEED_JSON as Seed[]).find((c) => c.id === 'kids')!

  it('單元與每一課的名稱、學會什麼相同', () => {
    expect(kids.units!.map((u) => [u.id, u.title, u.metaphor])).toEqual(KIDS_UNITS.map((u) => [u.id, u.title, u.metaphor]))
    expect(kids.units!.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.summary]))).toEqual(KIDS_UNITS.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.learn])))
  })

  it('開放的課和課程頁(KIDS_OPEN_LESSONS)相同,只有第一課免費預覽', () => {
    const lessons = kids.units!.flatMap((u) => u.lessons)
    expect(lessons.filter((l) => l.status === 'open').map((l) => l.id)).toEqual(Object.keys(KIDS_OPEN_LESSONS))
    expect(kids.access).toBe('login-free')
    expect(lessons.filter((l) => l.access).map((l) => [l.id, l.access])).toEqual([[KIDS_PREVIEW_LESSON, 'free']])
  })
})
