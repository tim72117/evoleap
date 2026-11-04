import { Link } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { ACCESS_LABEL, ALL_LEVELS } from '../content/levels'
import { coursePath, lessonLabel, lessonPath, type Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { topicOfCourse } from '../content/topics'
import { LevelArt } from '../home/LevelArt'
import { INTERACTIVE_ICON } from '../studio/interactive/scene'
import styles from './CourseOverview.module.css'

// 課程總覽:上方是課程介紹(標籤、標題、簡述、總時長與課數)與開始學習的卡片,下方是課程內容清單。
// 清單每一列:播放圖示、課名(還沒有教學影片的課標「製作中」)、目標、形式(互動/影片/步驟)與時長。

/** 「約 15 分」「約 1 小時 20 分」→ 分鐘;看不懂的回傳 0 */
export function minutesOf(length: string): number {
  const h = /(\d+)\s*小時/.exec(length)
  const m = /(\d+)\s*分/.exec(length)
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
}

export function formatMinutes(total: number): string {
  if (total < 60) return `約 ${total} 分鐘`
  const m = total % 60
  return `約 ${Math.floor(total / 60)} 小時${m ? ` ${m} 分` : ''}`
}

const hasVideo = (l: CourseLesson) => l.videos.some((v) => v.live)

// ---------- 線條圖示(1.8 線寬、圓角端點) ----------
const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg className={styles.icon} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
const CLOCK = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2'
const BOOK = 'M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5zM12 6v13.5'
const PLAY = 'M8 5.5v13l10.5-6.5z'
const CHEVRON = 'M9 6l6 6-6 6'
const FILM = 'M4 6h16v12H4zM4 10h16M9 6v4M15 6v4'
const LIST = 'M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01'

function kindOf(lesson: CourseLesson, interactive: boolean): { label: string; icon: string } {
  if (interactive) return { label: '互動', icon: INTERACTIVE_ICON }
  if (hasVideo(lesson)) return { label: '影片', icon: FILM }
  return { label: `${lesson.steps.length} 個步驟`, icon: LIST }
}

export function CourseOverviewPage({ course, interactive = [] }: { course: Course; interactive?: string[] }) {
  const level = ALL_LEVELS.find((l) => l.link === coursePath(course))
  const topic = topicOfCourse(coursePath(course))
  const access = level ? ACCESS_LABEL[level.access] : null
  const total = course.lessons.reduce((n, l) => n + minutesOf(l.length), 0)
  // 開始學習:第一個已經能看的課(都還沒有就從第一課)
  const start = course.lessons.find((l) => hasVideo(l) || interactive.includes(l.id)) ?? course.lessons[0]

  return (
    <SiteLayout title={course.title}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.intro}>
            <nav className={styles.crumb} aria-label="麵包屑">
              <Link to={`${topic.path}#map`}>{topic.name}</Link>
              <span aria-hidden="true">/</span>
              <span>{course.level}</span>
            </nav>
            <p className={styles.tags}>
              {level && <span className={styles.tagStrong}>{level.levelLabel}</span>}
              {access && <span className={styles.tag}>{access}</span>}
              <span className={styles.tag}>{topic.name}</span>
            </p>
            <h1>{course.title}</h1>
            <p className={styles.lead}>{course.summary}</p>
            <p className={styles.meta}>
              {total > 0 && (
                <span>
                  <Icon d={CLOCK} size={22} />
                  {formatMinutes(total)}
                </span>
              )}
              <span>
                <Icon d={BOOK} size={22} />
                {course.lessons.length} 課
              </span>
            </p>
          </div>
          <aside className={styles.card}>
            {level && (
              <div className={styles.art}>
                <LevelArt art={level.art} />
              </div>
            )}
            {start && (
              <Link className={styles.start} to={lessonPath(course, start)}>
                <Icon d={PLAY} />
                開始學習
              </Link>
            )}
          </aside>
        </div>
      </section>

      <section className={styles.content} aria-labelledby="course-content">
        <h2 id="course-content">課程內容</h2>
        <details className={styles.group} open>
          <summary>
            <Icon d={CHEVRON} />
            <span className={styles.groupTitle}>{course.title}</span>
            <span className={styles.groupCount}>{course.lessons.length} 課</span>
          </summary>
          <ol className={styles.rows}>
            {course.lessons.map((l) => {
              const ready = hasVideo(l) || interactive.includes(l.id)
              const kind = kindOf(l, interactive.includes(l.id))
              const minutes = minutesOf(l.length)
              return (
                <li key={l.id}>
                  <Link className={styles.row} to={lessonPath(course, l)}>
                    <span className={styles.play} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d={PLAY} fill="currentColor" />
                      </svg>
                    </span>
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>
                        <span className={styles.rowNum}>{lessonLabel(l)}</span>
                        {l.title}
                        {!ready && <span className={styles.badge}>製作中</span>}
                      </span>
                      <span className={styles.rowGoal}>{l.goal}</span>
                    </span>
                    <span className={styles.rowMeta}>
                      <span className={styles.chip}>
                        <Icon d={kind.icon} size={16} />
                        {kind.label}
                      </span>
                      {minutes > 0 && (
                        <span className={styles.time}>
                          <Icon d={CLOCK} size={18} />
                          {minutes} 分鐘
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </details>
      </section>
    </SiteLayout>
  )
}
