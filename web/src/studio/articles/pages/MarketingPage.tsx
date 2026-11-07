import { Link } from 'react-router-dom'
import { Article, Callout, DataTable, Section, SourceList } from '../Article'

// 軟體與線上課程行銷的手法、視覺效果、場景與文案。2026-11-07 整理自網路搜尋與網頁閱讀。
// 來源多為廠商與代理商部落格,樣本小、沒有轉換率的對照實驗;「有量測」與「經驗建議」分開寫。
// Udemy 官方宣傳片頁面、SchoolMaker、BigIdeasDB 這次讀不到(403、憑證錯誤、429),內容只採用搜尋摘要中可確認的部分。

type Row = [string, string]

const KEY_POINTS = [
  '首屏與宣傳片都先講學員的問題與學完的改變，不先列功能；標題短、具體，用「你」不用「我們」。',
  '開發工具類影片多用真實產品畫面，不用手繪動畫；中位長度約 1 分 13 秒，第一個操作或程式碼約在第 9 秒出現。',
  '課程銷售頁有固定骨架：標題 → 痛點 → 解法預覽 → 講師 → 課程內容 → 學員成果 → 價格與保證 → 常見問題 → 行動呼籲。',
  '早鳥、限額、倒數只用真的；假的稀缺會傷害前面累積的信任。',
]

const TACTICS: Row[] = [
  ['先收名單或預售', '開課前用一頁報名或預購確認需求，達標再完整製作；Hahow 早期的募資制也是這個邏輯（約一個月、達標才開課）。'],
  ['首批學員價', '第一批用早鳥或「創始學員」價，搭配真實的截止日或名額，並說明為什麼便宜（例如換取回饋）。各來源建議的折扣幅度不一，沒有實證。'],
  ['免費試看', '開放第一課或一段實際上課畫面，讓學員看到「怎麼教」；Udemy 也要求宣傳片說明教什麼、怎麼教。'],
  ['直播示範或說明會', '上線週用一場直播實際操作，搭配一系列 email；適合需要看過才懂的工具類課程。'],
  ['一支主片，多支短版', '主片放在課程頁（60–90 秒），另剪 15–30 秒短版投社群與廣告；Udemy 也建議把宣傳片放到 YouTube、LinkedIn 引流。'],
  ['依流量來源寫頁面', '課程銷售頁很難直接說服第一次接觸的陌生流量，通常要先有內容、試看或名單培養信任。'],
]

const VISUALS: Row[] = [
  ['真實產品畫面', '一份 49 支開發工具影片的分析中，13 支逐格編碼的影片有 8 支錄真實產品、4 支用動畫重畫；Tenet 分析 28 個 SaaS 首頁，有主視覺的 21 個中 57% 放產品介面實際運作。'],
  ['只做跟介面有關的動態', '設計服務商普遍建議節奏緊湊、轉場有目的、不放裝飾性動畫；HyperFrames 那類著色器背景只適合社群短版。'],
  ['程式碼放深色底', '同一份分析裡，畫面出現程式碼的 6 支有 5 支用深色底，即使整支影片是亮色。Claude Code 桌面版影片在第 16 秒用綠紅色 diff 呈現 AI 的改動。'],
  ['旁白或純音樂', '86%（42/49）有旁白；Anthropic、OpenAI 的 4 支都是純音樂，靠畫面上打出的請求說話。純音樂版平均較短（0:46 對 1:16）。'],
  ['文字動畫克制', 'Apple 風格的動態字以乾淨、少量的動畫為主；這類分析多為二手整理，沒有找到可靠的拆解。'],
  ['結尾一個行動', '首屏平均 1.4 個按鈕（通常一主一副）；影片結尾的行動呼籲也宜短。'],
]

const SCENES: Row[] = [
  ['痛點情境', '開場 5–10 秒內呈現學員熟悉的卡關畫面，再說這門課怎麼解決；講給誰聽要早點說，讓不適合的人自己離開。'],
  ['一句請求，AI 開始做事', 'AI 工具類最常見：畫面打出一句需求，AI 回覆並開始操作（Codex 宣傳片在第 9 秒出現請求）。'],
  ['真實操作與推近', '錄製或重現實際介面，推近到正在操作的地方，關鍵結果停留夠久。'],
  ['前後對比', '改之前／改之後的同一畫面，或程式碼的 diff；直接呈現「學完能做到什麼」。'],
  ['講師與學員成果', '講師說明為什麼開這門課；學員見證寫具體成果（幾週內做到什麼），附姓名與照片。'],
  ['結尾行動呼籲', '一句話加一個按鈕：開始第一課、預購、加入名單。'],
]

