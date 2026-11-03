import { Link } from 'react-router-dom'
import { ResearchRefs } from './BasicsOutline'
import { MODULES, OPEN_QUESTIONS, type Tier } from './basicsData'
import { useHashScroll } from '../../site/useHashScroll'
import { DocList } from '../docs/DocPage'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

type Chip = 'done' | 'todo' | 'out'

type LevelBlock = {
  code: string
  title: string
  access: string
  stage: { cls: Chip; text: string }
  /** 一句話的現況 */
  summary: string
  /** 現況的細項，以清單呈現 */
  points?: string[]
  next: string[]
  pending: string
  links: { to: string; label: string }[]
}

const count = (tier: Tier) => {
  const mods = MODULES.filter((m) => m.tier === tier)
  return `${mods.length} 單元 · ${mods.reduce((n, m) => n + m.lessons.length, 0)} 課`
}
const pendingCount = (tier: Tier) => OPEN_QUESTIONS.filter((q) => q.tier === tier).length

const LEVELS: LevelBlock[] = [
  {
    code: 'L0',
    title: 'AI 工具介紹',
    access: '免費',
    stage: { cls: 'todo', text: '大綱完成 · 第 0、1、2 課腳本完成' },
    summary: `用會操作檔案的 AI 工具在自己的電腦上做出東西，不講 AI 原理。${count('L0')}，每課已有步驟與提示詞。`,
    points: [
      '工具例：Claude Code、Codex CLI、Gemini CLI、Cursor Agent',
      '第 0 課：工具與安全（練習資料夾、確認提示），已有即時教學畫面',
      '第 1 課：專案與工作目錄、檔案操作，已有即時教學畫面',
      '第 2 課：說清楚需求，做出小森烘焙一頁式網站並精確調整，已有即時教學畫面',
    ],
    next: ['決定主示範的 AI 工具與形式（與 L2 主力 AI 程式助手一起決定）', '實測 0.2 全部提示詞（參考成品與腳本已完成）', '決定 L1 是否改用同一個工具、L2 如何處理重疊'],
    pending: `${pendingCount('L0')} 項待決定`,
    links: [{ to: '/proposal/tools', label: 'L0 大綱' }],
  },
  {
    code: 'L1',
    title: 'AI 工具入門',
    access: '免費',
    stage: { cls: 'todo', text: '大綱完成 · 待寫腳本' },
    summary: `零基礎、只用瀏覽器，不講 AI 原理。${count('L1')}。`,
    points: [
      '案例：小森烘焙的線上預約取貨系統（虛構），貫穿全課',
      '開場 1.0：在 L0 網站加上訂購單，帶出表單與送出前的資料規格檢查',
      '流程：老闆訊息 → 需求清單 → 澄清問題 → 工作項目 → 拆分排序與第一版 → 範本',
      '結業：處理新需求「會員集點」',
      '每課為「目標 → 步驟拆解 → 實際操作展示」，每步附可複製的提示詞',
    ],
    next: ['決定主示範的 AI 聊天工具', '在三個工具實測全部提示詞', '寫 1.1 腳本並找零基礎試看者跟做'],
    pending: `${pendingCount('L1')} 項待決定`,
    links: [{ to: '/proposal/ai-tools', label: 'L1 大綱' }],
  },
  {
    code: 'L1',
    title: '生活小工具',
    access: '暫定免費',
    stage: { cls: 'todo', text: '大綱完成 · 待實測' },
    summary: `與「AI 工具入門」並列的第二門 L1 課，接續 L0：每課做一個日常用得到的純前端小工具。${count('L1T')}。`,
    points: [
      '分帳計算機、購物清單、證件浮水印、照片批次縮小、名牌列印、抽籤分組，最後做自己的工具',
      '只用 HTML、CSS、原生 JavaScript，雙擊在瀏覽器打開，資料不離開自己的電腦',
      '其他工具構想（QR Code、PDF 合併、記帳本等）放在 L1 構想區',
    ],
    next: ['逐課檢查提示詞', '用選定工具實測，並確認各瀏覽器雙擊開啟的行為', '決定案例主軸與是否開放外部函式庫'],
    pending: `${pendingCount('L1T')} 項待決定`,
    links: [
      { to: '/proposal/life-tools', label: '生活小工具大綱' },
      { to: '/proposal/l1-ideas', label: 'L1 構想區' },
    ],
  },
  {
    code: 'L2',
    title: 'Vibe Coding 入門',
    access: '登入後免費',
    stage: { cls: 'todo', text: '大綱草稿' },
    summary: `工具與環境從零開始，以個人頁部署收尾。草稿 ${count('L2')}。`,
    points: ['工具：終端機、VS Code、Git／GitHub、Node.js LTS、AI 程式助手', '附 Windows／macOS 環境檢查表'],
    next: ['決定主力 AI 程式助手與 Windows 是否用 WSL', '在乾淨的 Windows、macOS 上實測安裝流程', '決定 L2→L3 的 JavaScript 落差怎麼補'],
    pending: `${pendingCount('L2')} 項待決定`,
    links: [{ to: '/proposal/vibe-coding', label: 'L2 大綱與環境檢查表' }],
  },
  {
    code: 'L3',
    title: 'AI Agent 整合應用',
    access: '未定',
    stage: { cls: 'todo', text: '提案中 · 架構待重新定義' },
    summary: '既有課程。',
    points: ['提案欄位大多已定稿', '七個單元已移出五個，剩 2 個單元加期末專案'],
    next: ['決定是否補單元（見課程架構）', '填「上課前的準備」', '輸出方形封面'],
    pending: '3 項待決定',
    links: [
      { to: '/proposal/ai-agent/fields', label: '提案內容' },
      { to: '/proposal/ai-agent/structure', label: '課程架構' },
      { to: '/proposal/ai-agent/cover', label: '封面圖' },
    ],
  },
  {
    code: 'L4',
    title: '進階 AI Agent 應用',
    access: '未定',
    stage: { cls: 'out', text: '未開始' },
    summary: '只有課程地圖上的暫定主題。',
    points: ['範圍取決於 L3 定案與移出單元的去向'],
    next: ['等 L3 架構定案後再列主題清單'],
    pending: '4 項待決定',
    links: [{ to: '/proposal/advanced', label: 'L4 預留頁' }],
  },
]

