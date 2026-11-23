import { Link } from 'react-router-dom'
import type { MapLesson } from '../content/courseMap'
import { courseTitleOf, lessonDocTitle, lessonKicker, lessonLabelOf } from '../content/lessonDisplay'
import { CLAUDE_CODE_LESSON_PAGES, CLAUDE_CODE_TOPIC, claudeCodeScenario } from '../content/topics'
import { LivePlayer } from '../courses/LivePlayer'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import { lessonUrl } from '../content/catalog'
import { LessonGate } from '../courses/LessonGate'
import { TopicBlocked } from './TopicBlocked'
import styles from './SoftwareTopicPage.module.css'

// 「Claude Code 工作術」的一個情境(/courses/claude-code/1):標題、說明、會用到的功能,下面是示範影片(LivePlayer,不記進度)。
// 能不能上、播哪個腳本、要不要登入都照資料庫(LessonGate);情境的文字在 content/topics.ts 的 CLAUDE_CODE_SCENARIOS。
// 有頁面的情境(路由與 SEO)由 CLAUDE_CODE_LESSON_PAGES 產生(routes.tsx、seo/pages.ts);規劃中的情境沒有頁面。
// 影片區塊的 id 是舊的影片錨點(remote、fork);網址帶 #錨點就定位到影片開頭,舊網址 /topics/claude-code#錨點 轉到這裡(courses/routes.tsx)。

/** 開頭是空白的字卡前奏,封面改用 Fork 的選單畫面 */
const FORK_POSTER = { chapter: '用 Fork 分出去', after: 2500 }

export function ClaudeCodeLessonPage({ id }: { id: string }) {
  const s = claudeCodeScenario(id)
  const title = s?.title ?? id
  const t = useT()
  return (
    <LessonGate
      course="claude-code"
      id={id}
      pages={Object.keys(CLAUDE_CODE_LESSON_PAGES)}
      requireScript
      login={{ kicker: lessonKicker(courseTitleOf('claude-code'), lessonLabelOf('claude-code', id)), title: title, docTitle: lessonDocTitle(title, courseTitleOf('claude-code')), back: { to: CLAUDE_CODE_TOPIC.path, label: t.home.gate.backToMap }, note: t.courses.lesson.loginNote }}
      blocked={(reason) => <TopicBlocked reason={reason} course="claude-code" topic={CLAUDE_CODE_TOPIC} id={id} title={title} />}
    >
      {(lesson, prev, next) => <Scenario id={id} lesson={lesson} prev={prev} next={next} />}
    </LessonGate>
  )
}

function Scenario({ id, lesson, prev, next }: { id: string; lesson: MapLesson; prev?: MapLesson; next?: MapLesson }) {
  useHashScroll()
  const t = useT()
  const s = claudeCodeScenario(id)!
  const page = CLAUDE_CODE_LESSON_PAGES[id]
  return (
    <SiteLayout title={lessonDocTitle(s.title, courseTitleOf('claude-code'))}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>
            {lessonKicker(courseTitleOf('claude-code'), lessonLabelOf('claude-code', id))}
          </p>
          <h1>{s.title}</h1>
          <p className={styles.pitch}>
            {s.summary}{' '}
            <span className={styles.tools}>
              {s.tools.map((x) => (
                <code key={x}>{x}</code>
              ))}
            </span>
          </p>
          <div className={styles.ctas}>
            <Link className={styles.secondary} to={{ pathname: CLAUDE_CODE_TOPIC.path, hash: 'map' }}>
              {t.courses.lesson.backToCourseMap}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div id={page.anchor} className={styles.rowPlayer} style={{ scrollMarginTop: 96 }}>
            <LivePlayer script={lesson.script!} title={s.video?.title ?? s.title} onTime={() => {}} poster={FORK_POSTER} saveProgress={false} />
          </div>
          <nav className={styles.ctas} aria-label={t.courses.lesson.pager}>
            {prev ? <Link to={lessonUrl('claude-code', prev.id)}>{t.courses.lesson.prev(lessonLabelOf('claude-code', prev.id))}</Link> : <span />}
            {next ? <Link to={lessonUrl('claude-code', next.id)}>{t.courses.lesson.next(lessonLabelOf('claude-code', next.id))}</Link> : <Link to={{ pathname: CLAUDE_CODE_TOPIC.path, hash: 'map' }}>{t.courses.lesson.courseMapNext}</Link>}
          </nav>
        </div>
      </section>
    </SiteLayout>
  )
}
