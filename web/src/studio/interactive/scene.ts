// 互動教學場景的資料處理(純函式,頁面在 InteractiveScenePage.tsx)。
//
// 互動點寫在腳本的 checkpoint 步驟上(id、options、free);舞台只把它當一般的練習點。
// 學員回答後,把對應的步驟插到互動點後面、重新載入舞台:回答就是時間軸的一部分,
// 所以畫面仍是時間的純函式(README 第 1 節),拖曳、倒轉、演員狀態都不用另外處理。
import type { ScriptStep, StageScript } from '../../live/types'

/** 「互動」標籤的圖示(游標點擊):課程清單與互動課程頁的側欄共用 */
export const INTERACTIVE_ICON = 'M14 4.1 12 6M5.1 8l-2.9-.8M6 12l-1.9 2M7.2 2.2 8 5.1M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z'

/** target:這個選項對應演員身上的哪個目標(把演員推到主畫面互動時,學員直接點它) */
export type MomentOption = { label: string; steps: ScriptStep[]; target?: string }
export type Moment = {
  id: string
  title: string
  body: string
  options: MomentOption[]
  /** 學員自己打字時演出的步驟,字串裡的 {{text}} 換成學員打的內容 */
  free?: { placeholder: string; steps: ScriptStep[] }
  /** 略過時的按鈕文字與演出的步驟(例如看示範);不寫就是單純略過。還沒回答就直接播放時也演這段,所以後面的內容可以接著它 */
  skip?: { label: string; steps: ScriptStep[] }
  /** 這個互動點回答過(或有示範)才會出現(後面的演出要接著前面的結果時用,例如先下指令才有確認提示) */
  requires?: string
  /**
   * 把演員推到主畫面互動時要聚焦的目標;choices 是沒有 target 的選項要放在哪個區域(例如輸入框裡);
   * zone 是互動區:演員的區塊(parts 的名稱),靜態互動時舞台太小也不收合,例如要學員點側欄時寫 ["sidebar"]
   */
  stage?: { focus: string; choices?: string; zone?: string[] }
}

/** 互動點能不能直接在演員身上回答:有對應的演員才行,要自己打字的也還是用詢問框 */
export const answersOnActor = (moment: Moment): boolean => !!moment.stage && !moment.free

/** 學員的回答:選了第幾個選項、自己打字,或略過(之後不再停下來) */
export type Answer = { option: number } | { text: string } | { skipped: true }
export type Answers = Record<string, Answer>

type CheckpointFields = { checkpoint?: string; body?: string; id?: string; options?: MomentOption[]; free?: Moment['free']; skip?: Moment['skip']; requires?: string; stage?: Moment['stage'] }

/** 列出腳本裡的互動點;id 或標題重複、沒有選項、requires 不是前面的互動點時丟錯(標題用來對應舞台的 stops) */
export function momentsOf(script: StageScript): Moment[] {
  const moments: Moment[] = []
  for (const raw of script.steps) {
    const s = raw as CheckpointFields
    if (!s.id || !s.checkpoint) continue
    if (!s.options?.length) throw new Error(`互動點「${s.id}」沒有選項`)
    if (moments.some((m) => m.id === s.id || m.title === s.checkpoint)) throw new Error(`互動點「${s.id}」的 id 或標題重複`)
    if (s.requires && !moments.some((m) => m.id === s.requires)) throw new Error(`互動點「${s.id}」的 requires 要指向前面的互動點`)
    moments.push({ id: s.id, title: s.checkpoint, body: s.body ?? '', options: s.options, free: s.free, skip: s.skip, requires: s.requires, stage: s.stage })
  }
  return moments
}

/** 收回一個回答;接在它後面的回答也一起收回,因為那些演出是接著這個結果的 */
export function withoutAnswer(moments: Moment[], answers: Answers, id: string): Answers {
  let next = { ...answers }
  delete next[id]
  for (const m of moments) if (m.requires === id) next = withoutAnswer(moments, next, m.id)
  return next
}

const fillText = (step: ScriptStep, text: string): ScriptStep =>
  Object.fromEntries(Object.entries(step).map(([k, v]) => [k, typeof v === 'string' ? v.split('{{text}}').join(text) : v])) as ScriptStep

