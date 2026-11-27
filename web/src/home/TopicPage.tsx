import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { findTopic, TOPIC_PATHS, useTopics } from '../content/topics'
import { useTopicPage, type PageSection } from '../content/topicPage'
import { stageAnchor, type CourseArt } from '../content/levels'
import { lessonLabel, lessonUrl } from '../content/catalog'
import { useCourseMapStates, type CourseMap, type CourseMapState, type MapLesson } from '../content/courseMap'
import { LessonListStatus } from '../courses/LessonGroup'
import { useLocale, useT } from '../i18n/I18nProvider'
import { LevelArt } from './LevelArt'
import { CardsSection, ListsSection, UnitsSection } from './TopicSections'
import styles from './SoftwareTopicPage.module.css'

// 主題頁(/topics/software、/topics/ai-apps)共用的頁面:照資料庫的區塊(content/topicPage.ts)由上到下畫。
// 大標、卡片與條列讀區塊;主題名稱讀主題;等級名稱、課名、簡介、每一課與開放與否讀課程地圖。讀取中顯示佔位卡、讀不到顯示「無法讀取」。

/** 一張等級卡 */
type Level = {
  id: string
  /** 單課網址用的課程 id */
  course: string
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

const texts = (list?: { text?: string }[]) => (list?.length ? list.map((x) => x.text ?? '') : undefined)

/** levels 區塊有 source:卡片是那門課公開的單元(階段) */
function stageLevels(section: PageSection, map: CourseMap): Level[] {
  const source = section.source!
  return map.units
    .filter((u) => !u.hidden)
    .map((u) => {
      const copy = section.blocks?.find((b) => b.ref === u.id)
      return {
        id: u.id,
        course: source,
        levelLabel: u.label ?? u.title,
        // 單元標題是「起步・課名」,卡片另外有階段名稱,所以拿掉前面的「起步・」
        title: u.label && u.title.startsWith(`${u.label}・`) ? u.title.slice(u.label.length + 1) : u.title,
        summary: copy?.text,
        art: (copy?.variant as CourseArt) || 'tools',
        link: `/courses/${source}#${stageAnchor(u.id)}`,
        prerequisite: copy?.note,
        topics: texts(copy?.children),
        lessons: u.lessons,
      }
    })
}

/** levels 區塊沒有 source:卡片是區塊裡列的課程;有總覽頁的課連總覽頁,沒有的連本頁的單元那一段 */
function courseLevels(section: PageSection, maps: Record<string, CourseMapState>, path: string): Level[] {
  return (section.blocks ?? []).flatMap((b) => {
    const s = maps[b.ref ?? '']
    if (s?.status !== 'ready') return []
    const { id, title, summary, art, units, overview } = s.map
    return [
      {
        id,
        course: id,
        levelLabel: b.label ?? title,
        title,
        summary: b.text || summary,
        art: (b.variant as CourseArt) || art || 'advanced',
        link: overview === false ? `${path}#units` : `/courses/${id}`,
        prerequisite: b.note,
        topics: texts(b.children) ?? units.filter((u) => !u.hidden).map((u) => u.title),
      },
    ]
  })
}

function LevelCard({ level, index }: { level: Level; index: number | null }) {
  const t = useT()
  const m = t.home.software
  // 開放了哪幾課照資料庫(只有列出單課的等級有)
  const lessons = (level.lessons ?? []).map((l) => ({ ...l, label: lessonLabel(l), to: lessonUrl(level.course, l.id) }))
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

/** 一個區塊要讀哪些課程地圖 */
function neededCourses(s: PageSection): string[] {
  if (s.kind === 'levels') return s.source ? [s.source] : [s.variant ?? '', ...(s.blocks ?? []).map((b) => b.ref ?? '')]
  return s.kind === 'units' && s.source ? [s.source] : []
}

export const SoftwareTopicPage = () => <TopicPage id="software" path={TOPIC_PATHS.software} />
export const AiAppsTopicPage = () => <TopicPage id="ai-apps" path={TOPIC_PATHS.aiApps} />

export function TopicPage({ id, path }: { id: string; path: string }) {
  const topics = useTopics()
  const topic = findTopic(topics, id)
  const page = useTopicPage(id)
  const t = useT()
  const m = t.home.software
  const { locale } = useLocale()
  const sections = page.status === 'ready' ? page.sections : []
  const maps = useCourseMapStates([...new Set(sections.flatMap(neededCourses).filter(Boolean))])

  // 等級卡:卡片要用到的課程地圖都讀到才算 ready;接續編號的那門課(variant)只用來算編號,讀不到不影響卡片(還在讀時先等,免得編號跳動)
  const levelsSection = sections.find((s) => s.kind === 'levels')
  const needed = levelsSection ? (levelsSection.source ? [levelsSection.source] : (levelsSection.blocks ?? []).map((b) => b.ref ?? '')) : []
  const after = levelsSection && !levelsSection.source ? levelsSection.variant : undefined
  const states = needed.map((c) => maps[c]?.status ?? 'loading')
  const state: CourseMapState['status'] =
    page.status === 'error' || topics.status === 'error' && levelsSection?.source || states.includes('error')
      ? 'error'
      : page.status === 'ready' && states.every((s) => s === 'ready') && !(after && (maps[after]?.status ?? 'loading') === 'loading') && !(levelsSection?.source && topics.status !== 'ready')
        ? 'ready'
        : 'loading'

  const sourceState = levelsSection?.source ? maps[levelsSection.source] : undefined
  const sourceMap = sourceState?.status === 'ready' ? sourceState.map : undefined
  const levels = state !== 'ready' || !levelsSection ? [] : sourceMap ? stageLevels(levelsSection, sourceMap) : courseLevels(levelsSection, maps, path)
  // 第一個等級的編號;算不出來(接續的課讀不到)就不顯示編號
  const afterState = after ? maps[after] : undefined
  const first = !after ? 0 : afterState?.status === 'ready' ? afterState.map.units.filter((u) => !u.hidden).length : null

  // 讀到後再捲到 #level-…、#map、#units
  useHashScroll(state)
  // 主視覺的次要按鈕:連到第一個已有課開放的等級(都還在規劃中時不顯示)
  const featured = levels.find((l) => l.lessons?.some((x) => x.status === 'open'))

  return (
    <SiteLayout title={topic ? topic.seoTitle || topic.name : null}>
      {page.status !== 'ready' && (
        <section className={styles.section} id="map">
          <div className={styles.container}>
            <LessonListStatus state={page.status} />
          </div>
        </section>
      )}
      {sections.map((s, index) => {
        // 區塊底色交錯
        const alt = index % 2 === 1 && s.kind !== 'levels'
        switch (s.kind) {
          case 'hero': {
            const pitch = s.lead || sourceMap?.about?.join(locale.startsWith('en') ? ' ' : '')
            return (
              <section key={s.id} className={styles.hero}>
                <div className={styles.heroInner}>
                  <p className={styles.kicker}>{s.eyebrow}</p>
                  <h1>
                    {(s.title ?? '').split('\n').map((line) => (
                      <span key={line} className={styles.titleLine}>
                        {line}
                      </span>
                    ))}
                  </h1>
                  {pitch && <p className={styles.pitch}>{pitch}</p>}
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
            )
          }
          case 'levels':
            return (
              <section key={s.id} className={styles.section} id={s.id}>
                <div className={styles.container}>
                  <header className={styles.sectionHead}>
                    <p className={styles.eyebrow}>{s.eyebrow || m.eyebrow}</p>
                    <h2>{s.title || m.levelsTitle}</h2>
                    <p className={styles.lead}>{s.lead || m.levelsLead}</p>
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
            )
          case 'cards':
            return <CardsSection key={s.id} section={s} alt={alt} />
          case 'lists':
            return <ListsSection key={s.id} section={s} alt={alt} />
          case 'units':
            return <UnitsSection key={s.id} section={s} alt={alt} course={maps[s.source ?? ''] ?? { status: 'loading' }} />
          default:
            return null
        }
      })}
    </SiteLayout>
  )
}
