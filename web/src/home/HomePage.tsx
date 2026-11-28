import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { lessonUrl, PREVIEW_LESSON_ID } from '../content/catalog'
import { useCourseMap } from '../content/courseMap'
import { LessonListStatus } from '../courses/LessonGroup'
import { findTopic, topicStartLabel, TOPIC_PATHS, useTopics, type Topic } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { sortByViews, useTopicViews } from './useTopicViews'
import { SiteLayout } from '../site/SiteLayout'
import type { CourseArt } from '../content/levels'
import { LevelArt } from './LevelArt'
import { TopicArt, TourCoverArt } from './TopicArt'
import styles from './HomePage.module.css'

// 首頁:先列出主題,再進入各主題。有內容的主題佔整排,列出各等級能學到什麼(首頁不放影片預覽);
// 規劃中的主題縮小,只寫預計做出的成果。主題(名稱、標語、卡片內容)讀資料庫(content/topics.ts 的 useTopics):讀取中顯示佔位卡、讀不到顯示「無法讀取」。

// 「開始第一課」從序章開始(不用登入就能看)
const introPath = lessonUrl('software', PREVIEW_LESSON_ID)

/** 首頁卡片的插圖(純裝飾,沿用主題頁的插圖);tone 是插圖面板的主色。沒列到的主題用預設圖 */
type CardArt = { art: ReactNode; tone?: 'sky' | 'warm' }
const level = (art: CourseArt) => <LevelArt art={art} />
const CARD_ART: Record<string, CardArt> = {
  launch: { art: <TopicArt name="speak" />, tone: 'sky' },
  kids: { art: <TopicArt name="next" />, tone: 'warm' },
  web: { art: level('build'), tone: 'sky' },
  'ai-apps': { art: level('agent') },
  monetize: { art: level('advanced'), tone: 'warm' },
  'life-data': { art: level('tools') },
  'claude-code': { art: level('chat'), tone: 'warm' },
}
const cardArt = (id: string): CardArt => CARD_ART[id] ?? { art: level('advanced') }

