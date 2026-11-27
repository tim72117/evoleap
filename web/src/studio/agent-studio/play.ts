// 「自己玩」的規則(不碰畫面):開發過程的五個步驟、下一步提示、依步驟重算演員狀態。
import type { StudioState } from '../../live/actors/agent-studio/actor'
import type { AnyActor, ScriptStep } from '../../live/types'

export const MILESTONES: { id: string; label: string; hint: string; done: (st: StudioState) => boolean }[] = [
  { id: 'say', label: '說想法', hint: '點左邊的卡片，告訴小幫手你想做什麼。', done: (st) => st.page.blocks.length > 0 },
  { id: 'try', label: '試一試', hint: '按按看網頁上的按鈕，或切到「手機」看一看。', done: (st) => st.tried },
  { id: 'fix', label: '修到好', hint: '按「檢查」，打叉的地方點卡片請小幫手修，修完再檢查一次。', done: (st) => st.passed },
  { id: 'save', label: '存起來', hint: '按「存起來」，之後改壞了還找得回來。', done: (st) => st.versions.length > 0 },
  { id: 'share', label: '分享', hint: '按「分享」，讓朋友看到（這是模擬的，不會真的傳出去）。', done: (st) => st.published > 0 },
]

export function nextHint(st: StudioState): string {
  return MILESTONES.find((m) => !m.done(st))?.hint ?? '完成了！還想改就繼續點卡片，改完記得再存起來、再分享。'
}

/** 依序套用步驟後的演員狀態(init/apply 是純函式) */
export function replay(def: AnyActor, props: object, steps: ScriptStep[]): StudioState {
  return steps.reduce(
    (st, raw) => {
      const step = raw as Record<string, unknown>
      const kind = def.kinds.find((k) => k in step)
      return kind ? def.apply!(st, kind, step) : st
    },
    def.init!(props),
  ) as StudioState
}
