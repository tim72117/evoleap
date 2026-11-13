import { Link } from 'react-router-dom'
import { WEB_PITCH } from '../content/webCourse'
import { topicStartLabel, WEB_TOPIC } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { TopicCourseMap } from './TopicCourseMap'
import styles from './SoftwareTopicPage.module.css'

// 主題「網頁怎麼運作」的課程地圖頁:課程說明,再列出每個單元與每一課學會什麼。
// 單元與每一課從資料庫讀(GET /api/courses/web/map),畫法與狀態標籤見 TopicCourseMap(courses/LessonGroup.tsx,和課程總覽頁的清單同一個元件);課程說明(WEB_PITCH)還在前端。

export function WebTopicPage() {
  useHashScroll()
  const topic = WEB_TOPIC
  const t = useT()
  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>{t.home.openNow}</p>
          <h1>{topic.name}</h1>
          <p className={styles.pitch}>{t.home.web.pitch(topic.slogan)}</p>
          <div className={styles.ctas}>
            <Link className={styles.primary} to={topic.start.path}>
              {topicStartLabel(topic.start)}
            </Link>
            <Link className={styles.secondary} to={{ pathname: topic.path, hash: 'map' }}>
              {t.home.viewCourseMap}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} id="about">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>{t.home.aboutCourse}</h2>
            {WEB_PITCH.map((p) => (
              <p key={p} className={styles.lead}>
                {p}
              </p>
            ))}
          </header>
        </div>
      </section>

      <section className={styles.section} id="map">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>{t.home.courseMap}</h2>
            <p className={styles.lead}>{t.home.web.mapLead}</p>
          </header>
          <TopicCourseMap course="web" topicPath={topic.path} />
        </div>
      </section>
    </SiteLayout>
  )
}