type Status = 'done' | 'todo'
const L3_PROGRESS: { item: string; status: Status; chip: string; to: string; page: string }[] = [
  { item: '課程標題', status: 'done', chip: '已定稿', to: '/proposal/ai-agent/fields', page: '提案內容' },
  { item: '課程描述', status: 'done', chip: '已定稿', to: '/proposal/ai-agent/fields', page: '提案內容' },
  { item: '哪些人適合這堂課', status: 'done', chip: '已定稿', to: '/proposal/ai-agent/fields', page: '提案內容' },
  { item: '你可以學到', status: 'done', chip: '已定稿', to: '/proposal/ai-agent/fields', page: '提案內容' },
  { item: '上課前的準備', status: 'todo', chip: '待定稿', to: '/proposal/ai-agent/fields', page: '提案內容' },
  { item: '長形封面 1000×620', status: 'done', chip: '已有', to: '/proposal/ai-agent/cover', page: '封面圖' },
  { item: '方形封面 800×800', status: 'todo', chip: '待輸出圖檔', to: '/proposal/ai-agent/cover', page: '封面圖' },
  { item: '章節列表', status: 'todo', chip: '架構待重新定義', to: '/proposal/ai-agent/structure', page: '課程架構' },
]

const DEPENDENCIES: string[] = [
  'L0 → L1：L1 假設學員已有帳號、會開新對話、找對話紀錄、上傳檔案；L1 第一課直接做任務。',
  'L1 → L2：L1 產出的需求清單與工作項目表是 L2 動手做的起點；L2 單元 6（AI 程式助手）沿用 L1 的提問結構與查證習慣。',
  'L2 → L3：L3 要求 JavaScript／TypeScript 與 Web 前端；L2 目前只教到「讀懂」，落差未解決（見 L2 銜接對照）。',
  'L2 → L3：L2 的主力 AI 程式助手若不是 Claude Code，L3 開頭需要另外引導安裝。',
  'L3 → L4：L3 移出的單元（即時／非同步呼叫、前後端串接、額度、部署）是否改放 L4，影響 L4 範圍。',
]

