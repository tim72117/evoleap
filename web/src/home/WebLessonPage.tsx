import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import type { MapLesson } from '../content/courseMap'
import { WEB_OPEN_LESSONS, webLesson } from '../content/webCourse'
import { WEB_TOPIC, webLessonDocTitle } from '../content/topics'
import { clearGuestProgress, memberProgress } from '../courses/progress'
import { useT } from '../i18n/I18nProvider'
import { documentTitle } from '../site/siteInfo'
import { InteractiveScenePage } from '../studio/interactive/InteractiveScenePage'
import styles from '../studio/interactive/InteractiveScenePage.module.css'
import { lessonPath } from './CourseMapUnits'
import { TopicLessonGate } from './TopicLessonGate'

// 「網頁怎麼運作」的一課:整個視窗都是互動舞台,右側是章節與步驟(InteractiveScenePage,和 L0 的互動課同一個外殼)。
// 能不能上、播哪個腳本、要不要登入都照資料庫(TopicLessonGate);課名在 webCourse.ts,互動方式(interaction)在 WEB_OPEN_LESSONS。
// 有頁面的課(路由與 SEO)由 WEB_OPEN_LESSONS 產生(routes.tsx、seo/pages.ts)。播放進度只有登入的會員才記。

export function WebLessonPage({ id }: { id: string }) {
  const title = webLesson(id)?.title ?? id
  const t = useT()
  return (
    <TopicLessonGate
      course="web"
      pages={Object.keys(WEB_OPEN_LESSONS)}
      topic={WEB_TOPIC}
      id={id}
      title={title}
      docTitle={webLessonDocTitle(id)}
      loginNote={t.home.lesson.loginNote}
    >
      {(lesson, prev, next) => <Player lesson={lesson} title={title} prev={prev} next={next} />}
    </TopicLessonGate>
  )
}

function Player({ lesson, title, prev, next }: { lesson: MapLesson; title: string; prev?: MapLesson; next?: MapLesson }) {
  const script = lesson.script!
  const { status, user } = useAuth()
  const memberId = user?.id ?? null
  const location = useLocation()
  const t = useT()
  const progress = useMemo(() => (memberId ? memberProgress(`live:${script}`) : undefined), [memberId, script])
  useEffect(() => {
    if (status !== 'loading' && !memberId) clearGuestProgress()
  }, [status, memberId])
  return (
    <InteractiveScenePage
      key={`${lesson.id}:${memberId ?? 'guest'}`}
      script={script}
      pageTitle={title}
      interaction={WEB_OPEN_LESSONS[lesson.id]?.interaction}
      course={{
        docTitle: documentTitle(webLessonDocTitle(lesson.id)),
        heading: title,
        back: { to: WEB_TOPIC.path, label: t.home.lesson.backToMap },
        progress,
        ready: status !== 'loading',
        footer: (
          <>
            {status === 'guest' && (
              <p className={styles.panelLogin}>
                <Link to={loginHref(location.pathname)}>{t.common.signIn}</Link>
                {t.home.lesson.resumeAfterSignIn}
              </p>
            )}
            <nav className={styles.panelFooter} aria-label={t.home.lesson.navLabel}>
              {prev ? <Link to={lessonPath(WEB_TOPIC.path, prev.id)}>{t.home.lesson.prev(prev.id)}</Link> : <span />}
              {next ? <Link to={lessonPath(WEB_TOPIC.path, next.id)}>{t.home.lesson.next(next.id)}</Link> : <Link to={`${WEB_TOPIC.path}#map`}>{t.home.lesson.mapNext}</Link>}
            </nav>
          </>
        ),
      }}
    />
  )
}
