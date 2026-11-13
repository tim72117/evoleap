// 進度紀錄的課號(progress 表的 lesson,例如 live:<腳本>、kids:<腳本>)→ 哪一門課的哪一課、網址。
// 會員空間的「課程」分頁用它把進度整理成一門門課。新增有播放器的課程時,在這裡加上對應。
// 上線課、網頁課、兒童課的播放器存的是資料庫課程地圖裡的腳本,所以優先照課程地圖對:
// - 地圖讀得到:只列地圖上已開放的課(管理員另外看得到草稿,標上「草稿」);改回規劃中、或從地圖拿掉的課不列。
// - 地圖讀不到:沒有對照(呼叫端把讀不到當成讀取失敗,見 CoursesSection),不用前端寫死的腳本路徑頂替。
import { COURSES, coursePath, lessonLabel, lessonPath } from '../content/catalog'
import type { CourseMap, MapLesson } from '../content/courseMap'
import { KIDS_OPEN_LESSONS, kidsLessonTitle } from '../content/kidsCourse'
import { LAUNCH_LESSON_PAGES, launchLesson, launchLessonPath } from '../content/launchCourse'
import { KIDS_TOPIC, LAUNCH_TOPIC, WEB_TOPIC } from '../content/topics'
import { WEB_OPEN_LESSONS, webLesson } from '../content/webCourse'
import { messages } from '../i18n/current'

export interface IndexedLesson {
  /** 課程的識別(同一門課的課共用) */
  course: string
  courseName: string
  coursePath: string
  /** 顯示用課名(含課號) */
  title: string
  /** 單課頁網址:點進去接著上 */
  path: string
  /** 草稿課(只有管理員看得到) */
  draft?: boolean
}

/** 進度紀錄的課號 → 課;不認得(課已下架、內部試做、改回規劃中)時回傳 undefined */
export type LessonLookup = (key: string) => IndexedLesson | undefined

/** 照課程地圖對腳本的課程(課程地圖 API 的 id) */
export const MAPPED_COURSES = ['launch', 'web', 'kids'] as const
export type MappedCourse = (typeof MAPPED_COURSES)[number]

interface MappedSpec {
  /** 播放器存進度時的前綴(live:<腳本> 或 kids:<腳本>) */
  prefix: string
  /** 課號 → 對照;沒有單課頁時回傳 undefined */
  entry: (id: string) => IndexedLesson | undefined
}

const SPECS: Record<MappedCourse, MappedSpec> = {
  launch: {
    prefix: 'live:',
    entry: (id) =>
      LAUNCH_LESSON_PAGES.includes(id)
        ? { course: 'launch', courseName: LAUNCH_TOPIC.name, coursePath: LAUNCH_TOPIC.path, title: `${id} ${launchLesson(id)?.title ?? ''}`.trim(), path: launchLessonPath(id) }
        : undefined,
  },
  web: {
    prefix: 'live:',
    entry: (id) =>
      WEB_OPEN_LESSONS[id]
        ? { course: 'web', courseName: WEB_TOPIC.name, coursePath: WEB_TOPIC.path, title: `${id} ${webLesson(id)?.title ?? ''}`.trim(), path: WEB_OPEN_LESSONS[id].path }
        : undefined,
  },
  kids: {
    prefix: 'kids:',
    entry: (id) =>
      KIDS_OPEN_LESSONS[id]
        ? { course: 'kids', courseName: KIDS_TOPIC.name, coursePath: KIDS_TOPIC.path, title: kidsLessonTitle(id), path: KIDS_OPEN_LESSONS[id].path }
        : undefined,
  },
}

/** 這個人在地圖上看得到、可以上的課(開放的課;管理員還有草稿) */
const visible = (l: MapLesson) => l.status === 'open' || l.status === 'draft'

/** maps:讀得到的課程地圖;讀不到的課程沒有對照(不用前端寫死的路徑頂替) */
export function buildLessonIndex(maps: Partial<Record<MappedCourse, CourseMap>> = {}): LessonLookup {
  const index = new Map<string, IndexedLesson>()
  const add = (key: string, l: IndexedLesson | undefined) => {
    if (l && !index.has(key)) index.set(key, l)
  }

  for (const course of MAPPED_COURSES) {
    const spec = SPECS[course]
    const map = maps[course]
    if (!map) continue
    const lessons = new Map(map.units.flatMap((u) => u.lessons).filter(visible).map((l) => [l.id, l]))
    const entry = (id: string) => {
      const e = spec.entry(id)
      return e && lessons.get(id)?.status === 'draft' ? { ...e, title: `${e.title}${messages().member.courses.draft}`, draft: true } : e
    }
    // 腳本以地圖為準
    for (const l of lessons.values()) if (l.script) add(`${spec.prefix}${l.script}`, entry(l.id))
  }

  for (const c of COURSES) {
    for (const l of c.lessons) {
      for (const v of l.videos) {
        if (v.live) add(`live:${v.live}`, { course: `course:${c.slug}`, courseName: c.title, coursePath: coursePath(c), title: `${lessonLabel(l)} ${l.title}`, path: lessonPath(c, l) })
      }
    }
  }
  return (key) => index.get(key)
}
