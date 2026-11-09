import { Link } from 'react-router-dom'
import type { MapUnit } from '../content/courseMap'
import { LAUNCH_OPEN_LESSONS, LAUNCH_PITCH, LAUNCH_UNITS } from '../content/launchCourse'
import { LAUNCH_TOPIC } from '../content/topics'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { CourseMapUnits } from './CourseMapUnits'
import styles from './SoftwareTopicPage.module.css'

// 主題「從做好到上線」的課程地圖頁:課程說明,再列出每個單元與每一課學會什麼。版型和「網頁怎麼運作」(WebTopicPage)相同。
// 單元與每一課從資料庫讀(GET /api/courses/launch/map);序章開放中,草稿的課只有管理員拿得到,標「草稿」、點得進去,其他人看到規劃中。

/** 前端內建的同一份課程地圖:資料庫讀到之前先顯示它,讀不到就一直用它(已開放的課當成開放,草稿不會從這裡露出來) */
const LOCAL_UNITS: MapUnit[] = LAUNCH_UNITS.map((u) => ({
  id: u.id,
  title: u.title,
  subtitle: u.question,
  lessons: u.lessons.map((l) => ({
    id: l.id,
    title: l.title,
    summary: l.learn,
    access: l.id === '0.1' ? 'free' : 'login-free',
    status: LAUNCH_OPEN_LESSONS.includes(l.id) ? 'open' : 'planned',
  })),
}))

export function LaunchTopicPage() {
  useHashScroll()
  const topic = LAUNCH_TOPIC
  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>開放中</p>
          <h1>{topic.name}</h1>
          <p className={styles.pitch}>{topic.slogan}。從部署、網域、資料與登入，到收費和上線後的監控。</p>
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
            <h2>課程地圖</h2>
            <p className={styles.lead}>序章開放中，第一課不用登入就能預覽，其他課登入後就能學習；還沒開放的課標「規劃中」，內容與順序可能調整。</p>
          </header>
          <CourseMapUnits course="launch" topicPath={topic.path} fallback={LOCAL_UNITS} />
        </div>
      </section>
    </SiteLayout>
  )
}
