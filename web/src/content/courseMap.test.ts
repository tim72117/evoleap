import { describe, expect, it } from 'vitest'
import courseSeed from '../../../server/internal/store/courses_seed.json'
import { KIDS_LESSON_PAGES, KIDS_UNITS } from './kidsCourse'
import { LAUNCH_LESSON_PAGES, launchScriptKey } from './launchCourse'
import { WEB_LESSON_PAGES, WEB_UNITS } from './webCourse'
import { COURSES, courseMapId } from './catalog'
import { SOFTWARE_STAGE_CONTENT } from './softwareStages'
import { L2_MODULES, l2OutlineLessons } from './l2Outline'
import { L2_LESSONS } from './l2Lessons'
import { minutesOf } from '../courses/CourseOverviewPage'
import { UNITS as AI_AGENT_UNITS } from './aiAgent'
import { ALL_LEVELS, LEVELS } from './levels'
import { hideDrafts } from './courseMap'
import { CLAUDE_CODE_LESSON_PAGES, CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC, LAUNCH_TOPIC, WEB_TOPIC } from './topics'
import { launchLessonPath } from './launchCourse'

// 課程地圖的資料在伺服器的種子資料(資料庫);課程頁、SEO、研發基地還是用前端的 kidsCourse.ts、webCourse.ts。兩邊要一致。
type Seed = { id: string; title: string; access: string; units?: { id: string; title: string; subtitle: string; lessons: { id: string; title: string; summary: string; access?: string; status: string; script?: string; files?: string[]; minutes?: number }[] }[] }

// 種子資料在 web/ 外面(Docker 建置前端時也會複製這份檔案,見 Dockerfile;seo/build.ts 也直接 import)
const SEED_JSON: unknown = courseSeed

describe('兒童課的課程地圖(資料庫種子)和前端課程資料一致', () => {
  it('讀得到伺服器的種子資料', () => {
    expect(SEED_JSON).toBeDefined()
  })

  const kids = (SEED_JSON as Seed[]).find((c) => c.id === 'kids')!

  // KIDS_UNITS 只剩研發基地的大綱頁在用;課名、一句話以種子為準,這裡只擋單元與課的編號、課名對不上(說明文字不再逐字比對)
  it('單元與每一課的課號、名稱和研發基地的大綱相同', () => {
    expect(kids.units!.map((u) => [u.id, u.title])).toEqual(KIDS_UNITS.map((u) => [u.id, u.title]))
    expect(kids.units!.flatMap((u) => u.lessons.map((l) => [l.id, l.title]))).toEqual(KIDS_UNITS.flatMap((u) => u.lessons.map((l) => [l.id, l.title])))
  })

  it('有腳本的課(開放與草稿)和課程頁(KIDS_LESSON_PAGES)相同、腳本相同', () => {
    const lessons = kids.units!.flatMap((u) => u.lessons)
    // 4.1~4.5 的課程頁與腳本已寫好,但正式機是規劃中(規劃中的課不能掛腳本):種子沒有腳本,課程頁照資料庫顯示規劃中
    const planned = new Set(lessons.filter((l) => l.status === 'planned').map((l) => l.id))
    expect(lessons.filter((l) => l.script).map((l) => [l.id, l.script])).toEqual(Object.entries(KIDS_LESSON_PAGES).filter(([id]) => !planned.has(id)).map(([id, l]) => [id, l.script]))
    expect(lessons.filter((l) => l.script && l.status !== 'open' && l.status !== 'draft')).toEqual([])
    expect(kids.access).toBe('login-free')
  })

  it('開放的課(含 3.1~3.5)都有完整的課程頁:網址照課號、腳本檔存在(不在 lab/)、有給家長的話', () => {
    const scripts = import.meta.glob('./live/**/*.json')
    const open = kids.units!.flatMap((u) => u.lessons).filter((l) => l.status === 'open')
    expect(open.map((l) => l.id)).toEqual(expect.arrayContaining(['3.1', '3.2', '3.3', '3.4', '3.5']))
    for (const l of open) {
      const page = KIDS_LESSON_PAGES[l.id]
      expect(page, l.id).toBeDefined()
      expect(page.path).toBe(`/courses/kids/${l.id.replace('.', '-')}`)
      expect(page.script).toBe(l.script)
      expect(scripts[`./live/${l.script}`], l.id).toBeDefined()
      expect(l.script!.startsWith('lab/')).toBe(false)
      expect(page.parents.length, l.id).toBeGreaterThan(0)
    }
  })
})

