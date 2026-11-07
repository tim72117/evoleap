import { Link } from 'react-router-dom'
import { COURSES, coursePath, openLessonsOf, type Course } from '../content/catalog'
import { ACCESS_LABEL, ALL_LEVELS } from '../content/levels'
import { AI_APPS_TOPIC, COURSE_LIST, SOFTWARE_TOPIC, topicOfCourse, WEB_TOPIC } from '../content/topics'
import { WEB_OPEN_LESSONS } from '../content/webCourse'
import { SiteLayout } from '../site/SiteLayout'
import styles from './CourseList.module.css'

// 全部課程:依主題列出 catalog.ts 的每一門課。規劃中的課不顯示課數(levels.ts:不寫未確認的堂數)。

function CourseCard({ course }: { course: Course }) {
  const path = coursePath(course)
  const access = ACCESS_LABEL[ALL_LEVELS.find((l) => l.link === path)?.access ?? 'tbd']
  const open = openLessonsOf(course).length
  return (
    <li className={styles.card}>
      <p className={styles.badges}>
        <span className={styles.level}>{course.level}</span>
        {access && <span className={styles.badge}>{access}</span>}
        {open > 0 ? (
          <span className={`${styles.badge} ${styles.badgeOpen}`}>已開放 {open} 課</span>
        ) : (
          <span className={`${styles.badge} ${styles.badgePlanned}`}><span aria-hidden="true">🌱 </span>規劃中</span>
        )}
      </p>
      <h3>
        <Link to={path}>{course.title}</Link>
      </h3>
      <p className={styles.summary}>{course.summary}</p>
    </li>
  )
}

export function CourseListPage() {
  return (
    <SiteLayout title={COURSE_LIST.seoTitle}>
      <div className={styles.container}>
        <header className={styles.head}>
          <h1>{COURSE_LIST.name}</h1>
          <p>依主題列出所有課程。標示「規劃中」的課程名稱與內容仍在規劃，可能調整。</p>
        </header>
        {[SOFTWARE_TOPIC, AI_APPS_TOPIC].map((topic) => (
          <section key={topic.path} className={styles.topic} aria-labelledby={`courses-${topic.path}`}>
            <div className={styles.topicHead}>
              <div>
                <h2 id={`courses-${topic.path}`}>{topic.name}</h2>
                <p>{topic.slogan}</p>
              </div>
              <Link className={styles.mapLink} to={topic.path}>
                看課程地圖 <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className={styles.grid}>
              {COURSES.filter((c) => topicOfCourse(coursePath(c)).path === topic.path).map((c) => (
                <CourseCard key={c.slug} course={c} />
              ))}
            </ul>
          </section>
        ))}
        {/* 獨立主題的課程:一個主題就是一門課,卡片連到主題的課程地圖頁 */}
        <section className={styles.topic} aria-labelledby="courses-web">
          <div className={styles.topicHead}>
            <div>
              <h2 id="courses-web">{WEB_TOPIC.name}</h2>
              <p>{WEB_TOPIC.slogan}</p>
            </div>
            <Link className={styles.mapLink} to={WEB_TOPIC.path}>
              看課程地圖 <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ul className={styles.grid}>
            <li className={styles.card}>
              <p className={styles.badges}>
                <span className={`${styles.badge} ${styles.badgeOpen}`}>已開放 {Object.keys(WEB_OPEN_LESSONS).length} 課</span>
              </p>
              <h3>
                <Link to={WEB_TOPIC.path}>{WEB_TOPIC.name}：AI 時代的網頁基礎課</Link>
              </h3>
              <p className={styles.summary}>{WEB_TOPIC.description}</p>
            </li>
          </ul>
        </section>
      </div>
    </SiteLayout>
  )
}
