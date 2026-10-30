import { Article, Callout, CardGrid, DataTable, Ext, Section, SourceList } from '../Article'

// 原文:docs/research/線上課程設計與影音製作-研究報告.md

const SRC = {
  ubc: 'https://blogs.ubc.ca/videolearninghub/?p=569',
  irrodl: 'https://www.irrodl.org/index.php/irrodl/article/view/2112/3364',
  iit: 'https://repository.iit.edu/islandora/object/islandora%3A1000826/datastream/DC/download',
  icer: 'https://icer2023.acm.org/details/icer-2023-papers/34/An-Empirical-Evaluation-of-Live-Coding-in-CS1',
  eggheadLesson: 'https://howtoegghead-gatsby.netlify.app/create-your-30second-lesson',
  udemyCommunity: 'https://community.udemy.com/en/discussion/158806/what-is-the-minimun-lenght-of-a-lesson',
  coursera: 'https://mooctech.net.technion.ac.il/resources/mooc-structure/',
  ucl: 'https://blog.ble.ac.uk/2021/04/the-curious-case-of-long-videos-how.html',
  southAlabama: 'https://hoasen.edu.vn/dbclkt/en/writing-learning-objectives-using-blooms-taxonomy-2',
  strathclyde: 'https://pureportal.strath.ac.uk/en/publications/course-design-2-writing-effective-learning-objectives/',
  udemySupport: 'https://support.udemy.com/hc/articles/115002883587',
  javarevisited: 'https://javarevisited.blogspot.com/2026/04/should-you-join-frontend-masters-to-learn-web-development.html',
  introWebDev: 'https://btholt.github.io/complete-intro-to-web-dev-v3',
  udemyTips: 'https://course-careers-edge.pages.dev/teaching-courses/40-tips-on-making-a-great-online-course',
  arxiv: 'https://ar5iv.labs.arxiv.org/html/2104.12555',
  glasgow: 'https://eprints.gla.ac.uk/282464/2/282464.pdf',
  edx: 'https://courses.edx.org/courses/course-v1:IMTx+DMx102+2T2018/622e87c1e3c844d8b98ee475524eeded/',
  lynda: 'https://www.lynda.com/Camtasia-tutorials/Develop-scripts/728395/781233-4.html',
  uwLaw: 'https://law.wisc.edu/lrw/2018_lwi_screencasting_handout.pdf',
  eggheadScreencasting: 'https://howtoegghead.com/instructor/screencasting/',
  slideGenius: 'https://www.slidegenius.com/blog/ums-likes-and-you-knows-avoiding-fillers-in-your-presentations',
  eggheadScreen: 'https://master--how-to-egghead.netlify.app/instructor/screencasting/screen-setup',
  clueso: 'https://www.clueso.io/cluebooks/tasteful-screen-recording--setting-up-screenrecording',
  devto: 'https://dev.to/5t3ph/how-i-set-up-vscode-for-recording-a-screencast-be7',
  uwMadison: 'https://pages.cs.wisc.edu/~gerald/papers/LiveCoding.pdf',
  sigcse: 'https://sigcse2025.sigcse.org/details/sigcse-ts-2025-Papers/4/Live-But-Not-Active-Minimal-Effect-with-Passive-Live-Coding',
  academia: 'https://www.academia.edu/76238181/Live_coding_vs_Static_Code_Examples',
}

const toc = [
  { id: 'overview', title: '摘要:六大製作鐵律' },
  { id: 'granularity', title: '單元顆粒度' },
  { id: 'objectives', title: '學習目標寫法' },
  { id: 'practice', title: '實作練習安排' },
  { id: 'assessment', title: '知識檢核' },
  { id: 'script', title: '腳本寫法' },
  { id: 'recording', title: '技術規格與畫面' },
  { id: 'live-coding', title: 'Live coding 的迷思' },
  { id: 'checklist', title: '製作建議清單' },
  { id: 'conclusion', title: '結論' },
]

