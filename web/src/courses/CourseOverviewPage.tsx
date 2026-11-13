import { Link } from 'react-router-dom'
import { messages } from '../i18n/current'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { ACCESS_LABEL, ALL_LEVELS } from '../content/levels'
import { coursePath, courseMapId, lessonLabel, lessonPath, nextCourse, type Course } from '../content/catalog'
import { useCourseMap } from '../content/courseMap'
import { useAuth } from '../auth/AuthContext'
import { topicOfCourse } from '../content/topics'
import { LevelArt } from '../home/LevelArt'
import { CLOCK, Icon, LessonGroup, LessonListStatus, PLAY } from './LessonGroup'
import styles from './CourseOverview.module.css'

// 課程總覽:上方是課程介紹(標籤、標題、簡述、總時長與課數)與開始學習的卡片,下方是課程內容清單。
// 每一課(課號、名稱、一句話、時間、開放與否、要不要登入)從資料庫讀(GET /api/courses/{id}/map);讀取中顯示佔位卡、讀不到顯示「無法讀取」,
// 不用前端寫死的課程資料頂替。課程介紹(標題、簡述、插圖)沒有存在資料庫,還在前端。
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


const BOOK = 'M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5zM12 6v13.5'

export function CourseOverviewPage({ course }: { course: Course }) {
  const t = useT()
  const c = t.courses
  const next = nextCourse(course)
  const level = ALL_LEVELS.find((l) => l.link === coursePath(course))
  const topic = topicOfCourse(coursePath(course))
  const access = level ? ACCESS_LABEL[level.access] : null
  const map = useCourseMap(courseMapId(course))
  // 課程清單只用資料庫的課程地圖:讀取中顯示佔位卡、讀不到顯示「無法讀取」,不用前端寫死的課程資料頂替
  const ready = map.status === 'ready'
  const lessons = map.status === 'ready' ? map.map.units.flatMap((u) => u.lessons) : []
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
              <Link to={`${topic.path}#map`}>{topic.name}</Link>
              <span aria-hidden="true">/</span>
              <span>{c.levelName(course.level)}</span>
            </nav>
            <p className={styles.tags}>
              {level && <span className={styles.tagStrong}>{c.levelName(level.levelLabel)}</span>}
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
              {ready && (
                <span>
                  <Icon d={BOOK} size={22} />
                  {c.lessonCount(lessons.length)}
                </span>
              )}
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

      <section className={styles.content} aria-labelledby="course-content">
        <h2 id="course-content">{c.overview.content}</h2>
        {map.status === 'ready' ? (
          <LessonGroup
            title={course.title}
            lessons={lessons}
            pathOf={(l) => lessonPath(course, l)}
            labelOf={(l) => lessonLabel(course.lessons.find((x) => x.id === l.id) ?? l)}
            guest={guest}
          />
        ) : (
          <LessonListStatus state={map.status} />
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
