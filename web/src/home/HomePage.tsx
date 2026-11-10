import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { COURSES, isPreviewLesson, lessonPath, openLessonsOf } from '../content/catalog'
import { KIDS_TOPIC, LAUNCH_TOPIC, PLANNED_TOPICS, SOFTWARE_TOPIC, topicStartLabel, type PlannedTopic } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import bakerySite from './assets/bakery-site.jpg'
import styles from './HomePage.module.css'

// 首頁:先列出主題,再進入各主題。有內容的主題佔整排,直接看得到做出來的成品(首頁不放影片預覽);
// 規劃中的主題縮小,只寫預計做出的成果。課數、連結與示範提示詞都取自課程資料,主題文案在 content/topics.ts。

const tools = COURSES.find((c) => c.slug === 'software')!
// 「開始第一課」從序章開始(不用登入就能看);已開放的課數算起步階段(tools)的
const toolsStage = tools.stages!.find((st) => st.id === 'tools')!
const openLessons = openLessonsOf({ ...tools, lessons: toolsStage.lessons })
const introLesson = tools.lessons.find(isPreviewLesson)!
const sitePrompt = tools.lessons.find((l) => l.id === '0.2')!.steps[0].prompt!

// 這個主題的等級(起步、零基礎、基礎);中階、進階在主題「打造 AI 互動軟體」
const LADDER = tools.stages!.map((st) => ({
  name: st.label,
  open: st.lessons.some((l) => l.videos.some((v) => v.live)),
}))

const TOPIC_ICONS = {
  terminal: (
    <svg className={styles.themeIcon} viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="16" rx="3" />
      <path d="m7 9.5 3 2.5-3 2.5" />
      <path d="M12.5 15H17" />
    </svg>
  ),
}

