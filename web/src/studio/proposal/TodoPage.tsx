import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 研發基地的待辦:還沒決定或還沒處理的事。做完就從這裡刪掉,記錄留在 CHANGELOG 與 git。

type Todo = { title: string; problem: string; action: string }

const DECISIONS: { title: string; detail: string }[] = [
  { title: '訂閱的價格', detail: '月繳、年繳的金額，以及要不要試用。' },
]

const GROUPS: { title: string; items: Todo[] }[] = [
  {
    title: '付費與法律頁',
    items: [
      {
        title: '重複訂閱與對不上的付款要人工處理',
        problem: '重複訂閱會自動停止續訂，但已付款項不會自動退；對不上帳號或價格的付款只留下紀錄與 log，沒有通知，也沒有後台可以查。',
        action: '定期查 subscription_events 的 duplicate、unknown_user、unknown_price，對應的交易在 subscription_payments，取消失敗放棄的工作在 subscription_tasks（failed_at 有值），之後再做通知或後台。補上方案價格後可以用 POST /api/admin/subscription-events/{id}/replay 重新處理。',
      },
      {
        title: '條款與程式不一致',
        problem: '收費頁與條款都寫訂閱制，Paddle webhook 也已改用訂閱套件，收費頁也接上了月繳與年繳的結帳，但還沒有價格，也沒有對 sandbox 實際測試；沒有設定價格時按鈕會停用。',
        action: '在 Paddle 建立月繳與年繳價格，通知目的地勾選 subscription.*、adjustment.* 與 transaction.completed，API key 開 customer_portal_session.write 權限，設定 PADDLE_ 環境變數，把 ID 填進 server/internal/plans/plans.go，走完訂閱、續訂、扣款失敗、取消與退款後才開放付款。',
      },
      {
        title: '會員看不到訂閱狀態',
        problem: '收費頁已能看到到期日、扣款失敗提醒與管理入口，但會員選單沒有。',
        action: '加進會員選單，取消方式要和退款政策寫的一致。',
      },
      {
        title: '收費頁還沒有對外開放',
        problem: '/pricing 設為 noindex，導覽列沒有入口，訂閱課程也沒有連到這一頁。',
        action: '開放付款時拿掉 noindex，加上導覽入口，訂閱課程連到訂閱方案。',
      },
    ],
  },
  {
    title: '課程存取',
    items: [
      {
        title: '訂閱課程的內容還在公開 bundle',
        problem: '後端已有 GET /api/courses/{id}/access，前端也有訂閱閘門，但課程內容目前都打包在公開的 bundle 裡，閘門只擋畫面。L2 以上還沒有內容，所以現在沒有外流。',
        action: '上架 L2 內容前決定內容怎麼由後端提供，端點要經過 courseAccess 檢查。',
      },
      {
        title: '背景工作在 Cloud Run 可能不會持續執行',
        problem: '取消失敗的重試靠伺服器內的定時工作，Cloud Run 預設只在處理請求時分配 CPU，沒有流量時重試會延後到下一次請求。',
        action: '決定要開 --no-cpu-throttling、設最少執行個體，或用 Cloud Scheduler 定期觸發。',
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
