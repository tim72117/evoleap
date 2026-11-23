import { describe, expect, it } from 'vitest'
import { COURSES, lessonUrl } from './catalog'
import { seedCourse } from './courseSeed'
import { courseTitleOf, lessonDocTitle, lessonKicker, lessonLabelOf } from './lessonDisplay'
import { PAGES } from '../seo/pages'
import { documentTitle } from '../site/siteInfo'

describe('lessonLabelOf', () => {
  it('軟體課:序章、第 N 課(起步階段 0.N 顯示為第 N 課)', () => {
    expect(lessonLabelOf('software', '0.intro')).toBe('序章')
    expect(lessonLabelOf('software', '0.3')).toBe('第 3 課')
    expect(lessonLabelOf('software', '1.2')).toBe('第 1.2 課')
  })
  it('其他課:第 <課號> 課', () => {
    expect(lessonLabelOf('web', '0.2')).toBe('第 0.2 課')
    expect(lessonLabelOf('launch', '1.1')).toBe('第 1.1 課')
    expect(lessonLabelOf('kids', '0.1')).toBe('第 0.1 課')
    expect(lessonLabelOf('claude-code', '1')).toBe('第 1 課')
  })
})

describe('單課頁標題', () => {
  it('document.title 頁名是「課名｜課程名稱」,登入把關 kicker 是「課程名稱 · 標籤」', () => {
    expect(lessonDocTitle('提出需求', '做出自己的軟體')).toBe('提出需求｜做出自己的軟體')
    expect(lessonKicker('網頁怎麼運作', '第 1 課')).toBe('網頁怎麼運作 · 第 1 課')
    expect(courseTitleOf('web')).toBe('網頁怎麼運作')
  })
  it('SEO 的軟體課單課頁 <title> 與執行期同一格式', () => {
    const software = COURSES.find((c) => c.slug === 'software')!
    // 規劃中的課是規劃中章節頁(標題與 PlannedChapterPage 的頁名一致),其餘是單課頁
    for (const lesson of seedCourse('software').units.flatMap((u) => u.lessons).filter((l) => l.status !== 'planned')) {
      const page = PAGES.find((p) => p.path === lessonUrl('software', lesson.id))
      expect(page?.title, lesson.id).toBe(documentTitle(lessonDocTitle(lesson.title, software.title)))
    }
  })
})
