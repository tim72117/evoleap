import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { findTopic, TOPIC_PATHS, useTopics, type Topic } from '../content/topics'
import { AI_APP_COURSES, AI_APPS_INTRO, MAP_INTRO, STAGE_COPY, stageAnchor, type CourseArt } from '../content/levels'
import { lessonLabel, lessonUrl } from '../content/catalog'
import { useCourseMap, type CourseMapState, type MapLesson, type MapUnit } from '../content/courseMap'
import { LessonListStatus } from '../courses/LessonGroup'
import { useLocale, useT } from '../i18n/I18nProvider'
import { AiAgentIntro } from './AiAgentIntro'
import { LevelArt } from './LevelArt'
import styles from './SoftwareTopicPage.module.css'

// 主題的課程地圖頁(/topics/software、/topics/ai-apps)。主題名稱讀資料庫的主題;等級名稱、課名、簡介、每一課與開放與否讀資料庫的課程地圖;
// 資料庫沒有欄位的文案(大標、卡片簡述與重點、先備條件)在 content/levels.ts。讀取中顯示佔位卡、讀不到顯示「無法讀取」。

/** 一張等級卡 */
type Level = {
  id: string
  levelLabel: string
  title: string
  summary?: string
  art: CourseArt
  link: string
  prerequisite?: string
  /** 卡片上的重點;沒有就列 lessons */
  topics?: string[]
  lessons?: MapLesson[]
}

/** 「做出自己的軟體」的等級:software 課程的單元(階段),先不公開的不列 */
function stageLevels(units: MapUnit[]): Level[] {
  return units
    .filter((u) => !u.hidden)
    .map((u) => {
      const copy = STAGE_COPY[u.id]
      return {
        id: u.id,
        levelLabel: u.label ?? u.title,
        // 單元標題是「起步・課名」,卡片另外有階段名稱,所以拿掉前面的「起步・」
        title: u.label && u.title.startsWith(`${u.label}・`) ? u.title.slice(u.label.length + 1) : u.title,
        summary: copy?.summary,
        art: copy?.art ?? 'tools',
        link: `/courses/software#${stageAnchor(u.id)}`,
        prerequisite: copy?.prerequisite,
        topics: copy?.topics,
        lessons: u.lessons,
      }
    })
}