const COPY_RESEARCH: Row[] = [
  ['標題短', 'Process Street 分析 87 個 SaaS 首頁（2016）：標題平均 6 個字、副標 12 個字，14% 沒有副標。'],
  ['講好處的不到一半', '同一份分析：39% 的標題講軟體帶來的好處，42% 含術語，20% 用社會認同（「上千家公司使用」）。'],
  ['「你」遠多於「我們」', '同一份分析出現 you／your 65 次、we／our 6 次；開發工具影片 34/42 支「你」多於「我們」。'],
  ['5 秒看懂的只有六成', 'Tenet 分析 28 個 SaaS 首頁（2026）：60.7% 標題 5 秒內看懂，32.1% 需要額外說明，7.1% 看不懂；46% 在首屏放社會認同。'],
  ['少用術語', '開發工具影片 64% 每百字少於 3 個開發術語，即使對象是工程師。'],
]

const SALES_PAGE: Row[] = [
  ['1. 標題與副標', '寫給誰、解決什麼問題或得到什麼結果。「拍出清楚的孩子照片，不用自動模式」比「學攝影、拍好照片」好。'],
  ['2. 痛點', '具體寫出學員現在的困擾，越具體越有共鳴（PAS：問題 → 放大 → 解法）。'],
  ['3. 解法預覽', '用「從 A 到 B」描述改變；章節標題改寫成學完的成果，例如「第一章：找到內容主題，不再缺貼文點子」。'],
  ['4. 講師', '相關經歷與學生成果，不炫耀；Hahow 建議另外說明作品與開課的真實原因。'],
  ['5. 課程內容', '由大到小：主題 → 內容概覽 → 單元安排 → 範例作品（Hahow 的建議順序）。'],
  ['6. 學員成果', '2–3 則具體見證；開頭先講讚美，結尾講原因。'],
  ['7. 價格與保證', '以價值說明價格；標示原價或拆解價值時要附理由。保證放在價格旁邊，寫清楚條件。'],
  ['8. 常見問題', '回應沒時間、適不適合我、值不值得、跟不上怎麼辦等疑慮；可用「即使你……也可以」句型提前回應。'],
  ['9. 行動呼籲', '重複一次主要行動與截止條件。'],
]

const FRAMEWORKS: Row[] = [
  ['STAR（Teachery）', '具體的問題與人 → 帶來的改變 → 權威與證明 → 降低風險與急迫性。'],
  ['PAS', '問題 → 放大痛點 → 解法（課程）。'],
  ['大象與騎象人（Thrive 引用 Haidt）', '購買靠情緒，再用理性說服自己：先給理由，再用情緒推一把。'],
  ['從 A 到 B', '用學員能驗證的前後狀態描述成果，例如「從只會基本和弦到背彈 10 首歌」。'],
]

const FOR_US: Row[] = [
  ['宣傳片', '60–90 秒主片，用即時教學畫面當真實操作素材（它本來就是真實介面），第 10 秒內出現第一個請求或操作；由 Lena 簡短招呼開場，另剪 15–30 秒社群版。'],
  ['首屏文案', '一句短標題講學員能做到的事（例如「不會寫程式，也能做出自己的網站」），副標說明對象與方式；一個主要按鈕「免費開始第一課」。'],
  ['課程頁', '照銷售頁骨架補齊：痛點、從 A 到 B、課程內容改寫成成果、講師、學員成果、常見問題。對外用起步／零基礎／基礎，不用 L0–L2。'],
  ['試看與名單', '首頁已有免費第一課與即時教學畫面，這就是試看；付費課程上線前先收名單或預購，確認需求。'],
  ['價格策略', '若做早鳥或創始學員價，截止日與名額必須是真的，並說明原因。'],
]

const toc = [
  { id: 'key', title: '重點摘要' },
  { id: 'tactics', title: '行銷手法' },
  { id: 'visuals', title: '視覺效果' },
  { id: 'scenes', title: '常見場景' },
  { id: 'copy', title: '行銷文案' },
  { id: 'for-us', title: '對本課程的建議' },
  { id: 'caveat', title: '資料缺口' },
]

