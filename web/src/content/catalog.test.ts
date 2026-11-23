import { describe, expect, it } from 'vitest'
import { COURSES, coursePath, courseMapId, courseOfLevel, inHiddenStage, levelLabelOf, levelMapId, levelMapLessons, lessonNumber, lessonPath, lessonUrl, nextCourse, plannedChapterPath, stageOf } from './catalog'
import { seedCourse } from './courseSeed'
import { SOFTWARE_STAGE_CONTENT } from './softwareStages'
import { ALL_LEVELS as LEVELS, levelPath, stageAnchor } from './levels'
import { CLAUDE_CODE_LESSON_PAGES, topicOfCourse } from './topics'
import { WEB_LESSON_PAGES } from './webCourse'
import { LAUNCH_LESSON_PAGES, launchLessonPath } from './launchCourse'
import { KIDS_LESSON_PAGES } from './kidsCourse'
import courseSeed from '../../../server/internal/store/courses_seed.json'

const allPaths = COURSES.flatMap((c) => [
  coursePath(c),
  ...(c.stages ? seedCourse(c.slug).units.flatMap((u) => u.lessons.map((l) => lessonUrl(c.slug, l.id))) : []),
  ...c.planned.map((ch) => plannedChapterPath(c, ch)),
])

// 軟體課前端寫死的課程內容(研發基地與單課頁的提示詞用):課程結構以種子為準,這裡只檢查內容資料本身的一致性
const lessons = SOFTWARE_STAGE_CONTENT.flatMap((st) => st.lessons.map((l) => [`software ${l.id}`, l] as const))

