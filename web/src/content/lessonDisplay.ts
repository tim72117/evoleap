// 單課頁的標題與標籤規則(所有課共用:軟體課、網頁、上線、兒童、Claude Code),畫面與 SEO(seo/pages.ts)用同一份:
// - 標籤(label):軟體課是「序章」「第 N 課」(起步階段 0.N 顯示為第 N 課),其他課是「第 <課號> 課」;放在 kicker、上一課/下一課的連結文字
// - 頁面標題(h1):課名,不含標籤
// - document.title(頁名):`課名｜課程名稱`(lessonDocTitle,SiteLayout / documentTitle 再接上「 · evoleap」)
// - 登入把關的 kicker:`課程名稱 · 標籤`(lessonKicker)
import { lessonLabel } from './catalog'
import { messages } from '../i18n/current'

/** 一課的標籤(目前語言):軟體課是「序章」(0.intro)、「第 N 課」(0.N → N);其他課「第 <課號> 課」(Claude Code 的情境課號 1..7 就是「第 1 課」) */
export function lessonLabelOf(courseSlug: string, lessonId: string): string {
  if (courseSlug === 'software') return lessonLabel({ id: lessonId })
  return messages().courses.lessonN(lessonId)
}

/** 單課頁的 document.title 頁名:`課名｜課程名稱`(給 documentTitle / SiteLayout 的 title)。課程名稱讀資料庫,還沒讀到時只有課名 */
export function lessonDocTitle(lessonTitle: string, courseTitle: string): string {
  return courseTitle ? messages().courses.lesson.docTitle(lessonTitle, courseTitle) : lessonTitle
}

/** 登入把關的 kicker:`課程名稱 · 標籤`;課程名稱還沒讀到時只有標籤 */
export function lessonKicker(courseTitle: string, label: string): string {
  return courseTitle ? `${courseTitle} · ${label}` : label
}
