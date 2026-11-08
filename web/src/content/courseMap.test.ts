import { describe, expect, it } from 'vitest'
import { KIDS_OPEN_LESSONS, KIDS_PREVIEW_LESSON, KIDS_UNITS } from './kidsCourse'
import { WEB_OPEN_LESSONS, WEB_UNITS, webNeedsLogin } from './webCourse'

// 課程地圖的資料在伺服器的種子資料(資料庫);課程頁、SEO、研發基地還是用前端的 kidsCourse.ts、webCourse.ts。兩邊要一致。
type Seed = { id: string; access: string; units?: { id: string; title: string; subtitle: string; lessons: { id: string; title: string; summary: string; access?: string; status: string }[] }[] }

// 種子資料在 web/ 外面:用 import.meta.glob 在測試執行時才讀(tsc 不檢查路徑)。
// 部署時 Docker 只複製 web/ 來建置前端,直接 import 的話 tsc -b 找不到檔案會讓建置失敗
const SEED_JSON = Object.values(import.meta.glob('../../../server/internal/store/courses_seed.json', { eager: true, import: 'default' }))[0]

describe('兒童課的課程地圖(資料庫種子)和前端課程資料一致', () => {
  it('讀得到伺服器的種子資料', () => {
    expect(SEED_JSON).toBeDefined()
  })

  const kids = (SEED_JSON as Seed[]).find((c) => c.id === 'kids')!

  it('單元與每一課的名稱、學會什麼相同', () => {
    expect(kids.units!.map((u) => [u.id, u.title, u.subtitle])).toEqual(KIDS_UNITS.map((u) => [u.id, u.title, u.metaphor]))
    expect(kids.units!.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.summary]))).toEqual(KIDS_UNITS.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.learn])))
  })

  it('開放的課和課程頁(KIDS_OPEN_LESSONS)相同,只有第一課免費預覽', () => {
    const lessons = kids.units!.flatMap((u) => u.lessons)
    expect(lessons.filter((l) => l.status === 'open').map((l) => l.id)).toEqual(Object.keys(KIDS_OPEN_LESSONS))
    expect(kids.access).toBe('login-free')
    expect(lessons.filter((l) => l.access).map((l) => [l.id, l.access])).toEqual([[KIDS_PREVIEW_LESSON, 'free']])
  })
})

describe('網頁怎麼運作的課程地圖(資料庫種子)和前端課程資料一致', () => {
  const web = (SEED_JSON as Seed[]).find((c) => c.id === 'web')!

  it('單元(標題下是這個單元回答的問題)與每一課的名稱、學會什麼相同', () => {
    expect(web.units!.map((u) => [u.id, u.title, u.subtitle])).toEqual(WEB_UNITS.map((u) => [u.id, u.title, u.question]))
    expect(web.units!.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.summary]))).toEqual(WEB_UNITS.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.learn])))
  })

  it('開放的課和課程頁(WEB_OPEN_LESSONS)相同,只有不用登入的課免費預覽', () => {
    const lessons = web.units!.flatMap((u) => u.lessons)
    expect(lessons.filter((l) => l.status === 'open').map((l) => l.id)).toEqual(Object.keys(WEB_OPEN_LESSONS))
    expect(web.access).toBe('login-free')
    expect(lessons.filter((l) => l.access).map((l) => [l.id, l.access])).toEqual(lessons.filter((l) => !webNeedsLogin(l.id)).map((l) => [l.id, 'free']))
  })

  it('課程頁網址照課號規則(0.1 → /topics/web/0-1),課程地圖連得過去', () => {
    for (const [id, l] of Object.entries(WEB_OPEN_LESSONS)) expect(l.path).toBe(`/topics/web/${id.replace('.', '-')}`)
  })
})
