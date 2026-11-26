import { Link } from 'react-router-dom'
import type { MapLesson } from '../content/courseMap'
import { useCourseName, useLessonTitle } from '../content/courseMap'
import { lessonDocTitle, lessonKicker, lessonLabelOf } from '../content/lessonDisplay'
import { CLAUDE_CODE_EXTRAS, scenarioAnchor, TOPIC_PATHS } from '../content/topics'
import { LivePlayer } from '../courses/LivePlayer'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { lessonUrl } from '../content/catalog'
import { LessonGate } from '../courses/LessonGate'
import { TopicBlocked } from './TopicBlocked'
import styles from './SoftwareTopicPage.module.css'

// 「Claude Code 工作術」的一個情境(/courses/claude-code/1):標題、說明、會用到的功能,下面是示範影片(LivePlayer,不記進度)。
// 路由是 /courses/claude-code/:lesson(home/routes.tsx);能不能上、播哪個腳本、要不要登入都照資料庫(LessonGate)。
// 課名、一句話、腳本讀資料庫;資料庫沒有欄位的「會用到的功能」與影片標題在 content/topics.ts 的 CLAUDE_CODE_EXTRAS。
// 影片區塊的 id 是舊的影片錨點(remote、fork);網址帶 #錨點就定位到影片開頭,舊網址 /topics/claude-code#錨點 轉到這裡(courses/routes.tsx)。

/** 開頭是空白的字卡前奏,封面改用 Fork 的選單畫面 */
const FORK_POSTER = { chapter: '用 Fork 分出去', after: 2500 }

export function ClaudeCodeLessonPage({ id }: { id: string }) {
  // 課名、課程名稱、一句話、腳本都讀資料庫(和 server 的 <title> 一致)
  const title = useLessonTitle('claude-code')(id)
  const courseName = useCourseName('claude-code')
  const t = useT()
  const docTitle = lessonDocTitle(title, courseName)
  return (
    <LessonGate
      course="claude-code"
      id={id}
      requireScript
      login={{ kicker: lessonKicker(courseName, lessonLabelOf('claude-code', id)), title: title, docTitle, back: { to: TOPIC_PATHS.claudeCode, label: t.home.gate.backToMap }, note: t.courses.lesson.loginNote }}
      blocked={(reason) => <TopicBlocked reason={reason} course="claude-code" topic={{ path: TOPIC_PATHS.claudeCode }} id={id} title={title} />}
    >
      {(lesson, prev, next) => <Scenario id={id} lesson={lesson} prev={prev} next={next} />}
    </LessonGate>
  )
}

function Scenario({ id, lesson, prev, next }: { id: string; lesson: MapLesson; prev?: MapLesson; next?: MapLesson }) {
  useHashScroll()
  const t = useT()
  const extra = CLAUDE_CODE_EXTRAS[id]
  const title = lesson.title
  const anchor = scenarioAnchor(lesson.script!)
  const courseName = useCourseName('claude-code')
  return (
    <SiteLayout title={lessonDocTitle(title, courseName)}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>
            {lessonKicker(courseName, lessonLabelOf('claude-code', id))}
          </p>
          <h1>{title}</h1>
          <p className={styles.pitch}>
            {lesson.summary}{' '}
            <span className={styles.tools}>
              {(extra?.tools ?? []).map((x) => (
                <code key={x}>{x}</code>
              ))}
            </span>
          </p>
          <div className={styles.ctas}>
            <Link className={styles.secondary} to={{ pathname: TOPIC_PATHS.claudeCode, hash: 'map' }}>
              {t.courses.lesson.backToCourseMap}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div id={anchor} className={styles.rowPlayer} style={{ scrollMarginTop: 96 }}>
            <LivePlayer script={lesson.script!} title={extra?.videoTitle ?? title} onTime={() => {}} poster={extra?.videoTitle ? FORK_POSTER : undefined} saveProgress={false} />
          </div>
          <nav className={styles.ctas} aria-label={t.courses.lesson.pager}>
            {prev ? <Link to={lessonUrl('claude-code', prev.id)}>{t.courses.lesson.prev(lessonLabelOf('claude-code', prev.id))}</Link> : <span />}
            {next ? <Link to={lessonUrl('claude-code', next.id)}>{t.courses.lesson.next(lessonLabelOf('claude-code', next.id))}</Link> : <Link to={{ pathname: TOPIC_PATHS.claudeCode, hash: 'map' }}>{t.courses.lesson.courseMapNext}</Link>}
          </nav>
        </div>
      </section>
    </SiteLayout>
  )
}
