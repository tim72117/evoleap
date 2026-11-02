import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 跨等級構想：學員在學習過程中，用自己的 AI 工具透過 MCP 連入課程，取得練習範本、提交作業。
// 尚未決定是否實作；此頁整理構想、可能的工具清單與待決定事項。

const POSITIONING: [string, string][] = [
  ['研發階段', '構想。尚未評估工時，也未決定是否實作。'],
  ['一句話', '學員在自己的 AI 工具（Claude Code、Codex CLI、Cursor 等）裡連上課程的 MCP server，直接說「給我這課的練習範本」「幫我交作業」，不用在瀏覽器與工具之間來回複製貼上。'],
  ['適用等級', 'L0 起就在用會操作檔案的 AI 工具，理論上 L0–L4 都能用；L3（AI Agent 整合應用）本身就教 MCP，可以把「連上課程 MCP」當成教材的一部分。'],
  ['與既有待決定事項的關係', 'L1「結業作品是否收件」「是否提供各課參考產出」、L0「已會用這類工具的學員」的自我檢查，都可以由這個構想一併解決。'],
]

const TOOLS: { name: string; does: string; note: string }[] = [
  { name: 'list_lessons', does: '列出等級、單元、課程與學員的完成狀態', note: '讓 AI 知道學員在哪一課' },
  { name: 'get_exercise', does: '把某一課的練習範本（起始檔案、提示詞、完成檢核）寫進學員的練習資料夾', note: '取代「到講義下載 zip 再解壓縮」' },
  { name: 'get_reference', does: '取得某一課的參考產出，讓跟不上的學員直接接續下一課', note: '對應 L1「是否提供各課參考產出」' },
  { name: 'check_work', does: '依該課的完成檢核清單，讓學員的 AI 先自我檢查', note: '在本機跑，不上傳；只回傳檢核項目' },
  { name: 'submit_assignment', does: '把作業（指定檔案或部署網址）連同自評提交到課程網站', note: '對應 L1 3.3 結業作品收件' },
  { name: 'get_feedback', does: '取回作業的批改狀態與回饋', note: '回饋來源（老師、助教、AI 初評）待決定' },
]

const FLOW = [
  '學員在課程網站登入，在「我的帳號」產生連線用的金鑰或完成 OAuth 授權。',
  '依課程提供的一行設定，把課程 MCP server 加進自己的 AI 工具。',
  '上課時對 AI 說「我在上 0.2，給我練習範本」→ AI 呼叫 get_exercise，把起始檔案放進練習資料夾。',
  '做完後說「幫我檢查」→ check_work 回傳檢核清單，AI 對照學員的檔案逐項檢查。',
  '說「交作業」→ AI 先列出要上傳的檔案讓學員確認，再呼叫 submit_assignment。',
  '之後說「作業有回饋了嗎」→ get_feedback。',
]

const TECH = [
  '既有 Go server（server/）已有帳號、JWT 與 /api 路由，可再掛一個 Streamable HTTP 的 MCP 端點（例如 /mcp），與網站共用帳號與資料庫。',
  '練習範本、完成檢核清單與參考產出放在課程內容（src/content）旁邊，網站講義與 MCP 讀同一份來源，避免兩邊不同步。',
  '作業提交需要新增資料表（提交紀錄、檔案或網址、自評、回饋）與檔案大小限制；檔案存放位置（資料庫、雲端儲存）待決定。',
  '唯讀工具（list_lessons、get_exercise、get_reference、check_work）可先上線，提交與回饋等確定收件流程後再做。',
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '從哪一級開始用', body: 'L0 學員剛接觸 AI 工具，加 MCP 設定可能是額外門檻；也可以只在 L3 教 MCP 時才引入，或 L0 先用網站下載、L3 再改用 MCP。' },
  { title: '各 AI 工具的支援程度', body: 'Claude Code、Codex CLI、Cursor、Gemini CLI 對遠端 MCP 與 OAuth 的支援程度不同，需實測，並決定課程只示範一種還是附各工具的設定說明。' },
  { title: '認證方式', body: 'OAuth（學員體驗較好，實作較多）或在網站產生個人金鑰（實作簡單，但要教學員保管金鑰）。' },
  { title: '作業由誰回饋', body: '老師人工、助教、AI 初評再由人複核，或只收件不回饋。影響人力成本與付費定位。' },
  { title: '與課程平台的關係', body: '課程若在課程平台上架，學員帳號在平台上；課程網站與 MCP 需要另外登入，要確認是否符合平台規範，以及如何對應購課身分。' },
  { title: '資安與隱私', body: '提交前一定要讓學員確認上傳內容，避免把 .env、金鑰或個人資料一起送出；伺服器端也要擋下常見的機密檔名。' },
]

const TODOS = [
  '挑一課（建議 L0 0.2 或 L1 3.3）寫出完整的範本、檢核清單與提交格式，當作試做範例。',
  '在兩到三個主要 AI 工具實測連接遠端 MCP server 的步驟與畫面。',
  '估算唯讀工具（第一階段）與提交／回饋（第二階段）的實作工時。',
]

export function McpPage() {
  return (
    <ProposalLayout title="課程 MCP" footer="跨等級構想 · 尚未決定是否實作">
      <h1>構想 · 用 MCP 連入課程</h1>
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

      <h2>學員的使用流程</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <ol className={ui['plain-list']}>
            {FLOW.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      </section>

      <h2>暫定工具清單</h2>
      <p className={ui.lead}>MCP server 對學員的 AI 工具提供的功能。名稱為暫定。</p>
      <section className={ui.card}>
        <table>
          <thead>
            <tr>
              <th>工具</th>
              <th>做什麼</th>
              <th>備註</th>
            </tr>
          </thead>
          <tbody>
            {TOOLS.map((t) => (
              <tr key={t.name}>
                <td className={ui.nowrap}>
                  <code>{t.name}</code>
                </td>
                <td>{t.does}</td>
                <td>{t.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>實作方向</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={TECH} />
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
    </ProposalLayout>
  )
}
