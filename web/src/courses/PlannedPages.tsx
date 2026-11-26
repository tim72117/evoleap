import { Link } from 'react-router-dom'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { coursePath, lessonUrl, plannedChapterPath, type Course, type PlannedChapter } from '../content/catalog'
import styles from './Lesson.module.css'
import { topicPathOfCourse } from '../content/topics'

// 規劃中的章節頁：只有標題與簡述，內容完成後章節改成單課頁(InteractiveLessonPage)。課程總覽一律是 CourseOverviewPage(照資料庫的課程地圖)。

/** 章節頁網址:有課號的章節(軟體課的種子課)用單課網址規則,其他是 /courses/<課>/<slug> */
const chapterLink = (course: Course, ch: PlannedChapter) => (ch.id ? lessonUrl(course.slug, ch.id) : plannedChapterPath(course, ch))

function Crumb({ course, chapter, current }: { course: Course; chapter: PlannedChapter; current?: string }) {
  const t = useT()
  const level = t.courses.levelName(chapter.level ?? course.level ?? '')
  return (
    <nav className={styles.crumb} aria-label={t.courses.breadcrumb}>
      <Link to={`${topicPathOfCourse(coursePath(course))}#map`}>{t.courses.courseMap}</Link>
      <span aria-hidden="true"> / </span>
      {current ? <Link to={coursePath(course)}>{level}</Link> : <span>{level}</span>}
      {current && (
        <>
          <span aria-hidden="true"> / </span>
          <span>{current}</span>
        </>
      )}
    </nav>
  )
}

/** siblings:前後章節的清單(軟體課是同單元規劃中的課,進階課是各單元) */
export function PlannedChapterPage({ course, chapter, siblings }: { course: Course; chapter: PlannedChapter; siblings: PlannedChapter[] }) {
  const all = siblings
  const i = all.indexOf(chapter)
  // 不在規劃清單裡的章節(草稿的課給沒權限的人看的替代頁):前後都連回課程總覽
  const prev = i >= 0 ? all[i - 1] : undefined
  const next = i >= 0 ? all[i + 1] : undefined
  const t = useT()
  const p = t.courses.plannedPages
  const label = (c: PlannedChapter) => t.courses.chapterName(c.label)
  return (
    <SiteLayout title={`${label(chapter)} ${chapter.title}`}>
      <div className={styles.page}>
        <Crumb course={course} chapter={chapter} current={label(chapter)} />
        <header className={styles.head}>
          <p className={styles.kicker}>
            {t.courses.levelName(chapter.level ?? course.level ?? '')} · {label(chapter)} · <span aria-hidden="true">🌱 </span>{t.courses.planned}
          </p>
          <h1>{chapter.title}</h1>
        </header>
        <section className={styles.goal}>
          <h2>{p.chapterGoal}</h2>
          <p>{chapter.summary}</p>
          {chapter.result && <p className={styles.scenario}>{p.afterDone(chapter.result)}</p>}
        </section>
        <p className={styles.lead}>{p.comingSoon}</p>
        <nav className={styles.pager} aria-label={p.pager}>
          {prev ? (
            <Link to={chapterLink(course, prev)}>
              <small>{t.courses.prevChapter}</small>
              {label(prev)} {prev.title}
            </Link>
          ) : (
            <Link to={coursePath(course)}>
              <small>{t.courses.backTo}</small>{t.courses.courseOverview}
            </Link>
          )}
          {next ? (
            <Link to={chapterLink(course, next)} className={styles.next}>
              <small>{t.courses.nextChapter}</small>
              {label(next)} {next.title}
            </Link>
          ) : (
            <Link to={coursePath(course)} className={styles.next}>
              <small>{t.courses.backTo}</small>{t.courses.courseOverview}
            </Link>
          )}
        </nav>
      </div>
    </SiteLayout>
  )
}
