import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { lessonUrl } from '../content/catalog'
import { courseTitleOf, lessonDocTitle, lessonKicker, lessonLabelOf } from '../content/lessonDisplay'
import { useLessonTitle, type MapLesson } from '../content/courseMap'
import { LAUNCH_LESSON_PAGES } from '../content/launchCourse'
import { WEB_TOPIC, LAUNCH_TOPIC } from '../content/topics'
import { WEB_LESSON_PAGES } from '../content/webCourse'
import { LessonGate } from '../courses/LessonGate'
import { clearGuestProgress, memberProgress } from '../courses/progress'
import { useT } from '../i18n/I18nProvider'
import { documentTitle } from '../site/siteInfo'
import { InteractiveScenePage } from '../studio/interactive/InteractiveScenePage'
import styles from '../studio/interactive/InteractiveScenePage.module.css'
import { TopicBlocked } from './TopicBlocked'

// 「網頁怎麼運作」「從做好到上線」的一課:整個視窗都是互動舞台,右側是章節與步驟(InteractiveScenePage,和 L0 的互動課同一個外殼)。
// 兩門課共用這一頁,差別只在 TOPIC_SCENES 的設定:有頁面的課(路由與 SEO)分別由 WEB_LESSON_PAGES、LAUNCH_LESSON_PAGES 產生(routes.tsx、seo/pages.ts)。
// 能不能上、播哪個腳本、要不要登入都照資料庫(LessonGate);課名在 webCourse.ts、launchCourse.ts。播放進度只有登入的會員才記。
// 追蹤:打開課程頁由 InteractiveScenePage 記 live:<腳本>;看到提示頁的訪客記 page:<網址>(PageView)。

type Topic = { name: string; path: string }
type SceneConfig = {
  topic: Topic
  /** 有課程頁(路由)的課號 */
  pages: string[]
  interaction: (id: string) => 'stage' | 'static' | undefined
  /** 草稿的課在標題前標示 */
  markDraft: boolean
}

const TOPIC_SCENES: Record<'web' | 'launch', SceneConfig> = {
  web: {
    topic: WEB_TOPIC,
    pages: Object.keys(WEB_LESSON_PAGES),
    interaction: (id) => WEB_LESSON_PAGES[id]?.interaction,
    markDraft: false,
  },
  launch: {
    topic: LAUNCH_TOPIC,
    pages: LAUNCH_LESSON_PAGES,
    interaction: () => 'static',
    markDraft: true,
  },
}

export const WebLessonPage = ({ id }: { id: string }) => <TopicScenePage course="web" id={id} />
export const LaunchLessonPage = ({ id }: { id: string }) => <TopicScenePage course="launch" id={id} />

function TopicScenePage({ course, id }: { course: 'web' | 'launch'; id: string }) {
  const title = useLessonTitle(course)(id)
  const t = useT()
  const cfg = TOPIC_SCENES[course]
  const courseTitle = courseTitleOf(course)
  const docTitle = lessonDocTitle(title, courseTitle)
  return (
    <LessonGate
      course={course}
      id={id}
      pages={cfg.pages}
      requireScript
      login={{ kicker: lessonKicker(courseTitle, lessonLabelOf(course, id)), title, docTitle, back: { to: cfg.topic.path, label: t.home.gate.backToMap }, note: t.courses.lesson.loginNote }}
      blocked={(reason) => <TopicBlocked reason={reason} course={course} topic={cfg.topic} id={id} title={title} />}
    >
      {(lesson, prev, next) => <Player course={course} cfg={cfg} lesson={lesson} title={title} docTitle={docTitle} prev={prev} next={next} />}
    </LessonGate>
  )
}

function Player({ course, cfg, lesson, title, docTitle, prev, next }: { course: 'web' | 'launch'; cfg: SceneConfig; lesson: MapLesson; title: string; docTitle: string; prev?: MapLesson; next?: MapLesson }) {
  const script = lesson.script!
  const { status, user } = useAuth()
  const memberId = user?.id ?? null
  const { pathname } = useLocation()
  const t = useT()
  const progress = useMemo(() => (memberId ? memberProgress(`live:${script}`) : undefined), [memberId, script])
  useEffect(() => {
    if (status !== 'loading' && !memberId) clearGuestProgress()
  }, [status, memberId])
  const heading = cfg.markDraft && lesson.status === 'draft' ? t.courses.lesson.draft(title) : title
  return (
    <InteractiveScenePage
      key={`${lesson.id}:${memberId ?? 'guest'}`}
      script={script}
      pageTitle={heading}
      interaction={cfg.interaction(lesson.id)}
      course={{
        docTitle: documentTitle(docTitle),
        heading,
        back: { to: cfg.topic.path, label: t.courses.lesson.backToCourseMap },
        progress,
        ready: status !== 'loading',
        footer: (
          <>
            {status === 'guest' && (
              <p className={styles.panelLogin}>
                <Link to={loginHref(pathname)}>{t.common.signIn}</Link>
                {t.courses.lesson.resumeAfterSignIn}
              </p>
            )}
            <nav className={styles.panelFooter} aria-label={t.courses.lesson.pager}>
              {prev ? <Link to={lessonUrl(course, prev.id)}>{t.courses.lesson.prev(lessonLabelOf(course, prev.id))}</Link> : <span />}
              {next ? <Link to={lessonUrl(course, next.id)}>{t.courses.lesson.next(lessonLabelOf(course, next.id))}</Link> : <Link to={`${cfg.topic.path}#map`}>{t.courses.lesson.courseMapNext}</Link>}
            </nav>
          </>
        ),
      }}
    />
  )
}
