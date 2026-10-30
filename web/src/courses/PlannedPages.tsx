import { Link } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { coursePath, lessonNumber, lessonPath, plannedChapterPath, type Course, type PlannedChapter } from '../content/catalog'
import styles from './Lesson.module.css'

// 規劃中的課程總覽與章節頁：只有標題與簡述，內容完成後章節改由 LessonPage 呈現。

function Crumb({ course, current }: { course: Course; current?: string }) {
  return (
    <nav className={styles.crumb} aria-label="麵包屑">
      <Link to="/#map">課程地圖</Link>
      <span aria-hidden="true"> / </span>
      {current ? <Link to={coursePath(course)}>{course.level}</Link> : <span>{course.level}</span>}
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
  return (
    <ol className={styles.lessonList}>
      {course.lessons.map((l) => (
        <li key={l.id}>
          <Link to={lessonPath(course, l)}>
            <span className={styles.lessonNum}>第 {lessonNumber(l)} 課</span>
            <span className={styles.lessonTitle}>{l.title}</span>
            <span className={styles.lessonGoal}>{l.goal}</span>
          </Link>
        </li>
      ))}
      {course.planned.map((c) => (
        <li key={c.slug}>
          <Link to={plannedChapterPath(course, c)}>
            <span className={styles.lessonNum}>{c.label} · 規劃中</span>
            <span className={styles.lessonTitle}>{c.title}</span>
            <span className={styles.lessonGoal}>{c.summary}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

export function PlannedCourseOverviewPage({ course }: { course: Course }) {
  return (
    <SiteLayout title={course.title}>
      <div className={styles.page}>
        <Crumb course={course} />
        <header className={styles.head}>
          <p className={styles.kicker}>{course.level} · 規劃中</p>
          <h1>{course.title}</h1>
          <p className={styles.lead}>{course.summary}</p>
        </header>
        <h2>章節（規劃中）</h2>
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
  return (
    <SiteLayout title={`${chapter.label} ${chapter.title}`}>
      <div className={styles.page}>
        <Crumb course={course} current={chapter.label} />
        <header className={styles.head}>
          <p className={styles.kicker}>
            {course.level} · {chapter.label} · 規劃中
          </p>
          <h1>{chapter.title}</h1>
        </header>
        <section className={styles.goal}>
          <h2>這一章的目標</h2>
          <p>{chapter.summary}</p>
          {chapter.result && <p className={styles.scenario}>完成後：{chapter.result}</p>}
        </section>
        <p className={styles.lead}>這一章的影片與操作步驟製作中，完成後會在這裡上架。</p>
        <nav className={styles.pager} aria-label="上一章與下一章">
          {prev ? (
            <Link to={plannedChapterPath(course, prev)}>
              <small>上一章</small>
              {prev.label} {prev.title}
            </Link>
          ) : (
            <Link to={coursePath(course)}>
              <small>回到</small>課程總覽
            </Link>
          )}
          {next ? (
            <Link to={plannedChapterPath(course, next)} className={styles.next}>
              <small>下一章</small>
              {next.label} {next.title}
            </Link>
          ) : (
            <Link to={coursePath(course)} className={styles.next}>
              <small>回到</small>課程總覽
            </Link>
          )}
        </nav>
      </div>
    </SiteLayout>
  )
}
