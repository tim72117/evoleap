// L0 第 2 課的互動版:腳本和語音都用課程原本的 l0/0.2-site.json,只在「商品卡片的排列」之後加一個互動點:
// 響應式設計,讓學員選手機、平板、桌面,看同一個網頁依寬度換排版。
// 位置在步驟 4 演完(瀏覽器還開著、網站是 v3、桌面寬度、捲到頂端)、關掉瀏覽器之前,
// 所以每個選項最後要把寬度與捲動還原成桌面、頂端,後面原本的演出才接得上。
// 說明文字以 site/v3 實際的 CSS 為準:只有一段 @media (max-width: 600px) 把商品卡片改成一欄,
// 其他寬度都是四欄;導覽列還沒有選單按鈕(那是步驟 7 才加的),手機寬度只是擠成兩行。
// skip 的步驟是空的:沒回答直接播放時,演的就是原本步驟 4 的「手機 → 桌面」示範,原本的旁白時間軸一個字都不動;
// 選項的回應旁白還沒有語音,只顯示字幕。原本的腳本調整順序或改文字時,找不到位置會直接丟錯。
import type { ScriptStep, StageScript } from '../../live/types'
import { stepFinder } from './scene'

type Loose = Record<string, unknown>

const step = (s: Loose): ScriptStep => s as unknown as ScriptStep

/** 響應式的結論,每個選項都帶到 */
const CONCEPT = '同一份網頁，依螢幕寬度自動換排版，這就是響應式設計。'

export function withL02Moments(base: StageScript): StageScript {
  const steps = base.steps as Loose[]
  const find = stepFinder(steps, 'l0-0.2.ts')
  const cardsUser = find('商品卡片的指令', (s) => s.user === '商品卡片在手機上改成一欄')
  const site = find('商品卡片改好的網站(v3)', (s) => s.show === 'browser' && s.site === 'v3', cardsUser)
  const toDesktop = find('放寬回桌面寬度', (s) => s.width === 'desktop', site)
  const toTop = find('捲回頁面頂端', (s) => s.scroll === 'top', toDesktop)
  const hide = find('關掉瀏覽器', (s) => s.hide === 'browser', toTop)
  find('步驟 4 的換你試試', (s) => s.checkpoint === '換你試試', hide)

  /** 切到某個寬度、說明排法、最後還原成桌面寬度與頁面頂端 */
  const reply = (width: 'phone' | 'tablet' | 'desktop', enter: string, tip: string, say: string, back: string): ScriptStep[] => [
    step({ scroll: 'products', narration: '先捲到商品卡片。' }),
    step({ width, narration: enter }),
    step({ callout: 'browser:section:products', text: tip, narration: say }),
    step({ wait: 1200 }),
    ...(width === 'desktop' ? [] : [step({ width: 'desktop', narration: back })]),
    step({ scroll: 'top' }),
  ]

  const moment: Loose = {
    checkpoint: '同一個網頁，換個裝置會變成什麼樣子？',
    body: '選一種裝置，看看網頁怎麼排版。可以在右側重新回答，三種都試一次。',
    id: 'device',
    stage: { focus: 'browser:content' },
    options: [
      {
        label: '📱 手機',
        steps: reply('phone', '視窗縮窄成手機寬度。', '手機：卡片一欄，導覽擠在一起', `手機寬度，商品卡片排成一欄，導覽列也擠成兩行，還沒有收起來。${CONCEPT}`, '放寬回桌面，卡片又是多欄。'),
      },
      {
        label: '📲 平板',
        steps: reply(
          'tablet',
          '視窗調成平板寬度。',
          '平板：還是四欄，有點擠',
          `平板寬度比手機寬，還沒到一欄的條件，卡片仍是四欄，每張變窄。${CONCEPT}`,
          '放寬回桌面，四欄比較寬鬆。',
        ),
      },
      {
        label: '🖥️ 桌面',
        steps: reply('desktop', '桌面寬度，就是剛才一直看到的樣子。', '桌面：四欄並排', `桌面寬度最寬，四張商品卡片並排。${CONCEPT}`, ''),
      },
    ],
    skip: { label: '先看示範', steps: [] as ScriptStep[] },
  }

  return {
    ...base,
    steps: [...steps.slice(0, hide), step(moment), ...steps.slice(hide)] as ScriptStep[],
  }
}
