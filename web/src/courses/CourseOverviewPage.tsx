import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { messages } from '../i18n/current'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { ACCESS_LABEL, ALL_LEVELS, levelPath, stageAnchor } from '../content/levels'
import { coursePath, levelIdOf, lessonLabel, lessonPath, nextCourse, requiresLogin, type Course } from '../content/catalog'
import { useCourseMap, type MapLesson } from '../content/courseMap'
import { LockIcon } from '../site/LockIcon'
import { useAuth } from '../auth/AuthContext'
import { topicOfCourse } from '../content/topics'
import { LevelArt } from '../home/LevelArt'
import { INTERACTIVE_ICON } from '../studio/interactive/scene'
import styles from './CourseOverview.module.css'

// 課程總覽:上方是課程介紹(標籤、標題、簡述、總時長與課數)與開始學習的卡片,下方是課程內容清單。
// 每一課(課號、名稱、一句話、時間、開放與否、要不要登入)從資料庫讀(GET /api/courses/{id}/map);讀到之前與讀不到時用前端 catalog.ts 的同一份資料
// (兩邊一致由 content/courseMap.test.ts 檢查)。課程介紹(標題、簡述、插圖)還在前端。
// 清單每一列:播放圖示、課名(還沒開放的課標「🌱 規劃中」)、一句話、形式(有腳本的是互動)與時長。
// 未登入時,開放的課在右側標「免費預覽」或鎖頭(登入後學習);確認登入狀態前不標,已登入的人不會閃過標籤。

/** 「約 15 分」「約 1 小時 20 分」→ 分鐘;看不懂的回傳 0 */
export function minutesOf(length: string): number {
  const h = /(\d+)\s*小時/.exec(length)
  const m = /(\d+)\s*分/.exec(length)
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
}

/** 總時長(目前語言):「約 45 分鐘」「約 1 小時 20 分」 */
export function formatMinutes(total: number): string {
  const t = messages().courses
  if (total < 60) return t.aboutMinutes(total)
  return t.aboutHours(Math.floor(total / 60), total % 60)
}


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

/** 讀到資料庫之前與讀不到時:用前端 catalog.ts 的課(有即時教學腳本的就是開放)。
 *  每一課的一句話只在資料庫,這裡先留空,免得讀到之後文字整個換掉 */
function localLessons(course: Course): MapLesson[] {
  return course.lessons.map((l) => {
    const script = l.videos[0]?.live
    return { id: l.id, title: l.title, summary: '', access: requiresLogin(course, l) ? 'login-free' : 'free', status: script ? 'open' : 'planned', script, minutes: minutesOf(l.length) }
  })
}

type Group = { id: string; title: string; subtitle: string; lessons: MapLesson[] }

