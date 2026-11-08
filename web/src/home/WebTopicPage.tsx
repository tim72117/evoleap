import { Link } from 'react-router-dom'
import type { MapUnit } from '../content/courseMap'
import { WEB_OPEN_LESSONS, WEB_PITCH, WEB_UNITS, webNeedsLogin } from '../content/webCourse'
import { WEB_TOPIC } from '../content/topics'
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
  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>開放中</p>
          <h1>{topic.name}</h1>
          <p className={styles.pitch}>{topic.slogan}。不教語法，教網頁怎麼運作、每個東西叫什麼。</p>
          <div className={styles.ctas}>
            <Link className={styles.primary} to={topic.start.path}>
              {topic.start.label}
            </Link>
            <Link className={styles.secondary} to={{ pathname: topic.path, hash: 'map' }}>
              查看課程地圖
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} id="about">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>課程說明</h2>
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
            <h2>課程地圖</h2>
            <p className={styles.lead}>課程陸續開放中，還沒開放的課標「規劃中」。第一課不用登入就能預覽，其他課登入後就能學習。</p>
          </header>
          <CourseMapUnits course="web" topicPath={topic.path} fallback={LOCAL_UNITS} />
        </div>
      </section>
    </SiteLayout>
  )
}
