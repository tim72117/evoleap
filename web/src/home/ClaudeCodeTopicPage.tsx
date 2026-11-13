import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n/I18nProvider'
import { lazyPage } from '../site/lazyPage'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC } from '../content/topics'
import styles from './SoftwareTopicPage.module.css'

type Scenario = (typeof CLAUDE_CODE_SCENARIOS)[number]

/** 播放器(含舞台引擎與演員)按下播放、展開影片時才下載 */
const LivePlayer = lazyPage(() => import('../courses/LivePlayer').then((m) => m.LivePlayer))

/** 開頭是空白的字卡前奏,封面改用 Fork 的選單畫面 */
const FORK_POSTER = { chapter: '用 Fork 分出去', after: 2500 }

function ScenarioRow({ scenario: s, visible }: { scenario: Scenario; visible: boolean }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const playerId = useId()
  const t = useT()
  const toggle = () => {
    setOpen(!open)
    setLoaded(true)
  }
  return (
    <li>
      <div className={s.video ? `${styles.row} ${styles.rowPlayable}` : styles.row}>
        <span className={styles.rowIcon} aria-hidden="true">
          {s.video ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
          )}
        </span>
        <div className={styles.rowText}>
          <h4>
            {s.video ? (
              <button type="button" className={styles.rowButton} aria-expanded={open} aria-controls={playerId} onClick={toggle}>
                {s.title}
              </button>
            ) : (
              s.title
            )}
          </h4>
          <p>
            {s.summary}{' '}
            <span className={styles.tools}>
              {s.tools.map((x) => (
                <code key={x}>{x}</code>
              ))}
            </span>
          </p>
        </div>
        <div className={styles.rowMeta}>
          {s.video ? (
            <>
              <span className={styles.tag}>{t.home.claudeCode.video}</span>
              <span>{s.video.duration}</span>
            </>
          ) : (
            <span className={`${styles.tag} ${styles.tagPlanned}`}><span aria-hidden="true">🌱 </span>{t.home.planned}</span>
          )}
        </div>
      </div>
      {s.video && (
        <div id={playerId} hidden={!open}>
          {/* 第一次展開才載入播放器,之後只切換顯示與隱藏,收合再展開時停在原來的位置 */}
          {loaded && (
            <div className={styles.rowPlayer}>
              <LivePlayer script={s.video.script} title={s.video.title} onTime={() => {}} poster={FORK_POSTER} saveProgress={false} paused={!open || !visible} />
            </div>
          )}
        </div>
      )}
    </li>
  )
}

/** 主題「Claude Code 工作術」:版面同課程地圖頁,但用條列清單列情境,不分等級 */
export function ClaudeCodeTopicPage() {
  useHashScroll()
  const topic = CLAUDE_CODE_TOPIC
  const t = useT()
  const m = t.home.claudeCode
  const [expanded, setExpanded] = useState(true)
  const rowsId = useId()

  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}><span aria-hidden="true">🌱 </span>{t.home.planned}</p>
          <h1>{topic.name}</h1>
          <p className={styles.pitch}>{m.pitch(topic.slogan)}</p>
          <div className={styles.ctas}>
            <Link className={styles.primary} to={{ pathname: topic.path, hash: 'scenarios' }}>
              {m.viewAll}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} id="scenarios">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>{m.scenariosTitle}</h2>
            <p className={styles.lead}>{m.scenariosLead}</p>
          </header>
          <div className={styles.group}>
            <h3 className={styles.groupHead}>
              <button type="button" className={styles.groupToggle} aria-expanded={expanded} aria-controls={rowsId} onClick={() => setExpanded(!expanded)}>
                <svg className={styles.chevron} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
                {m.allScenarios}
                <span className={styles.groupCount}>{m.count(CLAUDE_CODE_SCENARIOS.length)}</span>
              </button>
            </h3>
            <ul id={rowsId} className={styles.rows} hidden={!expanded}>
              {CLAUDE_CODE_SCENARIOS.map((s) => (
                <ScenarioRow key={s.title} scenario={s} visible={expanded} />
              ))}
            </ul>
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
