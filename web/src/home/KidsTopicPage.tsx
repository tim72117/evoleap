import { Link } from 'react-router-dom'
import type { MapUnit } from '../content/courseMap'
import { KIDS_OPEN_LESSONS, KIDS_UNITS, kidsNeedsLogin } from '../content/kidsCourse'
import { KIDS_TOPIC } from '../content/topics'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { CourseMapUnits } from './CourseMapUnits'
import styles from './SoftwareTopicPage.module.css'

// 主題「給孩子的網頁程式」的課程地圖頁:給家長看,列出每個單元與每一課學會什麼。
// 單元與每一課從資料庫讀(GET /api/courses/kids/map),畫法與狀態標籤見 CourseMapUnits。版面沿用「做出自己的軟體」的課程地圖頁。

/** 前端內建的同一份課程地圖(content/kidsCourse.ts):資料庫讀到之前先顯示它,讀不到(伺服器沒接資料庫、網路錯誤)就一直用它。
 *  兩邊一致由 content/courseMap.test.ts 檢查 */
const LOCAL_UNITS: MapUnit[] = KIDS_UNITS.map((u) => ({
  id: u.id,
  title: u.title,
  subtitle: u.metaphor,
  lessons: u.lessons.map((l) => ({
    id: l.id,
    title: l.title,
    summary: l.learn,
    access: kidsNeedsLogin(l.id) ? 'login-free' : 'free',
    status: KIDS_OPEN_LESSONS[l.id] ? 'open' : 'planned',
  })),
}))

export function KidsTopicPage() {
  useHashScroll()
  const topic = KIDS_TOPIC
  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>開放中</p>
          <h1>{topic.name}</h1>
          <p className={styles.pitch}>{topic.slogan}。不用打程式碼，點一點、拖一拖積木就能做出網頁；建議家長在旁陪學。</p>
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

      <section className={styles.section} id="map">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>課程地圖</h2>
            <p className={styles.lead}>課程陸續開放中，還沒開放的課標「規劃中」。第一課不用登入就能預覽，之後的課登入後就能學習。</p>
          </header>
          <CourseMapUnits course="kids" topicPath={topic.path} fallback={LOCAL_UNITS} />
        </div>
      </section>
    </SiteLayout>
  )
}