export function ResearchReportPage() {
  return (
    <Article slug="research-report" toc={toc}>
      <Section id="overview" title="摘要:開源專案轉線上課程的六大製作鐵律">
        <p>
          把 onagent 的開發範例轉製成「六單元+Capstone」線上課程時,最具研究支持的單一槓桿是
          <strong>嚴格的影片切片長度</strong>。
        </p>
        <p>
          Guo、Kim 與 Rubin(2014)分析 edX 四門 MOOC 共 690 萬次觀看紀錄後發現:不論影片原始長度多長,學員的中位數觀看時長都落在約
          6 分鐘,因此影片長度是目前已知對參與度最顯著的單一預測因子(<Ext href={SRC.ubc}>UBC blog</Ext>)。Katy
          Jordan(2015)分析 221 個 MOOC 也發現課程越長完成率越低,且課程<strong>開頭一到兩週</strong>是留存的關鍵窗口(
          <Ext href={SRC.irrodl}>IRRODL</Ext>)。相對地,業界熱衷的徽章、進度條等遊戲化機制證據薄弱,且效果因人而異(
          <Ext href={SRC.iit}>IIT dissertation</Ext>)。
        </p>
        <p>
          在錄製端,egghead.io、Frontend Masters 講師與學術研究共同指向一個違反直覺但一致的結論:
          <strong>純粹即時編碼(live coding)並不會帶來更好的學習成效</strong>。2023 年 ICER
          的對照研究甚至發現,其唯一具統計顯著性的結果是指出 live coding 的潛在缺點(<Ext href={SRC.icer}>ICER 2023</Ext>
          )。因此「預先寫好程式碼、錄製時分段重現」是效率與教學價值的最佳折衷。
        </p>
        <p>腳本撰寫上,業界的最大公約數是「大綱為主、開場結尾逐字寫、分段錄製」,而非逐字稿唸稿或純憑感覺發揮。</p>
        <Callout tone="key" title="可直接落地的 onagent 課程製作規格">
          <ul>
            <li>影片切片 6–9 分鐘</li>
            <li>每單元開頭安排一次高成就感的實作練習</li>
            <li>程式碼演示用「why before how」加分段 live-typing</li>
            <li>技術規格鎖定 1080p/16:9+三欄式版面+大字體高對比主題</li>
          </ul>
          <p>以下逐一展開方法論依據,並在最後給出一份可直接套用的製作建議清單。</p>
        </Callout>
      </Section>

      <Section id="granularity" title="單元顆粒度應仿照「影片—lesson—module」三層結構">
        <p>業界對教學內容的最小單位長度,有出乎意料一致的經驗值,可整理成三層:</p>
        <CardGrid
          items={[
            {
              title: '影片/lecture:2–10 分鐘',
              body: (
                <>
                  egghead.io 最極致,1–10 分鐘,原則是「一次只講一個想法」(
                  <Ext href={SRC.eggheadLesson}>How to egghead</Ext>);Udemy 社群建議 2–8 分鐘(
                  <Ext href={SRC.udemyCommunity}>Udemy Community</Ext>)。
                </>
              ),
            },
            {
              title: 'Lesson:約 30 分鐘',
              body: (
                <>
                  Coursera 官方結構要求每個 lesson 內含數支影片+至少一個 quiz 收尾(
                  <Ext href={SRC.coursera}>Coursera 結構鏡像文件</Ext>)。
                </>
              ),
            },
            {
              title: 'Module:1–2 小時',
              body: <>學習時間約 1–2 小時,通常含 2–3 個 lesson。</>,
            },
          ]}
        />
        <p>
          這個三層顆粒度並非武斷規定,而是受學習科學制約:UCL 部落格引用 Guo et al. 2014 與 Brame 2016,指出最佳觀看時長落在
          <strong>6–9 分鐘</strong>,涉及認知負荷理論(<Ext href={SRC.ucl}>UCL/ALT blog</Ext>
          )。威斯康辛大學的研究也顯示,學生明顯偏好 15 分鐘以下的片段。
        </p>
        <p>
          拆分的依據應該是<strong>內容的自然斷點</strong>(natural divisions)——即開源專案中一次完整的 PR、一個函式、一個
          feature 分支——而非湊時長。但一旦自然斷點產生的片段明顯超過 9
          分鐘,就應該主動在次一級的概念邊界處再切一刀,而不是錄完一次性長影片再硬切。這點在把長篇開發 walkthrough
          轉製成課程時特別容易被忽略。
        </p>
        <Callout tone="key" title="對 onagent 而言">
          <p>
            六個單元中的每一個,都應該視為一個「module」(1–2 小時學習時間),內部再拆成 3–6 個「lesson」級的子主題,每個 lesson
            再由 2–4 支 6–9 分鐘的短片組成。
          </p>
          <p>例如「單元三:工具鏈整合」可拆成「定義 tool」「推送到開發者平台」「串接 SDK 呼叫」三個 lesson。</p>
        </Callout>
      </Section>

      <Section id="objectives" title="Learning objectives 要寫成可驗證的技能句,對齊 Bloom 的應用/創造層級">
        <p>
          業界慣用的教學設計句型是「By the end of this lesson/course, you will/should be able to...」,背後依託的是 Bloom's
          修訂版分類法(2001)的六個認知層級——Remember、Understand、Apply、Analyze、Evaluate、Create(
          <Ext href={SRC.southAlabama}>University of South Alabama</Ext>)。
        </p>
        <p>一個合格的 objective 需符合 Mager 模型三要素,三者皆須可測量:</p>
        <DataTable
          head={['要素', '意義']}
          rows={[
            ['Performance', '可觀察的行為'],
            ['Conditions', '情境/限制'],
            ['Criterion', '達成標準'],
          ]}
        />
        <p>
          這套方法論也契合「backward design」——先定義目標,再反推教學活動與評量設計(
          <Ext href={SRC.strathclyde}>University of Strathclyde</Ext>)。Coursera 官方結構的具體做法是每個 lesson 圍繞
          <strong>1–2 個</strong>明確的 learning objective 設計,不多不少(<Ext href={SRC.coursera}>Coursera 結構鏡像文件</Ext>
          )。
        </p>
        <Callout tone="key" title="對 onagent 而言">
          <p>每個單元/lesson 的 objective 不該寫成抽象描述,而應寫成對應 Bloom's Apply/Create 層級的動詞句(implement、build、debug、refactor):</p>
          <ul>
            <li>不要:「了解 onagent 的 tool 機制」</li>
            <li>要:「能夠為一個真實的 API endpoint 撰寫並通過單元測試的 tool 實作」</li>
          </ul>
          <p>因為程式設計課程的實作本質本就偏向應用與創造,而非記憶或理解。</p>
        </Callout>
        <Callout tone="warn" title="證據限制">
          目前沒有找到 Udemy、Pluralsight、Frontend Masters、egghead.io 官方對 objective
          撰寫格式的具體規範文件,也沒有平台公開比較「寫了 objective」與「沒寫」的課程在完成率上的差異。這部分的建議主要基於通用教學設計理論的遷移,而非技術課程平台的直接實證。
        </Callout>
      </Section>

      <Section id="practice" title="實作練習沒有黃金比例,但「早期安排高成就感練習」是跨平台共識">
        <p>
          關於「影片講解 vs. 動手練習」的時間或內容佔比,<strong>沒有任何平台公開過量化的官方基準</strong>
          ——這是三份研究筆記中反覆出現的空白。能找到的只是功能描述與實務分享:
        </p>
        <ul>
          <li>
            Udemy 支援多語言 coding exercise(<Ext href={SRC.udemySupport}>Udemy support</Ext>)。
          </li>
          <li>
            Frontend Masters 的課程被形容為「錄製的工作坊」,內含手把手練習與真實專案(
            <Ext href={SRC.javarevisited}>javarevisited blog</Ext>)。
          </li>
          <li>
            其「Complete Intro to Web Dev v3」的實際結構是每講完一個技術主題(HTML→CSS→JavaScript)後,緊接一個對應的實作專案(
            <Ext href={SRC.introWebDev}>Complete Intro to Web Dev v3</Ext>)。
          </li>
        </ul>
        <p>
          更有價值的發現來自 Udemy 社群的教學心得:應該在課程<strong>早期</strong>
          就安排一個高產出感的練習,讓學員快速應用概念並產生成就感,同時建議刪減早期內容,讓學員更快抵達核心練習(
          <Ext href={SRC.udemyTips}>Udemy tips</Ext>)。
        </p>
        <p>
          這與 Katy Jordan 發現的「課程開頭一兩週是留存關鍵期」直接呼應。兩條證據線分別來自「創作者實務心得」與「MOOC
          完課率統計」,卻指向同一個結論。
        </p>
        <Callout tone="key" title="對 onagent 而言">
          <p>
            <strong>單元一結束前就要讓學員跑出一個可見成果</strong>(例如成功呼叫一個 onagent tool
            並拿到回應),而不是把「寫出第一個可運行範例」留到單元三、四才出現。
          </p>
          <p>六個單元加 Capstone 的結構,也應該讓每個單元都以一個小而完整的實作練習收尾,而非把所有動手操作集中在 Capstone。</p>
        </Callout>
      </Section>

      <Section id="assessment" title="知識檢核優先用自動化測試,同儕審查須搭配 rubric 與校準練習">
        <p>
          Coursera 官方結構明確要求每個 lesson 以 quiz 收尾、每個 module 以「review quiz」收尾(
          <Ext href={SRC.coursera}>Coursera 結構鏡像文件</Ext>)。
        </p>
        <p>
          程式設計類 MOOC 處理「作業批改規模化」問題的標準做法是同儕程式碼審查(peer code review),但這條路有明確的風險:Wang et
          al.(2021)連結 GitHub commits 與 MOOC 成績的研究發現,大規模同儕評分分數變異度高,且分數隨重複提交次數平均上升,分數變化與實際程式碼變更的關聯並不緊密——意味著評分系統可能被「多次提交」策略性拉高,而非反映真實進步(
          <Ext href={SRC.arxiv}>arXiv</Ext>)。
        </p>
        <p>降低這個風險的兩個已驗證手段:</p>
        <CardGrid
          items={[
            {
              title: '明確的評量規準(rubric)',
              body: (
                <>
                  University of Glasgow 的研究顯示,使用 rubric 的同儕評量比沒有時更具效度與信度(
                  <Ext href={SRC.glasgow}>Glasgow eprints</Ext>)。
                </>
              ),
            },
            {
              title: '校準練習(calibration exercise)',
              body: (
                <>
                  edX 的 IMTx 程式設計課在學員正式互評前,先讓他們對一份教師範例作業評分並對照正解(
                  <Ext href={SRC.edx}>edX course page</Ext>)。
                </>
              ),
            },
          ]}
        />
        <p>
          更根本的是 Katy Jordan 的發現:僅採用「自動評分測驗」(不含人工/同儕評分)的課程完成率較高(
          <Ext href={SRC.irrodl}>IRRODL</Ext>)。
        </p>
        <Callout tone="key" title="對 onagent 而言">
          <p>
            對這種以程式碼為核心產出的課程,凡能自動化的檢核(單元測試、CI 風格的 autograder、lint 檢查)都應該優先採用,取代人工批改。
          </p>
          <p>
            只有在無法自動化時(例如架構設計決策、程式碼可讀性)才退回同儕審查,且務必配上明確 rubric 與校準練習,並避免把「提交次數」當作進步指標。
          </p>
        </Callout>
      </Section>

      <Section id="script" title="腳本寫法:大綱為主、開場結尾逐字、分段錄製">
        <p>
          多個獨立來源(Lynda.com 的 Camtasia 課程講師、威斯康辛大學法學院的 screencasting 指南、egghead.io)在這一點上高度一致:
          <strong>大綱(outline)優於逐字稿</strong>。純逐字稿唸稿容易顯得生硬不自然,但開場與結尾仍應完整寫出並反覆練習朗讀(
          <Ext href={SRC.lynda}>Lynda.com</Ext>;<Ext href={SRC.uwLaw}>UW Law School</Ext>)。
        </p>
        <p>egghead.io 的做法把這個原則推到極致:</p>
        <ul>
          <li>
            以<strong>短而高品質的片段、每段約 20 秒、只涵蓋一個想法</strong>
            的方式分段錄製,片段之間暫停。這樣既方便後製精準刪除失誤片段(ripple delete),也不必為了維持單次長錄影的流暢度而加快語速或跳過停頓(
            <Ext href={SRC.eggheadScreencasting}>How to egghead: Screencasting</Ext>)。
          </li>
          <li>
            要求新進講師先錄一段 30 秒測試片段,待教練回饋後才正式錄製完整課程(
            <Ext href={SRC.eggheadLesson}>reviewer guide</Ext>)。
          </li>
        </ul>
        <p>
          贅詞(嗯、啊)的消除,主要靠對內容的熟悉度與練習次數。公開演講教練資料建議用「停頓」取代填充音,停頓本身能在關鍵論點前後製造強調效果(
          <Ext href={SRC.slideGenius}>SlideGenius</Ext>)。
        </p>
        <Callout tone="key" title="對 onagent 而言">
          「大綱+分段錄製」的組合對把開源專案開發歷程轉製成課程特別合適:可以按照程式碼的邏輯步驟(一個 function、一個
          feature)切成多個短片段分別錄製再剪接,大幅降低一次性長錄影失敗、需要整段重錄的風險。
        </Callout>
      </Section>

      <Section id="recording" title="技術規格與畫面呈現:16:9、三欄式佈局、放大字體">
        <p>錄影前準備的業界共識相對具體且可操作。</p>
        <DataTable
          head={['項目', '建議', '來源']}
          rows={[
            [
              '解析度',
              '16:9、1280×720 的 HiDPI 模式錄製(Retina 螢幕上實際像素 2560×1440),最終輸出 1920×1080',
              <Ext href={SRC.eggheadScreen}>How to egghead: Screen setup</Ext>,
            ],
            [
              '影格率',
              '1080p/30fps 作為多數情境的預設;只有密集 UI 細節或快速滾動/拖放畫面才需要提升到 4K 或 60fps',
              <Ext href={SRC.clueso}>Clueso Cluebooks</Ext>,
            ],
            ['畫面佈局', '三欄式/2:1 比例:編輯器佔螢幕約三分之二,瀏覽器或範例輸出佔右側三分之一', 'egghead.io'],
            ['程式碼字體', '16–18pt 起,欄寬限制在 80 或 120 字元', 'egghead.io'],
          ]}
        />
        <p>
          三欄式佈局對 onagent 課程特別實用,因為開源專案常需要同時展示程式碼變更與執行結果(測試通過、瀏覽器畫面更新)。
        </p>
        <h3>字體大小:看實際呈現,而非絕對數字</h3>
        <p>
          知名講師 Stephanie Eckles 公開分享的實際 VS Code 設定是 editor.fontSize 14pt 搭配 window.zoomLevel 4(即視窗整體放大
          400%),並關閉行號、breadcrumbs、hover 提示、status bar 等非必要 UI 元素,配色採用高對比主題(Apollo Midnight)(
          <Ext href={SRC.devto}>DEV.to</Ext>)。
        </p>
        <p>
          數字看似不同(16–18pt vs. 14pt),但本質一致:都是透過「字體設定+系統/視窗縮放」組合,達到「填滿畫面、放大到最大可讀尺寸」的效果。重點是
          <strong>實際視覺呈現大小</strong>,而非編輯器內的絕對數字。
        </p>
        <h3>工具鏈分工</h3>
        <DataTable
          head={['工具', '定位', '特點']}
          rows={[
            ['OBS Studio', '免費、跨平台', '純錄製,需搭配其他軟體剪輯'],
            ['Camtasia', '錄製+剪輯一體化商業軟體', '擅長縮放特效、標註、轉場,但學習曲線陡且需訂閱'],
            [
              'ScreenFlow',
              'Mac 專屬',
              <>
                以簡潔易用著稱,是 egghead.io 官方首選(
                <Ext href={SRC.eggheadScreencasting}>How to egghead: Screencasting</Ext>)
              </>,
            ],
            ['Loom', '瀏覽器內快速錄製+分享連結', '剪輯功能僅限調整起訖點,更適合草稿溝通而非正式課程交付'],
          ]}
        />
      </Section>

      <Section id="live-coding" title="Live coding 不等於更好的教學效果">
        <p>最具研究價值、也最違反直覺的發現,出現在「live coding vs. 預先寫好程式碼」這個問題上:</p>
        <DataTable
          head={['研究', '發現']}
          rows={[
            [
              <Ext href={SRC.icer}>ICER 2023(UCSD)</Ext>,
              '直接比較兩者的對照研究:live coding 並未在學習成效上顯著優於靜態範例;論文中唯一具統計顯著性的結果反而指出 live coding 的潛在缺點',
            ],
            [<Ext href={SRC.uwMadison}>UW-Madison 2020</Ext>, '同樣未能證明兩者有差異'],
            [<Ext href={SRC.sigcse}>SIGCSE 2025</Ext>, '進一步指出「單純被動觀看 live coding 效果有限」'],
          ]}
        />
        <p>
          Live coding 的價值在於能讓講者的思考過程動態呈現、示範如何解讀錯誤訊息與除錯。缺點是比靜態範例耗時(文獻提到有時多花兩倍時間),且缺乏結構性與可預測性(
          <Ext href={SRC.academia}>Academia.edu</Ext>)。
        </p>
        <Callout tone="key" title="對 onagent 而言">
          結合這些證據與 egghead 的分段錄製原則,對 onagent 這種「重現真實開發過程」的場景,最可行的做法是
          <strong>預先寫好最終程式碼作為「地圖」,錄製時用分段 live-typing 的方式逐步重現關鍵的程式碼變更</strong>
          ——既保留展示思考過程的教學價值,又避免真正即時編碼的效率與穩定性風險。
        </Callout>
      </Section>

      <Section id="checklist" title="針對 onagent 課程(六單元+Capstone)的製作建議清單">
        <h3>課程結構與單元拆分</h3>
        <DataTable
          head={['層級', '對應', '規格']}
          rows={[
            ['Module', '六個單元各一', '目標學習時間 1–2 小時'],
            ['Lesson', '每單元 3–6 個子主題', '一個 PR/一個 tool 定義/一個 SDK 呼叫鏈路=一個 lesson'],
            ['短片', '每 lesson 2–4 支', '6–9 分鐘'],
            ['Capstone', '獨立的長形 module', '內部仍按「功能斷點」切片,不要錄一支超過 15 分鐘的連續影片'],
          ]}
        />
        <ul>
          <li>
            拆分依據用 onagent 開源歷史的自然斷點;若某段開發過程超過 9 分鐘仍無法在自然斷點切開,主動在次一級概念邊界(例如「寫測試」與「跑測試」之間)再切一刀。
          </li>
          <li>
            每個單元的第一個 lesson 結尾就安排一次小而完整、看得到成果的動手練習(例如成功呼叫一個 tool 並看到回應),不要把所有實作集中到
            Capstone。這對應第 1–2 週留存關鍵期的研究發現,但推到「每單元開頭」的粒度。
          </li>
        </ul>

        <h3>Learning objectives 與檢核</h3>
        <ul>
          <li>
            每個單元用「完成本單元後,你將能夠 ___」句型寫 2–3 條 objective,動詞選用 implement / build / debug / refactor(Bloom's
            Apply/Create 層級),不用 understand / know 這類無法驗證的動詞。
          </li>
          <li>
            知識檢核優先用自動化測試/CI 風格 autograder(例如要求學員的程式碼通過 onagent
            既有的測試套件或新增測試),這是唯一有完課率正相關證據支持的檢核方式。
          </li>
          <li>只有設計決策類題目(架構選擇、API 設計取捨)才用同儕審查,且必須附上明確 rubric 與一份「對照範例作業」的校準練習。</li>
          <li>每個 module(單元)結尾安排一個 review quiz,混合自動評分選擇題與一個小型程式碼挑戰。</li>
        </ul>

        <h3>腳本撰寫流程</h3>
        <ul>
          <li>
            每支短片腳本用「大綱+關鍵字句」撰寫,只有開場鉤子(約 15–30 秒)與結尾回顧/過場語逐字寫出,並預先朗讀練習 2–3
            次;中段的程式碼講解部分用條列 talking points,保留臨場感。
          </li>
          <li>錄製前先用 Loom 或手機錄一段 30 秒的腳本試講(參照 egghead 新講師流程),確認節奏與用詞順暢後才正式錄製,降低正式錄製時的重錄成本。</li>
        </ul>
        <p>單元腳本骨架固定為七段:</p>
        <ol>
          <li>開場鉤子/成果預告</li>
          <li>情境動機(可併入第 1 段,說明這段程式碼/功能在 onagent 裡解決什麼問題)</li>
          <li>前置需求(需要先裝好什麼、看過哪個單元)</li>
          <li>分步驟教學(每步=做什麼+為什麼+示範+常見錯誤提醒)</li>
          <li>成果展示/驗收(跑測試、看輸出)</li>
          <li>疑難排解(複雜單元才需要)</li>
          <li>回顧總結+下一單元過場語</li>
        </ol>
        <DataTable
          head={['段落', '固定句型']}
          rows={[
            ['開場鉤子(成果預告+痛點)', '「如果你串接 onagent tool 時常遇到 ___,這集結束後你會知道怎麼一次解決。」'],
            [
              '結尾過場語',
              '「這集我們學會了 ___。下一集會接著處理 ___,會用到這集學到的 ___。」畫面上同步疊加「下一集:XXX」文字卡,不只靠旁白。',
            ],
          ]}
        />

        <h3>錄製技術規格</h3>
        <CardGrid
          items={[
            {
              title: '解析度與影格率',
              body: '1920×1080、16:9;有 Retina/HiDPI 螢幕的講者用 1280×720 HiDPI 模式錄製再降頻輸出,確保程式碼文字邊緣清晰。30fps 足夠多數畫面,若單元涉及大量拖放/快速滾動(例如示範 CI 介面)才拉到 60fps。',
            },
            {
              title: '畫面佈局',
              body: '固定用三欄式/2:1 佈局:VS Code 編輯器佔螢幕三分之二,瀏覽器/終端機輸出佔右側三分之一;上下留白,避免播放器介面遮住終端機底部輸出。',
            },
            {
              title: '編輯器設定',
              body: '字體至少 16–18pt(或用 14pt+視窗縮放 300–400% 達到等效放大),欄寬限制 80–120 字元避免換行;關閉行號、breadcrumbs、hover 提示、status bar、GitLens inline blame,側邊欄只留 Explorer,並用 Explorer Exclude 隱藏 node_modules、.env、.vscode 等 onagent repo 裡的雜訊目錄;配色採用高對比主題(避免 low-contrast scheme)。',
            },
            {
              title: '收音',
              body: '指向性麥克風,口與麥克風距離保持 2–6 吋(5–15 公分),在安靜、有軟性材質吸音的空間錄製;噪音問題優先在源頭解決(換房間、換麥克風),事後才考慮 Audacity Noise Removal 或 Adobe Podcast 降噪作為補救。',
            },
          ]}
        />
        <DataTable
          head={['工具', '使用時機']}
          rows={[
            ['ScreenFlow', 'Mac 環境首選(錄製+剪輯一體化、學習曲線低)'],
            ['Camtasia', '若團隊已有授權也可用,剪輯特效更完整'],
            ['OBS', '僅在需要免費跨平台錄製時採用,但要額外規劃「OBS 錄製→外部工具剪輯」兩階段流程'],
            ['Loom', '只用在腳本試講與內部審稿溝通,不作為正式課程交付工具'],
          ]}
        />

        <h3>程式碼演示段落的具體寫法</h3>
        <p>固定流程:</p>
        <ol>
          <li>一兩句話講這段程式碼解決什麼問題(why)</li>
          <li>展示程式碼整體長相,不逐行念</li>
          <li>針對 1–3 行核心邏輯展開講解(這一行在做什麼、為什麼這樣寫)</li>
          <li>執行並展示結果(測試通過、終端機輸出)</li>
          <li>順勢提醒一個常見錯誤或踩坑點</li>
        </ol>
        <ul>
          <li>
            <strong>錄製方式:</strong>預先在 repo 裡準備好「最終版」程式碼作為地圖,正式錄製時用分段 live-typing
            重現關鍵變更(而非真正從零現場發明程式碼),每段約 20 秒、只涵蓋一個想法,段與段之間停頓,方便後製精準剪掉失誤片段。
          </li>
        </ul>
        <Callout tone="warn" title="不要做即時除錯直播">
          不要為了展示「完整開發過程」而做真正的即時除錯現場直播——研究顯示 live coding
          不會帶來更好學習成效,卻會拉長錄製時間並增加出錯風險。真正的除錯教學價值,可以用「預先設計好的 bug
          場景+示範如何讀錯誤訊息」的方式重現,兼顧真實感與穩定性。
        </Callout>
        <Callout tone="key" title="這份清單的立場">
          <p>
            這套清單把三份研究筆記中反覆出現的「業界無公開量化基準」缺口(例如練習比例、鉤子秒數、過場語逐字範本),轉化為「選一個站得住腳的預設值並保持一致」的務實立場。
          </p>
          <p>
            因為跨平台共識都指向「一致性與清晰度本身比精確數字更重要」,與其等待不存在的黃金比例,不如先用上述具體規格啟動製作,再依六單元上線後的實際完課率數據迭代調整。
          </p>
        </Callout>
      </Section>

      <Section id="conclusion" title="結論">
        <p>
          這次研究最重要的反直覺發現,是 live coding 作為「展示真實開發過程」的手段,在學習成效上並不比預先寫好的程式碼更好,卻顯著增加錄製時間與風險。
        </p>
        <p>
          這直接挑戰了「開源專案開發範例的價值就在於真實、未經修飾的開發過程」這個預設。onagent
          課程轉製時,「真實感」應該透過敘事手法(講清楚 why、順勢提醒常見錯誤)來營造,而非真正的即時編碼。
        </p>
        <p>另一個值得注意的落差:</p>
        <CardGrid
          items={[
            {
              title: '有一致經驗值',
              body: '「影片多長」「字體多大」「解析度多少」這類可量化的技術規格,業界有高度一致且可直接複用的經驗值。',
            },
            {
              title: '缺乏公開基準',
              body: '「練習佔比」「鉤子具體秒數」「過場語逐字範本」這類更貼近「教學藝術」的問題,始終缺乏公開的量化基準或逐字範本。',
            },
          ]}
        />
        <Callout tone="key" title="對 onagent 而言">
          課程製作團隊在這些領域沒有「標準答案」可抄,必須自行定義一套內部一致的預設值(如本報告清單所列),並用六個單元上線後的實際完課率與觀看留存曲線作為唯一可信的迭代依據,而不是援引不存在的「業界最佳比例」。
        </Callout>
        <SourceList
          sources={[
            { label: 'UBC blog(Guo et al. 2014)', href: SRC.ubc },
            { label: 'IRRODL(Katy Jordan 2015)', href: SRC.irrodl },
            { label: 'IIT dissertation(遊戲化)', href: SRC.iit },
            { label: 'ICER 2023', href: SRC.icer },
            { label: 'UW-Madison LiveCoding.pdf', href: SRC.uwMadison },
            { label: 'SIGCSE 2025', href: SRC.sigcse },
            { label: 'How to egghead: Screencasting', href: SRC.eggheadScreencasting },
          ]}
        />
      </Section>
    </Article>
  )
}