/** 首頁上另外安排位置的主題:最上面的主打、接在後面的兩個;其他的照資料庫順序列在「更多主題」 */
const FEATURED = 'software'
const SECOND_ROW = ['launch', 'kids']

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
  const topicsState = useTopics()
  const softwareState = useCourseMap('software')
  const topicViews = useTopicViews()
  const software = findTopic(topicsState, FEATURED)
  const softwareViews = topicViews?.[FEATURED]
  // 階段(起步、基礎;先不公開的不列)的名稱與開放與否照資料庫課程地圖的單元;還在讀、讀不到時不列
  const ladder = softwareState.status === 'ready'
    ? softwareState.map.units.filter((u) => !u.hidden && u.label).map((u) => ({ name: u.label!, open: u.lessons.some((l) => l.status === 'open') }))
    : []
  const topics = topicsState.status === 'ready' ? topicsState.topics : []
  const second = SECOND_ROW.flatMap((id) => topics.filter((p) => p.id === id))
  const others = topics.filter((p) => p.id !== FEATURED && !SECOND_ROW.includes(p.id))
  const facts = [t.home.home.facts.free, t.home.home.facts.noCode]
  if (/^#(map|level-)/.test(hash)) return <Navigate replace to={{ pathname: TOPIC_PATHS.software, hash }} />

  // 大標在第一個逗號後換行,後半句用漸層字(和主題頁的主視覺一樣);沒有逗號就整句一行
  const comma = t.home.introTitle.search(/[，,]/)
  const titleHead = comma < 0 ? t.home.introTitle : t.home.introTitle.slice(0, comma + 1)
  const titleTail = comma < 0 ? '' : t.home.introTitle.slice(comma + 1)

  return (
    <SiteLayout>
      <div className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.container}>
          <h1>
            <span className={styles.titleLine}>{titleHead}</span>
            {titleTail && <span className={`${styles.titleLine} ${styles.titleAccent}`}>{titleTail}</span>}
          </h1>
          <p className={styles.pitch}>{t.home.introPitch}</p>
        </div>
      </section>

      <div className={styles.container}>
        {topicsState.status !== 'ready' && <LessonListStatus state={topicsState.status} />}
        {software && (
          <article className={styles.featured} aria-labelledby="theme-software">
            <div className={styles.featuredMain}>
              <div className={styles.featuredText}>
                <div className={styles.themeHead}>
                  <h2 id="theme-software">{software.name}</h2>
                  {softwareViews ? <ViewsLine text={t.home.themeCard.views(softwareViews)} /> : null}
                </div>
                <p className={styles.slogan}>{software.slogan}</p>
                <p className={styles.lede}>{software.content?.lede}</p>
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
                  <Link className={styles.secondary} to={TOPIC_PATHS.software}>
                    {t.home.topicCourses}
                  </Link>
                </div>
              </div>
              <div className={`${styles.art} ${styles.featuredArt}`} aria-hidden="true">
                <TourCoverArt />
              </div>
            </div>

            {/* 這個主題能學到什麼:依等級各一項 */}
            <div className={styles.learn}>
              <h3>{t.home.home.learnTitle}</h3>
              <ul>
                {(software.content?.learn ?? []).map((l) =>
                  typeof l === 'string' ? (
                    <li key={l}>{l}</li>
                  ) : (
                    <li key={l.level}>
                      <span className={styles.learnLevel}>{t.home.levelName(l.level)}</span>
                      {l.text}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </article>
        )}

        {/* 接在「做出自己的軟體」後面:做好之後的下一步 */}
        {/* 觀看次數多的主題排前面(還沒讀到次數時照原本的順序:上線、兒童課) */}
        {sortByViews(second, (p) => p.id, topicViews).map((p) => (
          <section key={p.id} className={styles.kids} aria-label={p.name}>
            <ThemeCard t={p} art={cardArt(p.id)} />
          </section>
        ))}

        {others.length > 0 && (
          <section className={styles.next} aria-labelledby="next-themes">
            <h2 id="next-themes">{t.home.home.moreTopics}</h2>
            <div className={styles.nextGrid}>
              {others.map((p) => (
                <ThemeCard t={p} key={p.id} art={cardArt(p.id)} />
              ))}
            </div>
          </section>
        )}
      </div>
      </div>
    </SiteLayout>
  )
}

/** 主題的觀看次數:眼睛圖示加文字(圖示只是裝飾,文字已經說明) */
function ViewsLine({ text }: { text: string }) {
  return (
    <p className={styles.views}>
      <svg className={styles.viewsIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {text}
    </p>
  )
}

/**
 * 規劃中(或已開放、t.open)主題的卡片:名稱、標語、步驟或整理前後示意、預計做出的成果或涵蓋的情境。
 * aside 放在標題與內容的右側(窄螢幕排到下面);below 接在步驟下面。
 * 有 aside 的卡片,「你會做出」另起一段橫跨整張卡片,放在標題與預覽下面(仿照「做出自己的軟體」的成果段)。
 * art 是首頁的插圖面板(裝飾),不和 aside 一起用。
 * 首頁不放 aside;展示頁(ShowcasePage)的兒童課卡片把預覽播放器放在 aside
 */
export function ThemeCard({ t: data, aside, below, art }: { t: Topic; aside?: ReactNode; below?: ReactNode; art?: CardArt }) {
  const topic = { ...data.content, id: data.id, name: data.name, slogan: data.slogan, path: data.path }
  const t = useT()
  const m = t.home.themeCard
  const topicViews = useTopicViews()
  const viewCount = topicViews?.[topic.id]
  // 「開始第一課」寫在主題資料裡;是這句固定按鈕字就照目前語言
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
        {viewCount ? <ViewsLine text={m.views(viewCount)} /> : null}
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
              <li key={String(s)}>{typeof s === 'string' ? s : s.text}</li>
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
            <Link className={styles.secondary} to={topic.path}>
              {topic.path.startsWith('/topics/') ? t.home.topicCourses : t.home.courseMap}
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
  if (art)
    return (
      <article className={`${cls} ${styles.themeArt}`}>
        <div className={styles.art} data-tone={art.tone} aria-hidden="true">
          {art.art}
        </div>
        <div className={styles.themeBody}>{body}</div>
      </article>
    )
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
