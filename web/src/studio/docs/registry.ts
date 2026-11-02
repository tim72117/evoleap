// 仍以 Markdown 呈現的文件:跟著程式一起維護的說明(各模組的 README)與工具產生的檔案
// (例如 src/studio/recorder/record.mjs --doc 產生的分鏡腳本),以 ?raw 在建置時讀進 bundle 後登記在這裡。
// 人工撰寫的文章已改寫成 React 頁面,見 src/studio/articles/。
import liveSpec from '../../live/README.md?raw'
import recorderGuide from '../recorder/README.md?raw'

export interface Doc {
  slug: string
  title: string
  source: string
  content: string
}

export const docs: Doc[] = [
  { slug: 'live', title: '即時教學畫面規格', source: 'web/src/live/README.md', content: liveSpec },
  { slug: 'recorder', title: '宣傳影片錄製工具', source: 'web/src/studio/recorder/README.md', content: recorderGuide },
]
