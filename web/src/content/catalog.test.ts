import { describe, expect, it } from 'vitest'
import { COURSES, coursePath, isPreviewLesson, lessonNumber, lessonPath, levelIdOf, levelLabelOf, plannedChapterPath, requiresLogin, requiresSubscription, stageOf } from './catalog'
import type { CourseLesson } from './lessonTypes'
import { ALL_LEVELS as LEVELS, levelPath, stageAnchor } from './levels'
import { AI_AGENT_COURSE_PATH } from './aiAgent'

const software = COURSES.find((c) => c.slug === 'software')!
const stage = (id: string) => software.stages!.find((st) => st.id === id)!

// 「做出自己的軟體」一門課三個階段:起步(tools)要訂閱、零基礎(ai-tools)登入後免費、基礎(vibe-coding-basics)要訂閱;存取方式照 levels.ts 的同 id 等級
describe('requiresLogin / requiresSubscription(依階段)', () => {
  const openOf = (id: string) => stage(id).lessons.filter((l) => !requiresLogin(software, l)).map((l) => l.id)

  it('零基礎(登入後免費):每一課都要登入', () => {
    expect(stage('ai-tools').lessons.length).toBeGreaterThan(0)
    expect(openOf('ai-tools')).toEqual([])
    for (const l of stage('ai-tools').lessons) expect(requiresSubscription(software, l), l.id).toBe(false)
  })

  // 起步要訂閱:登入由訂閱關卡(SubscriptionGate)處理,不走 LoginGate;只有序章不套關卡
  it('起步(訂閱):不走登入關卡,改套訂閱關卡,只有序章免費預覽', () => {
    const tools = stage('tools')
    expect(openOf('tools')).toEqual(tools.lessons.map((l) => l.id))
    for (const l of tools.lessons) expect(requiresSubscription(software, l), l.id).toBe(true)
    expect(tools.lessons.filter((l) => !isPreviewLesson(l)).map((l) => l.id)).toEqual(['0.0', '0.1', '0.2'])
  })

  it('基礎(訂閱):等級的存取方式是訂閱,目前只有規劃中的章節(沒有單課頁)', () => {
    const vibe = stage('vibe-coding-basics')
    expect(LEVELS.find((l) => l.id === vibe.id)!.access).toBe('subscription')
    expect(vibe.lessons).toEqual([])
    expect(vibe.planned.length).toBeGreaterThan(0)
  })

  it('不屬於任何階段的課(沒有 stages)照課程頁路徑對到的等級', () => {
    const agent = COURSES.find((c) => c.slug === 'ai-agent')!
    expect(agent.stages).toBeUndefined()
    expect(requiresSubscription(agent)).toBe(LEVELS.find((l) => l.id === 'ai-agent')!.access === 'subscription')
  })
})

describe('stageOf / levelLabelOf / levelIdOf', () => {
  it('每一課都屬於它所在的階段,flatten 後的 lessons 與各階段依序相同', () => {
    expect(software.lessons.map((l) => l.id)).toEqual(software.stages!.flatMap((st) => st.lessons.map((l) => l.id)))
    for (const st of software.stages!) for (const l of st.lessons) expect(stageOf(software, l)?.id, l.id).toBe(st.id)
  })

  it('規劃中的章節依 slug 對到階段', () => {
    for (const st of software.stages!) for (const ch of st.planned) expect(stageOf(software, ch)?.id, ch.slug).toBe(st.id)
  })

  it('階段 id 與 levels.ts 等級 id 相同,levelLabelOf 回傳起步、零基礎、基礎', () => {
    expect(software.stages!.map((st) => st.id)).toEqual(['tools', 'ai-tools', 'vibe-coding-basics'])
    expect(software.stages!.map((st) => st.label)).toEqual(['起步', '零基礎', '基礎'])
    for (const st of software.stages!) {
      expect(st.label).toBe(LEVELS.find((l) => l.id === st.id)!.levelLabel)
      for (const l of st.lessons) expect(levelLabelOf(software, l), l.id).toBe(st.label)
      for (const ch of st.planned) expect(levelLabelOf(software, ch), ch.slug).toBe(st.label)
    }
  })

  it('沒有指定課、或找不到階段時,levelLabelOf 回傳課程的 level;非分階段的課沒有 stageOf', () => {
    expect(levelLabelOf(software)).toBe(software.level)
    expect(levelLabelOf(software, { id: 'nope' })).toBe(software.level)
    const agent = COURSES.find((c) => c.slug === 'ai-agent')!
    expect(stageOf(agent, { slug: 'capstone' })).toBeUndefined()
    expect(levelLabelOf(agent)).toBe(agent.level)
  })

  it('levelIdOf:分階段的課回傳課程 slug(資料庫課程 id),其他課回傳等級 id', () => {
    expect(levelIdOf(software)).toBe('software')
    expect(levelIdOf(COURSES.find((c) => c.slug === 'ai-agent')!)).toBe('ai-agent')
    expect(levelIdOf(COURSES.find((c) => c.slug === 'advanced')!)).toBe('advanced')
  })
})

