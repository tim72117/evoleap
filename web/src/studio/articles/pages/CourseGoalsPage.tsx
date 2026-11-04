import { Article, Callout, CardGrid, DataTable, Section } from '../Article'

const toc = [
  { id: 'overview', title: '課程標題與描述' },
  { id: 'audience', title: '適合對象' },
  { id: 'outcomes', title: '你可以學到' },
  { id: 'tools', title: '需要準備的工具' },
  { id: 'background', title: '需要具備的背景知識' },
  { id: 'chapters', title: '章節列表' },
]

export function CourseGoalsPage() {
  return (
    <Article slug="course-goals" toc={toc}>
      <Section id="overview" title="課程標題與描述">
        <Callout title="課程標題" tone="key">
          <p>打造你的第一個 AI Agent 整合應用</p>
        </Callout>
        <p>
          跟著真實開源專案，打造一個用自然語言操作的 AI 助理：讓使用者打字問問題，Agent
          自動判讀問題、跑分析、繪製合適的統計圖表，做出一個能上線的整合應用。
        </p>
      </Section>

      <Section id="audience" title="適合對象">
        <p>這堂課適合：</p>
        <CardGrid
          items={[
            {
              title: '前端或全端工程師',
              body: '具備 JavaScript/TypeScript 基礎、想把 LLM 工具呼叫（tool calling）整合進自己產品。',
            },
            {
              title: '想讓 AI 真正動手的開發者',
              body: '想了解 AI Agent 如何「真正動手做事」而不只是聊天機器人。',
            },
            {
              title: '技術主管',
              body: '需要在工作中評估或導入 AI Agent 整合方案。',
            },
            {
              title: '想搞懂底層原理的學員',
              body: '想徹底搞懂工具呼叫（tool calling）的底層原理，學完後能快速為自己的產品打造自然語言驅動介面。',
            },
          ]}
        />
        <Callout title="這堂課較不適合" tone="warn">
          <ul>
            <li>完全沒有 Web 開發經驗、不熟悉 JavaScript 基礎語法的初學者</li>
            <li>想學習 LLM 模型訓練或底層原理的學員（本課程專注在應用整合層，不涉及模型訓練）</li>
          </ul>
        </Callout>
      </Section>

      <Section id="outcomes" title="你可以學到">
        <p>完成這堂課後，你將能夠：</p>
        <CardGrid
          items={[
            {
              title: '自然語言介面',
              body: '把一個操作畫面改造成「打字就能用」的自然語言介面，讓 AI 自動理解使用者的問題、選對工具並執行。',
            },
            {
              title: '工具介面與參數 Schema',
              body: '設計一個 LLM 可呼叫的工具介面，寫出 LLM 能準確理解、正確呼叫的參數 Schema。',
            },
            {
              title: '期末專案',
              body: '最終獨立完成一個涵蓋多種工具類型、並已上線的完整 AI Agent 整合應用。',
            },
            {
              title: '共通設計邏輯',
              body: '掌握工具呼叫的共通設計邏輯，這套能力能直接用來快速打造自然語言驅動的介面，不被單一工具綁住。',
            },
          ]}
        />
      </Section>

      <Section id="tools" title="上課前的準備：需要準備的工具／軟體">
        <Callout>
          <p>本節與下一節目前為草稿。</p>
        </Callout>
        <DataTable
          head={['工具／軟體', '說明']}
          rows={[
            ['電腦與終端機（Terminal）', 'Mac / Windows / Linux 皆可'],
            ['Git', '版本控制'],
            ['Node.js 與 npm', '建議 LTS 版本'],
            ['Docker', '用於部署單元的實作練習'],
            ['程式碼編輯器', '一個可用的程式碼編輯器，建議 VS Code'],
            ['Claude Code', '課程採 Vibe Coding 方式實作，會用 AI 輔助寫程式'],
            ['onagent 帳號與 API key', '課程中會引導註冊'],
          ]}
        />
      </Section>

      <Section id="background" title="上課前的準備：需要具備的背景知識">
        <ul>
          <li>
            熟悉 JavaScript / TypeScript 基本語法與基礎 Web 前端開發（DOM、fetch/WebSocket、npm 套件管理）
          </li>
          <li>會使用終端機與 Git 進行基本版本控制操作</li>
        </ul>
        <Callout tone="key">
          <p>不需要具備機器學習或 LLM 模型訓練相關背景知識。</p>
        </Callout>
      </Section>

      <Section id="chapters" title="章節列表（待規劃）">
        <p>
          章節將對應六單元＋Capstone 架構，尚未依課程架構重新規劃章節與小節。
        </p>
        <Callout title="規劃方向" tone="key">
          <ul>
            <li>聚焦自然語言介面、工具 Schema 設計、Vibe Coding 實作、部署與版本管理 + Capstone。</li>
            <li>說明時聚焦技術概念本身，避免只描述特定平台的操作步驟。</li>
          </ul>
        </Callout>
      </Section>
    </Article>
  )
}
