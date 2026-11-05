import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { LivePlayer } from '../courses/LivePlayer'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC } from '../content/topics'
import styles from './SoftwareTopicPage.module.css'

type Scenario = (typeof CLAUDE_CODE_SCENARIOS)[number]

/** 開頭是空白的字卡前奏,封面改用 Fork 的選單畫面 */
const FORK_POSTER = { chapter: '用 Fork 分出去', after: 2500 }

function ScenarioRow({ scenario: s }: { scenario: Scenario }) {
  const [open, setOpen] = useState(false)
  const playerId = useId()
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
              <button type="button" className={styles.rowButton} aria-expanded={open} aria-controls={playerId} onClick={() => setOpen(!open)}>
                {s.title}
              </button>
            ) : (
              s.title
            )}
          </h4>
          <p>
            {s.summary}{' '}
            <span className={styles.tools}>
              {s.tools.map((t) => (
                <code key={t}>{t}</code>
              ))}
            </span>
          </p>
        </div>
        <div className={styles.rowMeta}>
          {s.video ? (
            <>
              <span className={styles.tag}>影片</span>
              <span>{s.video.duration}</span>
            </>
          ) : (
            <span className={`${styles.tag} ${styles.tagPlanned}`}>規劃中</span>
          )}
        </div>
      </div>
      {s.video && (
        <div id={playerId} hidden={!open}>
          {/* 第一次展開才載入播放器 */}
          {open && (
            <div className={styles.rowPlayer}>
              <LivePlayer script={s.video.script} title={s.video.title} onTime={() => {}} poster={FORK_POSTER} saveProgress={false} />
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
  const [expanded, setExpanded] = useState(true)
  const rowsId = useId()

  return (
    <SiteLayout title={topic.seoTitle}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>規劃中</p>
          <h1>{topic.name}</h1>
          <p className={styles.pitch}>{topic.slogan}。遇到哪個情況就看哪一個，不用照順序。</p>
          <div className={styles.ctas}>
            <Link className={styles.primary} to={{ pathname: topic.path, hash: 'scenarios' }}>
              查看所有情境
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} id="scenarios">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <h2>使用情境</h2>
            <p className={styles.lead}>內容還在規劃，可能調整；功能名稱會隨工具改版。</p>
          </header>
          <div className={styles.group}>
            <h3 className={styles.groupHead}>
              <button type="button" className={styles.groupToggle} aria-expanded={expanded} aria-controls={rowsId} onClick={() => setExpanded(!expanded)}>
                <svg className={styles.chevron} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
                全部情境
                <span className={styles.groupCount}>{CLAUDE_CODE_SCENARIOS.length} 個情境</span>
              </button>
            </h3>
            {expanded && (
              <ul id={rowsId} className={styles.rows}>
                {CLAUDE_CODE_SCENARIOS.map((s) => (
                  <ScenarioRow key={s.title} scenario={s} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
