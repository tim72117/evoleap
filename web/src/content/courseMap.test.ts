import { describe, expect, it } from 'vitest'
import courseSeed from '../../../server/internal/store/courses_seed.json'
import { KIDS_OPEN_LESSONS, KIDS_PREVIEW_LESSON, KIDS_UNITS } from './kidsCourse'
import { LAUNCH_LESSON_PAGES, LAUNCH_OPEN_LESSONS, LAUNCH_UNITS, launchScriptKey } from './launchCourse'
import { WEB_OPEN_LESSONS, WEB_UNITS, webNeedsLogin } from './webCourse'
import { COURSES, coursePath, isPreviewLesson } from './catalog'
import { L2_MODULES } from './l2Outline'
import { minutesOf } from '../courses/CourseOverviewPage'
import { UNITS as AI_AGENT_UNITS } from './aiAgent'
import { ALL_LEVELS } from './levels'
import { CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC } from './topics'

// 課程地圖的資料在伺服器的種子資料(資料庫);課程頁、SEO、研發基地還是用前端的 kidsCourse.ts、webCourse.ts。兩邊要一致。
type Seed = { id: string; title: string; access: string; units?: { id: string; title: string; subtitle: string; lessons: { id: string; title: string; summary: string; access?: string; status: string; script?: string; files?: string[]; minutes?: number }[] }[] }

// 種子資料在 web/ 外面(Docker 建置前端時也會複製這份檔案,見 Dockerfile;seo/build.ts 也直接 import)
const SEED_JSON: unknown = courseSeed

describe('兒童課的課程地圖(資料庫種子)和前端課程資料一致', () => {
  it('讀得到伺服器的種子資料', () => {
    expect(SEED_JSON).toBeDefined()
  })

  const kids = (SEED_JSON as Seed[]).find((c) => c.id === 'kids')!

  it('單元與每一課的名稱、學會什麼相同', () => {
    expect(kids.units!.map((u) => [u.id, u.title, u.subtitle])).toEqual(KIDS_UNITS.map((u) => [u.id, u.title, u.metaphor]))
    expect(kids.units!.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.summary]))).toEqual(KIDS_UNITS.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.learn])))
  })

  it('開放的課和課程頁(KIDS_OPEN_LESSONS)相同、腳本相同,只有第一課免費預覽', () => {
    const lessons = kids.units!.flatMap((u) => u.lessons)
    expect(lessons.filter((l) => l.status === 'open').map((l) => [l.id, l.script])).toEqual(Object.entries(KIDS_OPEN_LESSONS).map(([id, l]) => [id, l.script]))
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

  it('開放的課和課程頁(WEB_OPEN_LESSONS)相同、腳本相同,只有不用登入的課免費預覽', () => {
    const lessons = web.units!.flatMap((u) => u.lessons)
    expect(lessons.filter((l) => l.status === 'open').map((l) => [l.id, l.script])).toEqual(Object.entries(WEB_OPEN_LESSONS).map(([id, l]) => [id, l.script]))
    expect(web.access).toBe('login-free')
    expect(lessons.filter((l) => l.access).map((l) => [l.id, l.access])).toEqual(lessons.filter((l) => !webNeedsLogin(l.id)).map((l) => [l.id, 'free']))
  })

  it('課程頁網址照課號規則(0.1 → /topics/web/0-1),課程地圖連得過去', () => {
    for (const [id, l] of Object.entries(WEB_OPEN_LESSONS)) expect(l.path).toBe(`/topics/web/${id.replace('.', '-')}`)
  })
})

