import { Link } from 'react-router-dom'
import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'

// 跨等級構想：不錄製影片，改用腳本即時產生教學畫面。
// 技術規格在 web/src/live/README.md；此頁整理定位、研究依據與製作原則。

const POSITIONING: [string, string][] = [
  ['研發階段', '部分上線。L0 第 0、1 課已改用即時教學畫面，直接掛在課程頁上播放；舞台、播放器外殼與兩個演員（Claude 桌面版、Finder）已完成。'],
  ['一句話', '不錄製影片，改用腳本即時產生教學畫面，在課程網站上播放。學員可以暫停、拖曳時間軸、調整速度，暫停時能直接選取並複製畫面上的提示詞與程式碼。'],
  ['只在自己的網站播放', '畫面只在自己的課程網站播放，不需要輸出影片檔上傳平台；需要宣傳片段時再由同一份腳本錄成 mp4。'],
  ['好處', '改一行腳本就能更新畫面，不用重錄；腳本可以和講義、提示詞、MCP 練習範本共用同一份來源；AI 可以協助撰寫腳本。'],
]

const ARCH: { part: string; role: string; path: string }[] = [
  { part: '外殼', role: '時間軸、播放控制、全螢幕、手機橫放、章節、字幕、旁白音訊。不知道畫面長什麼樣。', path: 'web/src/live/shell.js' },
  { part: '舞台', role: '怎麼演：時間表、旁白長度、字幕、章節、練習點、演員出場退場，以及章節卡、聚光燈、鏡頭推近、虛擬滑鼠等教學效果。', path: 'web/src/live/stage.js' },
  { part: '演員', role: '一個可重複使用的示範介面（目前有 Claude 桌面版、Finder），只負責「長什麼樣、每個動作畫成什麼樣子」。在 actors/index.js 登記。', path: 'web/src/live/actors/' },
  { part: '腳本', role: '演什麼：演員表、步驟、旁白、章節、練習點。JSON 格式，單課資料以 live 欄位指定。', path: 'web/src/content/live/' },
  { part: 'kit', role: '舞台與演員共用的動畫工具：緩動、打字、螢光筆、聚光燈、鏡頭推近、虛擬滑鼠等純函式。', path: 'web/src/live/kit.js' },
  { part: '繪製層、素材包（規劃）', role: '把一種場景的畫法與外觀（配色、字型、介面文字）分開，換素材包就換外觀。尚未實作。', path: '—' },
]

type Row = [string, string]

const TRANSITION_EVIDENCE = [
  'Brame（2016）整理教學影片的三個原則：標示重點（signaling）、切成段落（segmenting）、刪掉無關的東西（weeding）。轉場的功能是標出段落，讓學員知道換了新主題，不是裝飾。',
  '影片剪輯與動態設計的實務指南多建議以直接切換為主，特殊轉場留給重要時刻，並維持整部影片的一致性。',
]
const TRANSITION_PRACTICE: Row[] = [
  ['同一主題內換畫面', '直接切換，或 0.2–0.3 秒的短淡入淡出。'],
  ['換到新主題', '章節卡：1.5–2.5 秒的標題畫面，同時對應播放器上的章節。'],
  ['從整體看到細節', '鏡頭推近：同一畫面從全景推到某一行程式碼，學員不會迷失位置。'],
  ['兩個畫面有相同元素', '相同元素延續：例如檔案名稱從檔案列表移到編輯器標題，讓學員看出是同一個東西。'],
  ['要避免的', '旋轉、3D 翻頁、閃光等花俏特效；整部影片固定使用一兩種轉場。'],
  ['小技巧', '旁白比畫面早約 0.3 秒開始講下一段（J-cut），換場比較順。'],
]

