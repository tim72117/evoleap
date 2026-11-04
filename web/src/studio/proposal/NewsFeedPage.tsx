import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 跨等級構想：科技新知動態牆。2026-11-04 提出，尚未評估。
// 演繹方式沿用即時教學畫面的舞台系統（web/src/live/：stage.ts、actors/、content/live/*.json 腳本）。

const POSITIONING: [string, string][] = [
  ['研發階段', '構想，尚未評估工時。'],
  ['一句話', '類似社群網站的動態牆，一則一則放科技新知；每則可以用舞台系統演一段短短的即時畫面，而不只是文字。'],
  ['對象', '已在上課或上完課的學員，讓他們有理由常回來；也可作為訪客認識網站的入口。'],
  ['和其他構想的關係', '新知裡講到的新功能，可以接到「軟體新功能開箱」做完整示範（花小葉片開啟）。'],
]

const POST: [string, string][] = [
  ['一則動態', '標題、一兩句重點、發布時間、標籤（例如 AI 工具、開發工具）；可以展開看舞台演繹。'],
  ['舞台演繹', '用現有演員（瀏覽器、AI 對話、檔案、桌面）演出新功能怎麼用，十幾秒到一分鐘；學員可以暫停、複製畫面上的提示詞。'],
  ['製作方式', '寫一份舞台腳本（JSON）就是一則動態，不錄影；工具改版時改腳本就好。'],
  ['互動', '先做最簡單的：按「有用」、收藏；留言要另外評估審核成本。'],
]

const DESIGN_NOTES = [
  '動態牆是一則一則往下滑，舞台演繹預設不自動播放，點了才播，避免整頁同時播放、拖慢頁面。',
  '新知會過時：每則標上發布日期，過時的內容可以標示「已有更新」或收起來。',
  '只寫自己實測過的內容，並附上原始出處；不轉貼別人的文章全文。',
  '提到的工具或服務用通用名稱描述功能，不放他們的商標或標誌。',
  '舞台腳本可能需要新演員（例如手機畫面、通知），要依演員設計規範（操作型動作、init／apply 狀態）新增。',
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '誰來寫', body: '只有課程研發發文，還是開放學員投稿？' },
  { title: '更新頻率', body: '每天、每週，還是有重要新功能才發？' },
  { title: '要不要登入', body: '公開給所有人看（利於搜尋與引流），還是登入後才看得到？' },
  { title: '和資源系統的關係', body: '看新知能不能讓鹿掉落小葉片？要不要有上限？' },
  { title: '留言', body: '要不要開放留言，以及由誰審核。' },
]

export function NewsFeedPage() {
  return (
    <ProposalLayout title="科技新知動態牆" footer="跨等級構想 · 尚未評估">
      <h1>構想 · 科技新知動態牆</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>構想 · 待評估</span>

      <h2>定位</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {POSITIONING.map(([k, v]) => (
              <tr key={k}>
                <td className={ui.nowrap} style={{ width: '9em' }}>
                  <strong>{k}</strong>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>一則動態的樣子</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {POST.map(([k, v]) => (
              <tr key={k}>
                <td className={ui.nowrap} style={{ width: '9em' }}>
                  <strong>{k}</strong>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>設計要點</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={DESIGN_NOTES} />
        </div>
      </section>

      <h2>待決定</h2>
      <div className={ui.note}>
        <ul style={{ margin: 0 }}>
          {OPEN_QUESTIONS.map((q) => (
            <li key={q.title}>
              <strong style={{ display: 'inline' }}>{q.title}</strong>：{q.body}
            </li>
          ))}
        </ul>
      </div>
    </ProposalLayout>
  )
}
