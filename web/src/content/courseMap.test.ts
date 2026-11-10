import { describe, expect, it } from 'vitest'
import courseSeed from '../../../server/internal/store/courses_seed.json'
import { KIDS_OPEN_LESSONS, KIDS_PREVIEW_LESSON, KIDS_RELEASED_LESSONS, KIDS_UNITS } from './kidsCourse'
import { LAUNCH_LESSON_PAGES, LAUNCH_OPEN_LESSONS, LAUNCH_UNITS, launchScriptKey } from './launchCourse'
import { WEB_OPEN_LESSONS, WEB_UNITS, webNeedsLogin } from './webCourse'
import { COURSES, isPreviewLesson } from './catalog'
import { L2_MODULES } from './l2Outline'
import { minutesOf } from '../courses/CourseOverviewPage'
import { UNITS as AI_AGENT_UNITS } from './aiAgent'
import { ALL_LEVELS } from './levels'
import { hideDrafts } from './courseMap'
import { CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC, IDEA_TOPIC } from './topics'
import { IDEA_UNITS } from './ideaCourse'

// 課程地圖的資料在伺服器的種子資料(資料庫);課程頁、SEO、研發基地還是用前端的 kidsCourse.ts、webCourse.ts。兩邊要一致。
type Seed = { id: string; title: string; access: string; tier?: string; units?: { id: string; title: string; subtitle: string; access?: string; tier?: string; lessons: { id: string; title: string; summary: string; access?: string; status: string; script?: string; files?: string[]; minutes?: number }[] }[] }

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

  it('有腳本的課(開放與草稿)和課程頁(KIDS_OPEN_LESSONS)相同、腳本相同;開放的課是 KIDS_RELEASED_LESSONS;只有第一課免費預覽', () => {
    const lessons = kids.units!.flatMap((u) => u.lessons)
    expect(lessons.filter((l) => l.script).map((l) => [l.id, l.script])).toEqual(Object.entries(KIDS_OPEN_LESSONS).map(([id, l]) => [id, l.script]))
    expect(lessons.filter((l) => l.script && l.status !== 'open' && l.status !== 'draft')).toEqual([])
    expect(lessons.filter((l) => l.status === 'open').map((l) => l.id)).toEqual(KIDS_RELEASED_LESSONS)
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

  it('課程頁網址照課號規則(0.1 → /courses/web/0-1),課程地圖連得過去', () => {
    for (const [id, l] of Object.entries(WEB_OPEN_LESSONS)) expect(l.path).toBe(`/courses/web/${id.replace('.', '-')}`)
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

// 「做出自己的軟體」(software)一門課三個單元(階段):起步 tools、零基礎 ai-tools、基礎 vibe-coding-basics。
// 課程頁讀前端的 l0Lessons.ts、l1Lessons.ts 與 l2Outline.ts;資料庫只記錄課程結構與狀態,兩邊要一致。
// tools:要訂閱(basic),只有序章免費預覽;ai-tools:登入後免費;vibe-coding-basics:要訂閱(basic)
describe('做出自己的軟體的課程地圖(資料庫種子)和前端課程資料一致', () => {
  const seed = (SEED_JSON as Seed[]).find((c) => c.id === 'software')!
  const course = COURSES.find((c) => c.slug === 'software')!
  const lessonsOf = (unitId: string) => seed.units!.find((u) => u.id === unitId)!.lessons

  it('整門課:課名相同,存取方式是登入後免費(各單元再自己決定)', () => {
    expect(seed.title).toBe(course.title)
    expect(seed.access).toBe('login-free')
  })

  it('單元就是前端的階段:id、順序相同,標題是「階段・等級標題」,標題下是等級簡介', () => {
    expect(seed.units!.map((u) => u.id)).toEqual(course.stages!.map((st) => st.id))
    for (const st of course.stages!) {
      const level = ALL_LEVELS.find((l) => l.id === st.id)!
      const unit = seed.units!.find((u) => u.id === st.id)!
      expect([unit.title, unit.subtitle]).toEqual([`${st.label}・${level.title}`, level.summary])
    }
  })

  it('單元底下每一課的課號與順序和前端階段相同(合起來就是課程的全部單課與規劃章節)', () => {
    for (const st of course.stages!) {
      expect(lessonsOf(st.id).map((l) => l.id), st.id).toEqual([...st.lessons.map((l) => l.id), ...st.planned.map((c) => c.label)])
    }
    expect(seed.units!.flatMap((u) => u.lessons.map((l) => l.id))).toEqual([...course.lessons.map((l) => l.id), ...course.planned.map((c) => c.label)])
  })

  it('單元的存取方式與方案等級照課程地圖(levels.ts)', () => {
    expect(seed.units!.map((u) => [u.id, u.access, u.tier])).toEqual([
      ['tools', 'subscription', 'basic'],
      ['ai-tools', 'login-free', undefined],
      ['vibe-coding-basics', 'subscription', 'basic'],
    ])
    for (const u of seed.units!) expect(u.access, u.id).toBe(ALL_LEVELS.find((l) => l.id === u.id)!.access)
  })

  it.each([['tools'], ['ai-tools']])('%s:每一課的名稱、順序與學習時間相同', (id) => {
    const st = course.stages!.find((x) => x.id === id)!
    expect(lessonsOf(id).map((l) => [l.id, l.title, l.minutes])).toEqual(st.lessons.map((l) => [l.id, l.title, minutesOf(l.length)]))
  })

  it.each([['tools'], ['ai-tools']])('%s:有影片的課是開放、腳本和第一支影片相同,其他是規劃中', (id) => {
    const st = course.stages!.find((x) => x.id === id)!
    for (const l of st.lessons) {
      const s = lessonsOf(id).find((x) => x.id === l.id)!
      const live = l.videos[0]?.live
      expect([l.id, s.status, s.script]).toEqual([l.id, live ? 'open' : 'planned', live])
    }
  })

  it('只有序章(起步)免費預覽', () => {
    const all = seed.units!.flatMap((u) => u.lessons)
    expect(all.filter((l) => l.access).map((l) => [l.id, l.access])).toEqual(course.lessons.filter(isPreviewLesson).map((l) => [l.id, 'free']))
  })
})

// 還沒有課程內容的課:Vibe Coding 入門(基礎階段)的課照 l2Outline.ts;AI Agent 整合應用、進階 AI Agent 應用只規劃到單元／主題,單元底下還沒有課
describe('還在規劃的課程(資料庫種子)和前端的規劃一致', () => {
  const seed = (id: string) => (SEED_JSON as Seed[]).find((c) => c.id === id)!

  it('Vibe Coding 入門(基礎階段):每一課(課號、名稱、這一課能做到的事)與 l2Outline 相同,全部規劃中', () => {
    const vc = seed('software').units!.find((u) => u.id === 'vibe-coding-basics')!
    expect(vc.lessons.map((l) => [l.id, l.title, l.summary, l.status, l.minutes])).toEqual(
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

describe('從構想到實作的課程地圖(資料庫種子)和前端課程資料一致', () => {
  const idea = (SEED_JSON as Seed[]).find((c) => c.id === 'idea')!
  const lessons = idea.units!.flatMap((u) => u.lessons)

  it('課名、單元與每一課的名稱、學會什麼相同', () => {
    expect(idea.title).toBe(IDEA_TOPIC.name)
    expect(idea.units!.map((u) => [u.id, u.title, u.subtitle])).toEqual(IDEA_UNITS.map((u) => [u.id, u.title, u.question]))
    expect(lessons.map((l) => [l.id, l.title, l.summary])).toEqual(IDEA_UNITS.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.learn])))
  })

  it('全部規劃中,沒有腳本(主題頁沒有課程頁)', () => {
    expect(lessons.filter((l) => l.status !== 'planned' || l.script)).toEqual([])
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

describe('畫面上的身分不是管理員時,草稿當成規劃中(模擬身分、備援地圖)', () => {
  const units = [{ id: '1', title: 'u', subtitle: '', lessons: [
    { id: '1.1', title: 'a', summary: '', access: 'login-free' as const, status: 'open' as const, script: 'k/1.1.json' },
    { id: '1.2', title: 'b', summary: '', access: 'login-free' as const, status: 'draft' as const, script: 'k/1.2.json' },
  ] }]
  it('不是管理員:草稿變規劃中、拿掉腳本;開放的不動', () => {
    const out = hideDrafts(units, false)
    expect(out[0].lessons.map((l) => [l.id, l.status, l.script])).toEqual([['1.1', 'open', 'k/1.1.json'], ['1.2', 'planned', undefined]])
  })
  it('管理員:原樣', () => {
    expect(hideDrafts(units, true)).toBe(units)
  })
})

// 前端課程地圖(levels.ts)的存取方式決定單課頁要不要套訂閱關卡,和資料庫種子要一致;只有「還沒決定」(tbd)的不比對
describe('課程地圖的存取方式和資料庫種子一致', () => {
  // 「做出自己的軟體」的三個等級是 software 課程底下的單元,存取方式記在單元;其他等級各是一門課
  const accessOf = (id: string) => {
    const seeds = SEED_JSON as Seed[]
    return seeds.find((c) => c.id === id) ?? seeds.flatMap((c) => c.units ?? []).find((u) => u.id === id)
  }
  it.each(ALL_LEVELS.filter((l) => l.access !== 'tbd').map((l) => [l.id, l.access] as const))('%s', (id, access) => {
    const seed = accessOf(id)
    expect(seed, `種子沒有課程或單元 ${id}`).toBeDefined()
    expect(seed!.access).toBe(access)
  })
})
