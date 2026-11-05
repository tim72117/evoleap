import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 研發基地的待辦:還沒決定或還沒處理的事。做完就從這裡刪掉,記錄留在 CHANGELOG 與 git。

type Todo = { title: string; problem: string; action: string }

const DECISIONS: { title: string; detail: string }[] = [
  {
    title: '付費模式：訂閱制或一次性購買',
    detail: '法律頁目前寫訂閱制，收費頁和後端仍是單門課一次性購買。這個決定會影響要改條文，還是改收費頁與後端。',
  },
  {
    title: '全部課程頁（/courses）要留或移除',
    detail: '這一頁和主題頁列的是相同課程，導覽列也有它的入口。',
  },
  {
    title: 'L2 的存取方式',
    detail: '目前設為尚未決定，所以收費頁把它歸在「進階課程」。決定後要一起調整收費頁的分組。',
  },
]

const GROUPS: { title: string; items: Todo[] }[] = [
  {
    title: '付費與法律頁',
    items: [
      {
        title: '條款與程式不一致',
        problem: '服務條款和退款政策寫自動續訂、可看所有付費課程，但實際只能單門課一次性購買。',
        action: '依付費模式的決定，改條文或改收費頁與後端。對齊前不開放付款。',
      },
      {
        title: '隱私權政策的資料欄位不符',
        problem: '頁面寫保存訂閱編號、訂閱狀態與當期起訖時間，程式實際保存的是購買紀錄。',
        action: '對外告知的內容要和實際保存的資料一致。',
      },
    ],
  },
  {
    title: '課程存取',
    items: [
      {
        title: 'L1 的「登入後免費」只是標籤',
        problem: '沒登入也能打開 L1 的課程頁；服務條款也寫目前開放的內容不需註冊。',
        action: 'L1 開放前，加上實際的登入限制並更新條款，兩者要一起上線。',
      },
      {
        title: 'L2 列在收費頁的「進階課程」',
        problem: '收費頁把尚未決定的課都當成收費課，L2 填入價格後就會出現購買按鈕。',
        action: '把「尚未決定」和「收費」分開判斷。',
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
        title: '影片收合後要重新播放',
        problem: '收合影片列或整組情境都會卸載播放器，再展開就從頭開始。',
        action: '第一次展開才載入，之後只切換顯示與隱藏。',
      },
      {
        title: 'Fork 的封面設定寫死',
        problem: '所有影片都套用同一個封面設定，新增第二支影片時會退回空白字卡。',
        action: '把封面設定移到各情境的影片資料裡。',
      },
    ],
  },
  {
    title: '首頁與全部課程',
    items: [
      {
        title: '「課程地圖」按鈕沒有直接到地圖',
        problem: '按鈕連到主題頁頂部，頁尾和登入頁的同名連結則直接到地圖段落。',
        action: '連結改成 /topics/software#map。',
      },
      {
        title: '全部課程頁重複首頁的計算',
        problem: '「已開放幾課」的算法複製了一份，規則改動時兩邊可能不一致。',
        action: '如果保留這一頁就抽成共用函式；如果移除，連同導覽、SEO 和測試一起拿掉。',
      },
    ],
  },
]

export function TodoPage() {
  return (
    <ProposalLayout title="待辦" footer="來源：2026-11-05 的 code review">
      <h1>待辦</h1>

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
