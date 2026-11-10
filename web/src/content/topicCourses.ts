// 主題頁(/topics/<主題>)要列哪些課。
// 主題是一組課程的入口,課程本身在 /courses/<課程> 底下;一個主題列哪些課之後改由演算法決定
// (例如依學員的進度、熱門程度、課程之間的關聯挑選),現在還沒有演算法,pickTopicCourses 先回傳固定的清單。
// 「全部課程」頁(courses/CourseListPage.tsx)也用這裡的課程卡片資料。
import { AI_APPS_TOPIC, CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC, IDEA_TOPIC, KIDS_TOPIC, LAUNCH_TOPIC, SOFTWARE_TOPIC, WEB_TOPIC } from './topics'
import { COURSES, openLessonsOf } from './catalog'
import { KIDS_RELEASED_LESSONS } from './kidsCourse'
import { LAUNCH_OPEN_LESSONS } from './launchCourse'
import { WEB_OPEN_LESSONS } from './webCourse'
import { messages } from '../i18n/current'
import type { Messages } from '../i18n/zh'

/** 有主題頁的主題(/topics/<id>) */
export const TOPIC_IDS = ['software', 'ai-apps', 'web', 'launch', 'kids', 'claude-code', 'idea'] as const
export type TopicId = (typeof TOPIC_IDS)[number]

/** 主題本身:名稱、標語、說明、主題頁網址 */
export interface TopicInfo {
  id: TopicId
  name: string
  slogan: string
  description: string
  /** 主題頁網址(/topics/<id>) */
  path: string
}

/** 主題頁上的一張課程卡片 */
export interface TopicCourse {
  /** 課程的識別(課程地圖 API 的 id) */
  id: string
  title: string
  summary: string
  /** 課程頁(/courses/<id>) */
  path: string
  /** 已開放的數量(「已開放 3 課」);全部規劃中為 null */
  badge: string | null
  /** 還有規劃中的內容 */
  planned: boolean
  /** 課程頁連結的文字 */
  mapLabel: string
}

const topicInfo = (id: TopicId, t: { name: string; slogan: string; description: string; topicPath: string }): TopicInfo => ({
  id,
  name: t.name,
  slogan: t.slogan,
  description: t.description,
  path: t.topicPath,
})

export const TOPICS: Record<TopicId, TopicInfo> = {
  software: topicInfo('software', SOFTWARE_TOPIC),
  'ai-apps': topicInfo('ai-apps', AI_APPS_TOPIC),
  web: topicInfo('web', WEB_TOPIC),
  launch: topicInfo('launch', LAUNCH_TOPIC),
  kids: topicInfo('kids', KIDS_TOPIC),
  'claude-code': topicInfo('claude-code', CLAUDE_CODE_TOPIC),
  idea: topicInfo('idea', IDEA_TOPIC),
}

/** 每一門課的卡片資料;標籤與連結文字照字典 t(課名是課程內容,不翻) */
const software = COURSES.find((c) => c.slug === 'software')
const softwareOpen = software ? openLessonsOf(software).length : 0

export const courseCards = (t: Messages = messages()): Record<TopicId, TopicCourse> => ({
  software: {
    id: 'software',
    title: `${SOFTWARE_TOPIC.name}：從零基礎到做出網站與小工具`,
    summary: SOFTWARE_TOPIC.description,
    path: SOFTWARE_TOPIC.path,
    badge: softwareOpen ? t.courses.list.openN(softwareOpen) : null,
    planned: true,
    mapLabel: t.courses.list.viewContent,
  },
  // 中階、進階都還在規劃中
  'ai-apps': {
    id: 'ai-apps',
    title: `${AI_APPS_TOPIC.name}：讓 AI 查資料、跑分析、畫圖表`,
    summary: AI_APPS_TOPIC.description,
    path: AI_APPS_TOPIC.path,
    badge: null,
    planned: true,
    mapLabel: t.courses.list.viewMap,
  },
  web: {
    id: 'web',
    title: `${WEB_TOPIC.name}：AI 時代的網頁基礎課`,
    summary: WEB_TOPIC.description,
    path: WEB_TOPIC.path,
    badge: t.courses.list.openN(Object.keys(WEB_OPEN_LESSONS).length),
    planned: true,
    mapLabel: t.courses.list.viewMap,
  },
  launch: {
    id: 'launch',
    title: `${LAUNCH_TOPIC.name}：把作品變成服務`,
    summary: LAUNCH_TOPIC.description,
    path: LAUNCH_TOPIC.path,
    badge: t.courses.list.openN(LAUNCH_OPEN_LESSONS.length),
    planned: true,
    mapLabel: t.courses.list.viewMap,
  },
  kids: {
    id: 'kids',
    title: `${KIDS_TOPIC.name}：用積木蓋網頁`,
    summary: KIDS_TOPIC.description,
    path: KIDS_TOPIC.path,
    badge: t.courses.list.openN(KIDS_RELEASED_LESSONS.length),
    planned: true,
    mapLabel: t.courses.list.viewMap,
  },
  'claude-code': {
    id: 'claude-code',
    title: `${CLAUDE_CODE_TOPIC.name}：常見情境與對應做法`,
    summary: CLAUDE_CODE_TOPIC.description,
    path: CLAUDE_CODE_TOPIC.path,
    badge: t.courses.list.demoVideosN(CLAUDE_CODE_SCENARIOS.filter((s) => s.video).length),
    planned: CLAUDE_CODE_SCENARIOS.some((s) => !s.video),
    mapLabel: t.courses.list.viewScenarios,
  },
  // 全部規劃中:沒有「已開放」標籤
  idea: {
    id: 'idea',
    title: `${IDEA_TOPIC.name}：把點子變成做得出來的計畫`,
    summary: IDEA_TOPIC.description,
    path: IDEA_TOPIC.path,
    badge: null,
    planned: true,
    mapLabel: t.courses.list.viewMap,
  },
})

/**
 * 主題頁要列的課,依顯示順序。
 * 之後改由演算法決定;現在還沒有演算法,先固定:每個主題列出同名的那一門課。
 * 換成演算法時只改這個函式,主題頁、SEO 資料都從這裡讀。
 */
export function pickTopicCourses(topic: TopicId, t: Messages = messages()): TopicCourse[] {
  return [courseCards(t)[topic]]
}