const MATERIAL_EVIDENCE = [
  '誘人細節效應：加入「有趣但與學習無關」的內容會降低學習，整合分析效果約 g = −0.33；學員不能控制播放節奏時負面影響更大（Sundararajan & Adesope, 2020）。',
  '背景音樂與音效：Moreno & Mayer（2000）的實驗中，加上背景音樂或音效的版本學習效果較差，原因是與旁白爭用聽覺管道。',
  '情感設計：令人愉快的配色與擬人化的臉，整合分析認為有幫助（Brom 等, 2018），但個別研究結果不一致，可以使用但不要過度。',
]
const MATERIAL_PRACTICE = [
  '背景用素色或很淡的漸層，對比要低；重點內容放在畫面中央。',
  '強調色只用一種，而且只用在「現在要看這裡」：螢光筆、聚光燈、箭頭，出現時間與旁白講到的詞同步。',
  '用真實的介面畫面（模擬的 AI 工具）與案例素材（小森烘焙的 Logo、商品圖），不用與內容無關的圖庫影片。',
  '有旁白時不放背景音樂；輕音樂只用在片頭片尾與沒有旁白的空檔。打字聲、點擊聲預設關閉。',
  '角色（例如小森烘焙老闆）要有任務：提出需求、發問，不只是裝飾。',
]

const PACING_EVIDENCE = [
  '轉瞬即逝的資訊：動畫與旁白講完就消失，資訊又長又複雜時學員來不及吸收。切段落並加入停頓、讓學員自己控制節奏的版本，在難題上表現較好；這個好處主要出現在先備知識少的學員身上，正是 L0、L1 的對象。',
  'Guo 等（2014）：講者有熱忱、語速偏快的影片參與度較高；但既有錄製研究指出初學者容易跟不上太快的語速。兩者兼顧的做法是聲音有活力、畫面變化放慢。',
  '中途小測驗：Szpunar 等（2013）發現在影片中途穿插小問題，分心比例從約 40% 減半；後續研究結果不一，但成本低。',
]
const PACING_PRACTICE = [
  '一段只講一件事，約 20–60 秒。',
  '畫面一次只有一個焦點在變化。',
  '重要結果出現後停 1.5–2 秒，畫面不動，讓學員看清楚。',
  '等待時間要壓縮：AI 思考 30 秒的過程，畫面顯示「快轉 30 秒」，不讓學員真的等。',
  '先說要看哪裡（例如「注意右邊的檔案列表」），再讓它變化。',
  '每 3–5 分鐘放一個「停下來試試看」：播放器自動暫停並出題，或請學員動手做一步；可與課程 MCP 構想串接。',
]

const HUMOR_EVIDENCE = [
  '教學幽默研究（Banas 等 2011 回顧、Wanzer 等 2010 的 IHPT 理論）：與內容相關的幽默與學習呈正相關，無關的幽默呈負相關。',
  '口語化的說話方式是比笑話更可靠的做法：用「你」「我們」講解，整合分析顯示對記憶與應用有幫助（d 約 0.3–0.5），課程超過 35 分鐘後效果變小（Ginns 等, 2013）。',
  '語音原則：自然的人聲比機器合成聲學習效果好（Mayer）。',
]
const HUMOR_PRACTICE: [string, string, string][] = [
  ['AI 翻車現場', '需求講不清楚，AI 把烘焙店網站做成完全不對的風格', '為什麼要把需求說清楚'],
  ['角色互動', '小森老闆又傳來新訊息：「可以加會員集點嗎？」', '需求會一直變；同一個角色串起整門課'],
  ['改前改後對照', '模糊提示詞與改寫後提示詞的結果並排', '提示詞的差異'],
  ['前後呼應', '第 1 課埋的梗在結業時回收', '有完成整門課的感覺'],
  ['自嘲', '「我第一次用的時候也按了拒絕三次」', '降低初學者的焦慮'],
]
const HUMOR_RULES = [
  '放在一段講完、需要喘口氣的地方，不要插在講解中間。',
  '一次 5–15 秒，約每 3–5 分鐘一次。',
  '橋段裡不放學員需要記住的新資訊。',
  '避免嘲諷學員、需要特定文化背景才懂的迷因，以及蓋過旁白的音效笑點。',
]

