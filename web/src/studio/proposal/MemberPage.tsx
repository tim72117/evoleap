import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 跨等級構想：登入前後的差異（會員空間）。2026-11-03 整理。
// 「播放進度」已實作（server/internal/api/progress.go、web/src/courses/progress.ts）；其餘為構想，尚未決定是否實作。
// 新增任何會員資料前必須先更新隱私權政策（web/src/legal/PrivacyPage.tsx）。

const POSITIONING: [string, string][] = [
  ['研發階段', '部分已做（播放進度）；其餘為構想，尚未評估工時，優先順序尚未決定。'],
  ['一句話', '登入前後要有差別，會員才有理由註冊：訪客看課、不留下任何紀錄；登入後有自己的學習紀錄與工具。'],
  ['適用等級', 'L0–L4 都適用；「我的學習」頁與步驟打勾直接延伸現有的播放進度。'],
]

const DONE: [string, string, string][] = [
  ['訪客', '不儲存播放進度；舊版留在瀏覽器的進度會被清掉；課程頁提示「登入後會記住你看到哪裡」。', '前端不呼叫、後端也一律回 401'],
  ['會員', '自動記住每一課看到哪裡，下次從那裡接著看（約每 2 秒與離開頁面時存一次）。', '資料表 progress：使用者、課、位置、全長、更新時間；GET／PUT /api/progress'],
]

type Idea = { no: string; name: string; what: string; data: string; privacy: string }

const CORE: Idea[] = [
  { no: '1', name: '學習總覽「我的學習」', what: '首頁放「繼續看：0.1 第 2 分 10 秒」，下面是各課進度條與整體完成度。', data: '後端已有（GET /api/progress 回全部進度），缺前端頁面', privacy: '無新增資料' },
  { no: '2', name: '步驟打勾', what: '每課的步驟旁標「我做完了」；進度同時反映「看了」與「做了」。', data: '新增「步驟完成」資料（使用者、課、步驟）', privacy: '要更新隱私權政策' },
  { no: '3', name: '下一課建議', what: '依進度指出該看哪一課（看完 0.0 就推 0.1）。', data: '由進度與課程順序推算，不需新資料', privacy: '無' },
]

const LEARN: Idea[] = [
  { no: '4', name: '提示詞收藏', what: '把課程裡的提示詞一鍵收藏，可改寫、加標籤；最貼近本站主題。', data: '新增收藏資料', privacy: '要更新政策；要能刪除' },
  { no: '5', name: '步驟筆記', what: '每個步驟旁寫自己的備註。', data: '新增筆記資料（自由文字）', privacy: '要更新政策；要能刪除' },
  { no: '6', name: '我的作品', what: '每課的成品（例如小森烘焙網站的截圖或連結）存起來，串成學習軌跡。', data: '新增作品資料；若可上傳檔案還需要儲存空間', privacy: '要考慮內容安全與儲存成本' },
]

const GROW: Idea[] = [
  { no: '7', name: '內容分級', what: 'L0 全站公開（利於搜尋與入門）；L1 以上、參考成品下載、講義需登入。', data: '依登入狀態控制內容；不需新資料', privacy: '商業決策，需決定定位' },
  { no: '8', name: '完成證明', what: '完成一個級別後給可分享的頁面或證書。', data: '新增完成紀錄與公開頁', privacy: '公開頁要讓會員自己決定是否公開' },
  { no: '9', name: '意見回饋', what: '每課「這一步卡住了」按鈕，回饋給課程研發。', data: '新增回饋資料', privacy: '要更新政策' },
  { no: '10', name: '學習提醒', what: '停滯幾天寄 Email 提醒。', data: '需要寄信功能與訂閱同意、退訂連結', privacy: '要更新政策；需另外評估寄信服務' },
]

const ORDER = [
  '「我的學習」頁（1＋2＋3）：資料都在，先讓人感受到登入的價值。',
  '提示詞收藏（4）與我的作品（6）：本站最獨特的會員功能。',
  '內容分級（7）：需要先決定哪些內容要鎖，屬商業決策。',
  '意見回饋（9）、完成證明（8）、學習提醒（10）：視會員數與營運需要再做。',
]

const PRECONDITIONS = [
  '每新增一種會員資料（打勾、收藏、筆記、作品、回饋），都要先更新隱私權政策說明蒐集什麼、用途與保存期間。',
  '目前網站還沒有「刪除帳號」按鈕，只能來信申請。建議在做筆記、作品這類自由輸入的功能前，先補上刪除帳號，並讓刪除時一併清除所有會員資料（含進度）。',
  '我的作品若允許上傳檔案或貼連結，需要考慮內容安全（不當內容、惡意連結）與儲存費用。',
  '新增的資料表要補單元測試，並確認訪客一律被拒絕（進度功能已有）。',
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '哪些內容要登入才能看', body: '只鎖參考成品與講義，或整個 L1 以上？影響搜尋曝光與註冊誘因。' },
  { title: '是否要寄信', body: '學習提醒需要選寄信服務並處理退訂。' },
  { title: '完成證明', body: '是否公開、是否放真實姓名，由會員自己決定。' },
]

function IdeaTable({ ideas }: { ideas: Idea[] }) {
  return (
    <section className={ui.card}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>功能</th>
            <th>說明</th>
            <th>資料與後端</th>
            <th>隱私</th>
          </tr>
        </thead>
        <tbody>
          {ideas.map((i) => (
            <tr key={i.no}>
              <td className={ui.nowrap}>{i.no}</td>
              <td className={ui.nowrap}>
                <strong>{i.name}</strong>
              </td>
              <td>{i.what}</td>
              <td>{i.data}</td>
              <td>{i.privacy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function MemberPage() {
  return (
    <ProposalLayout title="會員空間" footer="跨等級構想 · 播放進度已實作，其餘尚未決定">
      <h1>構想 · 會員空間（登入前後的差異）</h1>
      <span className={`${ui.chip} ${ui.todo} ${ui['draft-banner']}`}>部分已做 · 其餘待評估</span>

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

      <h2>目前已做：播放進度</h2>
      <section className={ui.card}>
        <table>
          <thead>
            <tr>
              <th>對象</th>
              <th>行為</th>
              <th>實作</th>
            </tr>
          </thead>
          <tbody>
            {DONE.map(([who, what, impl]) => (
              <tr key={who}>
                <td className={ui.nowrap}>
                  <strong>{who}</strong>
                </td>
                <td>{what}</td>
                <td>{impl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className={ui.lead}>隱私權政策已同步改成現況：登入後記錄播放進度、未登入不儲存任何進度。</p>

      <h2>核心（建議先做）</h2>
      <p className={ui.lead}>這三項直接延續現有的進度資料，工作量小、學員最有感，合起來就是一個「我的學習」頁。</p>
      <IdeaTable ideas={CORE} />

      <h2>學習輔助</h2>
      <p className={ui.lead}>最能體現本站特色（提示詞、AI 協作）的差異化，排第二批。</p>
      <IdeaTable ideas={LEARN} />

      <h2>經營與回饋</h2>
      <IdeaTable ideas={GROW} />

      <h2>建議順序</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <ol className={ui['plain-list']}>
            {ORDER.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      </section>

      <h2>隱私與前置條件</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={PRECONDITIONS} />
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
