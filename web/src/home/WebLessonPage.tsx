import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import type { MapLesson } from '../content/courseMap'
import { WEB_OPEN_LESSONS, webLesson } from '../content/webCourse'
import { WEB_TOPIC, webLessonDocTitle } from '../content/topics'
import { clearGuestProgress, memberProgress } from '../courses/progress'
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
  return (
    <TopicLessonGate
      course="web"
      pages={Object.keys(WEB_OPEN_LESSONS)}
      topic={WEB_TOPIC}
      id={id}
      title={title}
      docTitle={webLessonDocTitle(id)}
      loginNote="第一課可以直接預覽，之後的課程要登入才能觀看。登入後也會記錄你的播放進度。"
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
        back: { to: WEB_TOPIC.path, label: '← 課程地圖' },
        progress,
        ready: status !== 'loading',
        footer: (
          <>
            {status === 'guest' && (
              <p className={styles.panelLogin}>
                <Link to={loginHref(location.pathname)}>登入</Link>後會記住你看到哪裡，下次從這裡接著看。
              </p>
            )}
            <nav className={styles.panelFooter} aria-label="上一課與下一課">
              {prev ? <Link to={lessonPath(WEB_TOPIC.path, prev.id)}>← 上一課：{prev.id}</Link> : <span />}
              {next ? <Link to={lessonPath(WEB_TOPIC.path, next.id)}>下一課：{next.id} →</Link> : <Link to={`${WEB_TOPIC.path}#map`}>課程地圖 →</Link>}
            </nav>
          </>
        ),
      }}
    />
  )
}
