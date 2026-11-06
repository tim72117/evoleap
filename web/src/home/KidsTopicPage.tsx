import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { KIDS_OPEN_LESSONS, KIDS_UNITS, kidsNeedsLogin } from '../content/kidsCourse'
import { KIDS_TOPIC } from '../content/topics'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import styles from './SoftwareTopicPage.module.css'
import own from './KidsTopicPage.module.css'

// 主題「給孩子的網頁程式」的課程地圖頁:給家長看,列出每個單元與每一課學會什麼。
// 已經可以上的課(KIDS_OPEN_LESSONS)連到課程頁:第一課標「免費預覽」,之後的標「登入後學習」;其他標「規劃中」。版面沿用「做出自己的軟體」的課程地圖頁。

export function KidsTopicPage() {
  useHashScroll()
  const { status } = useAuth()
  const signedIn = status === 'user' || status === 'disabled'
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
                            {/* 狀態:開始學習與免費預覽(綠)、登入後學習(暖色,鎖頭)、規劃中(淡色) */}
                            {(() => {
                              // 登入之後(或伺服器沒開放登入)可以上的課都是「開始學習」;沒登入時第一課是免費預覽,之後的要登入
                              const state = !open ? 'planned' : signedIn ? 'start' : status === 'loading' ? null : kidsNeedsLogin(l.id) ? 'login' : 'free'
                              // 還在確認登入狀態(state 是 null)時先不標,免得已登入的人閃過「登入後學習」
                              if (!state) return null
                              const label = { start: '開始學習', free: '免費預覽', login: '登入後學習', planned: '規劃中' }[state]
                              const icon = { start: '▶', free: '▶', login: '🔒', planned: '🌱' }[state]
                              return (
                                <span className={own.status} data-state={state}>
                                  <span className={own.statusIcon} aria-hidden="true">
                                    {icon}
                                  </span>
                                  {label}
                                </span>
                              )
                            })()}
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
