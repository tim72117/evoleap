import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { lessonNumber } from '../../content/catalog'
import { ADVANCED_QUESTIONS, MODULES, OPEN_QUESTIONS, type Tier } from './basicsData'
import { useHashScroll } from '../../site/useHashScroll'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

type Chip = 'done' | 'todo' | 'out'

type Question = { title: string; body: string }

type LevelBlock = {
  code: string
  /** 有逐課大綱的等級(basicsData 的 MODULES):現況底下列出各課狀態 */
  tier?: Tier
  title: string
  access: string
  stage: { cls: Chip; text: string }
  /** 一句話的現況 */
  summary: string
  /** 現況的細項，以清單呈現 */
  points?: string[]
  next: string[]
  questions: Question[]
  links: { to: string; label: string }[]
}

const count = (tier: Tier) => {
  const mods = MODULES.filter((m) => m.tier === tier)
  return `${mods.length} 單元 · ${mods.reduce((n, m) => n + m.lessons.length, 0)} 課`
}
const questionsOf = (tier: Tier) => OPEN_QUESTIONS.filter((q) => q.tier === tier)

const L3_QUESTIONS: Question[] = [
  { title: '課程架構', body: '七個單元已移出五個，要不要補單元，見 L3 課程架構。' },
  { title: '準備清單', body: 'Docker 與 onagent 帳號是否保留，見 L3 提案內容頁底。' },
  { title: '封面圖檔', body: '確認封面後，再輸出兩張 PNG。' },
]

const LEVELS: LevelBlock[] = [
  {
    code: 'L0',
    tier: 'L0',
    title: 'AI 工具介紹',
    access: '免費',
    stage: { cls: 'todo', text: '序章與第 0、1、2 課腳本完成 · 互動版上線' },
    summary: `用會操作檔案的 AI 工具在自己的電腦上做出東西，不講 AI 原理。${count('L0')}，每課已有步驟與提示詞。`,
    points: [
      '工具例：Claude Code、Codex CLI、Gemini CLI、Cursor Agent',
      '四課都是互動版即時教學畫面（播放中有「選一選、想一想」），旁白語音都已產生',
    ],
    next: ['決定主示範的 AI 工具與形式（與 L2 主力 AI 程式助手一起決定）', '實測 0.2 全部提示詞（參考成品與腳本已完成）', '找零基礎試看者從序章跟做到第 2 課，記錄卡關點', '決定 L1 是否改用同一個工具、L2 如何處理重疊'],
    questions: questionsOf('L0'),
    links: [{ to: '/studio/tools', label: 'L0 大綱' }],
  },
  {
    code: 'L1',
    tier: 'L1',
    title: 'AI 工具入門',
    access: '登入後免費',
    stage: { cls: 'todo', text: '大綱完成 · 待寫腳本' },
    summary: `零基礎、只用瀏覽器，不講 AI 原理。${count('L1')}。`,
    points: [
      '案例：小森烘焙的線上預約取貨系統（虛構），貫穿全課',
      '開場 1.0：在 L0 網站加上訂購單，帶出表單與送出前的資料規格檢查（開場動畫已試做）',
      '流程：老闆訊息 → 需求清單 → 澄清問題 → 工作項目 → 拆分排序與第一版 → 範本',
      '結業：處理新需求「會員集點」',
      '每課為「目標 → 步驟拆解 → 實際操作展示」，每步附可複製的提示詞',
    ],
    next: ['決定主示範的 AI 聊天工具', '在三個工具實測全部提示詞', '寫 1.1 腳本並找零基礎試看者跟做'],
    questions: questionsOf('L1'),
    links: [{ to: '/studio/ai-tools', label: 'L1 大綱' }],
  },
  {
    code: 'L1',
    tier: 'L1T',
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
    questions: questionsOf('L1T'),
    links: [
      { to: '/studio/life-tools', label: '生活小工具大綱' },
      { to: '/studio/l1-ideas', label: 'L1 構想區' },
    ],
  },
  {
    code: 'L2',
    tier: 'L2',
    title: 'Vibe Coding 入門',
    access: '訂閱專屬',
    stage: { cls: 'todo', text: '大綱草稿' },
    summary: `工具與環境從零開始，以個人頁部署收尾。草稿 ${count('L2')}。`,
    points: ['工具：終端機、VS Code、Git／GitHub、Node.js LTS、AI 程式助手', '附 Windows／macOS 環境檢查表'],
    next: ['決定主力 AI 程式助手與 Windows 是否用 WSL', '在乾淨的 Windows、macOS 上實測安裝流程', '決定 L2→L3 的 JavaScript 落差怎麼補'],
    questions: questionsOf('L2'),
    links: [{ to: '/studio/vibe-coding', label: 'L2 大綱與環境檢查表' }],
  },
  {
    code: 'L3',
    title: 'AI Agent 整合應用',
    access: '未定',
    stage: { cls: 'todo', text: '提案中 · 架構待重新定義' },
    summary: '既有課程，已移到主題「打造 AI 互動軟體」的中階。',
    points: ['提案欄位大多已定稿', '七個單元已移出五個，剩 2 個單元加期末專案'],
    next: ['決定是否補單元（見課程架構）', '填「上課前的準備」', '輸出方形封面'],
    questions: L3_QUESTIONS,
    links: [
      { to: '/studio/ai-agent/fields', label: '提案內容' },
      { to: '/studio/ai-agent/structure', label: '課程架構' },
      { to: '/studio/ai-agent/cover', label: '封面圖' },
    ],
  },
  {
    code: 'L4',
    title: '進階 AI Agent 應用',
    access: '未定',
    stage: { cls: 'out', text: '未開始' },
    summary: '主題「打造 AI 互動軟體」的進階，只有課程地圖上的暫定主題。',
    points: ['範圍取決於 L3 定案與移出單元的去向'],
    next: ['等 L3 架構定案後再列主題清單'],
    questions: ADVANCED_QUESTIONS,
    links: [{ to: '/studio/advanced', label: 'L4 預留頁' }],
  },
]

