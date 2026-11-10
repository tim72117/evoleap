import { Link } from 'react-router-dom'
import { COURSES, coursePath, openLessonsOf, type Course } from '../content/catalog'
import { ACCESS_LABEL, ALL_LEVELS, levelPath } from '../content/levels'
import { courseCards, TOPIC_IDS, TOPICS } from '../content/topicCourses'
import { AI_APPS_TOPIC, COURSE_LIST, SOFTWARE_TOPIC, topicOfCourse } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import styles from './CourseList.module.css'

// 全部課程:依主題列出 catalog.ts 的每一門課,再接一個主題就是一門課的獨立主題(網頁怎麼運作、給孩子的網頁程式、Claude Code 工作術)。
// 規劃中的課不顯示課數(levels.ts:不寫未確認的堂數)。

function CourseCard({ course }: { course: Course }) {
  const t = useT()
  const path = coursePath(course)
  const access = ACCESS_LABEL[ALL_LEVELS.find((l) => levelPath(l) === path)?.access ?? 'tbd']
  const open = openLessonsOf(course).length
  return (
    <li className={styles.card}>
      <p className={styles.badges}>
        <span className={styles.level}>{t.courses.levelName(course.level)}</span>
        {access && <span className={styles.badge}>{t.courses.accessName(access)}</span>}
        {open > 0 ? (
          <span className={`${styles.badge} ${styles.badgeOpen}`}>{t.courses.list.openN(open)}</span>
        ) : (
          <span className={`${styles.badge} ${styles.badgePlanned}`}><span aria-hidden="true">🌱 </span>{t.courses.planned}</span>
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
  const t = useT()
  const cards = courseCards(t)
  return (
    <SiteLayout title={COURSE_LIST.seoTitle}>
      <div className={styles.container}>
        <header className={styles.head}>
          <h1>{COURSE_LIST.name}</h1>
          <p>{t.courses.list.intro}</p>
        </header>
        {[SOFTWARE_TOPIC, AI_APPS_TOPIC].map((topic) => (
          <section key={topic.path} className={styles.topic} aria-labelledby={`courses-${topic.path}`}>
            <div className={styles.topicHead}>
              <div>
                <h2 id={`courses-${topic.path}`}>{topic.name}</h2>
                <p>{topic.slogan}</p>
              </div>
              <Link className={styles.mapLink} to={topic.path}>
                {t.courses.list.viewMap} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className={styles.grid}>
              {COURSES.filter((c) => topicOfCourse(coursePath(c)).path === topic.path).map((c) => (
                <CourseCard key={c.slug} course={c} />
              ))}
            </ul>
          </section>
        ))}
        {/* 獨立主題的課程:一個主題就是一門課,卡片連到課程頁(/courses/<id>),資料在 content/topicCourses.ts */}
        {/* software、ai-apps 有上面自己的段落(依 catalog 列出每門課) */}
        {TOPIC_IDS.filter((id) => id !== 'software' && id !== 'ai-apps').map((id) => {
          const topic = TOPICS[id]
          const card = cards[id]
          return (
            <section key={id} className={styles.topic} aria-labelledby={`courses-${id}`}>
              <div className={styles.topicHead}>
                <div>
                  <h2 id={`courses-${id}`}>{topic.name}</h2>
                  <p>{topic.slogan}</p>
                </div>
                <Link className={styles.mapLink} to={card.path}>
                  {card.mapLabel} <span aria-hidden="true">→</span>
                </Link>
              </div>
              <ul className={styles.grid}>
                <li className={styles.card}>
                  <p className={styles.badges}>
                    {card.badge && <span className={`${styles.badge} ${styles.badgeOpen}`}>{card.badge}</span>}
                    {card.planned && (
                      <span className={`${styles.badge} ${styles.badgePlanned}`}>
                        <span aria-hidden="true">🌱 </span>
                        {card.badge ? t.courses.list.otherPlanned : t.courses.planned}
                      </span>
                    )}
                  </p>
                  <h3>
                    <Link to={card.path}>{card.title}</Link>
                  </h3>
                  <p className={styles.summary}>{card.summary}</p>
                </li>
              </ul>
            </section>
          )
        })}
      </div>
    </SiteLayout>
  )
}
