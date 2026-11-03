// mixPlan.ts — 旁白計畫:把時間軸上的每一句旁白,對到合成好的章節音軌(scripts/mix.mjs 產出)。
//
// 純函式,不碰音訊:輸入目前時間軸的旁白與章節清單,輸出「要怎麼播」的片段清單。
//   range  章節音軌的一段範圍(連續的幾句旁白,用同一個音檔播,從 fromMs 播到 toMs)
//   clip   有語音但章節音軌裡找不到(清單過期、文字改了):退回逐句播放
//   silent 沒有語音(例如互動分支新寫的旁白):只有字幕
//
// 互動課程學員回答後,舞台會重排時間軸:分支的新旁白插進來、原本的示範被換掉,但回到主線的旁白,
// 彼此的間隔不變(scripts/mix.mjs 與驗證都確認過),所以仍是章節音軌裡連續的一段,
// 從該句的位置開始播(seek 一次)就能接上,不必整章退回逐句播放。

import type { Clip } from './narration'

/** 章節音軌裡的一句旁白 */
export type MixClip = {
  text: string
  offsetMs: number
  ms: number
  /** 合成時用的旁白音檔(voice.json 的 file);旁白重新產生之後和現在的不同,這句就不能用章節音軌 */
  voice?: string
}
/** 一個章節音軌:clips 依 offsetMs 排好 */
export type MixChapter = { file: string; clips: MixClip[] }
/** 時間軸上的一句旁白(舞台的 narrations) */
export type PlanNarration = { at: number; text: string }

export type PlanSegment =
  | {
      kind: 'range'
      file: string
      /** 時間軸上開始播的時間 */
      at: number
      /** 在音檔裡的範圍(毫秒) */
      fromMs: number
      toMs: number
      /** 這段範圍包含幾句旁白 */
      count: number
    }
  | { kind: 'clip'; at: number; text: string }
  | { kind: 'silent'; at: number; text: string }

/** 時間軸與音軌的間隔差在這個範圍內(毫秒)視為相同(浮點誤差) */
const GAP_TOLERANCE_MS = 2

type Loc = { chapter: number; idx: number }

/**
 * @param narrations 時間軸上的旁白(不必排序)
 * @param chapters 章節音軌清單
 * @param voiceFile 這句旁白目前的語音檔(voice.json 的 file);沒有語音回傳 undefined
 */
export function planNarration(narrations: PlanNarration[], chapters: MixChapter[], voiceFile: (text: string) => string | undefined): PlanSegment[] {
  const hasVoice = (text: string): boolean => voiceFile(text) !== undefined
  const where = new Map<string, Loc[]>()
  chapters.forEach((c, chapter) => {
    c.clips.forEach((clip, idx) => {
      // 合成之後旁白重新產生過(語音檔換了):這句不能用章節音軌
      if (clip.voice !== undefined && clip.voice !== voiceFile(clip.text)) return
      const list = where.get(clip.text)
      if (list) list.push({ chapter, idx })
      else where.set(clip.text, [{ chapter, idx }])
    })
  })

  const out: PlanSegment[] = []
  let run: { loc: Loc; at: number; seg: Extract<PlanSegment, { kind: 'range' }> } | null = null

  for (const n of [...narrations].sort((a, b) => a.at - b.at)) {
    const cands = where.get(n.text)
    if (!cands) {
      run = null
      out.push({ kind: hasVoice(n.text) ? 'clip' : 'silent', at: n.at, text: n.text })
      continue
    }
    // 同一句話出現在不只一處時,優先選接在上一句後面、間隔也對得上的那個
    let loc: Loc | undefined
    if (run) {
      const prev = chapters[run.loc.chapter].clips[run.loc.idx]
      loc = cands.find((c) => {
        if (c.chapter !== run!.loc.chapter || c.idx !== run!.loc.idx + 1) return false
        const cur = chapters[c.chapter].clips[c.idx]
        return Math.abs(n.at - run!.at - (cur.offsetMs - prev.offsetMs)) <= GAP_TOLERANCE_MS
      })
    }
    if (run && loc) {
      const clip = chapters[loc.chapter].clips[loc.idx]
      run.seg.toMs = clip.offsetMs + clip.ms
      run.seg.count++
      run.loc = loc
      run.at = n.at
      continue
    }
    loc = cands[0]
    const ch = chapters[loc.chapter]
    const clip = ch.clips[loc.idx]
    const seg: Extract<PlanSegment, { kind: 'range' }> = { kind: 'range', file: ch.file, at: n.at, fromMs: clip.offsetMs, toMs: clip.offsetMs + clip.ms, count: 1 }
    out.push(seg)
    run = { loc, at: n.at, seg }
  }
  return out
}

/** 時間軸上的時間 t 落在哪個片段的範圍內(含起點、不含終點);沒有語音的空檔回傳 null */
export function rangeAt(plan: PlanSegment[], t: number): Extract<PlanSegment, { kind: 'range' }> | null {
  for (const s of plan) if (s.kind === 'range' && t >= s.at && t < s.at + (s.toMs - s.fromMs)) return s
  return null
}

/**
 * 旁白計畫轉成外殼播放用的 Clip:range 是章節音軌的一段(from 是在音檔裡的起點),
 * clip 是原本逐句的音檔,silent 不播。沒有章節音軌(還沒合成、或沒上傳)時就是原本逐句播放。
 */
export function narrationClips(
  narrations: PlanNarration[],
  voice: { durations: Record<string, number>; urls: Record<string, string>; files: Record<string, string> } | null,
  mix: { chapters: MixChapter[] } | null,
): Clip[] {
  if (!voice) return []
  const single = (n: PlanNarration): Clip => ({ at: n.at, ms: voice.durations[n.text], url: voice.urls[n.text] })
  if (!mix?.chapters.length) return narrations.filter((n) => voice.urls[n.text]).map(single)
  const byText = new Map(narrations.map((n) => [n.at, n]))
  return planNarration(narrations, mix.chapters, (t) => voice.files[t]).flatMap((s): Clip[] => {
    if (s.kind === 'range') return [{ at: s.at, ms: s.toMs - s.fromMs, url: s.file, from: s.fromMs }]
    if (s.kind === 'clip') return [single(byText.get(s.at) ?? { at: s.at, text: s.text })]
    return []
  })
}

// 開發時引擎的程式一改就整頁重新載入(同 narration.ts)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
