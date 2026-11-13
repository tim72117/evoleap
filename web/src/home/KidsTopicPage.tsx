import { Link } from 'react-router-dom'
import type { MapUnit } from '../content/courseMap'
import { KIDS_GUIDE_SCRIPT, KIDS_OPEN_LESSONS, KIDS_RELEASED_LESSONS, KIDS_UNITS, kidsNeedsLogin } from '../content/kidsCourse'
import { KIDS_TOPIC, topicStartLabel } from '../content/topics'
import { KidsSchedulePanel } from '../kidsMode/KidsSchedulePanel'
import { useKidsMode } from '../kidsMode/KidsModeContext'
import { useT } from '../i18n/I18nProvider'
import { lazyPage } from '../site/lazyPage'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { CourseMapUnits } from './CourseMapUnits'
import own from './KidsTopicPage.module.css'
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
    // 有課程頁但還沒開放的是草稿(訪客看到「還沒開放」)
    status: KIDS_RELEASED_LESSONS.includes(l.id) ? 'open' : KIDS_OPEN_LESSONS[l.id] ? 'draft' : 'planned',
  })),
}))

// 小播放器用到時才下載(和 Claude Code 工作術的情境影片一樣)
const LivePlayer = lazyPage(() => import('../courses/LivePlayer').then((m) => m.LivePlayer))

export function KidsTopicPage() {
  useHashScroll()
  const topic = KIDS_TOPIC
  const t = useT()
  const { mode } = useKidsMode()
  // 兒童模式:只有家長安排好的這週的課(不介紹課程、不放課程地圖)
  if (mode?.active) {
    return (
      <SiteLayout title={topic.seoTitle}>
        <KidsSchedulePanel mode={mode} />
      </SiteLayout>
    )
  }
  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>{t.home.openNow}</p>
          <h1>{topic.name}</h1>
          <p className={styles.pitch}>{t.home.kidsTopic.pitch(topic.slogan)}</p>
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

      <section className={styles.section} id="how">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>{t.home.kidsTopic.howTitle}</h2>
            <p className={styles.lead}>{t.home.kidsTopic.howLead}</p>
          </header>
          <div className={own.guidePlayer}>
            <LivePlayer script={KIDS_GUIDE_SCRIPT} title={t.home.kidsTopic.howTitle} onTime={() => {}} saveProgress={false} />
          </div>
        </div>
      </section>

      <section className={styles.section} id="map">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>{t.home.courseMap}</h2>
            <p className={styles.lead}>{t.home.kidsTopic.mapLead}</p>
          </header>
          <CourseMapUnits course="kids" topicPath={topic.path} fallback={LOCAL_UNITS} />
        </div>
      </section>
    </SiteLayout>
  )
}