export function HomePage() {
  // 課程地圖以前在首頁:舊連結(/#map、/#level-tools)導到課程頁的同一個位置(等級就是單元:#level-<等級> → #stage-<等級>)
  const { hash } = useLocation()
  const [resultOpen, setResultOpen] = useState(false)
  const t = useT()
  const facts = [t.home.home.facts.free, t.home.home.facts.open(openLessons.length), t.home.home.facts.noCode]
  if (/^#(map|level-)/.test(hash)) return <Navigate replace to={{ pathname: SOFTWARE_TOPIC.path, hash: hash.replace('#level-', '#stage-') }} />

  return (
    <SiteLayout>
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1>{t.home.introTitle}</h1>
          <p className={styles.pitch}>{t.home.introPitch}</p>
        </div>
      </section>

      <div className={styles.container}>
        <article className={styles.featured} aria-labelledby="theme-software">
          <div className={styles.featuredMain}>
            <div className={styles.featuredText}>
              <h2 id="theme-software">{SOFTWARE_TOPIC.name}</h2>
              <p className={styles.slogan}>{SOFTWARE_TOPIC.slogan}</p>
              <p className={styles.lede}>{SOFTWARE_TOPIC.lede}</p>
              <ul className={styles.facts}>
                {facts.map((f) => (
                  <li key={f.strong}>
                    {f.pre}
                    <strong>{f.strong}</strong>
                    {f.post}
                  </li>
                ))}
              </ul>
              <ol className={styles.ladder} aria-label={t.home.home.ladderLabel}>
                {LADDER.map((s) => (
                  <li key={s.name} className={s.open ? styles.ladderOpen : undefined}>
                    {t.home.levelName(s.name)}
                  </li>
                ))}
              </ol>
              <div className={styles.ctas}>
                <Link className={styles.primary} to={lessonPath(tools, introLesson)}>
                  {t.home.startFirstLesson}
                </Link>
                <Link className={styles.secondary} to={{ pathname: SOFTWARE_TOPIC.path, hash: 'map' }}>
                  {t.home.courseMap}
                </Link>
              </div>
            </div>
          </div>

          <div id="home-result" className={styles.result} data-open={resultOpen}>
            <div className={styles.resultPrompt}>
              <h3>{t.home.home.resultTitle}</h3>
              <p className={styles.resultNote}>{t.home.home.resultIntro}</p>
              <blockquote>{sitePrompt}</blockquote>
              <p className={styles.resultNote}>{t.home.home.resultOutro}</p>
            </div>
            <figure className={styles.resultShot}>
              <img src={bakerySite} alt={t.home.home.resultAlt} width={1520} height={1040} loading="lazy" />
              <figcaption>{t.home.home.resultCaption}</figcaption>
            </figure>
          </div>
          {/* 手機版預設收起「第 2 課就能做出這個網站」:卡片下緣的展開條,展開後內容出現在上方、這條變成「收起」;桌機不顯示 */}
          <button
            type="button"
            className={styles.resultToggle}
            aria-expanded={resultOpen}
            aria-controls="home-result"
            onClick={(e) => {
              const bar = e.currentTarget
              setResultOpen((o) => !o)
              // 收起時上方內容消失、展開條往上跳:收起後把展開條捲回畫面中,不會突然看到下一個區塊
              if (resultOpen) requestAnimationFrame(() => bar.scrollIntoView({ block: 'nearest' }))
            }}
          >
            {resultOpen ? t.home.home.collapse : t.home.home.resultTitle}
            <svg className={styles.resultChevron} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </article>

        {/* 接在「做出自己的軟體」後面:做好之後的下一步 */}
        <section className={styles.kids} aria-label={LAUNCH_TOPIC.name}>
          <ThemeCard t={LAUNCH_TOPIC} />
        </section>

        <section className={styles.kids} aria-label={KIDS_TOPIC.name}>
          <ThemeCard t={KIDS_TOPIC} />
        </section>

        <section className={styles.next} aria-labelledby="next-themes">
          <h2 id="next-themes">{t.home.home.moreTopics}</h2>
          <div className={styles.nextGrid}>
            {PLANNED_TOPICS.map((p) => (
              <ThemeCard t={p} key={p.name} />
            ))}
          </div>
        </section>
      </div>
    </SiteLayout>
  )
}

/**
 * 規劃中(或已開放、t.open)主題的卡片:名稱、標語、步驟或整理前後示意、預計做出的成果或涵蓋的情境。
 * aside 放在標題與內容的右側(窄螢幕排到下面);below 接在步驟下面。
 * 有 aside 的卡片,「你會做出」另起一段橫跨整張卡片,放在標題與預覽下面(仿照「做出自己的軟體」的成果段)。
 * 首頁不放 aside;展示頁(ShowcasePage)的兒童課卡片把預覽播放器放在 aside
 */
export function ThemeCard({ t: topic, aside, below }: { t: PlannedTopic; aside?: ReactNode; below?: ReactNode }) {
  const t = useT()
  const m = t.home.themeCard
  // 「開始第一課」寫在課程資料裡;是這句固定按鈕字就照目前語言
  const startLabel = topic.start && topicStartLabel(topic.start)
  const outcomes = topic.outcomes && (
    <>
      <h4>{m.youWillMake}</h4>
      <ul className={styles.outcomes}>
        {topic.outcomes.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
    </>
  )
  const body = (
    <>
      {/* 首頁不標「開放中」:有主色標籤的主題放標籤;規劃中的主題在標題右邊標小樹苗(和兒童課的「規劃中」一樣) */}
      {topic.tag && <p className={`${styles.badge} ${styles.badgeOpen}`}>{topic.tag}</p>}
      <div className={styles.themeHead}>
        <h3>
          {topic.icon && TOPIC_ICONS[topic.icon]}
          {topic.name}
        </h3>
        {!topic.open && (
          <p className={styles.planned}>
            <span className={styles.plannedIcon} aria-hidden="true">
              🌱
            </span>
            {t.home.planned}
          </p>
        )}
      </div>
      <p className={styles.themeSlogan}>{topic.slogan}</p>
      {topic.intro && <p className={styles.themeIntro}>{topic.intro}</p>}
      {topic.pains && (
        <>
          <h4>{m.stuck}</h4>
          <ul className={styles.outcomes}>
            {topic.pains.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {topic.learn && (
        <>
          <h4>{topic.learnTitle ?? m.learnDefault}</h4>
          <ul className={styles.outcomes}>
            {topic.learn.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {topic.flow && (
        <ol className={styles.flow} aria-label={m.flowLabel}>
          {topic.flow.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      {topic.sample && (
        <div className={styles.sample}>
          <p className={styles.sampleCaption}>{topic.sample.caption}</p>
          <div className={styles.sampleGrid}>
            <div>
              <h4>{m.before}</h4>
              <ul>
                {topic.sample.before.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <span aria-hidden="true">→</span>
            <div>
              <h4>{m.after}</h4>
              <ul>
                {topic.sample.after.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {topic.start && (
        // 已經可以上第一課的主題:按鈕放在步驟下面,和「做出自己的軟體」的位置一樣
        <div className={styles.ctas}>
          <Link className={styles.primary} to={topic.start.path}>
            {startLabel}
          </Link>
          {topic.path && (
            <Link className={styles.secondary} to={{ pathname: topic.path, hash: 'map' }}>
              {t.home.courseMap}
            </Link>
          )}
        </div>
      )}
      {below}
      {!aside && outcomes}
      {topic.scenarios && (
        <>
          <h4>{m.scenarios}</h4>
          <ul className={styles.outcomes}>
            {topic.scenarios.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {!topic.start && topic.path && (
        <Link className={styles.themeLink} to={topic.path}>
          {m.seePlan} <span aria-hidden="true">→</span>
        </Link>
      )}
    </>
  )
  const cls = topic.open ? `${styles.theme} ${styles.themeOpen}` : styles.theme
  if (!aside) return <article className={cls}>{body}</article>
  return (
    <article className={`${cls} ${styles.themeAside}`}>
      <div>{body}</div>
      {aside}
      {topic.outcomes && (
        <div className={styles.themeResult}>
          <h3>{m.youWillMake}</h3>
          <ol>
            {topic.outcomes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}