export function ProposalIndexPage() {
  useHashScroll()
  return (
    <ProposalLayout title="總覽" footer="課程研發工作區 · 等級對齊 src/content/levels.ts（LEVELS）" back={false}>
      <h1>課程研發總覽</h1>
      <p className={ui.lead}>依課程地圖分五個等級（L0–L4）。每個等級的研發階段、下一步與待決定事項；細節在各等級頁。</p>

      <h2>各等級狀態</h2>
      {LEVELS.map((lv) => (
        <section className={ui.card} key={`${lv.code}-${lv.title}`}>
          <div className={ui['card-head']}>
            <div className={ui['head-left']}>
              <span className={ui['head-num']}>{lv.code}</span>
              <div>
                <h3>{lv.title}</h3>
                <div className={ui.meta}>存取：{lv.access}</div>
              </div>
            </div>
            <div className={ui.chips}>
              <span className={`${ui.chip} ${ui[lv.stage.cls]}`}>{lv.stage.text}</span>
            </div>
          </div>
          <div className={ui['card-body']}>
            <dl className={ui.kv}>
              <dt>現況</dt>
              <dd>
                <p className={ui['kv-lead']}>{lv.summary}</p>
                {lv.points && (
                  <ul className={ui['plain-list']}>
                    {lv.points.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </dd>
              <dt>下一步</dt>
              <dd>
                <ul className={ui['plain-list']}>
                  {lv.next.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </dd>
              <dt>待決定</dt>
              <dd>{lv.pending}</dd>
            </dl>
          </div>
          <div className={ui['card-foot']}>
            <div className={ui.links}>
              {lv.links.map((l, i) => (
                <Link key={l.to} className={i === 0 ? ui.btn : `${ui.btn} ${ui.ghost}`} to={l.to}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <h2>L3 進度明細</h2>
      <section className={ui.card}>
        <table>
          <thead>
            <tr>
              <th>項目</th>
              <th>狀態</th>
              <th>前往</th>
            </tr>
          </thead>
          <tbody>
            {L3_PROGRESS.map((row) => (
              <tr key={row.item}>
                <td>{row.item}</td>
                <td>
                  <span className={`${ui.chip} ${ui[row.status]}`}>{row.chip}</span>
                </td>
                <td>
                  <Link to={row.to}>{row.page}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>待決定（跨等級摘要）</h2>
      <div className={ui.note}>
        <ul style={{ margin: 0 }}>
          <li>
            <strong style={{ display: 'inline' }}>L2 主力 AI 程式助手</strong>：Claude Code 或 GitHub Copilot，影響 L2 單元 6 與 L3 開頭，見{' '}
            <Link to="/proposal/vibe-coding">L2</Link>。
          </li>
          <li>
            <strong style={{ display: 'inline' }}>L2→L3 的 JavaScript 落差</strong>：另開課或在 L2 加單元，見{' '}
            <Link to="/proposal/vibe-coding">L2</Link>。
          </li>
          <li>
            <strong style={{ display: 'inline' }}>L3 課程架構</strong>：七個單元已移出五個，要不要補單元，見{' '}
            <Link to="/proposal/ai-agent/structure">L3 課程架構</Link>。
          </li>
          <li>
            <strong style={{ display: 'inline' }}>L3 準備清單</strong>：Docker 與 onagent 帳號是否保留，見{' '}
            <Link to="/proposal/ai-agent/fields">L3 提案內容</Link>頁底。
          </li>
          <li>
            <strong style={{ display: 'inline' }}>L3 封面圖檔</strong>：確認封面後，再輸出兩張 PNG。
          </li>
        </ul>
      </div>

      <h2>跨等級構想</h2>
      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>用 MCP 連入課程</h3>
              <div className={ui.meta}>適用：L0–L4</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.out}`}>構想 · 待評估</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>學員在自己的 AI 工具裡連上課程的 MCP server，就能：</p>
          <ul className={ui['plain-list']}>
            <li>直接取得練習範本與參考產出</li>
            <li>依完成檢核自我檢查</li>
            <li>提交作業並取回回饋</li>
          </ul>
          <p className={ui['kv-lead']} style={{ marginTop: 8 }}>可一併解決 L1「結業作品是否收件」「是否提供各課參考產出」。</p>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/proposal/mcp">
              構想頁
            </Link>
          </div>
        </div>
      </section>
      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>即時教學影像</h3>
              <div className={ui.meta}>適用：L0–L4</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.todo}`}>試做中</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>不錄製影片，改用腳本即時產生教學畫面，在課程網站播放。</p>
          <ul className={ui['plain-list']}>
            <li>學員可暫停、拖曳、複製畫面上的提示詞</li>
            <li>含轉場、素材、節奏與輕鬆橋段的研究整理</li>
            <li>
              參考案例：<Link to="/docs/research/video-shotcraft">video-shotcraft</Link>（宣傳片製作方法，借用與不照搬的部分）
            </li>
            <li>L0 第 0、1、2 課已上線為即時教學畫面</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/proposal/visuals">
              構想頁
            </Link>
            <Link className={`${ui.btn} ${ui.ghost}`} to="/proposal/visuals/preview">
              預覽畫面
            </Link>
          </div>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>會員空間</h3>
              <div className={ui.meta}>適用：L0–L4</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.todo}`}>部分已做</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>登入前後要有差別，會員才有理由註冊：</p>
          <ul className={ui['plain-list']}>
            <li>已做：登入後記住每一課看到哪裡；未登入不儲存播放進度</li>
            <li>構想：「我的學習」頁、步驟打勾、提示詞收藏、我的作品、內容分級</li>
            <li>每新增一種會員資料，都要先更新隱私權政策</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/proposal/member">
              構想頁
            </Link>
          </div>
        </div>
      </section>

      <h2>等級間依賴</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <ul className={ui['plain-list']}>
            {DEPENDENCIES.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </section>

      <h2>參考研究</h2>
      <ResearchRefs />

      <h2 id="docs">文件</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <DocList />
        </div>
      </section>

      <h2>其他檔案</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            <tr>
              <td>
                <Link to="/materials">工具</Link>
              </td>
              <td>即時教學畫面預覽、宣傳影片錄製、封面設計與裁切</td>
            </tr>
            <tr>
              <td>
                README<span className={ui['repo-path']}>README.md</span>
              </td>
              <td>目錄說明</td>
            </tr>
          </tbody>
        </table>
      </section>
    </ProposalLayout>
  )
}
