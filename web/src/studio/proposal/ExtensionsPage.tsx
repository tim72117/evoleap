import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 跨等級構想：延伸課程。2026-11-07 提出，尚未評估。
// 主課程的段落可以接上其他主題的課（延伸課程），學員自己選要一起上哪些，或在段落中看到推薦。

const POSITIONING: [string, string][] = [
  ['研發階段', '構想，尚未評估工時。'],
  ['一句話', '上一門課時，可以把其他主題裡相關的課一起排進來：開課前自己勾選要一起上的延伸課，或在某個段落看到「想多了解可以看這一課」的推薦。'],
  ['對象', '想把一個概念弄懂再往下走的學員；也讓各主題的課互相導流，不必在每門課重講一次。'],
  ['和其他構想的關係', '學員選了哪些延伸課、上到哪裡，要記在「會員空間」的學習紀錄；上完延伸課能不能讓鹿掉落小葉片，可以接「資源系統」。'],
]

const FORMS: [string, string][] = [
  ['開課前選擇', '課程總覽列出這門課可以搭配的延伸課（標出來自哪個主題、多長），學員勾選要一起上的。勾選的課會排進課程內容清單，放在對應段落的後面，上完主課那一段就接著上。'],
  ['段落中推薦', '在章節結束或「換你試試」的練習點之後，出現一張推薦卡片：「想知道背後怎麼運作？看〈某課〉，約 N 分」。可以點進去上，也可以略過繼續主課，不會自動跳走。'],
  ['上完回來', '從推薦或清單進入延伸課，上完後有「回到〈主課〉第 N 段」的按鈕，回到原本的位置接著播。'],
]

const EXAMPLES: [string, string, string][] = [
  ['起步 · 第 2 課：做出一頁式網站', '網頁怎麼運作 · 序章 0.2「HTML、CSS、JavaScript 的分工」', 'AI 一次做出 index.html、styles.css、script.js，看完分工比較知道要請它改哪一個檔案。'],
  ['零基礎 · 1.0 訂購單：送出前檢查', '網頁怎麼運作 · 序章 0.1「輸入網址之後發生的事」', '說明為什麼「每天最多 8 個蛋糕」前端擋不住：資料要送到伺服器才知道別人訂了多少。'],
  ['起步 · 第 2 課：改太多時，比對並還原', 'AI 工具技巧 · Claude Code「Fork：帶著對話另開一條路」', '想試另一種改法又怕改壞時，可以另開一條路，不影響原本的對話。'],
]

const DATA_NOTES = [
  '延伸課本身仍屬於原本的主題，主課只記「在哪一段之後接哪一課、為什麼推薦」，不複製內容；原本的課改版時，延伸的地方自動跟著更新。',
  '單課資料可以加一個欄位，例如 extensions: [{ topic, lesson, after: 段落或步驟, why: 一句推薦理由 }]；開課前的選單與段落中的推薦卡片都從這份資料產生。',
  '延伸課的存取規則照它原本的課：序章免登入、第 0 課登入後免費、其他要訂閱。看不到的課要標出來，不要點了才發現要登入或訂閱。',
  '學員勾選的延伸課要記在會員資料裡，才能跨裝置接著上；沒登入的訪客只看得到段落中的推薦，不能勾選排課。',
]

const DESIGN_NOTES = [
  '主線優先：推薦卡片不打斷播放、不自動跳轉，略過一次就不再跳出同一張。',
  '每個段落最多推薦一到兩課，太多會變成另一份課程清單。',
  '推薦卡片要寫出推薦理由與長度（約幾分鐘），讓學員判斷現在要不要看。',
  '延伸課在課程內容清單裡和主課分得出來（例如縮排、標出來源主題），完成度分開算，不讓主課看起來變長、變難完成。',
  '兒童課的延伸要另外評估：9 歲孩子容易被岔開，可能只在課程結束時推薦。',
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '誰決定推薦', body: '由研發基地逐課手動挑，還是依課程的知識點（knowledge）自動找出相關的課？' },
  { title: '算不算完成', body: '延伸課要不要計入主課的完成度與結業條件？' },
  { title: '跨主題收費', body: '主課已訂閱、延伸課在另一個主題時，要不要分開收費？' },
  { title: '還沒開放的課', body: '延伸到「規劃中」的課時，要不要先顯示（標 🌱 規劃中），還是開放後才出現？' },
  { title: '放在哪裡', body: '開課前的選單放在課程總覽頁，還是第一次開始上課時跳出來問？' },
]

function Table({ rows, head }: { rows: string[][]; head?: string[] }) {
  return (
    <section className={ui.card}>
      <table>
        {head && (
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) =>
                i === 0 && !head ? (
                  <td key={i} className={ui.nowrap} style={{ width: '9em' }}>
                    <strong>{c}</strong>
                  </td>
                ) : (
                  <td key={i}>{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function ExtensionsPage() {
  return (
    <ProposalLayout title="延伸課程" footer="跨等級構想 · 尚未評估">
      <h1>構想 · 延伸課程</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>構想 · 待評估</span>

      <h2>定位</h2>
      <Table rows={POSITIONING} />

      <h2>兩種接法</h2>
      <Table rows={FORMS} />

      <h2>例子</h2>
      <Table head={['主課的段落', '延伸課（來源主題）', '為什麼推薦']} rows={EXAMPLES} />

      <h2>資料怎麼寫</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={DATA_NOTES} />
        </div>
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
