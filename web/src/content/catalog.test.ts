import { describe, expect, it } from 'vitest'
import { FREE_LESSON_COUNT } from './access'
import { COURSES, coursePath, lessonNumber, lessonPath, plannedChapterPath, requiresLogin } from './catalog'
import type { CourseLesson } from './lessonTypes'
import { ALL_LEVELS as LEVELS } from './levels'
import { AI_AGENT_COURSE_PATH } from './aiAgent'

describe('requiresLogin', () => {
  const open = (slug: string) => {
    const course = COURSES.find((c) => c.slug === slug)!
    return course.lessons.filter((l) => !requiresLogin(course, l)).map((l) => l.id)
  }
  it('登入後免費的課:序章(預覽課)與依順序的前兩課不用登入,第三課起要登入', () => {
    const first = (slug: string) => COURSES.find((c) => c.slug === slug)!.lessons.slice(0, FREE_LESSON_COUNT).map((l) => l.id)
    expect(open('tools')).toEqual(['0.intro', '0.0'])
    expect(first('tools')).toEqual(['0.intro', '0.0'])
    expect(open('ai-tools')).toEqual(first('ai-tools'))
    const tools = COURSES.find((c) => c.slug === 'tools')!
    expect(requiresLogin(tools, tools.lessons.find((l) => l.id === '0.1')!)).toBe(true)
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
    const aiTools = COURSES.find((c) => c.slug === 'ai-tools')!
    expect(lessonPath(aiTools, l('1.1'))).toBe('/courses/ai-tools/1-1')
    const tools = COURSES.find((c) => c.slug === 'tools')!
    expect(lessonPath(tools, l('0.3'))).toBe('/courses/tools/3')
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

  it.each(LEVELS.filter((l) => l.link).map((l) => [l.id, l.link!] as const))('level %s links to an existing course (%s)', (_, link) => {
    expect(coursePaths.has(link)).toBe(true)
  })

  // 首頁課程地圖會略過對不到的單課(不 throw),所以在這裡確保每一項都對得到
  it.each(LEVELS.filter((l) => l.lessons?.length).map((l) => [l.id, l] as const))('level %s lessons all exist in its course', (_, level) => {
    const course = COURSES.find((c) => coursePath(c) === level.link)
    expect(course, `${level.id} 找不到 link 為 ${level.link} 的課程`).toBeDefined()
    const ids = new Set(course!.lessons.map((l) => l.id))
    const missing = level.lessons!.map((l) => l.id).filter((id) => !ids.has(id))
    expect(missing).toEqual([])
  })

  it('every course takes its title from a level', () => {
    const titles = new Set(LEVELS.map((l) => l.title))
    for (const c of COURSES) expect(titles.has(c.title), c.slug).toBe(true)
  })
})
