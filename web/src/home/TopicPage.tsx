import { Link } from 'react-router-dom'
import { pickTopicCourses, TOPICS, type TopicId } from '../content/topicCourses'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import styles from '../courses/CourseList.module.css'

// 主題頁(/topics/<主題>):主題的名稱與說明,下面列出這個主題的課。
// 列哪些課由 content/topicCourses.ts 的 pickTopicCourses 決定(之後改用演算法,現在固定);課程本身在 /courses/<課程>。
// 卡片整張可點(CourseList.module.css 的 .card h3 a::after 蓋滿卡片),版面和「全部課程」頁一致。

export function TopicPage({ id }: { id: TopicId }) {
  const topic = TOPICS[id]
  const t = useT()
  const courses = pickTopicCourses(id, t)
  return (
    <SiteLayout title={t.courses.topicPage.title(topic.name)}>
      <div className={styles.container}>
        <header className={styles.head}>
          <h1>{topic.name}</h1>
          <p>{topic.slogan}</p>
        </header>
        <section className={styles.topic} aria-labelledby={`topic-${id}-courses`}>
          <div className={styles.topicHead}>
            <div>
              <h2 id={`topic-${id}-courses`}>{t.courses.topicPage.heading}</h2>
              <p>{t.courses.topicPage.plannedNote}</p>
            </div>
          </div>
          <ul className={styles.grid}>
            {courses.map((c) => (
              <li key={c.id} className={styles.card}>
                <p className={styles.badges}>
                  {c.badge && <span className={`${styles.badge} ${styles.badgeOpen}`}>{c.badge}</span>}
                  {c.planned && (
                    <span className={`${styles.badge} ${styles.badgePlanned}`}>
                      <span aria-hidden="true">🌱 </span>
                      {c.badge ? t.courses.list.otherPlanned : t.courses.planned}
                    </span>
                  )}
                </p>
                <h3>
                  <Link to={c.path}>{c.title}</Link>
                </h3>
                <p className={styles.summary}>{c.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SiteLayout>
  )
}
