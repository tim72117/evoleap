import { Link } from 'react-router-dom'
import type { MapUnit } from '../content/courseMap'
import { IDEA_PITCH, IDEA_UNITS } from '../content/ideaCourse'
import { IDEA_TOPIC } from '../content/topics'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { CourseMapUnits } from './CourseMapUnits'
import styles from './SoftwareTopicPage.module.css'

// 主題「從構想到實作」的課程地圖頁:課程說明,再列出每個單元與每一課學會什麼。版型和「從做好到上線」(LaunchTopicPage)相同。
// 單元與每一課從資料庫讀(GET /api/courses/idea/map);目前全部規劃中,草稿的課只有管理員拿得到。

/** 前端內建的同一份課程地圖:資料庫讀到之前先顯示它,讀不到就一直用它 */
const LOCAL_UNITS: MapUnit[] = IDEA_UNITS.map((u) => ({
  id: u.id,
  title: u.title,
  subtitle: u.question,
  lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, summary: l.learn, access: 'login-free', status: 'planned' })),
}))

export function IdeaTopicPage() {
  useHashScroll()
  const topic = IDEA_TOPIC
  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>
            <span aria-hidden="true">🌱 </span>規劃中
          </p>
          <h1>{topic.name}</h1>
          <p className={styles.pitch}>{topic.slogan}。從腦力激盪、排優先順序、整理文件，到做出第一版。</p>
          <div className={styles.ctas}>
            <Link className={styles.primary} to={{ pathname: topic.path, hash: 'map' }}>
              查看課程地圖
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} id="about">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>課程說明</h2>
            {IDEA_PITCH.map((p) => (
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
            <p className={styles.lead}>課程還在規劃，每一課都標「規劃中」，內容與順序可能調整。</p>
          </header>
          <CourseMapUnits course="idea" topicPath={topic.path} fallback={LOCAL_UNITS} />
        </div>
      </section>
    </SiteLayout>
  )
}