describe('courses', () => {
  it('have unique slugs', () => {
    const slugs = COURSES.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('have unique lesson ids (seed) and planned slugs within each course', () => {
    for (const c of COURSES) {
      if (c.stages) {
        const ids = seedCourse(c.slug).units.flatMap((u) => u.lessons.map((l) => l.id))
        expect(new Set(ids).size, c.slug).toBe(ids.length)
      }
      expect(new Set(c.planned.map((p) => p.slug)).size, c.slug).toBe(c.planned.length)
    }
  })
})

describe('course URLs', () => {
  it('are unique', () => {
    const dupes = allPaths.filter((p, i) => allPaths.indexOf(p) !== i)
    expect(dupes).toEqual([])
  })

  it.each(allPaths)('%s is a clean path (no dot in last segment, no trailing slash)', (p) => {
    expect(p.startsWith('/courses/')).toBe(true)
    expect(p.endsWith('/')).toBe(false)
    expect(p).not.toMatch(/\/\//)
    // Go server 把最後一段含 '.' 的網址當成靜態檔
    expect(p.split('/').pop()).not.toContain('.')
    expect(p).toMatch(/^[a-z0-9/-]+$/)
  })

  it('AI Agent 中階課沒有自己的頁面:不在課程目錄,等級卡片連到主題頁', () => {
    expect(COURSES.some((c) => c.slug === 'ai-agent')).toBe(false)
    expect(allPaths.some((p) => p.startsWith('/courses/ai-agent'))).toBe(false)
    expect(LEVELS.find((l) => l.id === 'ai-agent')!.link).toBe('/topics/ai-apps#units')
  })
})

describe('lessonNumber / lessonPath', () => {
  const l = (id: string) => ({ id })
  it('drops the 0. prefix for L0 lessons', () => {
    expect(lessonNumber(l('0.1'))).toBe('1')
    expect(lessonNumber(l('0.12'))).toBe('12')
  })
  it('keeps other lesson ids', () => {
    expect(lessonNumber(l('1.1'))).toBe('1.1')
    expect(lessonNumber(l('2.10'))).toBe('2.10')
  })
  it('lessonPath replaces the dot with a dash', () => {
    const software = COURSES.find((c) => c.slug === 'software')!
    expect(lessonPath(software, l('1.1'))).toBe('/courses/software/1-1')
    expect(lessonPath(software, l('0.3'))).toBe('/courses/software/3')
    expect(lessonPath(software, l('4.3'))).toBe('/courses/software/4-3')
    expect(lessonPath(software, { id: '0.intro' })).toBe('/courses/software/intro')
  })
  it('lessonUrl 任何課都用同一條規則:小數點換成 -,只有 software 的 0.N 去掉 0.', () => {
    expect(lessonUrl('web', '1.2')).toBe('/courses/web/1-2')
    expect(lessonUrl('web', '0.1')).toBe('/courses/web/0-1')
    expect(lessonUrl('launch', '0.1')).toBe('/courses/launch/0-1')
    expect(lessonUrl('claude-code', '1')).toBe('/courses/claude-code/1')
    expect(lessonUrl('software', '0.1')).toBe('/courses/software/1')
    expect(lessonUrl('software', '0.intro')).toBe('/courses/software/intro')
    expect(lessonUrl('software', '1.0')).toBe('/courses/software/1-0')
    expect(lessonUrl('software', '4.3')).toBe('/courses/software/4-3')
  })
})

describe('lesson content', () => {
  it('there is at least one lesson', () => {
    expect(lessons.length).toBeGreaterThan(0)
  })

  it.each(lessons)('%s has title, goal, and steps with title+expected', (_, lesson) => {
    expect(lesson.title.trim()).not.toBe('')
    expect(lesson.goal.trim()).not.toBe('')
    expect(lesson.steps.length).toBeGreaterThanOrEqual(1)
    for (const [i, s] of lesson.steps.entries()) {
      expect(s.title?.trim(), `step ${i + 1} title`).toBeTruthy()
      expect(s.expected?.trim(), `step ${i + 1} expected`).toBeTruthy()
    }
    // 步驟標題用作 React key,必須唯一
    expect(new Set(lesson.steps.map((s) => s.title)).size).toBe(lesson.steps.length)
  })

  it.each(lessons)('%s videos reference valid steps and cover every step', (_, lesson) => {
    const n = lesson.steps.length
    expect(lesson.videos.length).toBeGreaterThanOrEqual(1)
    const covered = new Set<number>()
    for (const v of lesson.videos) {
      expect(v.steps.length, v.title).toBeGreaterThan(0)
      for (const s of v.steps) {
        expect(Number.isInteger(s) && s >= 1 && s <= n, `${v.title}: step ${s} of ${n}`).toBe(true)
        covered.add(s)
      }
    }
    const missing = Array.from({ length: n }, (_, i) => i + 1).filter((s) => !covered.has(s))
    expect(missing).toEqual([])
    // 影片標題用作 React key
    expect(new Set(lesson.videos.map((v) => v.title)).size).toBe(lesson.videos.length)
  })

  it.each(lessons)('%s cues reference the video steps in ascending time', (_, lesson) => {
    for (const v of lesson.videos) {
      if (!v.cues) continue
      for (const [i, c] of v.cues.entries()) {
        expect(v.steps, `${v.title} cue step ${c.step}`).toContain(c.step)
        expect(c.at).toBeGreaterThanOrEqual(0)
        if (i > 0) expect(c.at, `${v.title} cue ${i}`).toBeGreaterThan(v.cues[i - 1].at)
      }
    }
  })
})

describe('LEVELS ↔ COURSES', () => {
  const coursePaths = new Set([...COURSES.map(coursePath), '/topics/ai-apps'])

  it('三個等級是 software 一門課的三個階段:階段 id = 等級 id,連結帶 #stage-<id>', () => {
    const software = COURSES.find((c) => c.slug === 'software')!
    expect(software.stages!.map((st) => st.id)).toEqual(['tools', 'ai-tools', 'vibe-coding-basics'])
    for (const st of software.stages!) {
      const lv = LEVELS.find((l) => l.id === st.id)!
      expect(lv.link).toBe(`/courses/software#${stageAnchor(st.id)}`)
      expect(levelPath(lv)).toBe(coursePath(software))
      expect(courseOfLevel(lv)).toBe(software)
      expect(levelMapId(lv)).toBe('software')
      expect(st.label).toBe(lv.levelLabel)
      expect(Boolean(st.hidden)).toBe(Boolean(lv.hidden))
    }
    // 階段就是種子的單元:每一課都在某個階段裡
    expect(seedCourse('software').units.map((u) => u.id)).toEqual(software.stages!.map((st) => st.id))
    expect(courseMapId(software)).toBe('software')
  })

  it('stageOf / levelLabelOf / inHiddenStage 依課所在階段', () => {
    const software = COURSES.find((c) => c.slug === 'software')!
    expect(stageOf(software, { id: '0.1' })?.id).toBe('tools')
    expect(stageOf(software, { id: '1.0' })?.id).toBe('ai-tools')
    expect(stageOf(software, { slug: '4-3' })?.id).toBe('vibe-coding-basics')
    expect(levelLabelOf(software, { id: '0.1' })).toBe('起步')
    expect(levelLabelOf(software, { slug: '4-3' })).toBe('基礎')
    expect(levelLabelOf(software)).toBe(software.level)
    expect(inHiddenStage(software, { id: '1.0' })).toBe(true)
    expect(inHiddenStage(software, { id: '0.1' })).toBe(false)
    expect(inHiddenStage(software, { slug: '4-3' })).toBe(false)
  })

  it('levelMapLessons:分階段的課只取同 id 單元的課', () => {
    const lessonsOf = (id: string) => [{ id: `${id}.1`, title: '', summary: '', access: 'free' as const, status: 'open' as const }]
    const map = { id: 'software', title: '', access: 'free' as const, units: ['tools', 'ai-tools', 'vibe-coding-basics'].map((id) => ({ id, title: '', subtitle: '', lessons: lessonsOf(id) })) }
    const lv = (id: string) => LEVELS.find((l) => l.id === id)!
    expect(levelMapLessons(map, lv('ai-tools'))!.map((l) => l.id)).toEqual(['ai-tools.1'])
    expect(levelMapLessons(map, lv('vibe-coding-basics'))!.map((l) => l.id)).toEqual(['vibe-coding-basics.1'])
    expect(levelMapLessons(undefined, lv('tools'))).toBeUndefined()
  })

  it('level ids are unique', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length)
  })

  it.each(LEVELS.filter((l) => l.link).map((l) => [l.id, l.link!] as const))('level %s links to an existing course (%s)', (_, link) => {
    expect(coursePaths.has(link.split('#')[0])).toBe(true)
  })

  // 首頁課程地圖會略過對不到的單課(不 throw),所以在這裡確保每一項都對得到
  it.each(LEVELS.filter((l) => l.lessons?.length).map((l) => [l.id, l] as const))('level %s lessons all exist in its course', (_, level) => {
    const course = courseOfLevel(level)
    expect(course, `${level.id} 找不到 link 為 ${level.link} 的課程`).toBeDefined()
    // 分階段的課:等級的課要在種子同 id 單元裡
    const ids = new Set(seedCourse(course!.slug).units.find((u) => u.id === level.id)!.lessons.map((l) => l.id))
    const missing = level.lessons!.map((l) => l.id).filter((id) => !ids.has(id))
    expect(missing).toEqual([])
  })

  it('every course takes its title from a level', () => {
    // (分階段的課「做出自己的軟體」有自己的課名,階段的標題在各階段的等級;不是等級的課(課頁在別處:網頁怎麼運作等)課名來自主題資料)
    const titles = new Set(LEVELS.map((l) => l.title))
    for (const c of COURSES.filter((c) => !c.stages && !(c.slug in PAGE_COURSE_PATHS))) expect(titles.has(c.title), c.slug).toBe(true)
  })
})

describe('nextCourse', () => {
  const bySlug = (slug: string) => COURSES.find((c) => c.slug === slug)!
  it('分階段的課(做出自己的軟體)在課內依序上,沒有下一門課', () => {
    expect(nextCourse(bySlug('software'))).toBeUndefined()
  })
  it('先不公開(hidden)的課程不會被當成下一章', () => {
    expect(COURSES.filter((c) => c.hidden).every((h) => COURSES.every((c) => nextCourse(c) !== h))).toBe(true)
  })
})

// 課頁在別處產生的課(網頁怎麼運作、從做好到上線、Claude Code 工作術):課程總覽頁共用 CourseOverviewPage,
// 單課頁由 home/routes.tsx 產生,所以 catalog 裡沒有 lessons、planned(否則 courses/routes.tsx 會產生重複的路由)
// 課程總覽頁的連結規則(overviewModel.ts)是「資料庫有腳本、開放或草稿」→ lessonUrl(課程, 課號);網址要和這些課頁註冊的網址一樣
const PAGE_COURSE_PATHS: Record<string, Record<string, string>> = {
  web: Object.fromEntries(Object.entries(WEB_LESSON_PAGES).map(([id, l]) => [id, l.path])),
  launch: Object.fromEntries(LAUNCH_LESSON_PAGES.map((id) => [id, launchLessonPath(id)])),
  kids: Object.fromEntries(Object.entries(KIDS_LESSON_PAGES).map(([id, l]) => [id, l.path])),
  'claude-code': Object.fromEntries(Object.entries(CLAUDE_CODE_LESSON_PAGES).map(([id, l]) => [id, l.path])),
}

describe('課頁在別處的課', () => {
  const paged = COURSES.filter((c) => c.slug in PAGE_COURSE_PATHS)

  it('web、launch、kids、claude-code 都是 /courses/<課程> 的共用總覽頁,課程地圖 id 就是 slug', () => {
    expect(paged.map((c) => c.slug)).toEqual(['web', 'launch', 'kids', 'claude-code'])
    for (const c of paged) {
      expect(coursePath(c)).toBe(`/courses/${c.slug}`)
      expect(courseMapId(c)).toBe(c.slug)
      expect(c.planned, c.slug).toEqual([])
    }
  })

  it('課頁網址在 /courses/<課程>/ 底下,不含小數點,沒有重複', () => {
    for (const c of paged) {
      const paths = Object.values(PAGE_COURSE_PATHS[c.slug])
      expect(paths.length, c.slug).toBeGreaterThan(0)
      expect(new Set(paths).size, c.slug).toBe(paths.length)
      for (const p of paths) {
        expect(p.startsWith(`${coursePath(c)}/`), p).toBe(true)
        expect(p.split('/').pop()).not.toContain('.')
      }
    }
  })

  it('每一課都在資料庫種子的課程地圖裡,而且有腳本、開放或草稿(總覽頁才連得到)', () => {
    const seed = courseSeed as unknown as { id: string; units?: { lessons: { id: string; script?: string; status: string }[] }[] }[]
    for (const c of paged) {
      const lessons = seed.find((s) => s.id === courseMapId(c))!.units!.flatMap((u) => u.lessons)
      for (const id of Object.keys(PAGE_COURSE_PATHS[c.slug])) {
        const l = lessons.find((x) => x.id === id)
        expect(l, `${c.slug} ${id}`).toBeDefined()
        // 課頁寫好了、正式機還是規劃中的課(兒童課 4.x):種子沒有掛腳本,課程總覽不連
        if (l!.status === 'planned') continue
        expect(l!.script, `${c.slug} ${id}`).toBeTruthy()
        expect(['open', 'draft'], `${c.slug} ${id}`).toContain(l!.status)
      }
      // 反過來:種子裡有腳本的課都有課頁
      expect(lessons.filter((l) => l.script).map((l) => l.id), c.slug).toEqual(Object.keys(PAGE_COURSE_PATHS[c.slug]).filter((id) => lessons.find((l) => l.id === id)?.status !== 'planned'))
    }
  })

  it('總覽頁的連結網址(lessonUrl)等於每一課頁註冊的網址', () => {
    for (const c of paged) {
      for (const [id, path] of Object.entries(PAGE_COURSE_PATHS[c.slug])) expect(lessonUrl(c.slug, id), `${c.slug} ${id}`).toBe(path)
    }
  })

  it('主題就是這門課自己:topicOfCourse 回傳這個主題,課程頁的麵包屑不會連回自己', () => {
    for (const c of paged) expect(topicOfCourse(coursePath(c)).path).toBe(coursePath(c))
    expect(topicOfCourse('/courses/software').path).toBe('/topics/software')
  })
})
