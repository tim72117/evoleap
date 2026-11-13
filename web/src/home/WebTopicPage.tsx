import { Link } from 'react-router-dom'
import type { MapUnit } from '../content/courseMap'
import { WEB_OPEN_LESSONS, WEB_PITCH, WEB_UNITS, webNeedsLogin } from '../content/webCourse'
import { topicStartLabel, WEB_TOPIC } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { CourseMapUnits } from './CourseMapUnits'
import styles from './SoftwareTopicPage.module.css'

// 主題「網頁怎麼運作」的課程地圖頁:課程說明,再列出每個單元與每一課學會什麼。
// 單元與每一課從資料庫讀(GET /api/courses/web/map),畫法與狀態標籤見 CourseMapUnits(和兒童課的課程地圖頁共用);課程說明(WEB_PITCH)還在前端。

/** 前端內建的同一份課程地圖(content/webCourse.ts):資料庫讀到之前先顯示它,讀不到就一直用它。兩邊一致由 content/courseMap.test.ts 檢查 */
const LOCAL_UNITS: MapUnit[] = WEB_UNITS.map((u) => ({
  id: u.id,
  title: u.title,
  subtitle: u.question,
  lessons: u.lessons.map((l) => ({
    id: l.id,
    title: l.title,
    summary: l.learn,
    access: webNeedsLogin(l.id) ? 'login-free' : 'free',
    status: WEB_OPEN_LESSONS[l.id] ? 'open' : 'planned',
  })),
}))

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
          <CourseMapUnits course="web" topicPath={topic.path} fallback={LOCAL_UNITS} />
        </div>
      </section>
    </SiteLayout>
  )
}
