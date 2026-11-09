import type { JSX } from 'react'
import { HomePage } from './HomePage'
import { ClaudeCodeTopicPage } from './ClaudeCodeTopicPage'
import { KidsLessonPage } from './KidsLessonPage'
import { KidsTopicPage } from './KidsTopicPage'
import { LaunchLessonPage } from './LaunchLessonPage'
import { LaunchTopicPage } from './LaunchTopicPage'
import { WebLessonPage } from './WebLessonPage'
import { WebTopicPage } from './WebTopicPage'
import { AiAppsTopicPage, SoftwareTopicPage } from './SoftwareTopicPage'
import { KIDS_OPEN_LESSONS } from '../content/kidsCourse'
import { LAUNCH_LESSON_PAGES, launchLessonPath } from '../content/launchCourse'
import { WEB_OPEN_LESSONS } from '../content/webCourse'
import { AI_APPS_TOPIC, CLAUDE_CODE_TOPIC, KIDS_TOPIC, LAUNCH_TOPIC, SOFTWARE_TOPIC, WEB_TOPIC } from '../content/topics'
import { PageView } from '../courses/guestActivity'
import { SHOWCASE_PATH, ShowcasePage } from './ShowcasePage'

export const homeRoutes: { path: string; element: JSX.Element }[] = [
  // 首頁與課程地圖:訪客打開時記一筆 page:<網址>(PageView,guestActivity.ts),後台串成「從首頁進來的路徑」
  { path: '/', element: <PageView><HomePage /></PageView> },
  { path: SOFTWARE_TOPIC.path, element: <PageView><SoftwareTopicPage /></PageView> },
  { path: AI_APPS_TOPIC.path, element: <PageView><AiAppsTopicPage /></PageView> },
  { path: CLAUDE_CODE_TOPIC.path, element: <PageView><ClaudeCodeTopicPage /></PageView> },
  { path: KIDS_TOPIC.path, element: <PageView><KidsTopicPage /></PageView> },
  // 兒童課已經可以上的課,一課一頁
  ...Object.entries(KIDS_OPEN_LESSONS).map(([id, l]) => ({ path: l.path, element: <KidsLessonPage key={id} id={id} /> })),
  { path: WEB_TOPIC.path, element: <PageView><WebTopicPage /></PageView> },
  // 序章開放中,首頁放在「做出自己的軟體」下方
  { path: LAUNCH_TOPIC.path, element: <PageView><LaunchTopicPage /></PageView> },
  // 有課程頁的課,一課一頁;能不能上、播哪個腳本看課程地圖 API 的 status 與 script,草稿只有管理員進得來
  ...LAUNCH_LESSON_PAGES.map((id) => ({ path: launchLessonPath(id), element: <LaunchLessonPage key={id} id={id} /> })),
  // 展示頁:首頁拿掉的影片預覽,當獨立的行銷頁(站內沒有連結連過來,只列在 sitemap)
  { path: SHOWCASE_PATH, element: <PageView><ShowcasePage /></PageView> },
  // 網頁怎麼運作已經可以上的課,一課一頁
  ...Object.entries(WEB_OPEN_LESSONS).map(([id, l]) => ({ path: l.path, element: <WebLessonPage key={id} id={id} /> })),
]