function LevelCard({ level, index }: { level: Level; index: number | null }) {
  const t = useT()
  const m = t.home.software
  // 開放了哪幾課照資料庫(只有列出單課的等級有)
  const lessons = (level.lessons ?? []).map((l) => ({ ...l, label: lessonLabel(l), to: lessonUrl('software', l.id) }))
  const opened = lessons.filter((l) => l.status === 'open')
  return (
    <li id={`level-${level.id}`} className={`${styles.step} ${styles.planned}`} style={{ '--step': index ?? 0 } as CSSProperties}>
      <div className={styles.node} aria-hidden="true">
        {index}
      </div>
      <article className={styles.card}>
        <div className={styles.art}>
          <span className={styles.artLevel}>
            <strong>{t.home.levelName(level.levelLabel)}</strong>
          </span>
          <LevelArt art={level.art} />
        </div>
        <div className={styles.body}>
          <p className={styles.badges}>
            {opened.length ? (
              <span className={`${styles.badge} ${styles.badgeOpen}`}>{m.openedLessons(opened.map((l) => l.label).join(m.listSep))}</span>
            ) : (
              <span className={`${styles.badge} ${styles.badgePlanned}`}><span aria-hidden="true">🌱 </span>{t.home.planned}</span>
            )}
          </p>
          <h3>{level.title}</h3>
          {level.summary && <p className={styles.summary}>{level.summary}</p>}
          {lessons.length && !level.topics ? (
            <>
              <h4 className={styles.topicsHead}>{m.lessonContent}</h4>
              <ol className={styles.lessons}>
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link to={l.to} className={styles.lessonNum}>
                      {l.label}
                    </Link>
                    <span>{l.summary}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <h4 className={styles.topicsHead}>
                {m.lessonContent}
                {m.tentative}
              </h4>
              <ul className={styles.topics}>
                {(level.topics ?? []).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
          {level.prerequisite && (
            <p className={styles.prereq}>
              <span>{m.prerequisite}</span>
              {level.prerequisite}
            </p>
          )}
          <Link className={styles.cta} to={level.link}>
            {m.viewCourse} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </article>
    </li>
  )
}

type TopicMap = {
  topic?: Topic
  path: string
  intro: { kicker: string; titleLines: string[]; pitch?: string }
  /** 資料都讀到了是 ready */
  state: 'loading' | 'error' | 'ready'
  levels: Level[]
  /** 第一個等級的編號(做出自己的軟體從 Level 0 起算) */
  /** 算不出編號(software 讀不到)時是 null,不顯示編號 */
  first: number | null
  /** 課程地圖下方的課程介紹 */
  after?: ReactNode
}

/** 幾份資料合起來的狀態:有一份讀不到就是 error,都讀到才是 ready */
const combine = (...states: { status: CourseMapState['status'] }[]): TopicMap['state'] =>
  states.some((s) => s.status === 'error') ? 'error' : states.every((s) => s.status === 'ready') ? 'ready' : 'loading'

/** 主題「做出自己的軟體」:L0 起步到 L2 基礎 */
export function SoftwareTopicPage() {
  const topics = useTopics()
  const software = useCourseMap('software')
  const { locale } = useLocale()
  const map = software.status === 'ready' ? software.map : undefined
  return (
    <TopicMapPage
      topic={findTopic(topics, 'software')}
      path={TOPIC_PATHS.software}
      intro={{ ...MAP_INTRO, pitch: map?.about?.join(locale.startsWith('en') ? ' ' : '') }}
      state={combine(topics, software)}
      levels={map ? stageLevels(map.units) : []}
      first={0}
    />
  )
}

/** 主題「打造 AI 互動軟體」:中階、進階(都還在規劃中);課程地圖下方是中階課的課程介紹(AiAgentIntro) */
export function AiAppsTopicPage() {
  const topics = useTopics()
  // 等級編號接著「做出自己的軟體」的階段數往下排
  const software = useCourseMap('software')
  const agent = useCourseMap('ai-agent')
  const advanced = useCourseMap('advanced')
  // 只有這兩門課是必要的;software 只用來接編號、topics 只提供主題名稱,讀不到不影響等級卡(software 還在讀時先等,免得編號跳動)
  const state = software.status === 'loading' ? 'loading' : combine(agent, advanced)
  const levels: Level[] = AI_APP_COURSES.flatMap(({ id, topics: points, ...copy }) => {
    const s = id === 'ai-agent' ? agent : advanced
    if (s.status !== 'ready') return []
    const { title, summary, art, units } = s.map
    return [{ ...copy, id, title, summary, art: art ?? 'advanced', topics: points ?? units.filter((u) => !u.hidden).map((u) => u.title) }]
  })
  const first = software.status === 'ready' ? stageLevels(software.map.units).length : null
  return <TopicMapPage topic={findTopic(topics, 'ai-apps')} path={TOPIC_PATHS.aiApps} intro={AI_APPS_INTRO} state={state} levels={state === 'ready' ? levels : []} first={first} after={<AiAgentIntro />} />
}

/** 主題的課程地圖頁:由淺入深列出等級 */
function TopicMapPage({ topic, path, intro, state, levels, first, after }: TopicMap) {
  // 等級卡要讀到資料才有,讀到後再捲到 #level-…、#map
  useHashScroll(state)
  const t = useT()
  const m = t.home.software
  // 主視覺的次要按鈕:連到第一個已有課開放的等級(都還在規劃中時不顯示)
  const featured = levels.find((l) => l.lessons?.some((x) => x.status === 'open'))

  return (
    <SiteLayout title={topic ? topic.seoTitle || topic.name : null}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>{intro.kicker}</p>
          <h1>
            {intro.titleLines.map((line) => (
              <span key={line} className={styles.titleLine}>
                {line}
              </span>
            ))}
          </h1>
          {intro.pitch && <p className={styles.pitch}>{intro.pitch}</p>}
          <ol className={styles.overview} aria-label={m.overviewLabel}>
            {levels.map((l, i) => (
              <li key={l.id}>
                <Link to={{ pathname: path, hash: `level-${l.id}` }}>
                  <span className={styles.overviewNum}>{first === null ? null : first + i}</span>
                  {t.home.levelName(l.levelLabel)}
                </Link>
              </li>
            ))}
          </ol>
          <div className={styles.ctas}>
            <Link className={styles.primary} to={{ pathname: path, hash: 'map' }}>
              {t.home.viewCourseMap}
            </Link>
            {featured && (
              <Link className={styles.secondary} to={featured.link}>
                {m.featured(t.home.levelName(featured.levelLabel), featured.title.split('：')[0])}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section} id="map">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <p className={styles.eyebrow}>{m.eyebrow}</p>
            <h2>{m.levelsTitle}</h2>
            <p className={styles.lead}>{m.levelsLead}</p>
          </header>
          {state === 'ready' ? (
            <ol className={styles.map}>
              {levels.map((l, i) => (
                <LevelCard key={l.id} level={l} index={first === null ? null : first + i} />
              ))}
            </ol>
          ) : (
            <LessonListStatus state={state} />
          )}
        </div>
      </section>
      {after}
    </SiteLayout>
  )
}
