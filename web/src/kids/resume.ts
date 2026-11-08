// 兒童課的播放進度(會員才存,存到伺服器,見 courses/progress.ts):記住看到哪一段,下次從那一段的開頭接著看。
// 回答會在時間軸上插進回應,所以存的位置一律換算成「沒有回答」的時間軸(每次打開都一樣),段落用名稱對應。
// 接著看時不帶回之前的回答:那一段之前的題目當成走過了(跳段不會被擋),往回跳再播到題目時照樣會問。

export type Chapter = { label: string; at: number }

/** 太靠近開頭或結尾的進度不套用(和一般播放器一樣) */
const EDGE_MS = 5000

/** 目前位置(含回答的時間軸)換成沒有回答的時間軸:同名段落的開頭 + 在這一段裡播了多久(不超過下一段的開頭) */
export function toPlain(now: number, chapters: Chapter[], plain: Chapter[], plainDuration: number): number {
  const cur = chapters.reduce<Chapter | null>((k, c) => (c.at <= now + 1 ? c : k), null)
  const i = cur ? plain.findIndex((c) => c.label === cur.label) : -1
  if (!cur || i < 0) return Math.max(0, Math.min(now, plainDuration))
  const end = plain[i + 1]?.at ?? plainDuration
  return Math.max(plain[i].at, Math.min(plain[i].at + (now - cur.at), end - 1))
}

/** 上次的進度要從哪一段的開頭接著看;太靠近開頭、結尾,或就在第一段裡,回傳 null(從頭開始) */
export function resumeChapter(saved: number | null, plain: Chapter[], plainDuration: number): Chapter | null {
  if (saved == null || saved < EDGE_MS || saved > plainDuration - EDGE_MS) return null
  const c = plain.reduce<Chapter | null>((k, x) => (x.at <= saved ? x : k), null)
  return c && c.at > 0 ? c : null
}
