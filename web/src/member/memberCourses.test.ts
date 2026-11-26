import { describe, expect, it } from 'vitest'
import { fixtureCourse as seedCourse } from '../test/courseFixture'
import type { CourseMap } from '../content/courseMap'
import { KIDS_LESSON_PAGES } from '../content/kidsCourse'
import { launchLessonPath, launchScriptKey } from '../content/launchCourse'
import { WEB_LESSON_PAGES } from '../content/webCourse'
import { buildLessonIndex } from './lessonIndex'
import { isFinished, startedCourses } from './memberCourses'

const p = (lesson: string, positionMs: number, durationMs: number, updatedAt: string) => ({ lesson, positionMs, durationMs, updatedAt })

const map = (id: string, lessons: { id: string; script?: string; status?: 'open' | 'draft' | 'planned' }[]): CourseMap => ({
  id,
  title: id,
  access: 'free',
  units: [{ id: 'u', title: 'u', subtitle: '', lessons: lessons.map((l) => ({ status: 'open', ...l, title: l.id, summary: '', access: 'free' })) }],
})

describe('buildLessonIndex', () => {
  it('沒有課程地圖時,軟體課、上線課、網頁課、兒童課都沒有對照(不用前端寫死的路徑頂替)', () => {
    const lookup = buildLessonIndex()
    const web = Object.values(WEB_LESSON_PAGES)[0]
    expect(lookup(`live:${web.script}`)).toBeUndefined()
    const kids = Object.values(KIDS_LESSON_PAGES)[0]
    expect(lookup(`kids:${kids.script}`)).toBeUndefined()
    expect(lookup(launchScriptKey('0.1'))).toBeUndefined()
    expect(lookup('live:nope/unknown.json')).toBeUndefined()
  })

  it('做出自己的軟體照課程地圖的腳本對:列在 software 底下(網址 /courses/software/<課號>),先不公開的單元不列', () => {
    const seed = seedCourse('software')
    const intro = seed.units.flatMap((u) => u.lessons).find((l) => l.id === '0.intro')!
    const hiddenLesson = seed.units.find((u) => u.hidden)!.lessons.find((l) => l.script)!
    const lookup = buildLessonIndex({ software: seed as unknown as CourseMap })
    expect(lookup(`live:${intro.script}`)).toMatchObject({ course: 'course:software', coursePath: '/courses/software', path: '/courses/software/intro', title: `序章 ${intro.title}` })
    expect(lookup(`live:${hiddenLesson.script}`)).toBeUndefined()
    // 沒有地圖時沒有對照
    expect(buildLessonIndex()(`live:${intro.script}`)).toBeUndefined()
  })

  it('上線課、網頁課、兒童課照課程地圖的腳本對,改了腳本路徑也對得上', () => {
    const [webId, web] = Object.entries(WEB_LESSON_PAGES)[0]
    const [kidsId, kids] = Object.entries(KIDS_LESSON_PAGES)[0]
    const lookup = buildLessonIndex({
      launch: map('launch', [{ id: '0.1' }, { id: '0.2', script: 'launch/v2/0.2.json' }, { id: 'nopage', script: 'launch/x.json' }]),
      web: map('web', [{ id: webId, script: 'web/renamed.json' }]),
      kids: map('kids', [{ id: kidsId, script: 'kids/renamed.json' }]),
    })
    expect(lookup('live:launch/v2/0.2.json')?.path).toBe(launchLessonPath('0.2'))
    expect(lookup('live:web/renamed.json')?.path).toBe(web.path)
    expect(lookup('kids:kids/renamed.json')?.path).toBe(kids.path)
    // 課名取自地圖(測試地圖的課名 = 課號)
    expect(lookup('live:launch/v2/0.2.json')?.title).toBe('0.2 0.2')
    expect(lookup('kids:kids/renamed.json')?.title).toBe(kidsId)
    // 資料庫新增的課(前端沒有手寫內容)一樣照規則給網址
    expect(lookup('live:launch/x.json')?.path).toBe('/courses/launch/nopage')
    // 以地圖的腳本為準:地圖上沒給腳本的課、換腳本之前的舊腳本都不對照(不用前端寫死的路徑補)
    expect(lookup(launchScriptKey('0.1'))).toBeUndefined()
    expect(lookup(launchScriptKey('0.2'))).toBeUndefined()
    expect(lookup(`kids:${kids.script}`)).toBeUndefined()
  })

  it('地圖讀得到時,改回規劃中或拿掉的課不列;管理員看得到的草稿課標上草稿', () => {
    const lookup = buildLessonIndex({
      launch: map('launch', [{ id: '0.1', status: 'planned' }, { id: '0.2', script: 'launch/0.2.json', status: 'draft' }]),
    })
    expect(lookup(launchScriptKey('0.1'))).toBeUndefined()
    expect(lookup(launchScriptKey('0.3'))).toBeUndefined()
    expect(lookup(launchScriptKey('0.2'))).toMatchObject({ draft: true, path: launchLessonPath('0.2') })
    expect(lookup(launchScriptKey('0.2'))?.title).toContain('（草稿）')
  })
})

