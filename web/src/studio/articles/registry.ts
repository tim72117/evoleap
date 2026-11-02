// 文章(原 docs/ 底下的 Markdown,已改寫成 pages/ 的 React 頁面)的目錄資料。
// 新增文章:在 pages/ 建立頁面元件、在這裡登記 meta、在 routes.tsx 對應元件。
// 順序即 /docs 列表與文章底部「上一篇/下一篇」的順序。

export type ArticleCategory = 'course' | 'research'

export interface ArticleMeta {
  /** 網址路徑 /docs/<slug> */
  slug: string
  title: string
  category: ArticleCategory
  /** 一兩句摘要,用於列表與文章開頭 */
  summary: string
}

export const CATEGORY_LABEL: Record<ArticleCategory, string> = {
  course: '課程',
  research: '研究',
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
    slug: 'research/script-template',
    title: '腳本範本結構',
    category: 'research',
    summary: '教學影片腳本的段落結構與範本研究筆記。',
  },
]

export function findArticle(slug: string): ArticleMeta {
  const meta = articles.find((a) => a.slug === slug)
  if (!meta) throw new Error(`unknown article slug: ${slug}`)
  return meta
}