type Status = 'done' | 'todo'
const L3_PROGRESS: { item: string; status: Status; chip: string; to: string; page: string }[] = [
  { item: '課程標題', status: 'done', chip: '已定稿', to: '/studio/ai-agent/fields', page: '提案內容' },
  { item: '課程描述', status: 'done', chip: '已定稿', to: '/studio/ai-agent/fields', page: '提案內容' },
  { item: '哪些人適合這堂課', status: 'done', chip: '已定稿', to: '/studio/ai-agent/fields', page: '提案內容' },
  { item: '你可以學到', status: 'done', chip: '已定稿', to: '/studio/ai-agent/fields', page: '提案內容' },
  { item: '上課前的準備', status: 'todo', chip: '待定稿', to: '/studio/ai-agent/fields', page: '提案內容' },
  { item: '長形封面 1000×620', status: 'done', chip: '已有', to: '/studio/ai-agent/cover', page: '封面圖' },
  { item: '方形封面 800×800', status: 'todo', chip: '待輸出圖檔', to: '/studio/ai-agent/cover', page: '封面圖' },
  { item: '章節列表', status: 'todo', chip: '架構待重新定義', to: '/studio/ai-agent/structure', page: '課程架構' },
]

const DEPENDENCIES: string[] = [
  'L0 → L1：L1 假設學員已有帳號、會開新對話、找對話紀錄、上傳檔案；L1 第一課直接做任務。',
  'L1 → L2：L1 產出的需求清單與工作項目表是 L2 動手做的起點；L2 單元 4（AI 程式助手）沿用 L1 的提問結構與查證習慣。',
  'L2 → L3：L3 要求 JavaScript／TypeScript 與 Web 前端；L2 目前只教到「讀懂」，落差未解決（見 L2 銜接對照）。',
  'L2 → L3：L2 的主力 AI 程式助手若不是 Claude Code，L3 開頭需要另外引導安裝。',
  'L3 → L4：L3 移出的單元（即時／非同步呼叫、前後端串接、額度、部署）是否改放 L4，影響 L4 範圍。',
]

type StatusRow = { key: string; code: ReactNode; title: string; chip: string; done: boolean }

