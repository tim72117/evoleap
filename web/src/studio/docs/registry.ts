// 仍以 Markdown 呈現的文件:由工具產生、會被重新覆寫的檔案(例如
// tools/video/record.mjs --doc 產生的分鏡腳本),以 ?raw 在建置時讀進 bundle。
// 人工撰寫的文章已改寫成 React 頁面,見 src/studio/articles/。
// Dockerfile 的 web-build 階段需要能讀到這些檔案(見 Dockerfile 的 COPY 說明)。
import fundraisingStoryboard from '../../../../tools/video/scripts/fundraising.storyboard.md?raw'

export interface Doc {
  slug: string
  title: string
  source: string
  content: string
}

export const docs: Doc[] = [
  { slug: 'storyboard/fundraising', title: '分鏡腳本:fundraising', source: 'tools/video/scripts/fundraising.storyboard.md', content: fundraisingStoryboard },
]
