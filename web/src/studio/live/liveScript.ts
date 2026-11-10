// 即時腳本(研發基地 /studio/live-script):後端的臨時腳本由 MCP(evoleap mcp)修改,這一頁用 SSE 訂閱,
// 每次收到新版本就重新載入舞台,並把載入結果回報給後端(AI 用 wait_live_report 看)。API 見 server/internal/api/livescript.go。
import type { StageScript } from '../../live/stage'

/** 後端推來的一版 */
export type LiveSnapshot = {
  version: number
  script: StageScript
  report: { version: number; error?: string; duration?: number } | null
}

export const LIVE_EVENTS = '/api/live-script/events'

/** 解析推播的 data;格式不對回傳 null */
export function parseSnapshot(data: string): LiveSnapshot | null {
  try {
    const s = JSON.parse(data) as Partial<LiveSnapshot>
    if (typeof s.version !== 'number' || !s.script || typeof s.script !== 'object') return null
    return s as LiveSnapshot
  } catch {
    return null
  }
}

/** 新版本載入後從哪裡播:原本的位置還在新長度裡就停在原處(小改旁白、節奏時不用從頭看),超出就回到開頭 */
export const resumeAt = (prevTime: number, nextDuration: number): number => (prevTime >= 0 && prevTime < nextDuration ? prevTime : 0)

/** 回報載入結果;回報失敗(例如已經有更新的版本)不影響播放 */
export async function reportLoad(version: number, result: { duration: number } | { error: string }): Promise<void> {
  try {
    await fetch('/api/live-script/report', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, ...('duration' in result ? { duration: Math.round(result.duration) } : result) }),
    })
  } catch {
    // 網路錯誤:下一版再回報
  }
}