/** 現況裡的狀態清單:各課狀態與 L3 的提案進度共用 */
function StatusList({ heading, rows }: { heading: string; rows: StatusRow[] }) {
  return (
    <div className={ui['lesson-status']}>
      <p>{heading}</p>
      <ul>
        {rows.map((r) => (
          <li key={r.key}>
            {typeof r.code === 'string' ? <span>{r.code}</span> : r.code}
            <span>{r.title}</span>
            <span className={`${ui.chip} ${r.done ? ui.done : ui.todo}`}>{r.chip}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 各課的製作狀態。L2 的課還沒有逐課內容,沒有 status,算大綱草稿 */
function LessonStatuses({ tier }: { tier: Tier }) {
  const rows = MODULES.filter((m) => m.tier === tier).flatMap((m) =>
    m.lessons.map((l, i) => {
      const code = l.course ? (l.course.label ?? lessonNumber(l.course)) : `${m.num}.${i + 1}`
      const chip = l.status ?? '大綱草稿'
      return { key: code, code, title: l.title, chip, done: chip === '腳本完成' }
    }),
  )
  return <StatusList heading={`各課狀態（腳本完成 ${rows.filter((r) => r.done).length} / ${rows.length} 課）`} rows={rows} />
}

/** L3 提案各欄位的進度:L3 還沒有逐課大綱,放在現況裡取代各課狀態 */
function L3Progress() {
  const rows = L3_PROGRESS.map((row) => ({
    key: row.item,
    code: <Link to={row.to}>{row.page}</Link>,
    title: row.item,
    chip: row.chip,
    done: row.status === 'done',
  }))
  return <StatusList heading={`提案進度（完成 ${rows.filter((r) => r.done).length} / ${rows.length} 項）`} rows={rows} />
}

export function ProposalIndexPage() {
  useHashScroll()
  return (
    <ProposalLayout title="總覽" footer="研發基地 · 等級對齊 src/content/levels.ts（LEVELS）" back={false}>
      <h1>研發基地總覽</h1>
      <p className={ui.lead}>
        依課程地圖分五個等級：L0–L2 屬於主題「做出自己的軟體」，L3、L4 屬於主題「打造 AI 互動軟體」。每個等級的研發階段、下一步與待決定事項；細節在各等級頁。
      </p>

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
                {/* 預設收合,只看得到一句話的現況 */}
                <details className={ui['status-details']}>
                  <summary>{lv.summary}</summary>
                  {lv.points && (
                    <ul className={ui['plain-list']}>
                      {lv.points.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                  {lv.tier && <LessonStatuses tier={lv.tier} />}
                  {lv.code === 'L3' && <L3Progress />}
                </details>
              </dd>
              <dt>下一步</dt>
              <dd>
                <details className={ui['status-details']}>
                  <summary>{lv.next.length} 項</summary>
                  <ul className={ui['plain-list']}>
                    {lv.next.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </details>
              </dd>
              <dt>待決定</dt>
              <dd>
                <details className={ui['status-details']}>
                  <summary>{lv.questions.length} 項</summary>
                  <ul className={ui['plain-list']}>
                    {lv.questions.map((q) => (
                      <li key={q.title}>
                        <strong>{q.title}</strong>：{q.body}
                      </li>
                    ))}
                  </ul>
                </details>
              </dd>
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

      <h2>不分等級的課程</h2>
      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>AI 工具技巧</h3>
              <div className={ui.meta}>適用：L0 第 2 課之後</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.out}`}>構想 · 待評估</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>跟會操作檔案的 AI 工具一起工作的技巧，例如：</p>
          <ul className={ui['plain-list']}>
            <li>換裝置接著做：電腦上的工作，出門用手機看進度、回覆確認</li>
            <li>分岔：從同一段對話分出幾個分支，同時試好幾種想法</li>
            <li>建議先做成短課接在需要它的等級後面，暫不開成首頁主題</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/studio/ai-tips">
              構想頁
            </Link>
          </div>
        </div>
      </section>

      <h2>開發</h2>
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
            <li>L0 序章與第 0、1、2 課已上線為互動版即時教學畫面，都有旁白語音</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/studio/visuals">
              構想頁
            </Link>
          </div>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>演員互動</h3>
              <div className={ui.meta}>適用：互動課程</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.out}`}>構想 · 待評估</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>在互動階段，學員可以真的點演員畫面上的東西：</p>
          <ul className={ui['plain-list']}>
            <li>靜態互動：不播放，只有舞台，已在演員展示試做</li>
            <li>時間線：互動時怎麼暫停、操作怎麼變成演出、拖回去會怎樣</li>
            <li>待決定：腳本與互動的架構，之後一起設計</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/studio/actor-interaction">
              構想頁
            </Link>
            <Link className={`${ui.btn} ${ui.ghost}`} to="/studio/actor-interaction/showcase">
              演員展示
            </Link>
            <Link className={`${ui.btn} ${ui.ghost}`} to="/studio/actor-interaction/push">
              把演員推到主畫面
            </Link>
          </div>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>直式舞台</h3>
              <div className={ui.meta}>適用：互動課程、宣傳影片</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.todo}`}>已完成</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>同一支腳本換成 9:16 播放，給手機直拿看課與短影音：</p>
          <ul className={ui['plain-list']}>
            <li>已做：手機直拿自動直式（所有播放器）、課程腳本的直式位置與調度、兒童課演員上下排</li>
            <li>缺口：大人課的演員照橫式比例畫，直式下留白多、字偏小</li>
            <li>待決定：平板直拿要不要也用直式</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/studio/portrait">
              構想頁
            </Link>
          </div>
        </div>
      </section>

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
            <Link className={ui.btn} to="/studio/mcp">
              構想頁
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
            <Link className={ui.btn} to="/studio/member">
              構想頁
            </Link>
          </div>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>資源與角色系統</h3>
              <div className={ui.meta}>適用：L0–L4（需登入）</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.out}`}>構想 · 待評估</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>用兩種資源和一個角色串起「上課 → 獲得 → 開新課」：</p>
          <ul className={ui['plain-list']}>
            <li>小葉片：部分課程要花小葉片開啟</li>
            <li>進化膠囊：課程上完會獲得</li>
            <li>生命之鹿：所到之處充滿生機、掉落小葉片；購買課程也贈送小葉片</li>
            <li>物種培養：學員培養自己的物種，用膠囊進化</li>
            <li>待決定：有哪些物種、進化幾階、哪些課要花葉片、鹿什麼時候出現</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/studio/resources">
              構想頁
            </Link>
          </div>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>軟體新功能開箱</h3>
              <div className={ui.meta}>適用：主線以外的延伸課程（需登入）</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.out}`}>構想 · 待評估</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>AI 工具、開發工具推出新功能時，做一集介紹或開箱：</p>
          <ul className={ui['plain-list']}>
            <li>花小葉片開啟，讓上課撿到的葉片有地方花</li>
            <li>短篇單集，跟著工具更新隨時加；沿用即時教學畫面，改版時改腳本就好</li>
            <li>待決定：多久出一集、每集多少葉片、過時的開箱怎麼處理</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/studio/resources#unboxing">
              構想頁
            </Link>
          </div>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>科技新知動態牆</h3>
              <div className={ui.meta}>適用：全站</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.out}`}>構想 · 待評估</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>類似社群網站的動態牆，一則一則放科技新知：</p>
          <ul className={ui['plain-list']}>
            <li>每則可以用舞台系統演一段即時畫面，寫一份腳本就是一則，不錄影</li>
            <li>講到的新功能可以接到「軟體新功能開箱」做完整示範</li>
            <li>待決定：誰來寫、更新頻率、要不要登入、要不要開放留言</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/studio/news-feed">
              構想頁
            </Link>
          </div>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>延伸課程</h3>
              <div className={ui.meta}>適用：所有主題</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.out}`}>構想 · 待評估</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>上一門課時，把其他主題裡相關的課一起排進來：</p>
          <ul className={ui['plain-list']}>
            <li>開課前自己勾選要一起上的延伸課，排在對應段落後面</li>
            <li>或在章節結束、練習點之後看到推薦卡片，可以點進去也可以略過</li>
            <li>待決定：誰挑推薦、算不算完成、跨主題怎麼收費</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/studio/extensions">
              構想頁
            </Link>
          </div>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <div>
              <h3>全環節課程清單</h3>
              <div className={ui.meta}>適用：待選主題</div>
            </div>
          </div>
          <div className={ui.chips}>
            <span className={`${ui.chip} ${ui.out}`}>構想 · 待選主題</span>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>做出一個網站服務的每個環節都列成課，交給 AI 程式助手處理：</p>
          <ul className={ui['plain-list']}>
            <li>從準備、規劃、開發、測試、上線（網域、DNS、GCP）、營運到行銷，以 L2 為底再補完整</li>
            <li>每個環節兩堂課：基礎知識與用 AI 完成（一次完成、來回修正、自建工具或 AI 碰不到時的操作步驟）</li>
            <li>最後一段「讓 AI 順利工作」：讓 AI 看得到、自己檢查、自己做工具</li>
            <li>另有依情境整理的 AI 自動化情境清單</li>
            <li>待決定：要組成哪幾個主題、放在哪個等級</li>
          </ul>
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to="/studio/full-course">
              全環節課程清單
            </Link>
            <Link className={`${ui.btn} ${ui.ghost}`} to="/studio/ai-scenarios">
              情境清單
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

      <h2>其他檔案</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            <tr>
              <td>
                <Link to="/materials">工具</Link>
              </td>
              <td>課程編排、宣傳影片錄製、封面設計與裁切</td>
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
