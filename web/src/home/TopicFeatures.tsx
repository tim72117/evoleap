import { Link, type To } from 'react-router-dom'
import { PREVIEW_LESSON_ID } from '../content/catalog'
import type { CourseMap } from '../content/courseMap'
import type { PageSection } from '../content/topicPage'
import { useT } from '../i18n/I18nProvider'
import { ART, type ArtName } from '../live/actors/picture-card/art'
import { lazyPart } from '../site/lazyPart'
import { hasTopicArt, TopicArt } from './TopicArt'
import styles from './TopicFeatures.module.css'

// 主題頁的特色介紹(features 區塊):一排課程數字、圖文左右交錯的段落。文案讀資料庫,數字讀課程地圖(不寫死)。

// 互動展示用到舞台引擎,另外下載,不放進網站首次載入的主程式
const IntroDemo = lazyPart(() => import('./IntroDemo').then((m) => m.IntroDemo))

/** 序章圖卡的插圖(淺色底)。插圖是程式裡固定的向量圖(代號由伺服器檢查),不含使用者內容 */
function CardArt({ name }: { name: ArtName }) {
  return <svg className={styles.cardArt} viewBox="0 0 400 260" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[name] }} />
}

/** 已開放的課數、它們的總時間、有開放課的階段數(規劃中的不算,免得誇大);地圖還沒讀到時是 null */
function statsOf(map: CourseMap | undefined): { lessons: number; minutes: number; stages: number } | null {
  if (!map) return null
  const units = map.units.filter((u) => !u.hidden).map((u) => u.lessons.filter((l) => l.status === 'open'))
  const lessons = units.flat()
  const minutes = lessons.reduce((sum, l) => sum + (l.minutes ?? 0), 0)
  return { lessons: lessons.length, minutes, stages: units.filter((u) => u.length).length }
}

export function FeaturesSection({ section, map }: { section: PageSection; map?: CourseMap }) {
  const m = useT().home.software
  const stats = statsOf(map)
  // 不到兩小時用分鐘,以上用小時(無條件捨去,免得誇大)
  const long = !!stats && stats.minutes >= 120
  // variant 是 intro-demo 的段落:放序章的互動畫面;展示不了(沒有課程地圖或腳本、腳本沒有可示範的演員、讀不到)時放插圖
  const intro = map?.units.flatMap((u) => u.lessons).find((l) => l.id === PREVIEW_LESSON_ID)?.script
  return (
    <section className={styles.features} id={section.id}>
      <div className={styles.container}>
        {stats && stats.lessons > 0 && (
          <ul className={styles.stats}>
            {(
              [
                [stats.lessons, m.statLessons(stats.lessons)],
                [long ? Math.floor(stats.minutes / 60) : stats.minutes, long ? m.statHours(Math.floor(stats.minutes / 60)) : m.statMinutes(stats.minutes)],
                [stats.stages, m.statStages(stats.stages)],
              ] as const
            )
              .filter(([n]) => n > 0)
              .map(([n, label]) => (
                <li key={label}>
                  <strong>{n}</strong>
                  <span>{label}</span>
                </li>
              ))}
          </ul>
        )}
        {section.title && <h2 className={styles.heading}>{section.title}</h2>}
        {section.blocks?.map((b, i) => (
          <article key={b.id ?? b.title} className={[styles.row, i % 2 === 1 && styles.flip, b.variant === 'intro-demo' && intro && styles.demoRow].filter(Boolean).join(' ')}>
            <div className={styles.art} data-tone={i % 3}>
              {b.variant === 'intro-demo' &&
                (intro ? <IntroDemo script={intro} label={m.demoLabel} artwork={<CardArt name="chat" />} fallback={<CardArt name="chat" />} /> : <CardArt name="chat" />)}
              {hasTopicArt(b.variant) ? (
                <TopicArt name={b.variant!} />
              ) : (
                b.variant &&
                // 主題頁沒有另外畫的代號:用序章圖卡的圖
                b.variant in ART && <CardArt name={b.variant as ArtName} />
              )}
            </div>
            <div className={styles.text}>
              <p className={styles.label}>
                <span className={styles.index}>{String(i + 1).padStart(2, '0')}</span>
                {b.label}
              </p>
              <h3>{b.title}</h3>
              {b.text && <p className={styles.desc}>{b.text}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/** 頁尾的行動卡 */
export function ClosingCard({ text, to }: { text: string; to: To }) {
  const m = useT().home.software
  return (
    <section className={styles.closing}>
      <div className={styles.closingCard}>
        <p>
          {text.split('\n').map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </p>
        <Link to={to}>
          {m.startLearning}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}
