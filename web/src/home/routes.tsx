import type { JSX } from 'react'
import { HomePage } from './HomePage'
import { lazyPage } from '../site/lazyPage'
import { SHOWCASE_PATH } from './paths'
import { AiAppsTopicPage, SoftwareTopicPage } from './SoftwareTopicPage'
import { COURSES, coursePath } from '../content/catalog'
import { LessonRoute } from '../courses/LessonRoute'
import { AI_APPS_TOPIC, SOFTWARE_TOPIC } from '../content/topics'
import { PageView } from '../courses/guestActivity'

// 有播放器的頁面(課程頁、展示頁)用到才下載:舞台引擎與演員(src/live)不放進首頁、課程地圖就要下載的主程式
const KidsLessonPage = lazyPage(() => import('./KidsLessonPage').then((m) => m.KidsLessonPage))
const LaunchLessonPage = lazyPage(() => import('./TopicScenePage').then((m) => m.LaunchLessonPage))
const ClaudeCodeLessonPage = lazyPage(() => import('./ClaudeCodeLessonPage').then((m) => m.ClaudeCodeLessonPage))
const WebLessonPage = lazyPage(() => import('./TopicScenePage').then((m) => m.WebLessonPage))
const ShowcasePage = lazyPage(() => import('./ShowcasePage').then((m) => m.ShowcasePage))

/** 一門課的單課路由 /courses/<課程>/:lesson:哪一課照課程地圖(LessonRoute),版型照課程 */
function lessonRoute(slug: string, render: (id: string) => JSX.Element): { path: string; element: JSX.Element } {
  const course = COURSES.find((c) => c.slug === slug)!
  return { path: `${coursePath(course)}/:lesson`, element: <LessonRoute course={course} render={render} /> }
}

export const homeRoutes: { path: string; element: JSX.Element }[] = [
  // 首頁與課程地圖:訪客打開時記一筆 page:<網址>(PageView,guestActivity.ts),後台串成「從首頁進來的路徑」
  { path: '/', element: <PageView><HomePage /></PageView> },
  { path: SOFTWARE_TOPIC.path, element: <PageView><SoftwareTopicPage /></PageView> },
  { path: AI_APPS_TOPIC.path, element: <PageView><AiAppsTopicPage /></PageView> },
  // 單課頁(課程總覽頁 /courses/<課程> 由 courses/routes.tsx 的 catalog 產生,和其他課共用);能不能上、播哪個腳本看課程地圖 API,草稿只有管理員進得來
  lessonRoute('kids', (id) => <KidsLessonPage id={id} />),
  lessonRoute('launch', (id) => <LaunchLessonPage id={id} />),
  // 展示頁:首頁拿掉的影片預覽,當獨立的行銷頁(站內沒有連結連過來,只列在 sitemap)
  { path: SHOWCASE_PATH, element: <PageView><ShowcasePage /></PageView> },
  lessonRoute('claude-code', (id) => <ClaudeCodeLessonPage id={id} />),
  lessonRoute('web', (id) => <WebLessonPage id={id} />),
]