function stepsOf(moment: CheckpointFields, answer: Answer | undefined): ScriptStep[] {
  if (!answer || 'skipped' in answer) return moment.skip?.steps ?? []
  if ('text' in answer) {
    if (!moment.free) throw new Error(`互動點「${moment.id}」不能自己打字`)
    return moment.free.steps.map((s) => fillText(s, answer.text))
  }
  const option = moment.options?.[answer.option]
  if (!option) throw new Error(`互動點「${moment.id}」沒有第 ${answer.option} 個選項`)
  return option.steps
}

/** 依學員的回答展開成舞台可以載入的腳本:回答的第一步標成章節,時間軸與步驟清單看得到;沒回答時演出示範;前置的互動點沒回答也沒示範時先拿掉 */
export function expandAnswers(script: StageScript, answers: Answers): StageScript {
  /** 前置的互動點有演出可以接:回答了選項或打字,或是有示範(沒回答、略過都會演示範) */
  const hasPerformance = (id: string): boolean => {
    const answer = answers[id]
    if (answer && !('skipped' in answer)) return true
    return script.steps.some((raw) => (raw as CheckpointFields).id === id && !!(raw as CheckpointFields).skip)
  }
  return {
    ...script,
    steps: script.steps.flatMap((raw) => {
      const s = raw as CheckpointFields
      if (s.id && s.requires && !hasPerformance(s.requires)) return []
      const answer = s.id ? answers[s.id] : undefined
      const chapter = answer && ('skipped' in answer ? s.skip?.label : '你的回答')
      const inserted = s.id ? stepsOf(s, answer) : []
      return [raw, ...inserted.map((x, i) => (i === 0 && chapter ? { ...x, chapter } : x))]
    }),
  }
}

/**
 * 靜態演員的舞台要載入的腳本:只留這位演員與他自己的動作,從頭演到互動點之前,沒有鏡頭、旁白與其他舞台效果。
 * 演員鋪滿舞台(這個舞台不縮放,大小就是畫面上的大小)。其他演員的動作整個拿掉(不能只拿掉出場):他們的狀態要連續才推算得出來。
 * kinds 是這位演員會的動作(演員定義的 kinds),用來判斷沒寫 on 的步驟是不是他的。
 */
export function staticScript(script: StageScript, answers: Answers, momentId: string, actor: string, kinds: readonly string[]): StageScript {
  const expanded = expandAnswers(script, answers).steps as Record<string, unknown>[]
  const end = expanded.findIndex((s) => s.id === momentId)
  if (end < 0) throw new Error(`腳本裡沒有互動點「${momentId}」`)
  const steps = expanded.slice(0, end).flatMap((s) => {
    if (['card', 'callout', 'checkpoint', 'wait', 'move'].some((k) => k in s)) return []
    const owner = s.show ?? s.hide ?? s.parts ?? s.on
    if (owner !== undefined ? owner !== actor : !kinds.some((k) => k in s)) return []
    const { narration: _narration, chapter: _chapter, lessonStep: _lessonStep, focus: _focus, ...rest } = s
    return [rest]
  })
  // 靜態舞台只有這一位演員:不用鏡頭,也不用調度(blocking 的其他演員不在這份演員表裡)
  return { ...script, camera: undefined, blocking: undefined, cast: { [actor]: { ...script.cast[actor], place: 'full', hidden: false } }, steps: steps as unknown as ScriptStep[] }
}

/** 靜態舞台依寬度要關掉哪些區塊:演員宣告可以收合、舞台比門檻窄、又不在互動區的 */
export function collapsedParts(collapsible: Readonly<Record<string, number>> | undefined, zone: string[] | undefined, width: number): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(collapsible ?? {})
      .filter(([part, below]) => width < below && !zone?.includes(part))
      .map(([part]) => [part, false]),
  )
}

/** 在課程原本的腳本裡找步驟:原本的腳本調整順序或改文字時,找不到就直接丟錯,提醒要一起更新互動版 */
export function stepFinder(steps: Record<string, unknown>[], file: string) {
  return (label: string, match: (s: Record<string, unknown>) => boolean, from = 0): number => {
    const i = steps.findIndex((s, k) => k >= from && match(s))
    if (i < 0) throw new Error(`課程腳本找不到「${label}」,要一起更新 ${file}`)
    return i
  }
}

/** 給畫面顯示的回答文字;沒回答或略過時回傳 null */
export function answerLabel(moment: Moment, answer: Answer | undefined): string | null {
  if (!answer || 'skipped' in answer) return null
  return 'text' in answer ? answer.text : (moment.options[answer.option]?.label ?? null)
}
