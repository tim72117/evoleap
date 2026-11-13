import { Link } from 'react-router-dom'
import { COURSES, coursePath, openLessonsOf, type Course } from '../content/catalog'
import { ACCESS_LABEL, ALL_LEVELS } from '../content/levels'
import { KIDS_RELEASED_LESSONS } from '../content/kidsCourse'
import { LAUNCH_OPEN_LESSONS } from '../content/launchCourse'
import { AI_APPS_TOPIC, CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC, COURSE_LIST, KIDS_TOPIC, LAUNCH_TOPIC, SOFTWARE_TOPIC, topicOfCourse, WEB_TOPIC } from '../content/topics'
import { WEB_OPEN_LESSONS } from '../content/webCourse'
import { useT } from '../i18n/I18nProvider'
import type { Messages } from '../i18n/zh'
import { SiteLayout } from '../site/SiteLayout'
import styles from './CourseList.module.css'

// 全部課程:依主題列出 catalog.ts 的每一門課,再接一個主題就是一門課的獨立主題(網頁怎麼運作、給孩子的網頁程式、Claude Code 工作術)。
// 規劃中的課不顯示課數(levels.ts:不寫未確認的堂數)。

function CourseCard({ course }: { course: Course }) {
  const t = useT()
  const path = coursePath(course)
  const access = ACCESS_LABEL[ALL_LEVELS.find((l) => l.link === path)?.access ?? 'tbd']
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

/** 一個主題就是一門課的獨立主題:已開放幾課(或幾支示範影片),還有沒有規劃中的內容。title 是課名(課程內容,不翻) */
const singleTopics = (t: Messages) => [
  { id: 'web', topic: WEB_TOPIC, title: `${WEB_TOPIC.name}：AI 時代的網頁基礎課`, badge: t.courses.list.openN(Object.keys(WEB_OPEN_LESSONS).length), planned: true, mapLabel: t.courses.list.viewMap },
  { id: 'launch', topic: LAUNCH_TOPIC, title: `${LAUNCH_TOPIC.name}：把作品變成服務`, badge: t.courses.list.openN(LAUNCH_OPEN_LESSONS.length), planned: true, mapLabel: t.courses.list.viewMap },
  { id: 'kids', topic: KIDS_TOPIC, title: `${KIDS_TOPIC.name}：用積木蓋網頁`, badge: t.courses.list.openN(KIDS_RELEASED_LESSONS.length), planned: true, mapLabel: t.courses.list.viewMap },
  {
    id: 'claude-code',
    topic: CLAUDE_CODE_TOPIC,
    title: `${CLAUDE_CODE_TOPIC.name}：常見情境與對應做法`,
    badge: t.courses.list.demoVideosN(CLAUDE_CODE_SCENARIOS.filter((s) => s.video).length),
    planned: CLAUDE_CODE_SCENARIOS.some((s) => !s.video),
    mapLabel: t.courses.list.viewScenarios,
  },
]

export function CourseListPage() {
  const t = useT()
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
        {/* 獨立主題的課程:一個主題就是一門課,卡片連到主題的課程地圖頁 */}
        {singleTopics(t).map((st) => (
          <section key={st.id} className={styles.topic} aria-labelledby={`courses-${st.id}`}>
            <div className={styles.topicHead}>
              <div>
                <h2 id={`courses-${st.id}`}>{st.topic.name}</h2>
                <p>{st.topic.slogan}</p>
              </div>
              <Link className={styles.mapLink} to={st.topic.path}>
                {st.mapLabel} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className={styles.grid}>
              <li className={styles.card}>
                <p className={styles.badges}>
                  <span className={`${styles.badge} ${styles.badgeOpen}`}>{st.badge}</span>
                  {st.planned && (
                    <span className={`${styles.badge} ${styles.badgePlanned}`}>
                      <span aria-hidden="true">🌱 </span>{t.courses.list.otherPlanned}
                    </span>
                  )}
                </p>
                <h3>
                  <Link to={st.topic.path}>{st.title}</Link>
                </h3>
                <p className={styles.summary}>{st.topic.description}</p>
              </li>
            </ul>
          </section>
        ))}
      </div>
    </SiteLayout>
  )
}
