import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { COURSES, courseMapId, lessonUrl, PREVIEW_LESSON_ID } from '../content/catalog'
import { useCourseMaps } from '../content/courseMap'
import { KIDS_TOPIC, LAUNCH_TOPIC, PLANNED_TOPICS, SOFTWARE_TOPIC, topicStartLabel, type PlannedTopic } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import styles from './HomePage.module.css'

// 首頁:先列出主題,再進入各主題。有內容的主題佔整排,列出各等級能學到什麼(首頁不放影片預覽);
// 規劃中的主題縮小,只寫預計做出的成果。連結取自課程資料,主題文案在 content/topics.ts。

const software = COURSES.find((c) => c.slug === 'software')!
// 「開始第一課」從序章開始(不用登入就能看)
const introPath = lessonUrl(software.slug, PREVIEW_LESSON_ID)

// 這個主題的階段(起步、基礎;先不公開的零基礎不列),就是「做出自己的軟體」這門課的階段;中階、進階在主題「打造 AI 互動軟體」。階段名稱與已開放與否照資料庫課程地圖的單元(label、hidden;讀到之前先用種子的階段名稱)
const LADDER_STAGES = software.stages!.filter((st) => !st.hidden)
const LADDER_MAP_IDS = [courseMapId(software)]

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
  // 課程地圖以前在首頁:舊連結(/#map、/#level-tools)導到主題頁的同一個位置
  const { hash } = useLocation()
  const t = useT()
  const maps = useCourseMaps(LADDER_MAP_IDS)
  // 已開放與否照資料庫的課程地圖;還在讀、讀不到時等級不亮(不用前端的課程資料頂替)
  // 階段名稱與先不公開照資料庫課程地圖的單元(label、hidden);讀到之前先用同一份種子的階段名稱(不亮),版面不位移
  const softwareMap = maps[courseMapId(software)]
  const ladder = softwareMap
    ? softwareMap.units.filter((u) => !u.hidden && u.label).map((u) => ({ name: u.label!, open: u.lessons.some((l) => l.status === 'open') }))
    : LADDER_STAGES.map((st) => ({ name: st.label, open: false }))
  const facts = [t.home.home.facts.free, t.home.home.facts.noCode]
  if (/^#(map|level-)/.test(hash)) return <Navigate replace to={{ pathname: SOFTWARE_TOPIC.path, hash }} />

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
                {ladder.map((s) => (
                  <li key={s.name} className={s.open ? styles.ladderOpen : undefined}>
                    {t.home.levelName(s.name)}
                  </li>
                ))}
              </ol>
              <div className={styles.ctas}>
                <Link className={styles.primary} to={introPath}>
                  {t.home.startFirstLesson}
                </Link>
                <Link className={styles.secondary} to={{ pathname: SOFTWARE_TOPIC.path, hash: 'map' }}>
                  {t.home.courseMap}
                </Link>
              </div>
            </div>
          </div>

          {/* 這個主題能學到什麼:依等級各一項 */}
          <div className={styles.learn}>
            <h3>{t.home.home.learnTitle}</h3>
            <ul>
              {SOFTWARE_TOPIC.learn.map((l) => (
                <li key={l.level}>
                  <span className={styles.learnLevel}>{t.home.levelName(l.level)}</span>
                  {l.text}
                </li>
              ))}
            </ul>
          </div>
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
