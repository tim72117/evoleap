import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { AI_APPS_TOPIC, SOFTWARE_TOPIC } from '../content/topics'
import { ACCESS_LABEL, AI_APP_LEVELS, AI_APPS_INTRO, LEVELS, MAP_INTRO, shownLevels, type CourseLevel } from '../content/levels'
import { courseOfLevel, levelMapId, levelMapLessons, lessonLabel, lessonUrl } from '../content/catalog'
import { useCourseMaps, type CourseMap } from '../content/courseMap'
import { useT } from '../i18n/I18nProvider'
import { AiAgentIntro } from './AiAgentIntro'
import { LevelArt } from './LevelArt'
import styles from './SoftwareTopicPage.module.css'

/** 資料庫課程地圖裡已開放(status open)的課號;還在讀、讀不到時是 undefined */
const openIdsOf = (map: CourseMap | undefined, level: CourseLevel) => {
  const lessons = levelMapLessons(map, level)
  return lessons ? new Set(lessons.filter((l) => l.status === 'open').map((l) => l.id)) : undefined
}

/** 等級的單課清單(只有「做出自己的軟體」的階段有):附上網址與是否已開放 */
/** (lessonLabel 依目前語言,呼叫的元件用 useT() 訂閱語言,換語言時會重算) */
function levelLessons(level: CourseLevel, openIds: Set<string> | undefined) {
  const course = courseOfLevel(level)
  if (course?.slug !== 'software') return []
  return (level.lessons ?? []).map((item) => ({ ...item, label: lessonLabel(item), to: lessonUrl(course.slug, item.id), open: openIds?.has(item.id) ?? false }))
}

function LevelCard({ level, index, openIds }: { level: CourseLevel; index: number; openIds?: Set<string> }) {
  const t = useT()
  const m = t.home.software
  const available = level.status === 'available'
  // 目前只有「免費」會顯示(其他是 null)
  const access = ACCESS_LABEL[level.access] && (level.access === 'free' ? m.free : ACCESS_LABEL[level.access])
  const lessons = levelLessons(level, openIds)
  const opened = lessons.filter((l) => l.open)
  return (
    <li
      id={`level-${level.id}`}
      className={`${styles.step} ${available ? styles.available : styles.planned}`}
      style={{ '--step': index } as CSSProperties}
    >
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
            {access && (
              <span className={`${styles.badge} ${level.access === 'free' ? styles.badgeFree : styles.badgeLogin}`}>
                {access}
              </span>
            )}
            {/* 開放了哪幾課照資料庫的課程地圖;還在讀、讀不到時不標(不誤標成規劃中) */}
            {available ? (
              <span className={`${styles.badge} ${styles.badgeOpen}`}>{m.contentReady}</span>
            ) : openIds === undefined ? null : opened.length ? (
              <span className={`${styles.badge} ${styles.badgeOpen}`}>{m.openedLessons(opened.map((l) => l.label).join(m.listSep))}</span>
            ) : (
              <span className={`${styles.badge} ${styles.badgePlanned}`}><span aria-hidden="true">🌱 </span>{t.home.planned}</span>
            )}
          </p>
          <h3>{level.title}</h3>
          <p className={styles.summary}>{level.summary}</p>
          {lessons.length ? (
            <>
              <h4 className={styles.topicsHead}>{m.lessonContent}</h4>
              <ol className={styles.lessons}>
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link to={l.to} className={styles.lessonNum}>
                      {l.label}
                    </Link>
                    <span>{l.text}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <h4 className={styles.topicsHead}>
                {m.lessonContent}
                {!available && m.tentative}
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
          {level.link && (
            <Link className={styles.cta} to={level.link}>
              {m.viewCourse} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </article>
    </li>
  )
}

type TopicMap = {
  topic: { name: string; path: string; seoTitle: string }
  intro: { kicker: string; titleLines: string[]; pitch: string }
  levels: CourseLevel[]
  /** 第一個等級的編號(做出自己的軟體從 Level 0 起算) */
  first: number
  /** 課程地圖下方的課程介紹(外觀文案,不進資料庫) */
  after?: ReactNode
}

/** 主題「做出自己的軟體」:L0 起步到 L2 基礎 */
// 先不公開(hidden)的等級不列,後面的等級編號接著往下排
const SOFTWARE_LEVELS = shownLevels(LEVELS)
export const SoftwareTopicPage = () => <TopicMapPage topic={SOFTWARE_TOPIC} intro={MAP_INTRO} levels={SOFTWARE_LEVELS} first={0} />

/** 主題「打造 AI 互動軟體」:中階、進階(都還在規劃中);課程地圖下方是中階課的課程介紹(AiAgentIntro) */
export const AiAppsTopicPage = () => <TopicMapPage topic={AI_APPS_TOPIC} intro={AI_APPS_INTRO} levels={shownLevels(AI_APP_LEVELS)} first={SOFTWARE_LEVELS.length} after={<AiAgentIntro />} />

/** 主題的課程地圖頁:由淺入深列出等級 */
function TopicMapPage({ topic, intro, levels, first, after }: TopicMap) {
  useHashScroll()
  const t = useT()
  const m = t.home.software
  // 主視覺的次要按鈕:連到第一個已有課程可看的等級(都還在規劃中時不顯示)
  // 哪些課開放了照資料庫的課程地圖(讀不到時卡片不標開放狀態)
  const maps = useCourseMaps([...new Set(levels.map(levelMapId))])
  const openIds = (l: CourseLevel) => openIdsOf(maps[levelMapId(l)], l)
  const featured = levels.find((l) => l.link && (l.status === 'available' || levelLessons(l, openIds(l)).some((x) => x.open)))

  return (
    <SiteLayout title={topic.seoTitle}>
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
          <p className={styles.pitch}>{intro.pitch}</p>
          <ol className={styles.overview} aria-label={m.overviewLabel}>
            {levels.map((l, i) => (
              <li key={l.id}>
                <Link to={{ pathname: topic.path, hash: `level-${l.id}` }}>
                  <span className={styles.overviewNum}>{first + i}</span>
                  {t.home.levelName(l.levelLabel)}
                </Link>
              </li>
            ))}
          </ol>
          <div className={styles.ctas}>
            <Link className={styles.primary} to={{ pathname: topic.path, hash: 'map' }}>
              {t.home.viewCourseMap}
            </Link>
            {featured?.link && (
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
          <ol className={styles.map}>
            {levels.map((l, i) => (
              <LevelCard key={l.id} level={l} index={first + i} openIds={openIds(l)} />
            ))}
          </ol>
        </div>
      </section>
      {after}
    </SiteLayout>
  )
}
