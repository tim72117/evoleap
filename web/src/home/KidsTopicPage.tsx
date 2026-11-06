import { Link } from 'react-router-dom'
import { KIDS_OPEN_LESSONS, KIDS_UNITS, kidsNeedsLogin } from '../content/kidsCourse'
import { KIDS_TOPIC } from '../content/topics'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import styles from './SoftwareTopicPage.module.css'
import own from './KidsTopicPage.module.css'

// 主題「給孩子的網頁程式」的課程地圖頁:給家長看,列出每個單元與每一課學會什麼。
// 已經可以上的課(KIDS_OPEN_LESSONS)連到課程頁:第一課標「免費預覽」,之後的標「登入後可上」;其他標「規劃中」。版面沿用「做出自己的軟體」的課程地圖頁。

export function KidsTopicPage() {
  useHashScroll()
  const topic = KIDS_TOPIC
  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>規劃中</p>
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
            <p className={styles.lead}>課程還在規劃，內容可能調整。第一課不用登入就能預覽，之後的課要登入才能上。</p>
          </header>
          <div className={own.units}>
            {KIDS_UNITS.map((unit) => (
              <div className={styles.group} key={unit.id}>
                <h3 className={`${styles.groupHead} ${own.unitHead}`}>
                  {unit.title}
                  <small>{unit.metaphor}</small>
                </h3>
                <ul className={styles.rows}>
                  {unit.lessons.map((l) => {
                    const open = KIDS_OPEN_LESSONS[l.id]
                    return (
                      <li key={l.id}>
                        <div className={open ? `${styles.row} ${styles.rowPlayable}` : styles.row}>
                          <span className={`${styles.rowIcon} ${own.lessonNo}`} aria-hidden="true">
                            {l.id}
                          </span>
                          <div className={styles.rowText}>
                            {/* 可以上的課整列都能點(rowButton 的 ::after 蓋住整列),標題不畫成底線連結 */}
                            <h4>
                              {open ? (
                                <Link className={`${styles.rowButton} ${own.lessonLink}`} to={open.path}>
                                  {l.title}
                                </Link>
                              ) : (
                                l.title
                              )}
                            </h4>
                            <p>{l.learn}</p>
                          </div>
                          <div className={styles.rowMeta}>
                            {/* 第一課免費預覽,之後開放的課要登入 */}
                            <span className={open ? styles.tag : `${styles.tag} ${styles.tagPlanned}`}>{!open ? '規劃中' : kidsNeedsLogin(l.id) ? '登入後可上' : '免費預覽'}</span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
