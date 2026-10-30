import { ProposalLayout } from './ProposalLayout'

type Unit = {
  num: string
  title: string
  chip: { cls: 'done' | 'out' | 'todo'; text: string }
  rows: [string, string][]
}

const UNITS: Unit[] = [
  {
    num: '0',
    title: '環境準備與心智模型',
    chip: { cls: 'done', text: '保留' },
    rows: [
      ['學習目標', '看懂整體流程：開發者定義工具、LLM 呼叫工具、前端頁面執行結果。'],
      ['對應概念', 'App 與工具的關係、控制台導覽、命令列工具安裝。'],
      ['實作', '註冊帳號，跑過一個既有 App，看懂它的結構。'],
    ],
  },
  {
    num: '1',
    title: '第一個工具',
    chip: { cls: 'done', text: '保留' },
    rows: [
      ['學習目標', '理解工具的三個核心欄位：名稱、描述、參數（JSON Schema），如何決定 LLM 何時、如何呼叫它。'],
      ['對應概念', '參數 Schema、YAML／JSON 兩種定義格式。'],
      ['實作', '建立一個「填表單」工具，在測試環境裡實際呼叫看看。'],
    ],
  },
  {
    num: '2',
    title: '即時與非同步呼叫模式',
    chip: { cls: 'out', text: '已移出' },
    rows: [
      ['原規劃', '分辨「呼叫後立即結束」與「等前端回應再把結果餵回 LLM」兩種工具，以及後者為何會佔用共享資源。'],
      ['原實作', '把單元 1 的工具改成會讀取頁面即時資料的類型。'],
    ],
  },
  {
    num: '3',
    title: '前端串接',
    chip: { cls: 'out', text: '已移出' },
    rows: [
      ['原規劃', '讓真實網頁透過即時連線執行 LLM 送來的工具呼叫，並設定可連線的來源白名單。'],
      ['原實作', '在小型 Web App 嵌入 SDK，設定白名單並驗證。'],
    ],
  },
  {
    num: '4',
    title: '後端 API 串接',
    chip: { cls: 'out', text: '已移出' },
    rows: [
      ['原規劃', '讓工具呼叫直接送到開發者自己的後端 API，並討論目前沒有簽名驗證的安全邊界。'],
      ['原實作', '串接一個假的訂單查詢 API，並討論何時不該用。'],
    ],
  },
  {
    num: '5',
    title: '額度與方案',
    chip: { cls: 'out', text: '已移出' },
    rows: [
      ['原規劃', '理解方案如何限制每月用量、提問長度、附圖數量，為上線做資源規劃。'],
      ['原實作', '設定圖片上限，模擬額度用盡並觀察錯誤訊息。'],
    ],
  },
  {
    num: '6',
    title: '部署與版本管理',
    chip: { cls: 'out', text: '已移出' },
    rows: [
      ['原規劃', '把整合應用從本機帶到正式環境，建立可重複的發布流程。'],
      ['原實作', '用容器完成一次部署，寫一份更新紀錄並打版本標籤。'],
    ],
  },
]

const CAPSTONE: Unit = {
  num: '★',
  title: 'Capstone',
  chip: { cls: 'todo', text: '需重新定義' },
  rows: [
    [
      '原規劃',
      '從零做出一個完整上線的整合應用，需包含：至少 3 個工具（含即時與非同步各 1）、串接前端並設定白名單、至少 1 個後端 API 工具、額度設定、容器部署、更新紀錄與版本標籤。驗收方式為 5 到 10 分鐘的示範影片，依清單評分。',
    ],
    ['現況', '上述要求大半對應已移出的單元。目前的目標是「自然語言驅動的分析介面」，驗收清單要跟著重寫。'],
  ],
}

const FLOW: { cls: 'keep' | 'out' | 'redo'; text: string }[] = [
  { cls: 'keep', text: '0 環境與心智模型' },
  { cls: 'keep', text: '1 第一個工具' },
  { cls: 'out', text: '2 即時與非同步呼叫' },
  { cls: 'out', text: '3 前端串接' },
  { cls: 'out', text: '4 後端 API 串接' },
  { cls: 'out', text: '5 額度與方案' },
  { cls: 'out', text: '6 部署與版本管理' },
  { cls: 'redo', text: '期末專案' },
]

function UnitCard({ unit }: { unit: Unit }) {
  return (
    <section className="card">
      <div className={unit.chip.cls === 'out' ? 'card-body unit out' : 'card-body unit'}>
        <div className="num">{unit.num}</div>
        <div>
          <div className="row">
            <h3>{unit.title}</h3>
            <span className={`chip ${unit.chip.cls}`}>{unit.chip.text}</span>
          </div>
          <dl>
            {unit.rows.map(([dt, dd]) => (
              <div key={dt} style={{ display: 'contents' }}>
                <dt>{dt}</dt>
                <dd>{dd}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

export function StructurePage() {
  return (
    <ProposalLayout title="L3 課程架構" footer="web/src/studio/proposal/StructurePage.tsx">
      <h1>課程架構</h1>
      <p className="lead">最初規劃的七個單元加期末專案。你之後陸續拿掉的主題，在這裡標成「已移出」，保留原本內容方便對照。</p>

      <div className="flow" aria-label="單元進程">
        {FLOW.map((step, i) => (
          <span key={step.text} style={{ display: 'contents' }}>
            <span className={`step ${step.cls}`}>{step.text}</span>
            {i < FLOW.length - 1 && <i>→</i>}
          </span>
        ))}
      </div>
      <p className="lead" style={{ fontSize: 13 }}>
        綠色＝保留　紅色刪除線＝已移出提案範圍　橘色＝需重新定義
      </p>

      <div className="note">
        <strong>目前只剩 2 個單元加期末專案</strong>
        內容偏少，不足以撐起一門課。建議補上與「自然語言分析介面」直接相關的單元，例如：
        <ul>
          <li>資料與分析工具設計：讓 Agent 能查資料、跑分析</li>
          <li>圖表輸出：依問題選對統計圖表並繪製</li>
          <li>Vibe Coding 實作流程：用 Claude Code 把介面做出來</li>
        </ul>
        要不要照這個方向補，請決定後我再改。
      </div>

      <h2>單元</h2>
      {UNITS.map((u) => (
        <UnitCard key={u.num} unit={u} />
      ))}

      <h2>期末專案</h2>
      <UnitCard unit={CAPSTONE} />
    </ProposalLayout>
  )
}
