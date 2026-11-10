import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { COURSE_LIST } from '../content/topics'
import { fetchCourseMap, type CourseMap } from '../content/courseMap'
import { ApiError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { progressApi } from '../courses/progress'
import { buildLessonIndex, MAPPED_COURSES, type MappedCourse } from './lessonIndex'
import { startedCourses, type StartedCourse } from './memberCourses'
import styles from './member.module.css'

// 會員空間「課程」分頁:上過的課程與進度(來自播放進度 GET /api/progress,課號照課程地圖 GET /api/courses/{id}/map 對回課),一門課一張卡片,點進去接著上最近看的那一課。

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; courses: StartedCourse[] }

const dateFormat = new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric' })

function dateText(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dateFormat.format(d)
}

export function CoursesSection() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const { sessionExpired } = useAuth()

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    // 課程地圖讀不到不算失敗:那門課改用前端寫死的腳本路徑對照(lessonIndex.ts)
    const maps = Promise.all(MAPPED_COURSES.map((id) => fetchCourseMap(id).then((m) => [id, m] as const, () => null))).then(
      (list) => Object.fromEntries(list.filter((x) => x !== null)) as Partial<Record<MappedCourse, CourseMap>>,
    )
    Promise.all([progressApi.list(), maps])
      .then(([list, m]) => {
        if (!cancelled) setState({ status: 'ready', courses: startedCourses(list, buildLessonIndex(m)) })
      })
      .catch((err) => {
        if (cancelled) return
        // 登入過期或在別處登出:回到訪客狀態,會員空間會導去登入頁,登入後回到這裡
        if (err instanceof ApiError && err.status === 401) sessionExpired()
        else setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [attempt, sessionExpired])

  return (
    <section className={styles.panel} aria-labelledby="member-courses-title" aria-busy={state.status === 'loading'}>
      <h2 id="member-courses-title" className={styles.panelTitle}>
        我的課程
      </h2>

      {state.status === 'loading' ? (
        <p className={styles.muted}>載入中…</p>
      ) : state.status === 'error' ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>讀不到你的學習進度</p>
          <p className={styles.muted}>可能是網路不穩，請再試一次。</p>
          <button type="button" className={styles.secondary} onClick={() => setAttempt((n) => n + 1)}>
            重新載入
          </button>
        </div>
      ) : state.courses.length > 0 ? (
        <ul className={styles.courseList}>
          {state.courses.map((c) => (
            <li key={c.course}>
              <CourseCard course={c} />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>你還沒開始上課</p>
            <p className={styles.muted}>開始上課後，上過的課和看到哪裡都會記在這裡。先到課程列表挑一門課開始吧。</p>
          </div>
          <Link className={styles.rowCard} to={COURSE_LIST.path}>
            <span className={styles.rowCardText}>
              <strong>{COURSE_LIST.name}</strong>
              <span>看看有哪些課可以上</span>
            </span>
            <Arrow />
          </Link>
        </>
      )}
    </section>
  )
}

function CourseCard({ course }: { course: StartedCourse }) {
  const { last } = course
  const percent = Math.round(last.ratio * 100)
  const started = course.lessons.length
  return (
    <Link className={styles.courseCard} to={last.path}>
      <span className={styles.courseBody}>
        <span className={styles.courseName}>{course.courseName}</span>
        <strong className={styles.courseLesson}>{last.title}</strong>
        <span className={styles.progressRow}>
          <span
            className={styles.progressBar}
            role="progressbar"
            aria-label={`${last.title} 的進度`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={last.finished ? 100 : percent}
          >
            <span style={{ width: `${last.finished ? 100 : percent}%` }} />
          </span>
          <span className={styles.progressText}>{last.finished ? '已看完' : `看到 ${percent}%`}</span>
        </span>
        <span className={styles.courseMeta}>
          上過 {started} 課{course.finishedCount > 0 ? `・看完 ${course.finishedCount} 課` : ''}
          {dateText(last.updatedAt) ? `・上次 ${dateText(last.updatedAt)}` : ''}
        </span>
      </span>
      <span className={styles.courseAction}>
        {last.finished ? '再看一次' : '接著上'}
        <Arrow />
      </span>
    </Link>
  )
}

function Arrow() {
  return (
    <svg className={styles.rowCardArrow} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M7 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
