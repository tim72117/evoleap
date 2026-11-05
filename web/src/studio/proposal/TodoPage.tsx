import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 研發基地的待辦:還沒決定或還沒處理的事。做完就從這裡刪掉,記錄留在 CHANGELOG 與 git。

type Todo = { title: string; problem: string; action: string }

const DECISIONS: { title: string; detail: string }[] = []

const GROUPS: { title: string; items: Todo[] }[] = [
  {
    title: '付費與法律頁',
    items: [
      {
        title: '條款與程式不一致',
        problem: '服務條款和退款政策寫自動續訂、可看所有付費課程，但實際只能單門課一次性購買。',
        action: '付費模式已定為訂閱制：條文不動，把收費頁與後端改成訂閱。對齊前不開放付款。',
      },
      {
        title: '隱私權政策的資料欄位不符',
        problem: '頁面寫保存訂閱編號、訂閱狀態與當期起訖時間，程式實際保存的是購買紀錄。',
        action: '後端改成保存訂閱紀錄，和頁面寫的欄位一致。',
      },
    ],
  },
  {
    title: '課程存取',
    items: [
      {
        title: 'L2 的訂閱限制還沒做',
        problem: '課程地圖已標示訂閱專屬，但還沒有訂閱功能，L2 目前也沒有課程內容可以限制。',
        action: 'L2 上架內容前，加上訂閱檢查，只讓訂閱客戶觀看。',
      },
      {
        title: '收費頁的分組要對齊 L2',
        problem: 'L2 已定為訂閱專屬，收費頁仍把它和尚未決定的課一起列在「進階課程」，填入價格後會出現單門購買按鈕。',
        action: '把 L2 列為訂閱內容、不提供單門購買，並把「尚未決定」和「收費」分開判斷。',
      },
      {
        title: '已建立的資料庫不會更新存取設定',
        problem: '初始資料只補上不存在的課程，已有的 L1、L2 資料會維持舊值。',
        action: '上線前確認資料庫的值，必要時用 migration 更新。',
      },
    ],
  },
  {
    title: 'Claude Code 工作術',
    items: [
      {
        title: 'Fork 的封面設定寫死',
        problem: '所有影片都套用同一個封面設定，新增第二支影片時會退回空白字卡。',
        action: '把封面設定移到各情境的影片資料裡。',
      },
    ],
  },
]

export function TodoPage() {
  return (
    <ProposalLayout title="待辦" footer="來源：2026-11-05 的 code review">
      <h1>待辦</h1>

      {DECISIONS.length > 0 && (
        <>
          <h2>待決定</h2>
          <section className={ui.card}>
            <ul>
              {DECISIONS.map((d) => (
                <li key={d.title}>
                  <strong>{d.title}</strong>
                  <br />
                  {d.detail}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <div className={ui.card}>
            <ul>
              {group.items.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <br />
                  問題：{item.problem}
                  <br />
                  處理：{item.action}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </ProposalLayout>
  )
}
