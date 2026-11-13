import { Link } from 'react-router-dom'
import { LAUNCH_PITCH } from '../content/launchCourse'
import { LAUNCH_TOPIC, topicStartLabel } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { TopicCourseMap } from './TopicCourseMap'
import styles from './SoftwareTopicPage.module.css'

// 主題「從做好到上線」的課程地圖頁:課程說明,再列出每個單元與每一課學會什麼。版型和「網頁怎麼運作」(WebTopicPage)相同。
// 單元與每一課從資料庫讀(GET /api/courses/launch/map);序章與單元 1 開放中,草稿的課只有管理員拿得到,標「草稿」、點得進去,其他人看到規劃中。

export function LaunchTopicPage() {
  useHashScroll()
  const topic = LAUNCH_TOPIC
  const t = useT()
  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>{t.home.openNow}</p>
          <h1>{topic.name}</h1>
          <p className={styles.pitch}>{t.home.launch.pitch(topic.slogan)}</p>
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
            {LAUNCH_PITCH.map((p) => (
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
            <p className={styles.lead}>{t.home.launch.mapLead}</p>
          </header>
          <TopicCourseMap course="launch" topicPath={topic.path} />
        </div>
      </section>
    </SiteLayout>
  )
}
