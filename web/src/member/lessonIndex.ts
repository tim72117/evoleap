// 進度紀錄的課號(progress 表的 lesson,例如 live:<腳本>、kids:<腳本>)→ 哪一門課的哪一課、網址。
// 會員空間的「課程」分頁用它把進度整理成一門門課。新增有播放器的課程時,在這裡加上對應。
// 軟體課、上線課、網頁課、兒童課的播放器存的是資料庫課程地圖裡的腳本,所以照課程地圖對:
// - 地圖讀得到:只列地圖上已開放的課(管理員另外看得到草稿,標上「草稿」);改回規劃中、或從地圖拿掉的課不列。
// - 地圖讀不到:沒有對照(呼叫端把讀不到當成讀取失敗,見 CoursesSection),不用前端寫死的腳本路徑頂替。
import { lessonLabel, lessonUrl } from '../content/catalog'
import type { CourseMap, MapLesson } from '../content/courseMap'
import { KIDS_LESSON_PAGES } from '../content/kidsCourse'
import { LAUNCH_LESSON_PAGES, launchLessonPath } from '../content/launchCourse'
import { KIDS_TOPIC, LAUNCH_TOPIC, SOFTWARE_TOPIC, WEB_TOPIC } from '../content/topics'
import { WEB_LESSON_PAGES } from '../content/webCourse'
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
export const MAPPED_COURSES = ['software', 'launch', 'web', 'kids'] as const
export type MappedCourse = (typeof MAPPED_COURSES)[number]

interface MappedSpec {
  /** 播放器存進度時的前綴(live:<腳本> 或 kids:<腳本>) */
  prefix: string
  /** 課號 → 對照;沒有單課頁時回傳 undefined */
  entry: (id: string, title: string) => IndexedLesson | undefined
}

// 課名一律取自課程地圖(title 是地圖上該課的課名),不用前端寫死的課名
const SPECS: Record<MappedCourse, MappedSpec> = {
  // 軟體課的單課網址每一課都有(lessonUrl);課程在會員空間的識別沿用 course:software
  software: {
    prefix: 'live:',
    entry: (id, title) => ({ course: 'course:software', courseName: SOFTWARE_TOPIC.name, coursePath: '/courses/software', title: `${lessonLabel({ id })} ${title}`.trim(), path: lessonUrl('software', id) }),
  },
  launch: {
    prefix: 'live:',
    entry: (id, title) =>
      LAUNCH_LESSON_PAGES.includes(id)
        ? { course: 'launch', courseName: LAUNCH_TOPIC.name, coursePath: LAUNCH_TOPIC.path, title: `${id} ${title}`.trim(), path: launchLessonPath(id) }
        : undefined,
  },
  web: {
    prefix: 'live:',
    entry: (id, title) =>
      WEB_LESSON_PAGES[id]
        ? { course: 'web', courseName: WEB_TOPIC.name, coursePath: WEB_TOPIC.path, title: `${id} ${title}`.trim(), path: WEB_LESSON_PAGES[id].path }
        : undefined,
  },
  kids: {
    prefix: 'kids:',
    entry: (id, title) =>
      KIDS_LESSON_PAGES[id]
        ? { course: 'kids', courseName: KIDS_TOPIC.name, coursePath: KIDS_TOPIC.path, title: title || id, path: KIDS_LESSON_PAGES[id].path }
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
    // 先不公開(hidden)的單元不列在會員的課程清單
    const lessons = new Map(map.units.filter((u) => !u.hidden).flatMap((u) => u.lessons).filter(visible).map((l) => [l.id, l]))
    const entry = (id: string) => {
      const e = spec.entry(id, lessons.get(id)?.title ?? '')
      return e && lessons.get(id)?.status === 'draft' ? { ...e, title: `${e.title}${messages().member.courses.draft}`, draft: true } : e
    }
    // 腳本以地圖為準
    for (const l of lessons.values()) if (l.script) add(`${spec.prefix}${l.script}`, entry(l.id))
  }

  return (key) => index.get(key)
}
