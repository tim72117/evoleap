import { Link } from 'react-router-dom'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { coursePath, lessonNumber, levelLabelOf, lessonPath, plannedChapterPath, type Course, type PlannedChapter } from '../content/catalog'
import styles from './Lesson.module.css'
import { topicOfCourse } from '../content/topics'

// 規劃中的課程總覽與章節頁：只有標題與簡述，內容完成後章節改由 LessonPage 呈現。

function Crumb({ course, current, chapter }: { course: Course; current?: string; chapter?: PlannedChapter }) {
  const t = useT()
  const level = t.courses.levelName(levelLabelOf(course, chapter))
  return (
    <nav className={styles.crumb} aria-label={t.courses.breadcrumb}>
      <Link to={`${topicOfCourse(coursePath(course)).path}#map`}>{t.courses.courseMap}</Link>
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

/** 章節清單：已有內容的章節連到上課頁，規劃中的連到章節頁 */
export function ChapterList({ course }: { course: Course }) {
  const t = useT()
  return (
    <ol className={styles.lessonList}>
      {course.lessons.map((l) => (
        <li key={l.id}>
          <Link to={lessonPath(course, l)}>
            <span className={styles.lessonNum}>{t.courses.lessonN(lessonNumber(l))}</span>
            <span className={styles.lessonTitle}>{l.title}</span>
            <span className={styles.lessonGoal}>{l.goal}</span>
          </Link>
        </li>
      ))}
      {course.planned.map((c) => (
        <li key={c.slug}>
          <Link to={plannedChapterPath(course, c)}>
            <span className={styles.lessonNum}>{t.courses.chapterName(c.label)} · <span aria-hidden="true">🌱 </span>{t.courses.planned}</span>
            <span className={styles.lessonTitle}>{c.title}</span>
            <span className={styles.lessonGoal}>{c.summary}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

export function PlannedCourseOverviewPage({ course }: { course: Course }) {
  const t = useT()
  return (
    <SiteLayout title={course.title}>
      <div className={styles.page}>
        <Crumb course={course} />
        <header className={styles.head}>
          <p className={styles.kicker}>{t.courses.levelName(course.level)} · <span aria-hidden="true">🌱 </span>{t.courses.planned}</p>
          <h1>{course.title}</h1>
          <p className={styles.lead}>{course.summary}</p>
        </header>
        <h2>{t.courses.plannedPages.chapters}{t.courses.plannedPages.chaptersPlannedOpen}<span aria-hidden="true">🌱 </span>{t.courses.planned}{t.courses.plannedPages.chaptersPlannedClose}</h2>
        <ChapterList course={course} />
      </div>
    </SiteLayout>
  )
}

export function PlannedChapterPage({ course, chapter }: { course: Course; chapter: PlannedChapter }) {
  const all = course.planned
  const i = all.indexOf(chapter)
  const prev = all[i - 1]
  const next = all[i + 1]
  const t = useT()
  const p = t.courses.plannedPages
  const label = (c: PlannedChapter) => t.courses.chapterName(c.label)
  return (
    <SiteLayout title={`${label(chapter)} ${chapter.title}`}>
      <div className={styles.page}>
        <Crumb course={course} current={label(chapter)} chapter={chapter} />
        <header className={styles.head}>
          <p className={styles.kicker}>
            {t.courses.levelName(levelLabelOf(course, chapter))} · {label(chapter)} · <span aria-hidden="true">🌱 </span>{t.courses.planned}
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
            <Link to={plannedChapterPath(course, prev)}>
              <small>{t.courses.prevChapter}</small>
              {label(prev)} {prev.title}
            </Link>
          ) : (
            <Link to={coursePath(course)}>
              <small>{t.courses.backTo}</small>{t.courses.courseOverview}
            </Link>
          )}
          {next ? (
            <Link to={plannedChapterPath(course, next)} className={styles.next}>
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
