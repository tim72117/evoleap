/**
 * 把一句旁白切成幾段單行短字幕並分配時間。
 * 斷行規則比照 live/kit.ts 的 splitCaption(先句末、再逗號、最後才在字中間斷;標點不放行首);
 * 差別是相連的英文詞組(如 AI Agent)視為一個單位,過長的子句切成長短相近的幾段。
 */
export type CaptionSegment = { from: number; to: number; text: string }

const BUCKET_MS = 50
const SNAP_MS = 600
const MIN_PAUSE_BUCKETS = 2

const width = (s: string): number => [...s].reduce((sum, c) => sum + (/^[\x20-\x7e]$/.test(c) ? 0.5 : 1), 0)
const trailing = '[。！？；…，、：,.!?;:」』）)]*'
const TOKEN = new RegExp(`(?:[「『（]*)(?:[\\x21-\\x7e]+|[^\\x21-\\x7e\\s])${trailing}|\\s+`, 'gu')
const PHRASE = new RegExp(`[「『（]*[\\x21-\\x7e]+(?: +[\\x21-\\x7e]+)*${trailing}|[「『（]*[^\\x21-\\x7e\\s]${trailing}|\\s+`, 'gu')

function fill(tokens: string[], max: number, target = max): string[] {
  const lines: string[] = []
  let line = ''
  for (const t of tokens) {
    const next = width((line + t).trim())
    // 超過上限一定換行;超過目標長度時,取離目標較近的斷點
    if (line.trim() && (next > max || next - target > target - width(line.trim()))) {
      lines.push(line)
      line = t.trimStart()
    } else line += t
  }
  if (line.trim()) lines.push(line)
  return lines
}

function breakClause(clause: string, max: number): string[] {
  if (width(clause.trim()) <= max) return [clause]
  // 整串英文詞組放得下就不拆;比一行還長才退回逐詞斷
  const tokens = (clause.match(PHRASE) ?? [clause]).flatMap((t) => (width(t.trim()) <= max ? [t] : (t.match(TOKEN) ?? [t])))
  return fill(tokens, max, width(clause.trim()) / Math.ceil(width(clause.trim()) / max))
}

function splitLines(text: string, max: number): string[] {
  return text
    .split(/(?<=[。！？；…!?\n])/)
    .flatMap((sentence) => fill(sentence.split(/(?<=[，、：])|(?<=[,:] )/).flatMap((c) => breakClause(c, max)), max))
    .map((line) => line.trim().replace(/[，、：,:；]+$/, ''))
    .filter(Boolean)
}

/** 句中停頓的中點(毫秒);頭尾的靜音不算 */
function pausesOf(levels: string): number[] {
  return [...levels.matchAll(/0+/g)]
    .filter((m) => m[0].length >= MIN_PAUSE_BUCKETS && m.index > 0 && m.index + m[0].length < levels.length)
    .map((m) => (m.index + m[0].length / 2) * BUCKET_MS)
}

export function splitTimedCaption(text: string, totalMs: number, maxChars: number, levels?: string): CaptionSegment[] {
  const lines = splitLines(text, maxChars)
  if (!lines.length || !(totalMs > 0)) return []
  const all = lines.reduce((sum, l) => sum + width(l), 0)
  let acc = 0
  const ideal = lines.map((l) => ((acc += width(l)) / all) * totalMs)
  const pauses = levels ? pausesOf(levels) : []
  const ends: number[] = []
  for (let i = 0; i < lines.length - 1; i++) {
    const prev = ends[i - 1] ?? 0
    const near = pauses
      .filter((p) => p > prev && p < totalMs && Math.abs(p - ideal[i]) <= SNAP_MS)
      .sort((a, b) => Math.abs(a - ideal[i]) - Math.abs(b - ideal[i]))[0]
    // 前一段吸附得太後面時,在剩下的時間裡往後排,避免出現空段
    ends.push(near ?? (ideal[i] > prev ? ideal[i] : (prev + ideal[i + 1]) / 2))
  }
  ends.push(totalMs)
  return lines.map((line, i) => ({ from: ends[i - 1] ?? 0, to: ends[i], text: line }))
}

/** 一行字幕最多幾個中文字:手機直拿短一點 */
export const captionChars = (): number => (typeof matchMedia === 'function' && matchMedia('(max-width: 600px) and (orientation: portrait)').matches ? 16 : 24)

/** 這句念到 ms 時畫面上放哪一段(超過結尾停在最後一段) */
export function captionAt(parts: { from: number; to: number; text: string }[], ms: number): string {
  return (parts.find((p) => ms < p.to) ?? parts.at(-1))?.text ?? ''
}
