import { describe, expect, it } from 'vitest'
import { narrationClips, planNarration, rangeAt, type MixChapter } from './mixPlan'

// 章節 0:A(0–4s)、B(6–9s)、C(11–15s)、D(17–20s);偏移是在章節音檔裡的位置
const chapters: MixChapter[] = [
  {
    file: 'c0.mp3',
    clips: [
      { text: 'A', offsetMs: 0, ms: 4000 },
      { text: 'B', offsetMs: 6000, ms: 3000 },
      { text: 'C', offsetMs: 11000, ms: 4000 },
      { text: 'D', offsetMs: 17000, ms: 3000 },
    ],
  },
  { file: 'c1.mp3', clips: [{ text: 'E', offsetMs: 0, ms: 5000 }] },
]
const voiced = new Set(['A', 'B', 'C', 'D', 'E'])
const hasVoice = (t: string) => (voiced.has(t) ? `${t}.mp3` : undefined)

describe('旁白計畫 planNarration', () => {
  it('間隔與章節音軌一致:每個章節合成一段範圍,跨章節分成兩段', () => {
    // 時間軸上 A 從 1000 開始,後面的句子間隔與音檔裡相同;E 在另一個章節
    const plan = planNarration(
      [
        { at: 1000, text: 'A' },
        { at: 7000, text: 'B' },
        { at: 12000, text: 'C' },
        { at: 18000, text: 'D' },
        { at: 40000, text: 'E' },
      ],
      chapters,
      hasVoice,
    )
    expect(plan).toEqual([
      { kind: 'range', file: 'c0.mp3', at: 1000, fromMs: 0, toMs: 20000, count: 4 },
      { kind: 'range', file: 'c1.mp3', at: 40000, fromMs: 0, toMs: 5000, count: 1 },
    ])
  })

  it('互動分支:示範的 A、B 被換成沒語音的 X,回到主線的 C、D 從 C 的位置接著播', () => {
    const plan = planNarration(
      [
        { at: 1000, text: 'X' },
        { at: 9000, text: 'C' },
        { at: 15000, text: 'D' },
      ],
      chapters,
      hasVoice,
    )
    expect(plan).toEqual([
      { kind: 'silent', at: 1000, text: 'X' },
      { kind: 'range', file: 'c0.mp3', at: 9000, fromMs: 11000, toMs: 20000, count: 2 },
    ])
    // 時間軸 9000 對到音檔 11000;分支那段(1000–9000)沒有語音
    expect(rangeAt(plan, 5000)).toBeNull()
    expect(rangeAt(plan, 9000)?.fromMs).toBe(11000)
    expect(rangeAt(plan, 17999)?.file).toBe('c0.mp3') // D 在時間軸 15000–18000
    expect(rangeAt(plan, 18000)).toBeNull()
  })

  it('跳過中間的 B(A、C、D 都在):A 一段,C、D 另一段', () => {
    const plan = planNarration(
      [
        { at: 0, text: 'A' },
        { at: 10000, text: 'C' },
        { at: 16000, text: 'D' },
      ],
      chapters,
      hasVoice,
    )
    expect(plan.map((s) => (s.kind === 'range' ? `${s.fromMs}-${s.toMs}` : s.kind))).toEqual(['0-4000', '11000-20000'])
  })

  it('間隔對不上就不併成同一段(中間被插入了別的內容)', () => {
    const plan = planNarration(
      [
        { at: 0, text: 'A' },
        { at: 9000, text: 'B' }, // 音檔裡 A 到 B 相隔 6000,這裡 9000
      ],
      chapters,
      hasVoice,
    )
    expect(plan).toHaveLength(2)
    expect(plan.every((s) => s.kind === 'range' && s.count === 1)).toBe(true)
  })

  it('浮點誤差(2ms 內)視為相同間隔', () => {
    const plan = planNarration(
      [
        { at: 0.0000001, text: 'A' },
        { at: 6000.0000002, text: 'B' },
      ],
      chapters,
      hasVoice,
    )
    expect(plan).toHaveLength(1)
  })

  it('有語音但章節音軌裡沒有(清單過期):退回逐句播放;沒語音的是 silent', () => {
    const plan = planNarration(
      [
        { at: 0, text: 'Z' }, // 有語音、不在章節音軌
        { at: 5000, text: 'Y' }, // 沒語音
      ],
      chapters,
      (t) => (t === 'Z' ? 'Z.mp3' : undefined),
    )
    expect(plan).toEqual([
      { kind: 'clip', at: 0, text: 'Z' },
      { kind: 'silent', at: 5000, text: 'Y' },
    ])
  })

  it('同一句話在音軌裡出現兩次:接在上一句後面、間隔對得上的那個', () => {
    const dup: MixChapter[] = [
      {
        file: 'd.mp3',
        clips: [
          { text: '好', offsetMs: 0, ms: 1000 },
          { text: 'P', offsetMs: 2000, ms: 1000 },
          { text: '好', offsetMs: 4000, ms: 1000 },
        ],
      },
    ]
    const plan = planNarration(
      [
        { at: 0, text: '好' },
        { at: 2000, text: 'P' },
        { at: 4000, text: '好' },
      ],
      dup,
      () => 'x.mp3',
    )
    expect(plan).toEqual([{ kind: 'range', file: 'd.mp3', at: 0, fromMs: 0, toMs: 5000, count: 3 }])
  })

  it('旁白順序不影響結果(內部先依時間排序),空清單回傳空陣列', () => {
    const a = planNarration(
      [
        { at: 7000, text: 'B' },
        { at: 1000, text: 'A' },
      ],
      chapters,
      hasVoice,
    )
    expect(a).toEqual([{ kind: 'range', file: 'c0.mp3', at: 1000, fromMs: 0, toMs: 9000, count: 2 }])
    expect(planNarration([], chapters, hasVoice)).toEqual([])
  })
})

