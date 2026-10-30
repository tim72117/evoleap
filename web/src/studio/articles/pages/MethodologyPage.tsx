import { Article, Callout, DataTable, Section } from '../Article'
import { Findings, Gaps, Inferences, Takeaway, type Src } from './ResearchNote'

// 原 docs/research/notes/課程設計方法論.md

const EGGHEAD_REVIEWER: Src = {
  label: 'How to egghead – Reviewer guide',
  href: 'https://howtoegghead-gatsby.netlify.app/create-your-30second-lesson',
}
const COURSERA_MIRROR: Src = {
  label: 'Coursera on-demand structure mirror guide',
  href: 'https://mooctech.net.technion.ac.il/resources/mooc-structure/',
}
const WEB_DEV_V3: Src = {
  label: 'Complete Intro to Web Dev v3',
  href: 'https://btholt.github.io/complete-intro-to-web-dev-v3',
}
const UCL_BLOG = 'https://blog.ble.ac.uk/2021/04/the-curious-case-of-long-videos-how.html'
const SOUTH_ALABAMA = 'https://hoasen.edu.vn/dbclkt/en/writing-learning-objectives-using-blooms-taxonomy-2'

const toc = [
  { id: 'units', title: '單元拆分邏輯' },
  { id: 'objectives', title: '學習目標的寫法' },
  { id: 'practice', title: '實作練習的比例' },
  { id: 'assessment', title: '知識檢核機制' },
  { id: 'engagement', title: '完成率與參與度' },
]

