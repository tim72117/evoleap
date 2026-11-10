import { Link } from 'react-router-dom'
import type { MapUnit } from '../content/courseMap'
import { KIDS_GUIDE_SCRIPT, KIDS_OPEN_LESSONS, KIDS_RELEASED_LESSONS, KIDS_UNITS, kidsNeedsLogin } from '../content/kidsCourse'
import { KIDS_TOPIC } from '../content/topics'
import { KidsSchedulePanel } from '../kidsMode/KidsSchedulePanel'
import { useKidsMode } from '../kidsMode/KidsModeContext'
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

      <section className={styles.section} id="how">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>怎麼使用兒童課程</h2>
            <p className={styles.lead}>家長在會員空間替孩子排好上課時間、開啟兒童模式，孩子就只看得到兒童課程，時間到了才能上課，一課一課照進度往下上。</p>
          </header>
          <div className={own.guidePlayer}>
            <LivePlayer script={KIDS_GUIDE_SCRIPT} title="怎麼使用兒童課程" onTime={() => {}} saveProgress={false} />
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
