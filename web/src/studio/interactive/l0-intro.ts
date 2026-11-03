// 序章的互動版:腳本和課程原本的 l0/0.intro.json 一樣,只在三個地方加上「選一選、想一想」的互動點。
// 序章只看不操作,所以互動點是選擇題,對應課程的「完成檢核」;選項的回應用章節卡(card)顯示,
// 不動演員,所以每個選項演完都回到原本的狀態,後面的演出直接接得上。
// 原本的示範就是互動點的 skip(沒回答直接播放時,演的就是原本的內容,旁白語音也都用得上);
// 選項回應的旁白還沒有語音,只顯示字幕。原本的腳本調整順序或改文字時,找不到位置會直接丟錯。
import type { ScriptStep, StageScript } from '../../live/types'
import { stepFinder } from './scene'

type Loose = Record<string, unknown>

/** 選項的回應:一張章節卡,標題是結論,副標補充,旁白只有字幕 */
const reply = (card: string, sub: string, narration: string, eyebrow = '想一想'): ScriptStep => ({ card, eyebrow, sub, narration }) as unknown as ScriptStep

const SKIP = { label: '先看示範', steps: [] as ScriptStep[] }

export function withL0IntroMoments(base: StageScript): StageScript {
  const steps = base.steps as Loose[]
  const find = stepFinder(steps, 'l0-intro.ts')
  const beforeEnd = find('「以前」的最後一步', (s) => s.callout === 'browser0:content' && s.text === 'CSS：決定網頁長什麼樣子')
  const beforeWait = find('「以前」結束前的停頓', (s) => typeof s.wait === 'number', beforeEnd)
  const chatEnd = find('聊天式 AI 的總結', (s) => typeof s.card === 'string' && s.card.startsWith('複製 → 貼上'), beforeWait)
  const agentCard = find('AI Agent 的章節卡', (s) => s.lessonStep === 4, chatEnd)
  const checkEnd = find('「他只負責說清楚要什麼」的聚光燈', (s) => s.callout === 'boss:bubble', agentCard)

  const hardest: Loose = {
    checkpoint: '以前自己寫程式，哪一段最花時間？',
    body: '想一想剛才的流程，點一個你的猜測。',
    id: 'hardest',
    stage: { focus: 'browser0:content' },
    options: [
      { label: '學程式語言', steps: [reply('對，學語言最花時間', '學語言、一行一行寫最花時間，零基礎通常卡在這裡。', '對，學語言最花時間。學語言、一行一行寫，零基礎通常卡在這裡。')] },
      { label: '一行一行寫', steps: [reply('對，一行一行寫最花時間', '學語言、一行一行寫最花時間，零基礎通常卡在這裡。', '對，一行一行寫最花時間。學語言、一行一行寫，零基礎通常卡在這裡。')] },
      {
        label: '存檔、打開來看',
        steps: [reply('存檔、打開來看，其實很快', '最花時間的是學語言、一行一行寫，零基礎通常卡在這裡。', '存檔、打開來看，其實很快。最花時間的，是學語言、一行一行寫，零基礎通常卡在這裡。')],
      },
      {
        label: '找錯、修改',
        steps: [reply('找錯、修改也麻煩，但更早就卡住了', '學語言、一行一行寫最花時間，零基礎通常卡在這裡。', '找錯、修改的確麻煩，不過更早就卡住了。學語言、一行一行寫最花時間，零基礎通常卡在這裡。')],
      },
    ],
    skip: SKIP,
  }

  const who: Loose = {
    checkpoint: '把程式碼存成檔案、打開來看、把錯誤貼回去問，這些要誰做？',
    body: '剛才聊天式 AI 的來回，想一想是誰在動手。',
    id: 'who',
    stage: { focus: 'chat:msg:last' },
    options: [
      {
        label: '我自己',
        steps: [reply('對，這些都是你的手在做', '聊天式 AI 只回文字，存檔、打開、貼回去問，都要你自己來回；下一段的 AI Agent 會自己做完整個來回。', '對，這些都是你自己做。聊天式 AI 只給你文字，每一趟來回都還是你的手。下一段的 AI Agent，會自己做完整個來回。')],
      },
      {
        label: 'AI',
        steps: [reply('聊天式 AI 只回文字，手還是你的', '存檔、打開來看、貼回去問，都要你自己來；能自己動手做完的，是接下來的 AI Agent。', '其實不是。聊天式 AI 只給你文字，存檔、打開、貼回去問，都還是你自己做。能自己動手的，是接下來的 AI Agent。')],
      },
    ],
    skip: SKIP,
  }

  const verify: Loose = {
    checkpoint: 'AI 說做好了，你要怎麼辦？',
    body: '回到小森烘焙的老闆。AI 把網站做好了，你會怎麼做？',
    id: 'verify',
    stage: { focus: 'boss:bubble' },
    options: [
      {
        label: '直接相信',
        steps: [reply('「AI 說做好了」不等於做對了', '它也會做錯、誤解你的意思，直接相信，錯的地方就留在成品裡。要自己打開來確認。', 'AI 說做好了，不等於做對了。它也會做錯，也可能誤解你的意思，要自己打開來確認。')],
      },
      {
        label: '打開來親眼檢查',
        steps: [reply('對，打開來親眼確認', 'AI 說做好了不等於做對了；自己打開來看，才知道是不是你要的。', '對，打開來親眼確認。AI 說做好了，不等於做對了，要自己打開來確認。')],
      },
      {
        label: '再問 AI 一次',
        steps: [reply('再問一次，也不等於做對了', '它說做好了，不等於做對了。與其再問一次，不如自己打開來確認。', '再問一次，答案還是 AI 說的，不等於做對了。與其再問一次，不如自己打開來確認。')],
      },
    ],
    skip: SKIP,
  }

  return {
    ...base,
    steps: [
      ...steps.slice(0, beforeWait + 1),
      hardest,
      ...steps.slice(beforeWait + 1, chatEnd + 1),
      who,
      ...steps.slice(chatEnd + 1, checkEnd + 1),
      verify,
      ...steps.slice(checkEnd + 1),
    ] as ScriptStep[],
  }
}