describe('網頁怎麼運作、從做好到上線:課程總覽是共用的課程總覽頁(/courses/<課程>),不再是 /topics/', () => {
  it('主題的網址就是課程總覽頁', () => {
    expect(WEB_TOPIC.path).toBe('/courses/web')
    expect(LAUNCH_TOPIC.path).toBe('/courses/launch')
    expect(CLAUDE_CODE_TOPIC.path).toBe('/courses/claude-code')
    expect(launchLessonPath('2.3')).toBe('/courses/launch/2-3')
  })
})

describe('網頁怎麼運作的課程地圖(資料庫種子)和前端課程資料一致', () => {
  const web = (SEED_JSON as Seed[]).find((c) => c.id === 'web')!

  // WEB_UNITS 只剩研發基地的大綱頁在用;課名、單元說明、一句話以種子為準,這裡只擋課號、名稱對不上
  it('單元與每一課的課號、名稱和研發基地的大綱相同', () => {
    expect(web.units!.map((u) => [u.id, u.title])).toEqual(WEB_UNITS.map((u) => [u.id, u.title]))
    expect(web.units!.flatMap((u) => u.lessons.map((l) => [l.id, l.title]))).toEqual(WEB_UNITS.flatMap((u) => u.lessons.map((l) => [l.id, l.title])))
  })

  it('有腳本的課和有課程頁的課(WEB_LESSON_PAGES)相同、腳本相同', () => {
    const lessons = web.units!.flatMap((u) => u.lessons)
    expect(lessons.filter((l) => l.script).map((l) => [l.id, l.script])).toEqual(Object.entries(WEB_LESSON_PAGES).map(([id, l]) => [id, l.script]))
    expect(web.access).toBe('login-free')
  })

  it('課程頁網址照課號規則(0.1 → /courses/web/0-1),課程地圖連得過去', () => {
    for (const [id, l] of Object.entries(WEB_LESSON_PAGES)) expect(l.path).toBe(`/courses/web/${id.replace('.', '-')}`)
  })
})

