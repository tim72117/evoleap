/** 研究文章（/docs/...），各等級頁共用。 */
export const RESEARCH_REFS: { to: string; label: string; note: string }[] = [
  { to: '/docs/research-report', label: '製作研究報告', note: '課程設計、影片錄製、腳本結構的總覽' },
  {
    to: '/docs/research/methodology',
    label: '課程設計方法論',
    note: '粒度：影片 6–9 分、課約 30 分、單元 1–2 小時；早期安排成就感；每單元以實作收尾',
  },
  { to: '/docs/research/script-template', label: '腳本範本結構', note: '寫分鏡與旁白稿時套用' },
  { to: '/docs/research/recording', label: '影音錄製實務', note: '錄製與後製流程' },
  { to: '/docs/research/video-shotcraft', label: '參考案例：video-shotcraft', note: '宣傳片製作方法；即時教學畫面借用與不照搬的部分（非研究結論）' },
  { to: '/docs/research/voice-cost', label: '旁白語音的費用評估', note: 'Gemini TTS 價格與整套課程旁白的產生、改稿費用估算（2026-11-02 查價）' },
  { to: '/docs/course-goals', label: '課程目標（L3）', note: 'L3 的適合對象與先備條件，L2 銜接依據' },
]
