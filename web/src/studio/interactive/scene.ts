// 互動教學場景的資料處理(純函式,頁面在 InteractiveScenePage.tsx)。
//
// 互動點寫在腳本的 checkpoint 步驟上(id、options、free);舞台只把它當一般的練習點。
// 學員回答後,把對應的步驟插到互動點後面、重新載入舞台:回答就是時間軸的一部分,
// 所以畫面仍是時間的純函式(README 第 1 節),拖曳、倒轉、演員狀態都不用另外處理。
import type { ScriptStep, StageScript } from '../../live/types'

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
  /** 把演員推到主畫面互動時要聚焦的目標;choices 是沒有 target 的選項要放在哪個區域(例如輸入框裡) */
  stage?: { focus: string; choices?: string }
}

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