export function MethodologyPage() {
  return (
    <Article slug="research/methodology" toc={toc}>
      <p>
        本篇整理 Udemy、Coursera、Pluralsight、Frontend Masters、egghead.io 等線上技術課程平台的課程設計方法論,
        以及相關的學習科學研究。每個主題依序列出重點摘要、附來源的研究發現、由此推得的看法,以及目前沒有找到資料的缺口。
      </p>

      <Section id="units" title="單元拆分邏輯:長度、數量、拆分依據">
        <Takeaway>
          各平台在「單元有多長」上有頗一致的經驗值區間:單一影片/lecture 約 2–10 分鐘(egghead.io 最極致,1–10 分鐘;Udemy
          社群建議 3–8 分鐘;Coursera 舊版範本建議 6–9 分鐘),而更高層的「lesson」則約 30 分鐘、「module」約 1–2
          小時學習時間。拆分依據普遍是「技能/主題的自然斷點」而非固定時長,但時長上限明顯受學習科學(注意力/認知負荷)影響。
        </Takeaway>

        <DataTable
          head={['層級', '建議長度', '對應內容', '依據']}
          rows={[
            ['影片 / lecture', '2–10 分鐘', '一個概念', 'egghead.io 1–10 分鐘;Udemy 社群 2–6、3–7 分鐘;研究建議 6–9 分鐘'],
            ['lesson', '約 30 分鐘', '一個可操作技能', 'Coursera:數支影片 + 至少一個測驗收尾'],
            ['module', '1–2 小時', '一群相關技能/主題', 'Coursera:多數含 2–3 個 lesson,以 review quiz 結尾'],
          ]}
        />

        <Findings
          items={[
            {
              text: 'egghead.io 官方指南:每個 lesson 是單一螢幕錄影,長度 1–10 分鐘,原則是「一次只講一個想法(one thought at a time)」。',
              src: [EGGHEAD_REVIEWER],
            },
            {
              text: 'egghead 講師部落格描述自己錄製的 100 支教學影片,長度大致落在 1–5 分鐘。',
              src: [{ label: 'DEV Community', href: 'https://dev.to/tlakomy/recording-100-bite-sized-screencasts-lessons-learned-40l0' }],
            },
            {
              text: 'Udemy 社群(2020 年版主回覆):lecture 長度約 2–6 分鐘,非強制規定;其他社群成員建議 3–7 分鐘。',
              src: [{ label: 'Udemy Community', href: 'https://community.udemy.com/en/discussion/158806/what-is-the-minimun-lenght-of-a-lesson' }],
            },
            {
              text: 'Udemy 官方最低門檻(社群版主說明):課程至少 30 分鐘影片內容、至少 5 個 lecture。',
              src: [
                {
                  label: 'Udemy Community thread',
                  href: 'https://community.udemy.com/t5/First-time-course-creation/Number-of-lectures-per-section/m-p/22783',
                },
              ],
            },
            {
              text: 'Udemy 課程規劃經驗分享:以約 8 分鐘一個 lecture 來估算湊出約 1 小時內容;課程結構建議為 Section(主題分組)+ Lecture(單一概念),依「intro → core content → conclusion」排列。',
              src: [
                {
                  label: 'Udemy Community: guide about lecture and section',
                  href: 'https://community.udemy.com/en/discussion/134392/guide-about-lecture-and-section',
                },
              ],
            },
            {
              text: 'Udemy 平台技術上限:單課程最多 1,400 個 curriculum items(lecture/quiz/exercise 等),最多 800 個可同時發佈。',
              src: [
                {
                  label: 'Udemy Community guide',
                  href: 'https://community.udemy.com/t5/First-time-Course-Creation/Guide-about-lecture-and-section/m-p/134397',
                },
              ],
            },
            {
              text: 'Coursera on-demand 課程結構(經二手鏡像文件引用的官方指南):一個 lesson 應讓學習者花約 30 分鐘完成,內含數支影片 + 至少一個測驗(通常是 quiz)收尾;module 長度彈性,多數現有課程的 module 包含 2–3 個 lesson,但也有短至 1–2 個、長至 6 個以上的案例;每個 module 規劃學習時間約 1–2 小時,並以一個「review quiz」lesson 結尾。',
              src: [COURSERA_MIRROR],
            },
            {
              text: '2016 年明尼蘇達大學幻燈片(引用 Coursera 規劃範本,較舊、可能已過時):module 建議 3–5 個 lesson,每個 lesson 含 3–5 支講課影片,單支影片目標 6–9 分鐘,並每 5–7 分鐘影片內至少插入一次互動問題。',
              src: [
                {
                  label: 'University of Minnesota slide deck',
                  href: 'https://pubs.lib.umn.edu/index.php/mslt/article/download/735/739/976',
                },
              ],
            },
            {
              text: 'Pluralsight 官方 Author Audition Guide:試鏡影片長度須在 6–8 分鐘之間,10 分鐘為上限;明確規定「為其他用途錄製的影片內容不接受」——但此規則適用於試鏡片段,非正式課程 module 的官方長度規範。',
              src: [{ label: 'Pluralsight Author Audition Guide', href: 'https://learn.pluralsight.com/authors/auditions' }],
            },
            {
              text: 'Frontend Masters「Complete Intro to Web Dev v3」(Brian Holt)實際課程結構案例:依技術主題分大章(HTML → CSS → JavaScript),每個主題後接一個對應專案練習;最後涵蓋伺服器互動(JSON/AJAX/async-await)、第三方套件、Git/GitHub、後續學習方向。',
              src: [WEB_DEV_V3],
            },
            {
              text: 'Frontend Masters「Complete Intro to React v8」案例:課程分 7 個 syllabus 區段(Introduction、Vanilla React、JS Tools、Core React Concepts、React Capabilities、Special Case React Tools、End of Intro),整堂課圍繞一個完整應用程式(寵物領養瀏覽 app)逐步串接 React 生態工具(Parcel、ESLint、TailwindCSS、React Router)。',
              src: [{ label: 'Class Central listing', href: 'https://classcentral.com/course/independent-complete-intro-to-react-v7-110382' }],
            },
            {
              text: '學術研究建議(UCL 部落格引用 Guo et al. 2014 與 Brame 2016):最佳觀看時長落在 6–9 分鐘,理由涉及認知負荷理論。',
              src: [{ label: 'UCL/ALT blog: The curious case of long videos', href: UCL_BLOG }],
            },
            {
              text: '威斯康辛大學研究:學生明顯偏好 15 分鐘以下的影片片段。',
              src: [{ label: 'UCL/ALT blog citing Wisconsin study', href: UCL_BLOG }],
            },
          ]}
        />

        <Inferences
          items={[
            '業界的「grain size」邏輯是三層結構:影片/lecture(最小單位,2–10 分鐘,對應「一個概念」)→ lesson(約 30 分鐘,對應「一個可操作技能」)→ module(1–2 小時,對應「一群相關技能/主題」),這與把一個開源專案拆成課程時「單一功能 PR = 一個 lesson、單一模組/feature = 一個 module」的直覺相符。',
            '拆分依據本質上是「內容的自然斷點(natural divisions)」而非機械式的固定時長,但平台/研究給出的時長範圍(尤其 6–10 分鐘的影片上限)反映的是學習科學的注意力限制,不是純粹美學偏好——這點在把長篇開發 walkthrough 轉製成課程時特別重要,建議主動在自然的「概念邊界」處切割,而不是錄完一次性長影片再硬切。',
          ]}
        />

        <Gaps
          items={[
            '沒有找到 Coursera 現行(2024–2026)官方 Educator Resource Center 的第一手文件,上述 Coursera 數據來自二手鏡像頁面,可能已過時。',
            '沒有找到 Pluralsight 正式發布的「課程模組」(非試鏡影片)長度規範文件。',
            '沒有找到 egghead.io 或 Frontend Masters 關於「課程應拆成幾個 module/lesson」的量化官方建議(只有單支影片長度規範)。',
          ]}
        />
      </Section>

      <Section id="objectives" title="學習目標(learning objectives)的設計方式">
        <Takeaway>
          業界慣用句型「By the end of this lesson/course, you will/should be able to...」搭配 Bloom's taxonomy
          動詞分級,是教學設計(instructional design)的標準做法,並常見於課程大綱與個別 lesson 頁面;Coursera
          官方結構建議每個 lesson 圍繞 1–2 個清楚的 learning objective。
        </Takeaway>

        <Findings
          items={[
            {
              text: "Bloom's 修訂版分類(2001)共六個認知層級:Remember、Understand、Apply、Analyze、Evaluate、Create,教學設計者應依目標能力層級挑選對應動詞。",
              src: [{ label: 'University of South Alabama teaching page', href: SOUTH_ALABAMA }],
            },
            {
              text: '一個好的 learning objective 應包含三部分(Mager 模型):performance(可觀察的行為)、conditions(情境/限制)、criterion(達成標準),皆須是可測量的。',
              src: [{ label: 'University of South Alabama', href: SOUTH_ALABAMA }],
            },
            {
              text: "Bloom's taxonomy 契合「constructive alignment」與「backward design」方法論:先定義目標,再反推教學活動與評量設計。",
              src: [
                {
                  label: 'University of Strathclyde course design page',
                  href: 'https://pureportal.strath.ac.uk/en/publications/course-design-2-writing-effective-learning-objectives/',
                },
              ],
            },
            {
              text: '實際程式設計課程 lesson 頁面案例:開頭即寫「By the end of this lesson, you will be able to」,接著列出具體、可操作的技能(例如解釋 programming 的本質、熟悉課程架構),並標註 Estimated Time(30 分鐘);該課程固定每個 lesson 遵循「目標 → 概念講解 → 程式碼比較 → 練習 → 測驗 → 總結」的格式。',
              src: [{ label: 'Lesson 01 page', href: 'https://rays-programming.netlify.app/lesson_01' }],
            },
            {
              text: 'Coursera on-demand 課程結構官方做法(經鏡像文件引用):每個 lesson 圍繞 1–2 個明確的 learning objective 設計。',
              src: [{ ...COURSERA_MIRROR, label: 'Coursera structure mirror guide' }],
            },
            {
              text: 'Cambridge 電腦科學課程大綱用語範例:「By the end of the course students should...」接著列出具體、可觀察的能力(例如「understand how to break a programming task into a collection of functions」)。',
              src: [{ label: 'Cambridge CST course page', href: 'https://www.cl.cam.ac.uk/DeptInfo/CST00/node15.html' }],
            },
          ]}
        />

        <Inferences
          items={[
            "將開源專案的開發歷程轉製成課程時,每個 lesson 的 objective 宜對應到「一個具體、可驗證的技能」(例如「能夠為這個 API endpoint 寫出一個通過測試的實作」),而非抽象描述,並盡量採用 Bloom's「Apply/Create」層級的動詞(implement、build、debug、refactor),因為程式設計課程的實作本質偏向應用與創造層級,而非單純記憶/理解。",
          ]}
        />

        <Gaps
          items={[
            '沒有找到 Udemy、Pluralsight、Frontend Masters、egghead.io 官方對 learning objective 撰寫格式的具體規範文件(只找到 Coursera 的間接引用與通用教學設計資源)。',
            '沒有找到技術課程平台公開比較「寫了 learning objectives 的課程」與「沒寫的課程」在完成率/滿意度上的差異數據。',
          ]}
        />
      </Section>

      <Section id="practice" title="實作練習(hands-on lab / coding exercise)的安排比例">
        <Callout tone="warn" title="重點摘要:沒有找到官方比例">
          <p>
            沒有找到任何平台公開的「影片講解 vs. 動手練習」官方比例建議;可得的資料僅描述功能存在(Udemy 支援多語言 coding
            exercise、Frontend Masters 課程普遍包含手把手練習與真實專案),缺乏量化業界基準。
          </p>
        </Callout>

        <Findings
          items={[
            {
              text: 'Udemy 支援在課程中加入 coding exercise,涵蓋 C++、C#、Java、Python、Ruby、Swift、Web Development、PHP 等多種語言。',
              src: [{ label: 'Udemy support article', href: 'https://support.udemy.com/hc/articles/115002883587' }],
            },
            {
              text: 'Udemy 社群實務分享:一種常見做法是每個 section 固定包含「intro lecture → content lectures → quiz → workshop screencast」,即每個主題單元都搭配一個實作型的收尾練習。',
              src: [
                {
                  label: 'Udemy Community',
                  href: 'https://community.udemy.com/en/discussion/88021/everything-you-wanted-to-know-about-creating-a-course-on-udemy',
                },
              ],
            },
            {
              text: 'Udemy 教學心得:建議在課程「早期」就安排一個高產出感的練習,讓學員快速應用概念並產生成就感,同時建議刪減早期內容讓學員更快抵達核心練習。',
              src: [
                {
                  label: 'Udemy tips course reference',
                  href: 'https://course-careers-edge.pages.dev/teaching-courses/40-tips-on-making-a-great-online-course',
                },
              ],
            },
            {
              text: 'Frontend Masters 課程普遍被描述為「錄製的工作坊」,內含手把手 coding exercises 與真實專案範例,由產業實務工作者(如 Brian Holt、Kyle Simpson)授課,但沒有量化影片與練習的時間佔比。',
              src: [
                {
                  label: 'javarevisited blog review',
                  href: 'https://javarevisited.blogspot.com/2026/04/should-you-join-frontend-masters-to-learn-web-development.html',
                },
              ],
            },
            {
              text: 'Frontend Masters「Complete Intro to Web Dev v3」實際案例:每講完一個技術主題(HTML、CSS、JavaScript)後緊接一個對應的實作專案。',
              src: [WEB_DEV_V3],
            },
            {
              text: 'egghead.io 的 lesson 本質就是「螢幕錄影、邊講邊示範程式碼範例」,教學格式本身已高度貼近實作示範(而非純理論講解),強調 practice-ready。',
              src: [{ ...EGGHEAD_REVIEWER, label: 'How to egghead guide' }],
            },
          ]}
        />

        <Inferences
          items={[
            '業界缺乏明確比例基準,但從功能設計與實務分享可推論:技術課程傾向「短講解 + 立即動手」交替(而非長段落講解後才練習),且在課程早期就安排一次有成就感的實作,以提升初期參與度與留存——這點與下文「前兩週是關鍵參與期」的研究發現相呼應。',
          ]}
        />

        <Gaps
          items={[
            '沒有找到任何平台或研究提供「影片講解 vs. 動手練習」的具體時間/內容佔比建議值(例如「70% 練習 30% 講解」這類具體數字)。',
            '沒有找到 egghead.io 或 Pluralsight 官方對單堂課程內練習比例的說明文件。',
          ]}
        />
      </Section>

      <Section id="assessment" title="知識檢核機制:quiz、checklist、code review、作業批改">
        <Takeaway>
          Coursera 官方結構明確要求每個 lesson 以 quiz 收尾、每個 module 以 review quiz 收尾;程式設計類 MOOC
          普遍採用「同儕程式碼審查(peer code review)+ 詳細 rubric + 校準練習(calibration
          exercise)」來處理人工批改規模化的問題,但研究顯示同儕評分在大規模、重複提交下可能出現可靠性問題。
        </Takeaway>

        <Findings
          items={[
            {
              text: 'Coursera on-demand 課程結構(鏡像文件):每個 lesson 必須包含至少一個 assessment(通常是 quiz)作結尾;每個 module 應包含一個「comprehensive review quiz」,可以獨立做成一個「review」lesson。',
              src: [{ ...COURSERA_MIRROR, label: 'Coursera structure mirror guide' }],
            },
            {
              text: 'edX 程式設計 MOOC(IMTx 課程)實務做法:學員正式進行同儕互評前,先讓他們對一份「教師製作的範例作業」進行評分練習(校準),並附上正確評分供對照;評分依據詳細的評量規準(rubric)執行。',
              src: [
                {
                  label: 'edX course page',
                  href: 'https://courses.edx.org/courses/course-v1:IMTx+DMx102+2T2018/622e87c1e3c844d8b98ee475524eeded/',
                },
              ],
            },
            {
              text: '程式設計 MOOC 同儕評分工具研究(Wei & Wu, 2015):將學員提交的程式碼拆成較小片段,把相似片段分組讓評審者看到相關程式碼,並用隨機分配平衡評審工作量。',
              src: [
                {
                  label: 'Springer: A peer grading tool for MOOCs on programming',
                  href: 'https://www.springerprofessional.de/a-peer-grading-tool-for-moocs-on-programming/4401686',
                },
              ],
            },
            {
              text: '大規模同儕評分可靠性研究(Wang et al., 2021,連結 GitHub commits 與 MOOC 成績):大規模同儕評分分數變異度高,且分數隨重複提交次數平均上升,分數變化與實際程式碼變更的關聯並不緊密——意味著同儕評分系統可能被「多次提交」策略性地拉高分數而非反映真實進步。',
              src: [{ label: 'arXiv paper', href: 'https://ar5iv.labs.arxiv.org/html/2104.12555' }],
            },
            {
              text: '評量規準(rubric)研究(University of Glasgow):使用 rubric 的同儕評量比沒有 rubric 時更具效度與信度,rubric 讓評量標準更明確,有助於學習。',
              src: [{ label: 'Glasgow eprints repository', href: 'https://eprints.gla.ac.uk/282464/2/282464.pdf' }],
            },
            {
              text: '大學程式設計課程同儕評量比較研究(非 MOOC,arXiv 2505.22093):針對遊戲專案的同儕互評與教師評分相比,可達到中等程度的一致性,顯示同儕評量可部分近似教師評分。',
              src: [{ label: 'arXiv 2505.22093', href: 'https://arxiv.org/pdf/2505.22093v1' }],
            },
          ]}
        />

        <Inferences
          items={[
            <>
              把開源專案開發過程轉為課程時,若要設計「作業」,應考慮:
              <ol>
                <li>用自動化測試(unit test/CI 風格的 autograder)取代人工批改以提高規模化與一致性;</li>
                <li>若無法自動化而必須用同儕審查,務必搭配明確 rubric 與「校準練習」以降低評分噪音;</li>
                <li>避免僅靠「多次提交次數」作為進步指標,因為研究顯示此指標可能失真。</li>
              </ol>
            </>,
          ]}
        />

        <Gaps
          items={[
            '沒有找到 Udemy、Pluralsight、Frontend Masters、egghead.io 官方公開說明各自的知識檢核機制設計準則(例如 quiz 題數、checklist 使用方式)。',
            '沒有找到技術課程平台公開比較「自動化測試批改」vs.「同儕審查」vs.「無檢核」三種方式對學習效果影響的研究。',
          ]}
        />
      </Section>

      <Section id="engagement" title="維持完成率(completion rate)與參與度(engagement)的技巧">
        <Takeaway>
          最受研究支持的發現是:影片長度是參與度的最強預測因子(6 分鐘左右的中位觀看時長,建議影片切在 6–9 分鐘內),且課程開頭(前
          1–2 週)是留存的關鍵期;至於進度條與徽章等遊戲化機制,證據較弱且混雜——進度條在「導航/總覽」上有正面評價,但對實際完成率的影響難以量化,徽章的效果因人而異。
        </Takeaway>

        <DataTable
          head={['研究', '樣本', '主要數字']}
          rows={[
            ['Guo, Kim & Rubin (2014)', 'edX 四門 MOOC,690 萬次影片觀看', '中位數觀看時長約 6 分鐘'],
            ['Katy Jordan (2015)', '221 個 MOOC', '完成率中位數 12.6%(範圍 0.7%–52.1%)'],
            ['i-jim 期刊資料驅動研究', '逾 5,000 筆學員紀錄', '互動內容參與度與較高完成率顯著相關'],
          ]}
        />

        <Findings
          items={[
            {
              text: 'Guo, Kim & Rubin (2014),ACM Learning@Scale 論文,分析 edX 四門 MOOC 共 690 萬次影片觀看紀錄:影片長度是「目前所知對參與度最顯著的指標」,不論影片多長,學員的中位數觀看時長都落在約 6 分鐘,因此建議影片切成 6 分鐘以下的片段。',
              src: [
                { label: 'UBC blog summary', href: 'https://blogs.ubc.ca/videolearninghub/?p=569' },
                {
                  label: '原始論文 PDF(cs.rochester.edu)',
                  href: 'https://www.cs.rochester.edu/hci/pubs/pdfs/edX-MOOC-video-production-and-engagement_LAS-2014.pdf',
                },
              ],
            },
            {
              text: '同一研究其他發現:教師親自出鏡講解(talking-head)或可汗學院式手寫平板教學,都比純投影片更能提升參與度;教師語速較快、情緒較高昂時參與度較高;錄製精良的課堂講座被剪成 MOOC 片段後,參與度反而不如專為線上設計的影片。',
              src: [{ label: 'CUHK summary of Guo et al.', href: 'https://eddatax.fed.cuhk.edu.hk/?p=641' }],
            },
            {
              text: 'Katy Jordan (2015),IRRODL,分析 221 個 MOOC:完成率中位數僅 12.6%(範圍 0.7%–52.1%);課程時間越長,完成率越低;僅採用「自動評分測驗」(不含人工/同儕評分)的課程完成率較高;課程開始的第一、第二週對培養學員參與度至關重要。',
              src: [{ label: 'IRRODL paper', href: 'https://www.irrodl.org/index.php/irrodl/article/view/2112/3364' }],
            },
            {
              text: '一項涵蓋逾 5,000 筆學員紀錄的資料驅動研究(International Journal of Interactive Mobile Technologies):互動內容的參與度(特別是影片觀看與測驗參與)與較高的課程完成率顯著相關。',
              src: [{ label: 'i-jim journal article', href: 'https://online-journals.org/index.php/i-jim/article/view/58599' }],
            },
            {
              text: '進度條(progress bar)的使用者研究(Stockholm University 多個教學專案):進度條有助於學員在內容豐富的線上課程中掌握自身所在位置,但對實際完成率的影響「很難估計」,且不同學員需要的視覺化程度不同。',
              src: [{ label: 'Scribd/academic summary', href: 'https://www.scribd.com/document/498543670/b-Over-Mann-2018' }],
            },
            {
              text: '徽章(badge)的 Moodle 案例研究:學員認為獲得徽章像是講師給予的認可,但進度條比徽章獲得更一致的正面評價。',
              src: [
                {
                  label: 'educationaltechnologyjournal.springeropen.com table',
                  href: 'https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-018-0107-0/tables/1',
                },
              ],
            },
            {
              text: '徽章實驗研究(IIT 博士論文):主要假設未獲支持(即徽章對學習動機的整體效果未被證實),但發現徽章與學習目標取向(learning goal orientation)之間存在有意義的交互作用,顯示徽章可能有助於提升特定學員的自我效能感——效果因人而異,非普遍有效。',
              src: [
                {
                  label: 'IIT repository dissertation',
                  href: 'https://repository.iit.edu/islandora/object/islandora%3A1000826/datastream/DC/download',
                },
              ],
            },
          ]}
        />

        <Callout tone="key" title="推論:參與度的關鍵槓桿">
          <p>把開源專案開發範例轉製成課程時,維持參與度的關鍵槓桿應優先放在:</p>
          <ol>
            <li>嚴格控制單支影片長度在 6–9 分鐘內(而非依賴徽章/進度條等外加遊戲化機制);</li>
            <li>特別打磨課程「開頭 1–2 週」對應的內容與練習,因為這是留存的關鍵窗口;</li>
            <li>盡量採用自動評分測驗/練習而非純人工批改,因為研究顯示這與較高完成率相關。</li>
          </ol>
          <p>
            徽章、進度條類遊戲化機制的證據強度明顯弱於「影片長度」與「自動評分」兩項,不應作為課程設計的主力策略,僅可作為輔助、低成本的錦上添花。
          </p>
        </Callout>

        <Gaps
          items={[
            '沒有找到 Udemy、Pluralsight、Frontend Masters、egghead.io 各自公開揭露的完成率數據或 A/B 測試結果(Coursera 的 5–15%/25–40% 完成率數字僅為二手部落格引用,未找到 Coursera 原始報告佐證,不列入研究發現)。',
            '沒有找到「社群功能(討論區、同儕群組)」對技術課程完成率影響的可靠量化研究,僅有零散的廠商部落格宣稱,證據不足採信。',
            '「里程碑(milestone)」機制作為獨立變項對完成率的影響,沒有找到可靠的學術或平台一手資料。',
          ]}
        />
      </Section>
    </Article>
  )
}