describe('從做好到上線的課程地圖(資料庫種子)和前端課程資料一致', () => {
  const launch = (SEED_JSON as Seed[]).find((c) => c.id === 'launch')!
  const lessons = launch.units!.flatMap((u) => u.lessons)
  const scripts = import.meta.glob('./live/**/*.json')

  it('每個單元都有標題與說明,每一課都有名稱與一句話(前端沒有副本,種子就是唯一來源)', () => {
    for (const u of launch.units!) expect([u.id, u.title.trim() !== '', u.subtitle.trim() !== '']).toEqual([u.id, true, true])
    for (const l of lessons) expect([l.id, l.title.trim() !== '', l.summary.trim() !== '']).toEqual([l.id, true, true])
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
})

// 「AI 工具介紹」「AI 工具入門」的課程頁還是讀前端的 l0Lessons.ts、l1Lessons.ts;資料庫只記錄課程結構與狀態,兩邊要一致。
// 單元名稱來自研發基地的課程規劃(studio/proposal/basicsData.ts 的 MODULES)。
// 三個等級現在是「做出自己的軟體」(software)一門課的三個階段:資料庫是一門課、三個單元,單元 id 就是階段 id。
describe('做出自己的軟體(software)的課程地圖(資料庫種子):一門課、每個階段一個單元', () => {
  const software = (SEED_JSON as Seed[]).find((c) => c.id === 'software')!
  const course = COURSES.find((c) => c.slug === 'software')!

  it('種子沒有舊的三門課(tools、ai-tools、vibe-coding-basics 現在是 software 的單元)', () => {
    const ids = (SEED_JSON as Seed[]).map((c) => c.id)
    for (const old of ['tools', 'ai-tools', 'vibe-coding-basics']) expect(ids, old).not.toContain(old)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('單元就是階段:id 與順序和 catalog 的 stages 相同,單元標題是「階段・等級標題」', () => {
    expect(software.units!.map((u) => u.id)).toEqual(course.stages!.map((st) => st.id))
    for (const st of course.stages!) {
      const lv = ALL_LEVELS.find((l) => l.id === st.id)!
      expect(software.units!.find((u) => u.id === st.id)!.title).toBe(`${st.label}・${lv.title}`)
    }
    expect(software.title).toBe(course.title)
    expect(software.access).toBe('login-free')
  })

  it('每個階段的單元,課(含規劃中的章節)和階段的 lessons、planned 相同;課程整體是各階段依序合起來', () => {
    for (const st of SOFTWARE_STAGE_CONTENT) {
      const unit = software.units!.find((u) => u.id === st.id)!
      expect([...unit.lessons.map((l) => l.id)].sort(), st.id).toEqual([...st.lessons.map((l) => l.id), ...st.planned.map((p) => p.id ?? p.label)].sort())
    }
    const all = software.units!.flatMap((u) => u.lessons.map((l) => l.id))
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual(SOFTWARE_STAGE_CONTENT.flatMap((st) => [...st.lessons.map((l) => l.id), ...st.planned.map((p) => p.id ?? p.label)]).sort())
  })
})

// 「AI 工具介紹」「AI 工具入門」的課程頁還是讀前端的 l0Lessons.ts、l1Lessons.ts;資料庫只記錄課程結構與狀態,兩邊要一致。
describe.each(['tools', 'ai-tools'])('%s 階段的課程地圖(資料庫種子)和前端課程資料一致', (id) => {
  const seed = (SEED_JSON as Seed[]).find((c) => c.id === 'software')!
  const course = SOFTWARE_STAGE_CONTENT.find((st) => st.id === id)!
  const lessons = seed.units!.find((u) => u.id === id)!.lessons

  // 規劃中的章節(course.planned,例如 tools 的 0.3)只有標題,種子裡照課號排在寫好的課之間
  it('每一課的課號、名稱與學習時間相同,寫好的課順序相同', () => {
    const planned = course.planned.map((ch) => ch.id ?? ch.label)
    expect([...lessons.map((l) => l.id)].sort()).toEqual([...course.lessons.map((l) => l.id), ...planned].sort())
    expect(lessons.filter((l) => !planned.includes(l.id)).map((l) => [l.id, l.title, l.minutes])).toEqual(course.lessons.map((l) => [l.id, l.title, minutesOf(l.length)]))
    for (const ch of course.planned) expect(lessons.find((l) => l.id === (ch.id ?? ch.label))!.title).toBe(ch.title)
  })

  it('有影片的課是開放(草稿是 draft)、腳本和第一支影片相同,規劃中的章節是 planned', () => {
    for (const l of course.lessons) {
      const s = lessons.find((x) => x.id === l.id)!
      const live = l.videos[0]?.live
      expect([l.id, s.status, s.script]).toEqual([l.id, live ? (l.draft ? 'draft' : 'open') : 'planned', live])
    }
    for (const ch of course.planned) expect(lessons.find((l) => l.id === (ch.id ?? ch.label))!.status).toBe('planned')
  })

  it('整門課登入後免費', () => {
    expect(seed.access).toBe('login-free')
  })
})

// 還沒有課程內容的課:Vibe Coding 入門的課照 l2Outline.ts;AI Agent 整合應用、進階 AI Agent 應用只規劃到單元／主題,單元底下還沒有課
describe('還在規劃的課程(資料庫種子)和前端的規劃一致', () => {
  const seed = (id: string) => (SEED_JSON as Seed[]).find((c) => c.id === id)!

  it('Vibe Coding 入門(software 的基礎階段):每一課(課號、名稱、這一課能做到的事)相同;寫好的課(l2Lessons.ts)有腳本,草稿與否兩邊一致,其他規劃中', () => {
    // 資料庫的單元是階段(不再是 l2Outline 的主題),這個階段的課依 l2Outline 的順序放在同一個單元
    const vc = { units: seed('software').units!.filter((u) => u.id === 'vibe-coding-basics') }
    expect(L2_MODULES.length).toBeGreaterThan(0)
    const status = (id: string) => {
      const l = L2_LESSONS.find((x) => x.id === id)
      return l ? (l.draft ? 'draft' : 'open') : 'planned'
    }
    // 搬走、拿掉的章節(L2_DROPPED)不在種子裡
    expect(vc.units!.flatMap((u) => u.lessons.map((l) => [l.id, l.title, l.summary, l.status, l.minutes, l.script]))).toEqual(
      l2OutlineLessons().map(({ id, lesson: l }) => [id, l.title, l.objective, status(id), minutesOf(l.length), L2_LESSONS.find((x) => x.id === id)?.videos[0].live]),
    )
    // 課程頁的課名、時間和大綱相同
    for (const l of L2_LESSONS) {
      const [num, n] = l.id.split('.')
      const outline = L2_MODULES.find((m) => m.num === num)!.lessons[Number(n) - 1]
      expect([l.title, l.length], l.id).toEqual([outline.title, outline.length])
    }
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

  it('有課程頁的情境(CLAUDE_CODE_LESSON_PAGES)就是有腳本的課:課號、腳本相同,網址是 /courses/claude-code/<課號>,錨點是腳本檔名', () => {
    expect(lessons.filter((l) => l.script).map((l) => [l.id, l.script])).toEqual(Object.entries(CLAUDE_CODE_LESSON_PAGES).map(([id, l]) => [id, l.script]))
    for (const [id, l] of Object.entries(CLAUDE_CODE_LESSON_PAGES)) {
      expect(l.path).toBe(`${CLAUDE_CODE_TOPIC.path}/${id}`)
      expect(l.path).toBe(`/courses/claude-code/${id}`)
      expect(l.script).toBe(`claude-code/${l.anchor}.json`)
    }
  })
})

// 每門課的前五課免登入預覽(資料庫 lessons.access 為準,種子要和正式機一致):分階段的 software 每個階段(單元)各自的前五課,
// 其他課是整門課依課程順序(跨單元)的前五課;其餘的課不寫 access(照課程的登入後免費)。前端不再判斷存取,只標示資料庫的結果。
const FREE_LESSON_COUNT = 5
describe('每門課前五課免費預覽(資料庫種子)', () => {
  const lessonsOf = (c: Seed) => (c.id === 'software' ? c.units!.map((u) => u.lessons) : [c.units!.flatMap((u) => u.lessons)])
  const courses = (SEED_JSON as Seed[]).filter((c) => ['software', 'web', 'kids', 'launch'].includes(c.id))

  it('前五課是 free,其他課沒有 access', () => {
    expect(courses.map((c) => c.id).sort()).toEqual(['kids', 'launch', 'software', 'web'])
    for (const c of courses) {
      for (const group of lessonsOf(c)) {
        group.forEach((l, i) => expect(l.access, `${c.id} ${l.id}`).toBe(i < FREE_LESSON_COUNT ? 'free' : undefined))
      }
    }
  })
})

// 寫入課程資料時依種子把每一課的腳本檔(script、files)讀進資料庫,缺檔會失敗(正式環境是部署失敗);這裡先擋下來
describe('種子寫到的每一課的腳本檔都存在', () => {
  const LIVE = new Set(Object.keys(import.meta.glob('./live/**/*.json')).map((k) => k.replace('./live/', '')))
  // 課程簡介影片(introScript)也是這門課的檔
  const files = (SEED_JSON as (Seed & { introScript?: string })[]).flatMap((c) => [
    ...(c.introScript ? [[`${c.id} 簡介影片`, c.introScript]] : []),
    ...(c.units ?? []).flatMap((u) => u.lessons.flatMap((l) => [l.script, ...(l.files ?? [])].filter(Boolean).map((p) => [`${c.id} ${l.id}`, p!]))),
  ])

  it('script 與 files 都在 src/content/live/,而且不在研發基地專用的 lab/、promo/', () => {
    expect(files.filter(([, p]) => !LIVE.has(p) || /^(lab|promo)\//.test(p))).toEqual([])
  })

  it('公開的腳本檔(研發基地專用的除外)都掛在某一課底下,前端才拿得到', () => {
    // 旁白清單、章節音軌清單跟著同名的腳本
    const base = (p: string) => p.replace(/(\.voice|\.mix)?\.json$/, '')
    const owned = new Set(files.map(([, p]) => base(p)))
    // kids/4.x:4.1~4.5 在正式機是規劃中、不能掛腳本,檔案先放研發基地(上架時改種子加回 script)
    const studioOnly = /^(lab\/|promo\/|kids\/xray|kids\/4\.)/
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

// 課程資訊(簡介、說明段落、搜尋標題與描述、插圖、簡介影片、單元簡短名稱與先不公開):課程總覽、課程列表、首頁階段名稱都讀資料庫(API),
// build 時的 SEO 靜態頁讀這份種子(seo/pages.ts),所以前端不再有這些內容的副本;這裡檢查種子本身合規,以及前端還留著的相關資料(levels.ts、catalog 的課名)和它一致。
type InfoSeed = { id: string; title: string; summary?: string; about?: string[]; seoTitle?: string; description?: string; art?: string; introScript?: string; units: { id: string; label?: string; hidden?: boolean }[] }
describe('種子的課程資訊', () => {
  const seed = (id: string): InfoSeed => (SEED_JSON as InfoSeed[]).find((c) => c.id === id)!

  it('每門課都有簡介(總覽頁的導言、課程列表的卡片)', () => {
    for (const c of SEED_JSON as InfoSeed[]) expect((c.summary ?? '').trim(), c.id).not.toBe('')
  })

  it('software、web、launch 有說明段落(課程說明);只有兒童課有簡介影片', () => {
    for (const id of ['software', 'web', 'launch']) expect(seed(id).about!.length, id).toBeGreaterThan(0)
    expect((SEED_JSON as InfoSeed[]).filter((c) => c.introScript).map((c) => c.id)).toEqual(['kids'])
  })

  it('catalog 的課名(路由、單課頁麵包屑用)和種子的課名相同', () => {
    for (const c of COURSES) expect(seed(courseMapId(c)).title, c.slug).toBe(c.title)
  })

  it('software 的單元:簡短名稱和先不公開,levels.ts(主題地圖頁還在用)和種子一致', () => {
    expect(seed('software').units.map((u) => [u.id, u.label, Boolean(u.hidden)])).toEqual(LEVELS.map((l) => [l.id, l.levelLabel, Boolean(l.hidden)]))
  })

  it('等級的插圖(levels.ts)和種子的插圖相同', () => {
    for (const lv of ALL_LEVELS) expect(seed(lv.id === 'tools' || lv.id === 'ai-tools' || lv.id === 'vibe-coding-basics' ? 'software' : lv.id).art ?? '', lv.id).toBe(lv.id === 'tools' || lv.id === 'ai-tools' || lv.id === 'vibe-coding-basics' ? 'tools' : lv.art)
  })

  it('每門課的欄位長度、插圖、簡介影片路徑符合伺服器的規則', () => {
    for (const c of SEED_JSON as InfoSeed[]) {
      expect((c.summary ?? '').length, c.id).toBeLessThanOrEqual(500)
      expect((c.description ?? '').length, c.id).toBeLessThanOrEqual(500)
      expect((c.seoTitle ?? '').length, c.id).toBeLessThanOrEqual(200)
      expect(['', 'tools', 'chat', 'build', 'agent', 'advanced'], c.id).toContain(c.art ?? '')
      for (const p of c.about ?? []) expect(p.trim() !== '' && !p.includes('\n\n'), c.id).toBe(true)
      if (c.introScript) expect(c.introScript.endsWith('.json') && !c.introScript.startsWith('lab/') && !c.introScript.includes('..'), c.id).toBe(true)
    }
  })
})