const SHOTCRAFT_SUMMARY: Row[] = [
  ['是什麼', '一套給 Claude Code、Codex 使用的產品宣傳片製作 skill（Apache-2.0）。AI 依配方卡，用真實截圖與程式碼逐格畫出畫面，以 Remotion 輸出 MP4，不用 AI 生成影像。'],
  ['鏡頭配方卡', '124 張卡、150 個鏡頭。每張記錄意圖、影格時間表、參數的調節手感、音效、已知問題，並指向範例程式；要求先讀範例，不憑卡名重寫。'],
  ['真實介面素材', '用無頭瀏覽器截取 2 倍整頁圖、元素去背圖與座標表（layout.json），再由 2.5D 頁面相機運鏡；疊加元素與頁面共用座標。'],
  ['文字保持清晰', '放大時用 CSS zoom，不用 transform: scale，讓瀏覽器以放大後的尺寸繪製；主角元素另備 4 倍圖，推近時淡入替換。'],
  ['判例式準則', '每條審美規則都附當時的返工回饋與自查問題，例如一個鏡頭只講一個動態、關鍵資訊落定後至少停 1 秒。'],
  ['分層驗收', '每個鏡頭抽靜態影格自查，交付前由未參與製作的 subagent 獨立審查，逐條列出帶影格編號的證據。'],
]
const SHOTCRAFT_ADOPT: Row[] = [
  ['教學鏡頭配方', '整理常用段落（推近輸入框 → 打字 → 送出；展開權限對話框 → 聚光 → 點擊），附時間表與已知問題，讓 AI 寫腳本更穩定。'],
  ['先留停留時間', '排時間軸時先留好重要結果的停留時間，操作速度依真人節奏，與上方節奏原則一致。'],
  ['指定驗收時間點', '每段腳本指定要檢查的時間點，在預覽頁截圖確認；交付前再做一次獨立審查。'],
  ['返工記成判例', '把實際修改過的問題寫成「規則＋回饋＋自查問題」，累積成課程自己的準則。'],
]
const SHOTCRAFT_SKIP: Row[] = [
  ['配樂卡點、全畫面衝擊', '宣傳片追求記憶點；教學研究指出音樂與無關刺激會干擾學習，有旁白時不採用。'],
  ['傾斜運鏡與炫技特效', '操作教學需要看清文字。保留正視的推近；若日後加入 3D 傾斜，再注意文字清晰問題。'],
  ['離線渲染 MP4', '課程要能暫停、選取文字、依步驟跳轉，繼續在瀏覽器即時播放；宣傳片段才需要輸出影片。'],
  ['靜態截圖取代演員', '教學要呈現逐步操作與狀態變化，模擬介面比靜態圖適合；截圖只用在必須呈現真實頁面的少數場景。'],
]

const DESIGN_MAP: Row[] = [
  ['章節卡標出段落', '章節卡場景，自動對應播放器的章節'],
  ['停頓讓學員看清楚', '步驟加停頓欄位，預設 1500 毫秒'],
  ['壓縮等待時間', '步驟加快轉標示（例如「快轉 30 秒」）'],
  ['強調與旁白同步', '綁定旁白中的詞觸發螢光筆或聚光燈'],
  ['中途小測驗', '練習暫停點：播放器自動暫停、出題或請學員動手'],
  ['輕鬆橋段', '獨立的橋段場景類型，限制長度、不放新資訊'],
  ['刪掉無關內容', '驗證工具警告：背景音樂與旁白重疊、同時有兩個以上焦點在變化'],
]

const PROGRESS: [string, string, 'done' | 'todo'][] = [
  ['規格（外殼、舞台與演員；繪製層、素材包為規劃）', '草案完成', 'done'],
  ['繪製工具 kit 與單元測試', '完成', 'done'],
  ['播放器外殼 shell.js（全螢幕、手機橫放、章節、字幕、鍵盤、手勢）', '完成', 'done'],
  ['舞台 stage.js（章節卡、聚光燈、鏡頭、虛擬滑鼠、練習點）', '完成', 'done'],
  ['演員：Claude 桌面版、Finder', '完成', 'done'],
  ['課程頁直接掛載播放器（LivePlayer，章節對應課程步驟）', '完成', 'done'],
  ['L0 第 0、1 課改用即時教學畫面', '已上線', 'done'],
  ['內部預覽頁 /proposal/visuals/preview（逐時間點截圖檢查）', '完成', 'done'],
  ['旁白音訊', '待做', 'todo'],
  ['繪製層、素材包、驗證工具', '待做', 'todo'],
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '旁白來源', body: '真人錄音、TTS 或兩者並存（TTS 先試節奏，定稿再換真人）。研究顯示自然人聲效果較好；會影響腳本的音訊欄位與素材包結構。' },
  { title: '模擬其他產品介面的限制', body: '模擬 AI 工具介面的素材包不使用官方 Logo、商標或截圖，只做近似的版面與配色並註明非官方；產品改版時介面會與實際不同，需要定期對照更新。' },
]

