import { Link } from 'react-router-dom'
import { Article, Callout, DataTable, Ext, Section, SourceList } from '../Article'
import { HF_CATALOG } from './hyperframesCatalog'

// 參考案例:HyperFrames(HeyGen 開源的「HTML 轉影片」框架)的效果目錄。
// 2026-11-07 閱讀 GitHub 原始碼(commit ca64c2a)與官方目錄資料的整理;只讀了每項的一句說明與部分元件說明,沒有實際渲染。

type Row = [string, string]

/** 各小類的中文說明,鍵為「大類/小類」 */
const SECTION_NOTE: Record<string, string> = {
  '3D/3D motion': '3D 標題與運鏡：葉片分開露出標題、玻璃碎片拼成字、立方體輪播。',
  '3D/3D objects': '3D 物件：分層爆炸圖、立體 logo、產品轉台。',
  'Carousels/Carousels': '圖片卡片輪播，圓形、球面、路徑、文字加圓、視覺環五種軌道，各 5 個變體。',
  'Text & captions/Captions': '逐字字幕樣式：卡拉 OK 膠囊、TikTok 式底色、霓虹、故障、粒子爆開。',
  'Text & captions/Typography & Text': '標題文字的進退場：逐字浮現、模糊對焦、換字、螢光筆、手寫、翻牌看板。',
  'Text & captions/Lower Thirds': '畫面下方的名條（新聞、Podcast、訪談）與新聞跑馬燈。',
  'Code/Code Animations': '程式碼動畫：逐字打出、diff、高亮某行、捲動到某行、程式碼變形，以及終端機。',
  'Code/Code Snippets': '仿 VS Code、Terminal 的程式碼視窗。',
  'Transitions/Shader Transitions': 'WebGL 著色器轉場：白閃、甩鏡、故障、漣漪、光圈。',
  'Transitions/CSS Transitions': 'CSS 轉場合集：推、覆蓋、溶接、格狀、3D 翻轉、光、機械快門。',
  'Data & charts/Data': '圖表與地圖：長條圖、長條賽跑、折線、進度環、星等、地圖。',
  'Scenes & demos/Showcases': '完整示範場景：AI 對話、ChatGPT／Claude 風格對話、筆記打字、通知堆疊、地圖飛行。',
  'Scenes & demos/Product Demo': '產品操作示範：裝置外框、終端機執行指令、系統通知、開關、提示詞打字、兩張卡片切換焦點。',
  'Scenes & demos/Social Overlays': '社群卡片疊加：IG／TikTok 追蹤、X 貼文、Reddit、Spotify、YouTube 訂閱。',
  'Scenes & demos/Motion Scenes': '動態場景：數字跳動、結尾行動呼籲、白板手繪、SVG 描線、功能卡組裝、小卡展開成面板。',
  'Cursors/Cursors': '游標示範：AI 代理游標、右鍵選單、拖放、框選、選取文字、跟著點擊自動推近、觸控點。',
  'Motion & effects/Motion Primitives': '介面微動態：徽章彈出、數字滾輪、AI 串流文字、「輸入中」點點、成功勾勾、骨架載入、頁面滑動。',
  'Motion & effects/Effects': '效果與轉場元件：前後對比、聚光、手繪圈選與箭頭、圓形揭露、動態模糊、撕紙、設定與註冊流程。',
  'Motion & effects/Camera': '鏡頭：推近、拉遠、手持晃動、跟焦、介面推近平移、捲動長頁。',
  'Surfaces/Texture': '底紋：雜訊、底片顆粒、網點、大理石、掃描線。',
  'Surfaces/HTML-in-Canvas': '把 HTML 畫面貼進 3D 裝置（iPhone、MacBook）與液態玻璃效果。',
  'Blocks/Blocks': '其他區塊，多數是 WebGPU 著色器背景（極光、各種球體、漸層），另有流程圖、手繪框、logo 片尾。',
}