describe('旁白計畫與語音檔版本', () => {
  const withVoice: MixChapter[] = [{ file: 'v.mp3', clips: [{ text: 'A', offsetMs: 0, ms: 1000, voice: 'a-old.mp3' }] }]
  it('旁白重新產生(語音檔換了)後,章節音軌裡那句不能用:退回逐句播放', () => {
    const plan = planNarration([{ at: 0, text: 'A' }], withVoice, () => 'a-new.mp3')
    expect(plan).toEqual([{ kind: 'clip', at: 0, text: 'A' }])
  })
  it('語音檔相同就用章節音軌', () => {
    const plan = planNarration([{ at: 0, text: 'A' }], withVoice, () => 'a-old.mp3')
    expect(plan[0].kind).toBe('range')
  })
})

describe('narrationClips', () => {
  const voice = {
    durations: { A: 4000, B: 3000, Z: 1000 },
    urls: { A: 'https://v/A.mp3', B: 'https://v/B.mp3', Z: 'https://v/Z.mp3' },
    files: { A: 'A.mp3', B: 'B.mp3', Z: 'Z.mp3' },
  }
  it('沒有章節音軌:原本逐句播放(只播有語音的)', () => {
    expect(narrationClips([{ at: 0, text: 'A' }, { at: 5000, text: 'X' }], voice, null)).toEqual([{ at: 0, ms: 4000, url: 'https://v/A.mp3' }])
  })
  it('沒有語音:不播', () => {
    expect(narrationClips([{ at: 0, text: 'A' }], null, { chapters })).toEqual([])
  })
  it('有章節音軌:連續的旁白合成一段(from 是音檔裡的起點),沒語音的跳過,章節音軌沒有的退回逐句', () => {
    const mix = { chapters: [{ file: 'https://m/c0.mp3', clips: [{ text: 'A', offsetMs: 0, ms: 4000, voice: 'A.mp3' }, { text: 'B', offsetMs: 6000, ms: 3000, voice: 'B.mp3' }] }] }
    const clips = narrationClips(
      [
        { at: 1000, text: 'A' },
        { at: 7000, text: 'B' },
        { at: 20000, text: 'X' },
        { at: 30000, text: 'Z' },
      ],
      voice,
      mix,
    )
    expect(clips).toEqual([
      { at: 1000, ms: 9000, url: 'https://m/c0.mp3', from: 0 },
      { at: 30000, ms: 1000, url: 'https://v/Z.mp3' },
    ])
  })
})
