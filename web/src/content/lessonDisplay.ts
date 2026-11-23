// 單課頁的標題與標籤規則(所有課共用:軟體課、網頁、上線、兒童、Claude Code),畫面與 SEO(seo/pages.ts)用同一份:
// - 標籤(label):軟體課是「序章」「第 N 課」(起步階段 0.N 顯示為第 N 課),其他課是「第 <課號> 課」;放在 kicker、上一課/下一課的連結文字
// - 頁面標題(h1):課名,不含標籤
// - document.title(頁名):`課名｜課程名稱`(lessonDocTitle,SiteLayout / documentTitle 再接上「 · evoleap」)
// - 登入把關的 kicker:`課程名稱 · 標籤`(lessonKicker)
import { COURSES, lessonLabel } from './catalog'
import { messages } from '../i18n/current'

/** 一課的標籤(目前語言):軟體課是「序章」(0.intro)、「第 N 課」(0.N → N);其他課「第 <課號> 課」(Claude Code 的情境課號 1..7 就是「第 1 課」) */
export function lessonLabelOf(courseSlug: string, lessonId: string): string {
  if (courseSlug === 'software') return lessonLabel({ id: lessonId })
  return messages().courses.lessonN(lessonId)
}

/** 課程名稱(課程目錄 / 種子的 course.title);不認得的課用 slug */
export function courseTitleOf(courseSlug: string): string {
  return COURSES.find((c) => c.slug === courseSlug)?.title ?? courseSlug
}

/** 單課頁的 document.title 頁名:`課名｜課程名稱`(給 documentTitle / SiteLayout 的 title;seo/pages.ts 用同一個函式) */
export function lessonDocTitle(lessonTitle: string, courseTitle: string): string {
  return messages().courses.lesson.docTitle(lessonTitle, courseTitle)
}

/** 登入把關的 kicker:`課程名稱 · 標籤` */
export function lessonKicker(courseTitle: string, label: string): string {
  return `${courseTitle} · ${label}`
}
