import type { LessonProgress } from '../courses/progress'
import type { IndexedLesson, LessonLookup } from './lessonIndex'

// 把會員的進度紀錄整理成「上過的課程」:一門課一筆,最近看的課程在前。

/** 剩不到這麼多就算看完這一課:和播放器的續播規則一致(live/shell.ts 的 resume,剩超過 5 秒才從上次的位置接著播),
 *  所以「已看完・再看一次」點進去一定是從頭播 */
const FINISH_TAIL_MS = 5000

export interface StartedLesson extends IndexedLesson {
  /** 0–1 */
  ratio: number
  finished: boolean
  updatedAt: string
}

export interface StartedCourse {
  course: string
  courseName: string
  coursePath: string
  /** 最近看的那一課:卡片點進去接著上 */
  last: StartedLesson
  /** 上過的每一課,最近看的在前 */
  lessons: StartedLesson[]
  finishedCount: number
}

export function lessonRatio(p: Pick<LessonProgress, 'positionMs' | 'durationMs'>): number {
  if (p.durationMs <= 0) return 0
  return Math.min(1, Math.max(0, p.positionMs / p.durationMs))
}

export function isFinished(p: Pick<LessonProgress, 'positionMs' | 'durationMs'>): boolean {
  return p.durationMs > 0 && p.durationMs - p.positionMs <= FINISH_TAIL_MS
}

/** 時間字串轉成毫秒比較(伺服器的小數位數、時區寫法不一定相同,不能直接比字串);讀不懂的排最後 */
const timeOf = (iso: string): number => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? -Infinity : t
}

export function startedCourses(progress: LessonProgress[], lookup: LessonLookup): StartedCourse[] {
  const sorted = [...progress].sort((a, b) => timeOf(b.updatedAt) - timeOf(a.updatedAt))
  const byCourse = new Map<string, StartedCourse>()
  for (const p of sorted) {
    const lesson = lookup(p.lesson)
    if (!lesson) continue
    const started: StartedLesson = { ...lesson, ratio: lessonRatio(p), finished: isFinished(p), updatedAt: p.updatedAt }
    const c = byCourse.get(lesson.course)
    if (c) {
      // 同一課可能有兩筆紀錄(例如換過腳本),只算最近的一筆
      if (c.lessons.some((l) => l.path === started.path)) continue
      c.lessons.push(started)
      if (started.finished) c.finishedCount++
    } else {
      byCourse.set(lesson.course, {
        course: lesson.course,
        courseName: lesson.courseName,
        coursePath: lesson.coursePath,
        last: started,
        lessons: [started],
        finishedCount: started.finished ? 1 : 0,
      })
    }
  }
  return [...byCourse.values()]
}
