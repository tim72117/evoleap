import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 構想：做課程的人在 AI 工具（Claude Code 等）裡透過 MCP 連進網站後端，邊對話邊改一份「臨時腳本」，
// 研發基地的頁面同時收到新版本、舞台立刻照著演，不用存檔、重新整理。2026-11-10 提出，尚未決定是否實作。

const POSITIONING: [string, string][] = [
  ['研發階段', '構想，尚未評估工時，也還沒決定要不要做。'],
  ['一句話', '在 AI 工具裡說「做一段：瀏覽器打開小森烘焙、終端機跑起網站」，AI 透過 MCP 寫進後端的臨時腳本，研發基地的頁面同時照新腳本演出；不滿意就接著說，畫面跟著改。'],
  ['對象', '製作課程的人（研發），不是學員。只有管理員能用。'],
  ['想解決的事', '現在改腳本要改檔案、等頁面重新載入、自己對照演員的動作規格；寫錯的動作要播到才知道。把「說 → 看到」的距離縮到一次對話。'],
]

const FLOW = [
  '以管理員登入 evoleap CLI（evoleap login），把 MCP 加進自己的 AI 工具（例如 claude mcp add evoleap -- evoleap mcp）。',
  '在研發基地打開「即時腳本」頁，頁面訂閱這份臨時腳本，一開始是空的舞台。',
  '對 AI 說要演什麼 → AI 呼叫 set_script 或 add_step 寫進後端；頁面收到新版本，舞台馬上照著演。',
  '看了不滿意就接著說「第 3 步慢一點」「旁白改短」→ AI 呼叫 update_step，畫面跟著改。',
  '寫錯的動作（演員不認得、狀態對不上）在寫入時就回錯誤給 AI，讓它自己修，不用播到才發現。',
  '滿意後說「存成 lab 腳本」→ AI 呼叫 save_as，存成研發基地的腳本檔（或用 evoleap script push 推上去）。',
]

const TOOLS: { name: string; does: string; note: string }[] = [
  { name: 'get_script', does: '讀目前的臨時腳本（cast、steps）', note: 'AI 修改前先看現況' },
  { name: 'set_script', does: '整份取代臨時腳本', note: '從零開始或大改時用' },
  { name: 'add_step', does: '在指定位置插入一步（預設接在最後）', note: '最常用；頁面只要多演一步' },
  { name: 'update_step', does: '改某一步的欄位（例如 ms、narration、動作的參數）', note: '微調節奏與旁白' },
  { name: 'remove_step', does: '刪掉某一步', note: '' },
  { name: 'list_actors', does: '列出可以用的演員、動作與目標名稱（同 web/src/live/README.md 的演員表）', note: '讓 AI 不用猜動作名稱' },
  { name: 'validate', does: '用演員的 init/apply 從頭推算一遍，回傳第幾步出錯、錯在哪', note: '寫入時也自動做一次' },
  { name: 'save_as', does: '把臨時腳本存成研發基地的腳本檔（lab/ 底下的路徑）', note: '存檔前列出路徑讓人確認' },
]

const TECH = [
  '後端（Go）：臨時腳本放在記憶體（每位管理員一份，或以 id 區分多份），重啟就沒了；提供修改的 API，以及給前端訂閱的即時通道（SSE），腳本一改就推出新版本。',
  'MCP：做成 CLI 的子命令 evoleap mcp（stdio 傳輸），用 CLI 已存的登入 token 呼叫後端；或在後端掛 Streamable HTTP 端點。',
  '前端：研發基地新頁（例如 /studio/live-script），用現有的舞台播放器（InteractiveScenePage、LivePlayer）載入臨時腳本；收到新版本時重新載入舞台，停在原本的播放位置附近。',
  '驗證：寫入前用演員的 init/apply 推算一遍（和 content/kidsScripts.test.ts 的做法相同），錯誤訊息原樣回給 AI。',
  '權限：只有管理員；網站登入的 cookie 或 CLI token（evc_，可撤銷、7 天有效）都可以。',
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '臨時腳本放哪裡', body: '本機開發放記憶體就夠；正式站在 Cloud Run 上可能有好幾台執行個體，記憶體不共用，推播的連線也可能連到另一台。要在正式站用，得放資料庫或共用的快取。' },
  { title: '只在本機用，還是正式站也開', body: '只在本機用最單純（不用處理多台與連線時間）；正式站也開，才能在沒有開發環境的電腦上改腳本。' },
  { title: '推播方式', body: 'SSE 比較簡單（單向、走一般 HTTP）；WebSocket 能雙向（例如頁面回報目前播到第幾步給 AI）。Cloud Run 對長連線有時間上限，要能自動重連。' },
  { title: '更新時從哪裡播', body: '收到新版本時從頭播、從改動的那一步播，還是停在原本的位置？小改（旁白、節奏）停在原處比較順。' },
  { title: '存檔流程', body: '直接存成研發基地的腳本檔，還是存成本機檔案再走 git（commit、PR）？正式課程的腳本應該還是要經過 git。' },
  { title: '多人同時改', body: '兩個人同時改同一份臨時腳本時，後寫的蓋掉先寫的，還是各自一份？' },
]

export function LiveScriptMcpPage() {
  return (
    <ProposalLayout title="即時腳本 MCP" footer="跨等級構想 · 尚未決定是否實作">
      <h1>構想 · 用 MCP 邊說邊改腳本，舞台即時演出</h1>
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

      <h2>使用流程</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <ol style={{ margin: 0 }}>
            {FLOW.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </div>
      </section>

      <h2>暫定工具清單</h2>
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
