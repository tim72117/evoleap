import { useCourseMap } from '../../content/courseMap'
import { useTopicPage } from '../../content/topicPage'
import { LessonListStatus } from '../../courses/LessonGroup'
import { Fold } from './Fold'
import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 暫定主題與課名取自資料庫（advanced 課程的單元）；先備條件取自「打造 AI 互動軟體」主題頁的等級卡區塊。

const positioning = (title: string, prerequisite: string): [string, string][] => [
  ['研發階段', '未開始。只有課程地圖上的暫定主題，尚無大綱。'],
  ['課程地圖標題', title],
  ['先備條件（暫定）', prerequisite],
  ['存取', '未定。'],
  ['依賴', '主題與深度取決於 L3 期末專案的最終範圍，以及 L3 移出的單元（即時／非同步呼叫、前端與後端串接、額度、部署）是否改放到 L4。'],
]

const TODOS = [
  '等 L3 架構定案後，列出「L3 沒涵蓋但學員會需要」的主題清單。',
  '盤點 L3 移出單元的既有內容，評估能否直接沿用。',
  '為每個暫定主題寫一句學習成果，用來判斷是否值得成課。',
]

export function AdvancedPage() {
  const state = useCourseMap('advanced')
  const page = useTopicPage('ai-apps')
  const note = page.status === 'ready' ? page.sections.flatMap((x) => (x.kind === 'levels' ? (x.blocks ?? []) : [])).find((b) => b.ref === 'advanced')?.note : undefined
  const prerequisite = page.status === 'loading' ? '讀取中…' : page.status === 'error' ? '無法讀取' : (note ?? '尚未填寫')
  const map = state.status === 'ready' ? state.map : undefined
  return (
    <ProposalLayout title="L4 進階" footer="暫定主題：資料庫的 advanced 課程單元">
      <h1>L4 · 進階 AI Agent 應用</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>未開始 · 預留頁</span>

      <Fold title="定位">
        <section className={ui.card}>
          <table>
            <tbody>
              {positioning(map?.title ?? '', prerequisite).map(([k, v]) => (
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
      </Fold>

      <h2>暫定主題</h2>
      <p className={ui.lead}>取自課程地圖，尚未拆成單元。</p>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          {state.status === 'ready' ? <List items={state.map.units.map((u) => u.title)} /> : <LessonListStatus state={state.status} />}
        </div>
      </section>

      <h2>待辦</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={TODOS} />
        </div>
      </section>
    </ProposalLayout>
  )
}
