// 文章(原 docs/ 底下的 Markdown,已改寫成 pages/ 的 React 頁面)的目錄資料。
// 新增文章:在 pages/ 建立頁面元件、在這裡登記 meta、在 routes.tsx 對應元件。
// 順序即 /docs 列表與文章底部「上一篇/下一篇」的順序。

export type ArticleCategory = 'course' | 'research' | 'spec'

export interface ArticleMeta {
  /** 網址路徑 /docs/<slug> */
  slug: string
  title: string
  /** 研發基地第二排標籤的名稱,標題太長時才寫 */
  tab?: string
  category: ArticleCategory
  /** 一兩句摘要,用於列表與文章開頭 */
  summary: string
}

export const CATEGORY_LABEL: Record<ArticleCategory, string> = {
  course: '課程',
  research: '研究',
  spec: '工具與規格',
}

export const articles: ArticleMeta[] = [
  {
    slug: 'course-goals',
    title: '課程目標',
    category: 'course',
    summary: '課程標題、描述、適合對象、學習成果與上課前的準備。',
  },
  {
    slug: 'research-report',
    title: '線上課程設計與影音製作研究報告',
    tab: '研究報告',
    category: 'research',
    summary: '單元顆粒度、練習安排、腳本與錄製方式的研究整理與製作建議。',
  },
  {
    slug: 'research/methodology',
    title: '課程設計方法論',
    category: 'research',
    summary: '影片長度、學習目標寫法與練習比例的研究筆記。',
  },
  {
    slug: 'research/recording',
    title: '影音錄製實務',
    category: 'research',
    summary: '大綱與逐字稿、分段錄製、設備與後製的研究筆記。',
  },
  {
    slug: 'research/video-shotcraft',
    title: '參考案例：video-shotcraft',
    tab: 'video-shotcraft',
    category: 'research',
    summary: '宣傳片製作 skill 的做法整理：鏡頭配方卡、真實介面素材、分層驗收；哪些借用到即時教學畫面、哪些不照搬。',
  },
  {
    slug: 'research/voice-cost',
    title: '旁白語音的費用評估',
    category: 'research',
    summary: 'Gemini TTS 的官方價格與免費層級、依腳本字數估算整套課程旁白的產生與改稿費用，並比較其他 TTS 與真人錄音。',
  },
  {
    slug: 'research/tts-landscape',
    title: '文字轉語音工具現況',
    category: 'research',
    summary: '2026 年商用與開源 TTS 工具的整理（Cartesia、Gemini、ElevenLabs、Qwen3-TTS 等），含對課程旁白的選型建議與資料可信度提醒。',
  },
  {
    slug: 'research/script-template',
    title: '腳本範本結構',
    category: 'research',
    summary: '教學影片腳本的段落結構與範本研究筆記。',
  },
  // 以 Markdown 呈現的文件(內容在 docs/registry.ts,頁面由 docs/DocPage.tsx 用同一個版型畫出)
  {
    slug: 'live',
    title: '即時教學畫面規格',
    category: 'spec',
    summary: '即時教學畫面引擎的規格：播放器外殼、舞台、演員、鏡頭、腳本格式，以及新增演員與驗證的流程。',
  },
  {
    slug: 'recorder',
    title: '宣傳影片錄製工具',
    category: 'spec',
    summary: '用 JSON 分鏡腳本產生畫面並錄成 1080p 影片與字幕的工具：需求、檔案與使用方式。',
  },
]

export function findArticle(slug: string): ArticleMeta {
  const meta = articles.find((a) => a.slug === slug)
  if (!meta) throw new Error(`unknown article slug: ${slug}`)
  return meta
}