const SUMMARY: Row[] = [
  ['是什麼', '用 HTML、CSS 與可拖曳的動畫寫畫面，再逐格擷取輸出成 MP4 的開源框架（Apache-2.0），主打給 AI 程式助手使用。'],
  ['目錄規模', '原始碼的 registry 有 457 項：210 個區塊（block，完整場景）、239 個元件（component，可掛進場景的單一效果）、8 個範例。官方目錄頁公開其中 448 項，分成 11 大類。'],
  ['安裝方式', '用 npx hyperframes add 加上效果名稱，把原始碼複製進自己的專案，之後可以直接改。'],
  ['確定性', '規則和本站即時教學引擎相同：不讀系統時鐘、亂數要固定種子、素材先載完。差別是它的動畫多用暫停的 GSAP 時間軸，再跳到指定時間，本站則是 kit 純函式。'],
  ['元件說明格式', '主要元件都寫了「做什麼、什麼時候用、什麼時候不要用、可搭配哪些、可調參數」，其中「不要用」記錄的是實際品管時看到的誤用。'],
]

const PICKS: [string, string, string][] = [
  ['streaming-text', 'AI 回答以不均勻的段落湧出，不是逐字打出。', 'kit 只有 typewriter；AI 回覆改成分段湧出會更像真實的 Claude。'],
  ['typing-indicator', '「對方輸入中」的三點氣泡，彈入、跳動、消失。', 'kit.dots 已有點點，可對照它的彈入與消失時機。'],
  ['claude-exchange', 'Claude 風格對話：輸入提示詞、顯示搜尋與思考步驟、串流回答。', '可對照 claude-desktop 演員的步驟與節奏。'],
  ['code-diff', '刪除的行以紅色收合，新增的行以綠色展開。', '講「AI 改了哪些地方」時很常用，目前沒有對應動作。'],
  ['code-highlight、code-scroll', '高亮某一行、其餘變暗；捲動長檔案把目標行帶到中間。', '對應 kit.spotlight 與 scrollTo，可包成程式碼演員的動作。'],
  ['cursor-text-select、cursor-context-menu、cursor-drag-drop', '游標拖曳選取文字、右鍵叫出選單、拖放卡片。', 'kit.cursor 目前只有移動與點擊；這三種是教學常見操作。'],
  ['cursor-zoom-follow、ui-focus-zoom', '像螢幕錄影軟體一樣，鏡頭跟著下一個點擊位置推近。', '概念同 kit.focus，可參考它決定何時推近、何時拉回。'],
  ['hw-callout-circle、hw-arrow、hw-underline', '手繪抖動感的圈選、箭頭、底線，逐筆畫出。', 'kit 有 marker、underline、arrowPath；手繪風更像講師在畫面上標註。'],
  ['yt-feather-highlight', '畫面變暗，只留一個羽化的橢圓亮區。', '對照 kit.spotlight 的邊緣處理。'],
  ['before-after-wipe', '同一位置的前後兩個狀態，用分隔線左右對比。', '適合展示「改之前／改之後」的網頁。'],
  ['native-notification-pop', 'iOS 或 macOS 系統通知從上方落下。', '可對照 macOS 演員的通知外觀。'],
  ['success-check、skeleton-reveal', '成功勾勾畫出；骨架畫面脈動後換成內容。', '可用在「完成」與「載入中」的回饋。'],
]

const ADOPT: Row[] = [
  ['動作說明加上何時用、何時不用', '演員動作與 kit 函式的說明補上 use_when／avoid_when，AI 寫腳本時比較不會用錯（對應規格 2A.4 與第 7 節的 AI 製作流程）。'],
  ['用 cues 對準旁白', '元件用一串秒數指定每個步驟的落點，讓畫面跟著旁白走；可對照舞台腳本的 at／delay 寫法。'],
  ['補新手法的順序', '從上表挑課程真的會用到的，先寫成「輸入時間、輸出樣式」的純函式加進 kit 並補測試，再給演員使用（規格第 6 節）。'],
]

const SKIP: Row[] = [
  ['著色器背景、3D、輪播', 'WebGPU／WebGL 背景、3D 標題、圖片輪播與課程內容無關，會搶走對操作畫面的注意力。'],
  ['社群卡片、新聞名條', '屬於宣傳片與社群影片的元素，教學畫面用不到；宣傳片另外評估。'],
  ['直接複製原始碼', '多數元件依賴 GSAP 時間軸，本站引擎不用；部分區塊內含 GSAP（GSAP Standard License，非 OSI 開源授權）、three.js 等第三方程式，各有授權。借用做法、自己改寫成 kit 純函式即可。'],
]