const allPaths = COURSES.flatMap((c) => [
  coursePath(c),
  ...c.lessons.map((l) => lessonPath(c, l)),
  ...c.planned.map((ch) => plannedChapterPath(c, ch)),
])

const lessons = COURSES.flatMap((c) => c.lessons.map((l) => [`${c.slug} ${l.id}`, l] as const))

describe('courses', () => {
  it('have unique slugs', () => {
    const slugs = COURSES.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('have unique lesson ids and planned slugs within each course', () => {
    for (const c of COURSES) {
      expect(new Set(c.lessons.map((l) => l.id)).size, c.slug).toBe(c.lessons.length)
      expect(new Set(c.planned.map((p) => p.slug)).size, c.slug).toBe(c.planned.length)
    }
  })
})

describe('course URLs', () => {
  it('分階段的課:各階段的課程頁網址與規劃章節網址互不重複', () => {
    const urls = software.stages!.flatMap((st) => [...st.lessons.map((l) => lessonPath(software, l)), ...st.planned.map((c) => plannedChapterPath(software, c))])
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.filter((p, i) => urls.indexOf(p) !== i)).toEqual([])
  })

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

  it('only the L3 course has a custom overview, at AI_AGENT_COURSE_PATH', () => {
    const custom = COURSES.filter((c) => c.customOverview).map(coursePath)
    expect(custom).toEqual([AI_AGENT_COURSE_PATH])
  })
})

describe('lessonNumber / lessonPath', () => {
  const l = (id: string) => ({ id }) as CourseLesson
  it('drops the 0. prefix for L0 lessons', () => {
    expect(lessonNumber(l('0.1'))).toBe('1')
    expect(lessonNumber(l('0.12'))).toBe('12')
  })
  it('keeps other lesson ids', () => {
    expect(lessonNumber(l('1.1'))).toBe('1.1')
    expect(lessonNumber(l('2.10'))).toBe('2.10')
  })
  it('lessonPath replaces the dot with a dash', () => {
    expect(lessonPath(software, l('1.1'))).toBe('/courses/software/1-1')
    expect(lessonPath(software, l('0.3'))).toBe('/courses/software/3')
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
  const coursePaths = new Set([...COURSES.map(coursePath), AI_AGENT_COURSE_PATH])

  it('level ids are unique', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length)
  })

  // link 可以帶 #stage-<id>(課程總覽頁的階段錨點),比對課程時用 levelPath 去掉
  it.each(LEVELS.filter((l) => l.link).map((l) => [l.id, l.link!] as const))('level %s links to an existing course (%s)', (_, link) => {
    expect(coursePaths.has(levelPath({ link })!)).toBe(true)
  })

  it('起步、零基礎、基礎三個等級都連到「做出自己的軟體」的各自階段', () => {
    for (const id of ['tools', 'ai-tools', 'vibe-coding-basics']) {
      const level = LEVELS.find((l) => l.id === id)!
      expect(levelPath(level), id).toBe(coursePath(software))
      expect(level.link, id).toBe(`${coursePath(software)}#${stageAnchor(id)}`)
      expect(stage(id), id).toBeDefined()
    }
  })

  // 首頁課程地圖會略過對不到的單課(不 throw),所以在這裡確保每一項都對得到
  it.each(LEVELS.filter((l) => l.lessons?.length).map((l) => [l.id, l] as const))('level %s lessons all exist in its course', (_, level) => {
    const course = COURSES.find((c) => coursePath(c) === levelPath(level))
    expect(course, `${level.id} 找不到 link 為 ${level.link} 的課程`).toBeDefined()
    // 分階段的課:單課要在這個等級對應的階段裡
    const lessons = course!.stages ? (course!.stages.find((st) => st.id === level.id)?.lessons ?? []) : course!.lessons
    const ids = new Set(lessons.map((l) => l.id))
    const missing = level.lessons!.map((l) => l.id).filter((id) => !ids.has(id))
    expect(missing).toEqual([])
  })

  it('every course takes its title from a level (the staged course has its own title)', () => {
    const titles = new Set(LEVELS.map((l) => l.title))
    for (const c of COURSES) {
      if (c.stages) expect(c.title, c.slug).toBe('做出自己的軟體')
      else expect(titles.has(c.title), c.slug).toBe(true)
    }
  })
})
