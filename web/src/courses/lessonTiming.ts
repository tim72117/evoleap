// 單課頁的影片時間軸工具(純函式,由 LessonPage 使用;測試見 lessonTiming.test.ts)。
import type { LessonVideo } from '../content/lessonTypes'

export function mmss(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 依目前播放秒數，找出 cues 中最後一個已經到達的步驟（1 起算）；還沒到任何 cue 時回傳 null */
export function stepAt(cues: { step: number; at: number }[] | undefined, t: number): number | null {
  let found: number | null = null
  for (const c of cues ?? []) if (t >= c.at) found = c.step
  return found
}

/** 預覽大綱（模擬播放器）的步驟時間點：有標 cues 就照用；沒標時把這支影片示範的步驟
 *  平均分配在影片長度上，前 8% 留給開場的「目標 → 步驟拆解」。 */
export function effectiveCues(video: LessonVideo | undefined): { step: number; at: number }[] {
  if (!video) return []
  if (video.cues) return video.cues
  const duration = video.minutes * 60
  const intro = duration * 0.08
  const k = video.steps.length
  return video.steps.map((step, i) => ({ step, at: Math.round(intro + ((duration - intro) * i) / k) }))
}