describe('從做好到上線的課程地圖(資料庫種子)和前端課程資料一致', () => {
  const launch = (SEED_JSON as Seed[]).find((c) => c.id === 'launch')!
  const lessons = launch.units!.flatMap((u) => u.lessons)
  const scripts = import.meta.glob('./live/**/*.json')

  it('單元與每一課的名稱、學會什麼相同', () => {
    expect(launch.units!.map((u) => [u.id, u.title, u.subtitle])).toEqual(LAUNCH_UNITS.map((u) => [u.id, u.title, u.question]))
    expect(lessons.map((l) => [l.id, l.title, l.summary])).toEqual(LAUNCH_UNITS.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.learn])))
  })

  it('能上的課(開放、草稿)都有腳本,腳本檔存在、不在只給研發基地的 lab/', () => {
    for (const l of lessons.filter((x) => x.status !== 'planned')) {
      expect(l.script, l.id).toBeDefined()
      expect(scripts[`./live/${l.script}`], `${l.id}:${l.script}`).toBeDefined()
      expect(l.script!.startsWith('lab/'), l.script).toBe(false)
    }
  })

  it('有腳本的課和有課程頁的課(LAUNCH_LESSON_PAGES)相同,後台能依腳本標出課名', () => {
    expect(lessons.filter((l) => l.script).map((l) => l.id)).toEqual(LAUNCH_LESSON_PAGES)
    for (const l of lessons.filter((x) => x.script)) expect(`live:${l.script}`).toBe(launchScriptKey(l.id))
  })

  it('序章三課與單元 1 已開放,單元 2 是草稿,其他還在規劃中;只有 0.1 免費預覽', () => {
    expect(lessons.filter((l) => l.status === 'open').map((l) => l.id)).toEqual(LAUNCH_OPEN_LESSONS)
    expect(lessons.filter((l) => l.status === 'draft').map((l) => l.id)).toEqual(['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9'])
    expect(lessons.filter((l) => l.access).map((l) => [l.id, l.access])).toEqual([['0.1', 'free']])
  })
})

// 「AI 工具介紹」「AI 工具入門」的課程頁還是讀前端的 l0Lessons.ts、l1Lessons.ts;資料庫只記錄課程結構與狀態,兩邊要一致。
// 單元名稱來自研發基地的課程規劃(studio/proposal/basicsData.ts 的 MODULES)。
describe.each([
  ['tools', '/courses/tools'],
  ['ai-tools', '/courses/ai-tools'],
])('%s 的課程地圖(資料庫種子)和前端課程資料一致', (id, path) => {
  const seed = (SEED_JSON as Seed[]).find((c) => c.id === id)!
  const course = COURSES.find((c) => coursePath(c) === path)!
  const lessons = seed.units!.flatMap((u) => u.lessons)

  it('每一課的課號、名稱、順序與學習時間相同', () => {
    expect(lessons.map((l) => [l.id, l.title, l.minutes])).toEqual(course.lessons.map((l) => [l.id, l.title, minutesOf(l.length)]))
  })

  it('有影片的課是開放、腳本和第一支影片相同,其他是規劃中', () => {
    for (const l of course.lessons) {
      const s = lessons.find((x) => x.id === l.id)!
      const live = l.videos[0]?.live
      expect([l.id, s.status, s.script]).toEqual([l.id, live ? 'open' : 'planned', live])
    }
  })

  it('整門課登入後免費,只有序章免費預覽', () => {
    expect(seed.access).toBe('login-free')
    expect(lessons.filter((l) => l.access).map((l) => [l.id, l.access])).toEqual(course.lessons.filter(isPreviewLesson).map((l) => [l.id, 'free']))
  })
})

