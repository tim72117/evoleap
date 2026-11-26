import { describe, expect, it } from 'vitest'
import { COURSES, coursePath, lessonIdFromSlug, lessonNumber, lessonPath, lessonUrl, plannedChapterPath, plannedSlug } from './catalog'
import { SOFTWARE_STAGE_CONTENT } from './softwareStages'
import { topicPathOfCourse } from './topics'
import { fixtureCourse, FIXTURE_COURSES } from '../test/courseFixture'

const SOFTWARE_LESSON_IDS = fixtureCourse('software').units.flatMap((u) => u.lessons.map((l) => l.id))

const allPaths = COURSES.flatMap((c) => [
  coursePath(c),
  ...(c.staged ? SOFTWARE_LESSON_IDS.map((id) => lessonUrl(c.slug, id)) : []),
  ...c.planned.map((id) => plannedChapterPath(c, { slug: plannedSlug(id) })),
])

// 軟體課前端寫死的課程內容(研發基地與單課頁的提示詞用):課程結構以資料庫為準,這裡只檢查內容資料本身的一致性
const lessons = SOFTWARE_STAGE_CONTENT.flatMap((st) => st.lessons.map((l) => [`software ${l.id}`, l] as const))

describe('course URLs', () => {
  it('不重複,最後一段不含小數點(Go server 會當成靜態檔)、沒有結尾斜線', () => {
    expect(allPaths.filter((p, i) => allPaths.indexOf(p) !== i)).toEqual([])
    expect(allPaths.filter((p) => !/^\/courses\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(p))).toEqual([])
  })

  it('AI Agent 中階課沒有自己的頁面;進階課的章節頁網址是 topic-<單元>', () => {
    expect(COURSES.some((c) => c.slug === 'ai-agent')).toBe(false)
    expect(allPaths).toContain('/courses/advanced/topic-1')
  })

  it('課程所在的主題頁:做出自己的軟體與進階課各有主題頁,其他課的主題頁就是自己', () => {
    expect(topicPathOfCourse('/courses/software')).toBe('/topics/software')
    expect(topicPathOfCourse('/courses/advanced')).toBe('/topics/ai-apps')
    for (const slug of ['web', 'launch', 'kids', 'claude-code']) expect(topicPathOfCourse(`/courses/${slug}`)).toBe(`/courses/${slug}`)
  })

  it('lessonIdFromSlug 是 lessonUrl 的反向(地圖讀不到時的畫面標示用)', () => {
    for (const c of FIXTURE_COURSES) {
      for (const l of c.units.flatMap((u) => u.lessons)) expect(lessonIdFromSlug(c.id, lessonUrl(c.id, l.id).split('/').pop()!), `${c.id} ${l.id}`).toBe(l.id)
    }
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

  it('every lesson has title, goal, and steps with title+expected', () => {
    for (const [name, lesson] of lessons) {
      expect(lesson.title.trim(), name).not.toBe('')
      expect(lesson.goal.trim(), name).not.toBe('')
      expect(lesson.steps.length).toBeGreaterThanOrEqual(1)
      for (const [i, s] of lesson.steps.entries()) {
        expect(s.title?.trim(), `step ${i + 1} title`).toBeTruthy()
        expect(s.expected?.trim(), `step ${i + 1} expected`).toBeTruthy()
      }
      // 步驟標題用作 React key,必須唯一
      expect(new Set(lesson.steps.map((s) => s.title)).size).toBe(lesson.steps.length)
    }
  })

  it('every lesson videos reference valid steps and cover every step', () => {
    for (const [name, lesson] of lessons) {
      const n = lesson.steps.length
      expect(lesson.videos.length, name).toBeGreaterThanOrEqual(1)
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
    }
  })

  it('every lesson cues reference the video steps in ascending time', () => {
    for (const [name, lesson] of lessons) {
      for (const v of lesson.videos) {
        if (!v.cues) continue
        const at = `${name} ${v.title}`
        for (const [i, c] of v.cues.entries()) {
          expect(v.steps, `${at} cue step ${c.step}`).toContain(c.step)
          expect(c.at).toBeGreaterThanOrEqual(0)
          if (i > 0) expect(c.at, `${at} cue ${i}`).toBeGreaterThan(v.cues[i - 1].at)
        }
      }
    }
  })
})
