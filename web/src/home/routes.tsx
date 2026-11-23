import type { JSX } from 'react'
import { HomePage } from './HomePage'
import { lazyPage } from '../site/lazyPage'
import { SHOWCASE_PATH } from './paths'
import { AiAppsTopicPage, SoftwareTopicPage } from './SoftwareTopicPage'
import { KIDS_LESSON_PAGES } from '../content/kidsCourse'
import { LAUNCH_LESSON_PAGES, launchLessonPath } from '../content/launchCourse'
import { WEB_LESSON_PAGES } from '../content/webCourse'
import { AI_APPS_TOPIC, CLAUDE_CODE_LESSON_PAGES, SOFTWARE_TOPIC } from '../content/topics'
import { PageView } from '../courses/guestActivity'

// 有播放器的頁面(課程頁、展示頁)用到才下載:舞台引擎與演員(src/live)不放進首頁、課程地圖就要下載的主程式
const KidsLessonPage = lazyPage(() => import('./KidsLessonPage').then((m) => m.KidsLessonPage))
const LaunchLessonPage = lazyPage(() => import('./TopicScenePage').then((m) => m.LaunchLessonPage))
const ClaudeCodeLessonPage = lazyPage(() => import('./ClaudeCodeLessonPage').then((m) => m.ClaudeCodeLessonPage))
const WebLessonPage = lazyPage(() => import('./TopicScenePage').then((m) => m.WebLessonPage))
const ShowcasePage = lazyPage(() => import('./ShowcasePage').then((m) => m.ShowcasePage))

export const homeRoutes: { path: string; element: JSX.Element }[] = [
  // 首頁與課程地圖:訪客打開時記一筆 page:<網址>(PageView,guestActivity.ts),後台串成「從首頁進來的路徑」
  { path: '/', element: <PageView><HomePage /></PageView> },
  { path: SOFTWARE_TOPIC.path, element: <PageView><SoftwareTopicPage /></PageView> },
  { path: AI_APPS_TOPIC.path, element: <PageView><AiAppsTopicPage /></PageView> },
  // 兒童課已經可以上的課,一課一頁
  ...Object.entries(KIDS_LESSON_PAGES).map(([id, l]) => ({ path: l.path, element: <KidsLessonPage key={id} id={id} /> })),
  // 從做好到上線的課程總覽頁 /courses/launch 由 courses/routes.tsx 的 catalog 產生(和其他課共用)。
  // 有課程頁的課,一課一頁;能不能上、播哪個腳本看課程地圖 API 的 status 與 script,草稿只有管理員進得來
  ...LAUNCH_LESSON_PAGES.map((id) => ({ path: launchLessonPath(id), element: <LaunchLessonPage key={id} id={id} /> })),
  // 展示頁:首頁拿掉的影片預覽,當獨立的行銷頁(站內沒有連結連過來,只列在 sitemap)
  { path: SHOWCASE_PATH, element: <PageView><ShowcasePage /></PageView> },
  // Claude Code 工作術有示範影片的情境,一個情境一頁(總覽頁 /courses/claude-code 同樣由 catalog 產生)
  ...Object.entries(CLAUDE_CODE_LESSON_PAGES).map(([id, l]) => ({ path: l.path, element: <ClaudeCodeLessonPage key={id} id={id} /> })),
  // 網頁怎麼運作已經可以上的課,一課一頁(課程總覽頁 /courses/web 由 courses/routes.tsx 的 catalog 產生,和其他課共用)
  ...Object.entries(WEB_LESSON_PAGES).map(([id, l]) => ({ path: l.path, element: <WebLessonPage key={id} id={id} /> })),
]