// 還沒有課程內容的課:Vibe Coding 入門的課照 l2Outline.ts;AI Agent 整合應用、進階 AI Agent 應用只規劃到單元／主題,單元底下還沒有課
describe('還在規劃的課程(資料庫種子)和前端的規劃一致', () => {
  const seed = (id: string) => (SEED_JSON as Seed[]).find((c) => c.id === id)!

  it('Vibe Coding 入門:單元與每一課(課號、名稱、這一課能做到的事)相同,全部規劃中', () => {
    const vc = seed('vibe-coding-basics')
    expect(vc.units!.map((u) => [u.id, u.title])).toEqual(L2_MODULES.map((m) => [m.num, m.title]))
    expect(vc.units!.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.summary, l.status, l.minutes]))).toEqual(
      L2_MODULES.flatMap((m) => m.lessons.map((l, i) => [`${m.num}.${i + 1}`, l.title, l.objective, 'planned', minutesOf(l.length)])),
    )
  })

  it('AI Agent 整合應用:單元與目標相同,期末專案的 id 是 capstone', () => {
    expect(seed('ai-agent').units!.map((u) => [u.id, u.title, u.subtitle, u.lessons.length])).toEqual(
      AI_AGENT_UNITS.map((u) => [u.num === '★' ? 'capstone' : u.num, u.title, u.goal, 0]),
    )
  })

  it('進階 AI Agent 應用:每個規劃主題是一個單元', () => {
    const topics = ALL_LEVELS.find((l) => l.id === 'advanced')!.topics!
    expect(seed('advanced').units!.map((u) => [u.id, u.title, u.lessons.length])).toEqual(topics.map((t, i) => [String(i + 1), t, 0]))
  })
})

// Claude Code 工作術:主題頁還是讀 topics.ts 的 CLAUDE_CODE_SCENARIOS;資料庫把每個情境記成一課(依頁面上的順序編號),
// 有示範影片的是開放(腳本就是影片),其他規劃中。目前整頁不用登入,整門課是 free
describe('Claude Code 工作術(資料庫種子)和主題頁的情境一致', () => {
  const cc = (SEED_JSON as Seed[]).find((c) => c.id === 'claude-code')!
  const lessons = cc.units!.flatMap((u) => u.lessons)

  it('課名、單元標題下的說明和主題頁相同', () => {
    expect([cc.title, cc.units!.map((u) => u.subtitle)]).toEqual([CLAUDE_CODE_TOPIC.name, [CLAUDE_CODE_TOPIC.slogan]])
  })

  it('每個情境一課:名稱、說明、狀態與腳本相同', () => {
    expect(lessons.map((l) => [l.id, l.title, l.summary, l.status, l.script, l.minutes])).toEqual(
      CLAUDE_CODE_SCENARIOS.map((s, i) => [String(i + 1), s.title, s.summary, s.video ? 'open' : 'planned', s.video?.script, s.video && minutesOf(s.video.duration)]),
    )
    expect(cc.access).toBe('free')
  })
})

// 寫入課程資料時依種子把每一課的腳本檔(script、files)讀進資料庫,缺檔會失敗(正式環境是部署失敗);這裡先擋下來
describe('種子寫到的每一課的腳本檔都存在', () => {
  const LIVE = new Set(Object.keys(import.meta.glob('./live/**/*.json')).map((k) => k.replace('./live/', '')))
  const files = (SEED_JSON as Seed[]).flatMap((c) => (c.units ?? []).flatMap((u) => u.lessons.flatMap((l) => [l.script, ...(l.files ?? [])].filter(Boolean).map((p) => [`${c.id} ${l.id}`, p!]))))

  it('script 與 files 都在 src/content/live/,而且不在研發基地專用的 lab/、promo/', () => {
    expect(files.filter(([, p]) => !LIVE.has(p) || /^(lab|promo)\//.test(p))).toEqual([])
  })

  it('公開的腳本檔(研發基地專用的除外)都掛在某一課底下,前端才拿得到', () => {
    // 旁白清單、章節音軌清單跟著同名的腳本
    const base = (p: string) => p.replace(/(\.voice|\.mix)?\.json$/, '')
    const owned = new Set(files.map(([, p]) => base(p)))
    const studioOnly = /^(lab\/|promo\/|kids\/xray)/
    const orphan = [...LIVE].filter((p) => !studioOnly.test(p) && !owned.has(base(p)))
    expect(orphan).toEqual([])
  })
})