const SOURCES: { label: string; href: string }[] = [
  { label: 'Vincentwei1021/video-shotcraft（GitHub）', href: 'https://github.com/Vincentwei1021/video-shotcraft' },
  { label: 'Brame (2016) Effective Educational Videos（PMC 全文）', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5132380/' },
  { label: 'Vanderbilt CFT：Effective educational videos', href: 'https://cft.vanderbilt.edu/guides-sub-pages/effective-educational-videos/' },
  { label: 'Seductive details（ACU Inspire）', href: 'https://inspire.acu.edu.au/articles/seductive-details' },
  { label: 'Learning Scientists：Cut It Out: Learning with Seductive Details', href: 'https://www.learningscientists.org/blog/2019/6/20-1' },
  { label: 'Moreno & Mayer (2000) 原文 PDF', href: 'https://tecfa.unige.ch/tecfa/teaching/methodo/Moreno_Mayer00.pdf' },
  { label: 'Coherence principle 摘要', href: 'https://sites.google.com/site/cognitivetheorymmlearning/coherence-principle' },
  { label: "Brom, Stárková & D'Mello (2018) emotional design 手稿", href: 'https://artemis.ms.mff.cuni.cz/main/papers/emodesign_manuscript_1rev_180928_FINAL_norev.pdf' },
  { label: 'Wong & Adesope (2021) 摘要', href: 'https://ifp.nyu.edu/2020/journal-article-abstracts/s10648-020-09545-x/' },
  { label: 'Transient information effect（KoreaScience）', href: 'https://koreascience.kr/article/JAKO201612460477292.page' },
  { label: 'Biard, Cojean & Jamet (2018) segmentation and pacing', href: 'https://hal.archives-ouvertes.fr/hal-01783949' },
  { label: 'Segmenting principle 摘要', href: 'https://sites.google.com/site/cognitivetheorymmlearning/segmenting-principle' },
  { label: 'Szpunar, Khan & Schacter (2013) PMC 全文', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3631699/' },
  { label: 'ScienceDaily：Interpolated memory tests', href: 'https://www.sciencedaily.com/releases/2013/04/130404122240.htm' },
  { label: 'Faculty Focus：Humor in the classroom, 40 years of research', href: 'https://www.facultyfocus.com/articles/effective-teaching-strategies/humor-in-the-classroom-40-years-of-research/' },
  { label: 'European Journal of Humour Research：Appropriate and relevant humour', href: 'https://europeanjournalofhumour.org/ejhr/article/view/364' },
  { label: 'The eLearning Coach：Humor and learning', href: 'https://theelearningcoach.com/elearning_design/isd/humor-and-learning/' },
  { label: 'Ginns, Martin & Marsh (2013) meta-analysis', href: 'https://researchers.westernsydney.edu.au/en/publications/designing-instructional-text-in-a-conversational-style-a-meta-ana/' },
  { label: 'Cambridge Handbook：Principles based on social cues', href: 'https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-based-on-social-cues-in-multimedia-learning/093C1CDE75CF486DACD4CABC325ABE47' },
  { label: 'School of Motion：Six essential motion design transitions', href: 'https://schoolofmotion.com/blog/six-essential-motion-design-transitions-tutorial' },
  { label: 'Uppbeat：Video transition effects explained', href: 'https://uppbeat.io/blog/motion-graphics/video-transitions' },
  { label: 'Transitions and continuity: when to cut', href: 'https://cursa.app/en/page/transitions-and-continuity-when-to-cut-when-to-transition' },
]

function KvTable({ rows, head }: { rows: Row[]; head?: [string, string] }) {
  return (
    <section className="card">
      <table>
        {head && (
          <thead>
            <tr>
              <th>{head[0]}</th>
              <th>{head[1]}</th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="nowrap" style={{ width: '11em' }}>
                <strong>{k}</strong>
              </td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Evidence({ items }: { items: string[] }) {
  return (
    <div className="note">
      <strong>研究依據</strong>
      <ul>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

export function VisualsPage() {
  return (
    <ProposalLayout title="即時教學影像" footer="跨等級構想 · 技術規格見 web/src/live/README.md">
      <h1>構想 · 即時教學影像</h1>
      <span className="chip todo draft-banner">部分上線</span>
      <p>
        <Link className="btn" to="/proposal/visuals/preview">
          預覽即時教學畫面
        </Link>
      </p>

      <h2>定位</h2>
      <KvTable rows={POSITIONING} />

      <h2>架構摘要</h2>
      <p className="lead">
        完整規格見<span className="repo-path">web/src/live/README.md</span>；各時間點的畫面可在<Link to="/proposal/visuals/preview">預覽頁</Link>檢查
      </p>
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>部分</th>
              <th>負責什麼</th>
              <th>位置</th>
            </tr>
          </thead>
          <tbody>
            {ARCH.map((a) => (
              <tr key={a.part}>
                <td className="nowrap">
                  <strong>{a.part}</strong>
                </td>
                <td>{a.role}</td>
                <td className="nowrap">
                  <span className="repo-path">{a.path}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>製作原則（研究整理）</h2>
      <p className="lead">
        整體結論：轉場、素材、輕鬆橋段都要幫學員理解，只為了好看的部分在研究上大多扣分。下列效果量多取自摘要或二手整理，正式引用前需回原論文確認。
      </p>

      <h3>轉場：用來標出段落，不是裝飾</h3>
      <Evidence items={TRANSITION_EVIDENCE} />
      <KvTable rows={TRANSITION_PRACTICE} head={['情境', '做法']} />

      <h3>背景與素材：相關的留下，無關的刪掉</h3>
      <Evidence items={MATERIAL_EVIDENCE} />
      <section className="card">
        <div className="card-body">
          <List items={MATERIAL_PRACTICE} />
        </div>
      </section>

      <h3>節奏：讓學員跟得上</h3>
      <Evidence items={PACING_EVIDENCE} />
      <section className="card">
        <div className="card-body">
          <List items={PACING_PRACTICE} />
        </div>
      </section>

      <h3>輕鬆橋段：好笑的要跟內容有關</h3>
      <Evidence items={HUMOR_EVIDENCE} />
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>類型</th>
              <th>例子</th>
              <th>學到什麼</th>
            </tr>
          </thead>
          <tbody>
            {HUMOR_PRACTICE.map(([k, ex, learn]) => (
              <tr key={k}>
                <td className="nowrap">
                  <strong>{k}</strong>
                </td>
                <td>{ex}</td>
                <td>{learn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <div className="card-body">
          <List items={HUMOR_RULES} />
        </div>
      </section>

      <h2>參考案例：video-shotcraft</h2>
      <p className="lead">
        2026-11-02 閱讀原始碼與文件的整理，未實際渲染；它的目標是產品宣傳片，與教學影像不同，所以只借用製作方法。
      </p>
      <h3>它怎麼做</h3>
      <KvTable rows={SHOTCRAFT_SUMMARY} />
      <h3>值得借用</h3>
      <KvTable rows={SHOTCRAFT_ADOPT} head={['做法', '用在課程上']} />
      <h3>不照搬</h3>
      <KvTable rows={SHOTCRAFT_SKIP} head={['手法', '原因']} />

      <h2>對應到腳本與播放器的設計</h2>
      <KvTable rows={DESIGN_MAP} head={['研究結論', '腳本或播放器的做法']} />

      <h2>進度</h2>
      <section className="card">
        <table>
          <tbody>
            {PROGRESS.map(([item, chip, st]) => (
              <tr key={item}>
                <td>{item}</td>
                <td className="nowrap">
                  <span className={`chip ${st}`}>{chip}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>待決定</h2>
      <div className="note">
        <ul style={{ margin: 0 }}>
          {OPEN_QUESTIONS.map((q) => (
            <li key={q.title}>
              <strong style={{ display: 'inline' }}>{q.title}</strong>：{q.body}
            </li>
          ))}
        </ul>
      </div>

      <h2>參考來源</h2>
      <section className="card">
        <div className="card-body">
          <ul className="plain-list">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </ProposalLayout>
  )
}
