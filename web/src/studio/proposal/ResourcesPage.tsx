import { useHashScroll } from '../../site/useHashScroll'
import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 跨等級構想：資源與角色系統（小葉片、進化膠囊、生命之鹿、物種培養）。2026-11-04 提出，尚未評估。
// 依附會員空間（MemberPage）：資源要記在會員帳號上，訪客沒有資源。
// 新增任何會員資料前必須先更新隱私權政策（web/src/legal/PrivacyPage.tsx）。

const POSITIONING: [string, string][] = [
  ['研發階段', '構想，尚未評估工時與數值。'],
  ['一句話', '用兩種資源串起「上課 → 獲得 → 開新課」：有些課程要花小葉片開啟，上完課會獲得進化膠囊；鹿是陪著學員的角色，牠走過的地方會長出小葉片；學員可以培養自己的物種，用膠囊讓牠進化。'],
  ['適用等級', 'L0–L4；需要登入，資源記在會員帳號上。'],
  ['和品牌的關係', 'evoleap = evolve＋leap：鹿對應鹿角標誌，葉片呼應「葉綠」主色與成長，膠囊呼應「進化」。'],
]

const RESOURCES: [string, string, string][] = [
  ['小葉片', '花費：開啟部分課程。', '來源：鹿走過的地方會掉落；購買課程時贈送。其他來源待定（例如註冊、膠囊兌換）。'],
  ['進化膠囊', '獲得：每上完一課（或一個單元）得到。', '用途：讓自己培養的物種進化。其他用途待定（例如兌換小葉片）。'],
]

const CHARACTER: [string, string][] = [
  ['角色', '鹿：類似生命之神，所到之處充滿生機。'],
  ['在網站上的樣子', '鹿出現在學員的頁面裡（例如課程地圖、我的學習），牠走過的地方草木長出來、掉落小葉片，學員點一下撿起。'],
  ['和學習的關係', '鹿的出現與學員的學習綁在一起，例如上課時、完成一課後鹿來到課程地圖上的那一格，讓那一格長出生機。'],
  ['和標誌的關係', '沿用鹿角標誌的造型與葉綠配色，標誌就是這隻鹿的角。'],
]

const SPECIES: [string, string][] = [
  ['玩法', '學員培養自己的物種，用進化膠囊讓牠進化成下一個型態。'],
  ['和學習的關係', '膠囊只能靠上課取得，所以物種進化的程度就是學習進度的展現：上越多課，物種進化越多。'],
  ['進化的樣子', '每個型態有不同外觀；可以對應課程等級（L0–L4），例如一個等級一個型態。'],
  ['和鹿的關係', '鹿是生命之神，物種是牠帶來生機後長出來的生命；鹿陪著學員，物種是學員自己的。'],
  ['展示', '在「我的學習」頁看到自己的物種；未來可以搭配完成證明分享出去。'],
]

const UNBOXING: [string, string][] = [
  ['內容', '軟體的新功能介紹或開箱：AI 工具、開發工具推出新版本或新功能時，示範怎麼用、適合做什麼。'],
  ['開啟方式', '花小葉片開啟；是小葉片的主要用途之一，讓學員上課撿到的葉片有地方花。'],
  ['形式', '短篇、單集，跟著工具更新隨時加；可沿用即時教學畫面（腳本產生，不錄影），工具改版時改腳本就好。'],
  ['和主線課程的關係', '不放在 L0–L4 的主線裡，主線維持靠上課就能完成；開箱是額外的延伸內容。'],
]

const FLOW = [
  '學員登入後有少量起始小葉片。',
  '主線課直接看；標示「需要小葉片」的課（例如新功能開箱），花費後永久開啟。',
  '上完一課得到進化膠囊；鹿來到這一課，周圍長出生機並掉落小葉片。',
  '購買課程時也會贈送小葉片。',
  '用膠囊讓自己培養的物種進化。',
  '形成循環：上課 → 拿膠囊、撿葉片 → 物種進化、開新課。',
]