const toc = [
  { id: 'summary', title: '概要' },
  { id: 'catalog', title: '效果清單' },
  { id: 'picks', title: '值得參考的效果' },
  { id: 'adopt', title: '可以借用的做法' },
  { id: 'skip', title: '不照搬的部分' },
  { id: 'caveat', title: '尚未確認的事項' },
]

export function HyperframesPage() {
  return (
    <Article slug="research/hyperframes" toc={toc}>
      <p>
        HyperFrames 是 HeyGen 開源的影片框架，附有約 450 個現成效果。這篇整理它的效果清單，並對照
        <Link to="/docs/live">即時教學畫面規格</Link>的 kit 與演員，看哪些手法值得借用。
      </p>
      <Callout title="閱讀範圍" tone="warn">
        <p>
          整理自 2026-11-07 的原始碼（commit ca64c2a）。每項效果只讀了官方目錄的一句說明，少數讀了元件說明，沒有實際渲染或播放；
          效果的實際觀感請到官方目錄頁看預覽影片。
        </p>
      </Callout>

      <Section id="summary" title="概要">
        <DataTable head={['項目', '內容']} rows={SUMMARY} />
      </Section>

      <Section id="catalog" title="效果清單">
        <p>依官方目錄的大類與小類排列，共 448 項。名稱即安裝時用的 ID，可在官方目錄頁搜尋預覽。</p>
        {HF_CATALOG.map((s) => (
          <div key={`${s.group}/${s.section}`}>
            <h3>
              {s.group === s.section ? s.group : `${s.group}／${s.section}`}（{s.ids.length}）
            </h3>
            <p>{SECTION_NOTE[`${s.group}/${s.section}`]}</p>
            <p>
              {s.ids.map((id, i) => (
                <span key={id}>
                  {i > 0 && '、'}
                  <code>{id}</code>
                </span>
              ))}
            </p>
          </div>
        ))}
      </Section>

      <Section id="picks" title="值得參考的效果">
        <p>挑出和本站教學畫面（AI 對話、程式碼、操作示範、重點標示）直接相關的效果，並對照目前已有的工具。</p>
        <DataTable head={['效果', '做什麼', '對照本站']} rows={PICKS} />
      </Section>

      <Section id="adopt" title="可以借用的做法">
        <DataTable head={['做法', '說明']} rows={ADOPT} />
      </Section>

      <Section id="skip" title="不照搬的部分">
        <DataTable head={['項目', '理由']} rows={SKIP} />
      </Section>

      <Section id="caveat" title="尚未確認的事項">
        <ul>
          <li>沒有實際渲染，「值得參考」是依說明文字判斷，實際效果可能不如預期。</li>
          <li>各項目的第三方授權只看了 CREDITS.md 列出的部分；要借用某一項前，先看該項目錄內的授權檔。</li>
          <li>
            專案更新很頻繁，數量與名稱以 <Ext href="https://hyperframes.heygen.com/catalog/blocks/data-chart">官方目錄頁</Ext> 為準。
          </li>
        </ul>
      </Section>

      <SourceList
        sources={[
          { label: 'heygen-com/hyperframes（GitHub）', href: 'https://github.com/heygen-com/hyperframes' },
          { label: 'HyperFrames Catalog（官方目錄頁）', href: 'https://hyperframes.heygen.com/catalog/blocks/data-chart' },
          { label: 'Deterministic Rendering（官方文件）', href: 'https://github.com/heygen-com/hyperframes/blob/main/docs/concepts/determinism.mdx' },
          { label: '元件說明：registry/components/CATALOG.md', href: 'https://github.com/heygen-com/hyperframes/blob/main/registry/components/CATALOG.md' },
          { label: '第三方授權：CREDITS.md', href: 'https://github.com/heygen-com/hyperframes/blob/main/CREDITS.md' },
        ]}
      />
    </Article>
  )
}