describe('startedCourses', () => {
  const kidsLesson = Object.entries(KIDS_LESSON_PAGES)[0]
  const lookup = buildLessonIndex({
    launch: map('launch', [{ id: '0.1', script: 'launch/0.1.json' }, { id: '0.2', script: 'launch/0.2.json' }]),
    kids: map('kids', [{ id: kidsLesson[0], script: kidsLesson[1].script }]),
  })

  it('一門課一筆,最近看的課程在前,點進去是最近看的那一課', () => {
    const [a, b] = ['0.1', '0.2'].map(launchScriptKey)
    const kids = Object.values(KIDS_LESSON_PAGES)[0]
    const list = startedCourses(
      [
        p(a, 60_000, 60_000, '2026-11-01T00:00:00Z'),
        p(`kids:${kids.script}`, 10_000, 100_000, '2026-11-05T00:00:00Z'),
        p(b, 30_000, 120_000, '2026-11-03T00:00:00Z'),
        p('live:nope/unknown.json', 1, 2, '2026-11-09T00:00:00Z'),
      ],
      lookup,
    )
    expect(list.map((c) => c.course)).toEqual(['kids', 'launch'])
    const launch = list[1]
    expect(launch.last.path).toBe(launchLessonPath('0.2'))
    expect(launch.lessons).toHaveLength(2)
    expect(launch.finishedCount).toBe(1)
    expect(list[0].last.ratio).toBeCloseTo(0.1)
  })

  it('依實際時間排序,不受小數位數或時區寫法影響', () => {
    const [a, b] = ['0.1', '0.2'].map(launchScriptKey)
    const kids = Object.values(KIDS_LESSON_PAGES)[0]
    // 字串比較會把 b(…T09:00:00-03:00)排最後,實際上它是 12:00Z,三筆裡最新
    const list = startedCourses(
      [p(a, 1, 10, '2026-11-10T10:00:00.5Z'), p(b, 1, 10, '2026-11-10T09:00:00-03:00'), p(`kids:${kids.script}`, 1, 10, '2026-11-10T10:30:00Z')],
      lookup,
    )
    expect(list.map((c) => c.course)).toEqual(['launch', 'kids'])
    expect(list[0].last.path).toBe(launchLessonPath('0.2'))
  })

  it('剩不到 5 秒才算看完(和播放器的續播規則一致:剩超過 5 秒會接著播)', () => {
    expect(isFinished({ positionMs: 96_000, durationMs: 100_000 })).toBe(true)
    expect(isFinished({ positionMs: 196_000, durationMs: 200_000 })).toBe(true)
    expect(isFinished({ positionMs: 576_000, durationMs: 600_000 })).toBe(false)
    expect(isFinished({ positionMs: 50_000, durationMs: 100_000 })).toBe(false)
    expect(isFinished({ positionMs: 0, durationMs: 0 })).toBe(false)
  })
})