export function MarketingPage() {
  return (
    <Article slug="research/marketing" toc={toc}>
      <p>
        整理軟體產品與線上課程行銷常用的手法、視覺效果、場景與文案，作為課程首頁、課程頁與宣傳片的參考。宣傳片的製作方式另見
        <Link to="/docs/research/video-shotcraft">video-shotcraft</Link>與<Link to="/docs/research/hyperframes">HyperFrames 效果清單</Link>，
        實際素材在<Link to="/materials/promo">宣傳影片</Link>頁。
      </p>
      <Callout title="資料可信度" tone="warn">
        <p>
          來源多為製作公司、課程平台與代理商的部落格，有自己的商業立場；有量測的研究樣本很小（28 到 87 個網站、49 支影片），而且都沒有量到轉換率。
          網路上常見的「影片提升轉換 80%」之類數字多半是互相轉引的舊資料，這裡不採用。下面把「有量測」和「經驗建議」分開寫。
        </p>
      </Callout>

      <Section id="key" title="重點摘要">
        <Callout tone="key" title="四個共通點">
          <ul>
            {KEY_POINTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Callout>
      </Section>

      <Section id="tactics" title="行銷手法">
        <p>以下是各來源一致提到的做法，屬於經驗建議，沒有對照實驗。</p>
        <DataTable head={['手法', '做法與說明']} rows={TACTICS} />
      </Section>

      <Section id="visuals" title="視覺效果">
        <DataTable head={['效果', '依據']} rows={VISUALS} />
      </Section>

      <Section id="scenes" title="常見場景">
        <p>宣傳片與課程頁影片常用的場景，大致依出現順序排列。</p>
        <DataTable head={['場景', '怎麼用']} rows={SCENES} />
      </Section>

      <Section id="copy" title="行銷文案">
        <h3>有量測的發現</h3>
        <DataTable head={['發現', '數據']} rows={COPY_RESEARCH} />
        <h3>課程銷售頁的段落順序</h3>
        <p>以 Teachery 的 9 段為骨架，補上 Thrive Themes 拆解與 Hahow 提案指南的建議。各家順序大同小異，價格常放在最後。</p>
        <DataTable head={['段落', '寫法']} rows={SALES_PAGE} />
        <h3>常見文案框架</h3>
        <DataTable head={['框架', '步驟']} rows={FRAMEWORKS} />
        <h3>要避免的寫法</h3>
        <ul>
          <li>假的倒數計時與限量：Teachery 明確反對，幾份上市檢查清單也提醒會燒掉信任；不實的價格或限量標示也可能違反公平交易法對不實廣告的規範。</li>
          <li>先列功能（「本課程有 47 支影片」）、模糊承諾（「改變你的事業」）、術語、把最強的好處藏在後面。</li>
          <li>沒有理由的價值數字，例如「這門課值兩萬，現在只要 97 元」。</li>
          <li>「歡迎來到我的課程」這類不講好處的標題。</li>
        </ul>
      </Section>

      <Section id="for-us" title="對本課程的建議">
        <p>以下是依上述資料推論的做法，尚未測試效果。</p>
        <DataTable head={['項目', '建議']} rows={FOR_US} />
      </Section>

      <Section id="caveat" title="資料缺口">
        <ul>
          <li>沒有找到首屏寫法、影片長度或早鳥設計與轉換率之間的對照研究；要知道哪種有效，只能自己做 A/B 測試。</li>
          <li>Udemy 官方宣傳片指南、SchoolMaker 的銷售頁指南這次讀不到全文，只用了搜尋摘要中的內容。</li>
          <li>沒有找到 Cursor、Claude Code 等 AI 工具宣傳片的逐格拆解；開發工具影片的數據來自一家影片製作公司的分析，部分方法沒有公開。</li>
          <li>中文市場（Hahow、PressPlay 等）的文案與早鳥設計，只找到平台的提案指南與舊報導，缺少具體案例拆解。</li>
        </ul>
      </Section>

      <SourceList
        sources={[
          { label: '49 Developer-First Demo Videos Analyzed（Advids，2026）', href: 'https://advids.co/blog/developer-tool-demo-videos-code-on-screen' },
          { label: 'SaaS Website Hero Section Best Practices（Tenet，2026）', href: 'https://www.wearetenet.com/blog/saas-hero-section-best-practices' },
          { label: 'I Analyzed the Copy on 87 SaaS Startup Landing Pages（Process Street，2016）', href: 'https://www.process.st/startup-landing-pages/' },
          { label: 'Sales Page Copywriting for Courses（Teachery）', href: 'https://www.teachery.co/blog/sales-page-copywriting-course' },
          { label: 'Online Course Sales Page Teardown（Thrive Themes）', href: 'https://thrivethemes.com/online-course-sales-page-teardown/' },
          { label: 'Hahow 創作者：課程介紹文案範例', href: 'https://creator.hahow.in/create-course-proposal/step2/course-description/description-example.md' },
          { label: 'Hahow 募資機制（數位時代，2015）', href: 'https://www.bnext.com.tw/article/37392/BN-2015-09-15-123850-117' },
          { label: 'Udemy：Create the perfect preview for your course', href: 'https://teach.udemy.com/publishing/promo-video/' },
          { label: 'SaaS Video Animation Best Practices（Hatch Studios）', href: 'https://hatchstudios.com/best-practices-for-creating-engaging-saas-product-videos/' },
          { label: 'Product Launch Video: 11 Examples（Vidpros）', href: 'https://vidpros.com/product-launch-video/' },
          { label: 'Online course launch checklist（Themeisle）', href: 'https://themeisle.com/blog/?p=118080' },
          { label: 'How to Pre-Sell an Online Course in 2026（LearnyBox）', href: 'https://learnybox.com/en/blog/how-to-pre-sell-an-online-course/' },
        ]}
      />
    </Article>
  )
}
