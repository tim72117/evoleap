import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 構想：兒童課程免費、孩子看不到廣告，由家長設定上課時間（每週 n 次）；家長在設定畫面才看得到廣告。2026-11-10 整理，尚未決定是否實作。
// 現況：兒童課程不放廣告（courses/lessonAds.ts 的註解：兒童課不走這裡）；課程存取方式在 courses_seed.json 的 kids 課程（目前是「登入後免費」）；沒有家長帳號、上課時間或每週次數的概念。

const POSITIONING: [string, string][] = [
  ['研發階段', '構想，尚未評估工時，也還沒決定要不要做。'],
  ['一句話', '兒童課程對孩子完全免費、沒有廣告；家長替孩子設定每週上課的時間與次數，而廣告只出現在家長自己操作的設定畫面。'],
  ['適用課程', '主題「給孩子的網頁程式」（kids 課程）；先做這一門，其他課程不受影響。'],
  ['商業邏輯', '孩子端不接觸任何廣告與付費，廣告收入來自家長設定時的曝光；是否同時提供訂閱（免廣告設定）尚未決定。'],
]

const ROLES: [string, string, string][] = [
  ['家長', '用自己的帳號登入；建立孩子的學習檔案、設定上課時間與每週次數；設定與檢視畫面會看到廣告。', '一般會員帳號（已有的登入）加上「家長模式」'],
  ['孩子', '用家長給的方式進入上課（例如家長裝置上的孩子入口，或只需輸入簡單代碼）；上課畫面沒有廣告、沒有付費提示。', '孩子不需要自己的 Email 與密碼；不蒐集孩子的個人資料'],
]

const SCHEDULE: [string, string][] = [
  ['每週次數 n', '家長設定「每週上 n 次」（例如 2 次），孩子本週已上幾次、還剩幾次都看得到；上完就提示「這週的課上完了」。'],
  ['上課時間', '家長選每週哪幾天、哪個時段可以上課；時段外孩子入口顯示「還沒到上課時間」，家長可以臨時開放一次。'],
  ['進度', '孩子上完一課自動記進度（已有的播放進度），家長在設定畫面看到本週完成幾課、上到哪一課。'],
  ['提醒', '時間到了在孩子入口提示「該上課囉」；是否寄信或推播給家長尚未決定。'],
]

const ADS: [string, string][] = [
  ['出現的位置', '只在家長設定畫面（設定時間、每週次數、檢視進度）；孩子的上課畫面、孩子入口、課程地圖的孩子視角一律沒有。'],
  ['出現的時機', '家長「設定時」：進入設定頁或儲存設定時；一次設定只出現一次，避免干擾操作。'],
  ['廣告合規', '兒童導向頁面的廣告有額外限制（投放平台對兒童導向內容的規定）；家長設定頁必須和孩子的上課頁完全分開，而且設定頁面向成人，不是兒童導向。上線前要先確認廣告平台與個資法對兒童相關服務的要求。'],
  ['和現有規則的關係', '現有規則：登入且沒訂閱的人在大部分課程會看到廣告，管理員與訂閱者不看（courses/lessonAds.ts），兒童課不放廣告。新構想是把「兒童課的廣告」改放到家長設定畫面，其他規則不變。'],
]

const DATA: [string, string][] = [
  ['孩子檔案', '家長帳號底下的孩子：暱稱（不是真實姓名也可以）、年齡區間可省略；不放照片與聯絡方式。'],
  ['上課計畫', '每個孩子：每週次數 n、可上課的星期與時段、時區；是否臨時開放。'],
  ['上課紀錄', '孩子本週上了哪幾課、哪天上的（可由現有播放進度推算，必要時另存「完成一次上課」）。'],
  ['存取方式', 'kids 課程改成「免費」（不需要登入就能進孩子入口，由家長裝置授權）或維持「登入後免費」，要先決定。'],
]

const DESIGN_NOTES = [
  '孩子入口和家長設定頁要是兩個獨立的入口，不共用畫面與元件，免得廣告元件被帶進孩子的畫面。',
  '時段控制以伺服器時間與家長設定的時區判斷，不信任孩子裝置上的時間。',
  '先做最小版本：家長設定每週次數、孩子入口顯示「這週還可以上 N 次」；時段限制與提醒第二階段再做。',
  '新增任何家長與孩子相關資料之前，必須先更新隱私權政策（web/src/legal/PrivacyPage.tsx），說明蒐集什麼、用途與保存期間，並提供刪除孩子檔案的方式。',
  '新的資料表要補單元測試，並確認孩子入口只能讀到孩子自己的上課計畫、不能碰到家長帳號的其他資料。',
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '孩子怎麼進入上課', body: '在家長的裝置上切換成孩子入口、或給孩子一組簡單代碼（或 QR code）？影響是否要讓孩子自己的裝置也能登入。' },
  { title: '時段外要不要真的擋住', body: '硬性擋住（時段外不能上），還是只提醒「已經超過計畫」？硬性擋住會讓家長更有掌控感，但也更容易卡住孩子。' },
  { title: '多個孩子', body: '一個家長帳號能不能有好幾個孩子、各自的計畫與進度？第一版是否只支援一個。' },
  { title: '免廣告的選項', body: '訂閱的家長在設定畫面也不看廣告？這會讓兒童課的收入變成只靠廣告，需要和訂閱方案一起決定。' },
  { title: '廣告合規', body: '家長設定頁放廣告是否符合廣告平台對兒童相關服務的規定與個資法？上線前需要確認，必要時改成贊助或其他形式。' },
  { title: '家長信箱', body: '要不要寄「本週上課摘要」給家長？需要寄信服務與退訂流程（見會員空間構想的學習提醒）。' },
]

export function KidsFamilyPage() {
  return (
    <ProposalLayout title="兒童課家長模式" footer="跨等級構想 · 尚未決定是否實作">
      <h1>構想 · 兒童課程免費無廣告，家長設定上課時間</h1>
      <span className={`${ui.chip} ${ui.todo} ${ui['draft-banner']}`}>構想 · 待評估</span>

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

      <h2>兩種使用者</h2>
      <section className={ui.card}>
        <table>
          <thead>
            <tr>
              <th>角色</th>
              <th>做什麼、看到什麼</th>
              <th>帳號與資料</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map(([who, what, data]) => (
              <tr key={who}>
                <td className={ui.nowrap}>
                  <strong>{who}</strong>
                </td>
                <td>{what}</td>
                <td>{data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>上課時間與每週次數</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {SCHEDULE.map(([k, v]) => (
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

      <h2>廣告放哪裡</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {ADS.map(([k, v]) => (
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

      <h2>需要的資料</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {DATA.map(([k, v]) => (
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