const DESIGN_NOTES = [
  '「上完」要有明確的判定：看完（播放進度到結尾）、做完（步驟打勾），或兩者都要。影響會員空間的步驟打勾是否要先做。',
  '要避免讓學員為了拿膠囊而快轉；可以只在第一次完成時發放，或要求步驟打勾。',
  '開啟課程的價格要和「免費／登入後免費／付費」的課程分級一起決定，避免和真正的付費機制衝突。',
  '資源的增減要留紀錄（什麼時候、因為什麼增減多少），方便查帳與處理學員詢問。',
  '圖示與名稱：小葉片可沿用鹿角標誌的葉綠，膠囊用根部的暖棕點綴色。',
  '鹿掉落葉片要有上限與條件（例如每天、每完成一課），避免掛著頁面就能一直撿。',
  '物種進化需要的膠囊數要和課程數量一起算，讓學員大約上完一個等級就進化一次，不會太快用完或永遠到不了。',
  '物種的造型要和鹿角標誌同一套風格（線條、葉綠與暖棕），需要另外設計各型態的圖。',
  '鹿的動畫不能干擾上課：播放教學畫面時不出現或只在角落；要尊重「減少動態效果」的系統設定。',
]

const PRECONDITIONS = [
  '依附會員機制：訪客沒有資源；需要新增資源餘額與增減紀錄的資料表。',
  '要先更新隱私權政策（新增學習與資源紀錄）。',
  '若小葉片未來可以用錢買，就涉及虛擬貨幣與退款規定，服務條款要另外補充；建議第一版只能靠上課取得。',
  '新增的 API 要補單元測試，並確認訪客一律被拒絕、資源不能被前端直接改寫（增減只在後端判定）。',
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '小葉片的其他來源', body: '已定：鹿掉落、購買課程贈送。另外要不要註冊贈送、每日登入、膠囊兌換？' },
  { title: '鹿什麼時候出現', body: '每次登入、上課時、完成一課後，還是學員主動去找牠？' },
  { title: '鹿會不會成長', body: '隨著學員進度改變外觀（例如角越長越多分枝），還是固定造型？' },
  { title: '購買課程送多少', body: '依課程價格比例，還是固定數量？' },
  { title: '有哪些物種', body: '學員一開始自己選、隨機獲得，還是大家同一種？物種是植物、動物，還是兩者都有？' },
  { title: '進化幾階', body: '對應 L0–L4 的五階，還是另外訂？進化是否有分支（不同選擇長成不同型態）？' },
  { title: '可以養幾隻', body: '只有一隻，還是可以收集多種？' },
  { title: '膠囊的其他用途', body: '除了進化，要不要也能換小葉片？' },
  { title: '開箱的頻率與價格', body: '多久出一集、每集要多少小葉片？過時的開箱要下架、降價，還是改成免費？' },
  { title: '哪些課要花小葉片', body: 'L0 維持全免費？L1 以上的哪些課要開啟、各要多少？' },
  { title: '發放單位', body: '每一課、每個單元，還是每個等級完成時才發？' },
  { title: '和付費的關係', body: '小葉片是否取代或並存於未來的付費課程。' },
]

export function ResourcesPage() {
  useHashScroll()
  return (
    <ProposalLayout title="資源系統" footer="跨等級構想 · 尚未評估">
      <h1>構想 · 資源與角色系統（小葉片、進化膠囊、生命之鹿、物種培養）</h1>
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

      <h2>兩種資源</h2>
      <section className={ui.card}>
        <table>
          <thead>
            <tr>
              <th>資源</th>
              <th>用途</th>
              <th>來源／延伸</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map(([name, use, more]) => (
              <tr key={name}>
                <td className={ui.nowrap}>
                  <strong>{name}</strong>
                </td>
                <td>{use}</td>
                <td>{more}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>角色：生命之鹿</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {CHARACTER.map(([k, v]) => (
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

      <h2>物種培養</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {SPECIES.map(([k, v]) => (
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

      <h2 id="unboxing" style={{ scrollMarginTop: 120 }}>花小葉片的課程：新功能開箱</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {UNBOXING.map(([k, v]) => (
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

      <h2>學員的流程（草案）</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <ol className={ui['plain-list']}>
            {FLOW.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      </section>

      <h2>設計要點</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={DESIGN_NOTES} />
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
