import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { ACCESS_LABEL, LEVELS, MAP_INTRO, type CourseLevel } from '../content/levels'
import { COURSES, coursePath, lessonNumber, lessonPath } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { LevelArt } from './LevelArt'
import styles from './HomePage.module.css'

/** 已有可以播放的影片(即時教學畫面)的課 */
const isOpen = (l: CourseLesson) => l.videos.some((v) => v.live)

/** 等級的單課清單:對到課程目錄裡的單課,附上網址與是否已開放。
 *  對不到的項目直接略過(不在 render 中 throw,免得整個首頁空白);資料一致性由 catalog.test.ts 檢查 */
function levelLessons(level: CourseLevel) {
  const course = COURSES.find((c) => coursePath(c) === level.link)
  if (!course) return []
  return (level.lessons ?? []).flatMap((item) => {
    const lesson = course.lessons.find((l) => l.id === item.id)
    if (!lesson) return []
    return [{ ...item, num: lessonNumber(lesson), to: lessonPath(course, lesson), open: isOpen(lesson) }]
  })
}

function LevelCard({ level, index }: { level: CourseLevel; index: number }) {
  const available = level.status === 'available'
  const access = ACCESS_LABEL[level.access]
  const lessons = levelLessons(level)
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
            Level {index}
            <strong>{level.levelLabel}</strong>
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
            {available ? (
              <span className={`${styles.badge} ${styles.badgeOpen}`}>課程內容已上架</span>
            ) : opened.length ? (
              <span className={`${styles.badge} ${styles.badgeOpen}`}>第 {opened.map((l) => l.num).join('、')} 課已開放</span>
            ) : (
              <span className={styles.badge}>規劃中</span>
            )}
          </p>
          <h3>{level.title}</h3>
          <p className={styles.summary}>{level.summary}</p>
          {lessons.length ? (
            <>
              <h4 className={styles.topicsHead}>課程內容</h4>
              <ol className={styles.lessons}>
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link to={l.to} className={styles.lessonNum}>
                      第 {l.num} 課
                    </Link>
                    <span>{l.text}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <h4 className={styles.topicsHead}>課程內容{!available && '（暫定）'}</h4>
              <ul className={styles.topics}>
                {(level.topics ?? []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
          {level.prerequisite && (
            <p className={styles.prereq}>
              <span>先備條件</span>
              {level.prerequisite}
            </p>
          )}
          {level.link && (
            <Link className={styles.cta} to={level.link}>
              查看課程內容 <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </article>
    </li>
  )
}

export function HomePage() {
  useHashScroll()
  // 主視覺的次要按鈕:連到第一個已有課程可看的等級(L3 還在規劃中,不會出現在這裡)
  const featured = LEVELS.find((l) => l.link && (l.status === 'available' || levelLessons(l).some((x) => x.open)))

  return (
    <SiteLayout>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>{MAP_INTRO.kicker}</p>
          <h1>
            {MAP_INTRO.titleLines.map((line) => (
              <span key={line} className={styles.titleLine}>
                {line}
              </span>
            ))}
          </h1>
          <p className={styles.pitch}>{MAP_INTRO.pitch}</p>
          <ol className={styles.overview} aria-label="等級總覽">
            {LEVELS.map((l, i) => (
              <li key={l.id}>
                <Link to={{ pathname: '/', hash: `level-${l.id}` }}>
                  <span className={styles.overviewNum}>{i}</span>
                  {l.levelLabel}
                </Link>
              </li>
            ))}
          </ol>
          <div className={styles.ctas}>
            <Link className={styles.primary} to={{ pathname: '/', hash: 'map' }}>
              查看課程地圖
            </Link>
            {featured?.link && (
              <Link className={styles.secondary} to={featured.link}>
                {featured.levelLabel}課程：{featured.title.split('：')[0]}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section} id="map">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <p className={styles.eyebrow}>由淺入深</p>
            <h2>課程等級</h2>
            <p className={styles.lead}>
              由上往下依難度排列。標示「規劃中」的課程名稱與內容仍在規劃，可能調整。
            </p>
          </header>
          <ol className={styles.map}>
            {LEVELS.map((l, i) => (
              <LevelCard key={l.id} level={l} index={i} />
            ))}
          </ol>
        </div>
      </section>
    </SiteLayout>
  )
}
