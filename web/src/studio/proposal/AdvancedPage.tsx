import { LEVELS } from '../../content/levels'
import { List, ResearchRefs } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 暫定主題取自課程地圖（src/content/levels.ts 的 LEVELS，id: 'advanced'）。
const level = LEVELS.find((l) => l.id === 'advanced')

const POSITIONING: [string, string][] = [
  ['研發階段', '未開始。只有課程地圖上的暫定主題，尚無大綱。'],
  ['課程地圖標題', level?.title ?? '進階 AI Agent 應用'],
  ['先備條件（暫定）', level?.prerequisite ?? '完成 L3 或具備同等經驗'],
  ['存取', '未定。'],
  ['依賴', '主題與深度取決於 L3 期末專案的最終範圍，以及 L3 移出的單元（即時／非同步呼叫、前端與後端串接、額度、部署）是否改放到 L4。'],
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: 'L3 移出的單元是否改放 L4', body: 'L3 課程架構中已移出的五個單元（見 L3 課程架構頁）可能是 L4 的素材，需決定要不要接手。' },
  { title: '開始規劃的時機', body: '課程地圖寫的是「依學員回饋持續規劃」：是否等 L3 上線並收到回饋後再開始？' },
  { title: '單一課程或系列短課', body: '四個暫定主題差異大，可考慮拆成獨立短課，而不是一門完整課程。' },
  { title: '存取方式', body: '免費、登入後免費或付費，尚未決定。' },
]

const TODOS = [
  '等 L3 架構定案後，列出「L3 沒涵蓋但學員會需要」的主題清單。',
  '盤點 L3 移出單元的既有內容，評估能否直接沿用。',
  '為每個暫定主題寫一句學習成果，用來判斷是否值得成課。',
]

export function AdvancedPage() {
  return (
    <ProposalLayout title="L4 進階" footer="暫定主題：src/content/levels.ts（LEVELS）">
      <h1>L4 · 進階 AI Agent 應用</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>未開始 · 預留頁</span>

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

      <h2>暫定主題</h2>
      <p className={ui.lead}>取自課程地圖，尚未拆成單元。</p>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={level?.topics ?? []} />
        </div>
      </section>

      <h2>待辦</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={TODOS} />
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

      <h2>參考研究</h2>
      <ResearchRefs />
    </ProposalLayout>
  )
}