/** 課程內容的一個階段(資料庫的一個單元):標題、小字(原本階段的說明)與這個階段的課;網址帶 #stage-<id> 時展開並捲到這裡 */
function StageGroup({ id, title, subtitle, count, defaultOpen, children }: { id: string; title: string; subtitle: string; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  const anchor = stageAnchor(id)
  const { hash } = useLocation()
  const targeted = hash === `#${anchor}`
  const [open, setOpen] = useState(defaultOpen || targeted)
  const ref = useRef<HTMLDetailsElement>(null)
  const t = useT()
  useEffect(() => {
    if (!targeted) return
    setOpen(true)
    ref.current?.scrollIntoView({ block: 'start' })
  }, [targeted])
  return (
    <details ref={ref} id={anchor} className={styles.group} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <Icon d={CHEVRON} />
        <span className={styles.groupTitle}>
          {title}
          {subtitle && <small className={styles.groupSub}>{subtitle}</small>}
        </span>
        <span className={styles.groupCount}>{t.courses.lessonCount(count)}</span>
      </summary>
      {children}
    </details>
  )
}

function LessonRows({ course, lessons, guest }: { course: Course; lessons: MapLesson[]; guest: boolean }) {
  const c = useT().courses
  return (
    <ol className={styles.rows}>
      {lessons.map((l) => {
        const ready = l.status === 'open'
        const minutes = l.minutes ?? 0
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
                  <span className={styles.rowNum}>{lessonLabel(course.lessons.find((x) => x.id === l.id) ?? l)}</span>
                  {l.title}
                </span>
                {l.summary && <span className={styles.rowGoal}>{l.summary}</span>}
              </span>
              <span className={styles.rowMeta}>
                {!ready && (
                  <span className={styles.badge}>
                    <span aria-hidden="true">🌱 </span>{c.planned}
                  </span>
                )}
                {guest && ready && (l.access === 'free' ? <span className={`${styles.badge} ${styles.badgePreview}`}>{c.overview.freePreview}</span> : <LockIcon label={c.overview.signInToLearn} />)}
                {ready && l.script && (
                  <span className={styles.chip}>
                    <Icon d={INTERACTIVE_ICON} size={16} />
                    {c.overview.interactive}
                  </span>
                )}
                {minutes > 0 && (
                  <span className={styles.time}>
                    <Icon d={CLOCK} size={18} />
                    {c.minutes(minutes)}
                  </span>
                )}
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/** 讀到資料庫之前與讀不到時的階段分組:分階段的課照前端的階段(標題與小字取自 levels.ts,和資料庫的單元一致),其他課一組 */
function localGroups(course: Course): Group[] {
  if (!course.stages) return [{ id: course.slug, title: course.title, subtitle: '', lessons: localLessons(course) }]
  return course.stages.map((st) => {
    const level = ALL_LEVELS.find((l) => l.id === st.id)
    const lessons = localLessons({ ...course, lessons: st.lessons })
    const planned: MapLesson[] = st.planned.map((c) => ({ id: c.label, title: c.title, summary: '', access: 'login-free', status: 'planned' }))
    return { id: st.id, title: level ? `${messages().courses.levelName(level.levelLabel)}・${level.title}` : messages().courses.levelName(st.label), subtitle: level?.summary ?? '', lessons: [...lessons, ...planned] }
  })
}

export function CourseOverviewPage({ course }: { course: Course }) {
  const t = useT()
  const c = t.courses
  const next = nextCourse(course)
  // 分階段的課(做出自己的軟體)沒有單一等級:標籤、插圖取第一個階段,不顯示等級名稱
  const level = ALL_LEVELS.find((l) => levelPath(l) === coursePath(course))
  const topic = topicOfCourse(coursePath(course))
  const access = level && !course.stages ? ACCESS_LABEL[level.access] : null
  const map = useCourseMap(levelIdOf(course) ?? course.slug)
  const groups: Group[] = map.status === 'ready' ? map.map.units.map((u) => ({ id: u.id, title: u.title, subtitle: u.subtitle, lessons: u.lessons })) : localGroups(course)
  // 從課程地圖的等級點進來(#stage-<等級>):等級就是單元,只顯示這個單元;課數、時長、開始學習也只算這個單元
  const { hash } = useLocation()
  const only = course.stages ? groups.find((g) => hash === `#${stageAnchor(g.id)}`) : undefined
  const shown = only ? [only] : groups
  const lessons = shown.flatMap((g) => g.lessons)
  const total = lessons.reduce((n, l) => n + (l.minutes ?? 0), 0)
  const guest = useAuth().status === 'guest'
  // 開始學習:第一個已經能看的課(都還沒有就從第一課);沒登入時先找不用登入就能看的課,免得一點就是登入畫面
  const playable = lessons.filter((l) => l.status === 'open')
  const start = (guest && playable.find((l) => l.access === 'free')) || playable[0] || lessons[0]

  return (
    <SiteLayout title={course.title}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.intro}>
            <nav className={styles.crumb} aria-label={c.breadcrumb}>
              <Link to={topic.topicPath}>{topic.name}</Link>
              <span aria-hidden="true">/</span>
              {only ? (
                <>
                  <Link to={{ hash: 'map' }}>{c.levelName(course.level)}</Link>
                  <span aria-hidden="true">/</span>
                  <span>{only.title}</span>
                </>
              ) : (
                <span>{c.levelName(course.level)}</span>
              )}
            </nav>
            <p className={styles.tags}>
              {level && !course.stages && <span className={styles.tagStrong}>{c.levelName(level.levelLabel)}</span>}
              {access && <span className={styles.tag}>{c.accessName(access)}</span>}
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
                {c.lessonCount(lessons.length)}
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
                {c.overview.start}
              </Link>
            )}
          </aside>
        </div>
      </section>

      {/* id="map":站內的「課程地圖」連結(<課程頁>#map)捲到課程內容 */}
      <section className={styles.content} id="map" aria-labelledby="course-content">
        <h2 id="course-content">{c.overview.content}</h2>
        {shown.map((g) => (
          <StageGroup key={g.id} id={g.id} title={g.title} subtitle={g.subtitle} count={g.lessons.length} defaultOpen={g.lessons.some((l) => l.status !== 'planned')}>
            <LessonRows course={course} lessons={g.lessons} guest={guest} />
          </StageGroup>
        ))}
        {only && (
          <Link className={styles.nextCourse} to={{ hash: 'map' }}>
            <small>{c.overview.otherUnits}</small>
            <span>{c.overview.allUnits}</span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
        {next && (
          <Link className={styles.nextCourse} to={coursePath(next)}>
            <small>{c.nextCourse}</small>
            <span>
              {c.levelName(next.level)} · {next.title}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>
    </SiteLayout>
  )
}
