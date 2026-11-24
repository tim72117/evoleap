import { Link } from 'react-router-dom'
import { groupByTopic, useCourseList, type CourseListItem } from '../content/courseList'
import { useCourseMap } from '../content/courseMap'
import { ACCESS_LABEL } from '../content/levels'
import { COURSE_LIST } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { sortByViews, useTopicViews } from '../home/useTopicViews'
import { SiteLayout } from '../site/SiteLayout'
import styles from './CourseList.module.css'
import { LessonListStatus } from './LessonGroup'

// 全部課程:有哪些課、怎麼分組、課名、簡介、主題名稱與標語都讀資料庫(GET /api/courses),依主題一組一組列出。
// 卡片上的階段、存取方式、已開放幾課照各課的課程地圖(useCourseMap)。規劃中的課不顯示課數(levels.ts:不寫未確認的堂數)。

function CourseCard({ course }: { course: CourseListItem }) {
  const t = useT()
  const state = useCourseMap(course.id)
  const map = state.status === 'ready' ? state.map : undefined
  // 先不公開的單元(階段)不算
  const units = map?.units.filter((u) => !u.hidden) ?? []
  const level = units
    .filter((u) => u.label)
    .map((u) => t.courses.levelName(u.label!))
    .join('・')
  const access = map ? ACCESS_LABEL[map.access] : null
  const open = map ? units.flatMap((u) => u.lessons).filter((l) => l.status === 'open').length : null
  // 沒有自己總覽頁的課(overview === false,主題頁就是介紹):卡片連到主題頁;其他連 /courses/<id>(不看地圖有沒有讀到)
  const to = course.overview === false && course.topicPath ? course.topicPath : `/courses/${course.id}`
  return (
    <li className={styles.card}>
      <p className={styles.badges}>
        {level && <span className={styles.level}>{level}</span>}
        {access && <span className={styles.badge}>{t.courses.accessName(access)}</span>}
        {open === null ? null : open > 0 ? (
          <span className={`${styles.badge} ${styles.badgeOpen}`}>{t.courses.list.openN(open)}</span>
        ) : (
          <span className={`${styles.badge} ${styles.badgePlanned}`}><span aria-hidden="true">🌱 </span>{t.courses.planned}</span>
        )}
      </p>
      <h3>
        <Link to={to}>{course.title}</Link>
      </h3>
      {course.summary && <p className={styles.summary}>{course.summary}</p>}
    </li>
  )
}

export function CourseListPage() {
  const t = useT()
  const list = useCourseList()
  // 觀看次數多的主題排前面(還沒讀到次數時照資料庫的順序)
  const topicViews = useTopicViews()
  return (
    <SiteLayout title={t.courses.list.seoTitle}>
      <div className={styles.container}>
        <header className={styles.head}>
          <h1>{COURSE_LIST.name}</h1>
          <p>{t.courses.list.intro}</p>
        </header>
        {list.status !== 'ready' ? (
          <LessonListStatus state={list.status} />
        ) : (
          sortByViews(groupByTopic(list.courses), (g) => g.topicId, topicViews).map((g, i) => (
            <section key={`${g.topic}-${i}`} className={styles.topic} aria-labelledby={`courses-topic-${i}`}>
              <div className={styles.topicHead}>
                <div>
                  <h2 id={`courses-topic-${i}`}>{g.topic}</h2>
                  <p>{g.topicSlogan}</p>
                </div>
                <Link className={styles.mapLink} to={g.topicPath}>
                  {t.courses.list.viewMap} <span aria-hidden="true">→</span>
                </Link>
              </div>
              <ul className={styles.grid}>
                {g.courses.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </SiteLayout>
  )
}
