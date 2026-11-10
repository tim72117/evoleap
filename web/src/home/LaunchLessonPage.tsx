import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import type { MapLesson } from '../content/courseMap'
import { LAUNCH_LESSON_PAGES, launchLesson } from '../content/launchCourse'
import { LAUNCH_TOPIC } from '../content/topics'
import { clearGuestProgress, memberProgress } from '../courses/progress'
import { documentTitle } from '../site/siteInfo'
import { InteractiveScenePage } from '../studio/interactive/InteractiveScenePage'
import styles from '../studio/interactive/InteractiveScenePage.module.css'
import { lessonPath } from './CourseMapUnits'
import { TopicLessonGate } from './TopicLessonGate'

// 「從做好到上線」的一課(/topics/launch/0-1,LAUNCH_LESSON_PAGES 裡的課才有頁面):整個視窗都是互動舞台(InteractiveScenePage,和「網頁怎麼運作」的課程頁同一個外殼)。
// 能不能上、播哪個腳本、要不要登入都照資料庫(TopicLessonGate);課名在前端的 launchCourse.ts。播放進度只有登入的會員才記。
// 追蹤:打開課程頁由 InteractiveScenePage 記 live:<腳本>;看到提示頁的訪客記 page:<網址>(PageView),後台看得出有人想上還沒開放的課。

export function LaunchLessonPage({ id }: { id: string }) {
  const title = launchLesson(id)?.title ?? id
  return (
    <TopicLessonGate
      course="launch"
      pages={LAUNCH_LESSON_PAGES}
      topic={LAUNCH_TOPIC}
      id={id}
      title={title}
      docTitle={`${title}｜${LAUNCH_TOPIC.name}`}
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
  const { pathname } = useLocation()
  const progress = useMemo(() => (memberId ? memberProgress(`live:${script}`) : undefined), [memberId, script])
  useEffect(() => {
    if (status !== 'loading' && !memberId) clearGuestProgress()
  }, [status, memberId])
  const heading = lesson.status === 'draft' ? `${title}（草稿）` : title
  return (
    <InteractiveScenePage
      key={`${lesson.id}:${memberId ?? 'guest'}`}
      script={script}
      pageTitle={heading}
      interaction="static"
      course={{
        docTitle: documentTitle(`${title}｜${LAUNCH_TOPIC.name}`),
        heading,
        back: { to: LAUNCH_TOPIC.path, label: '← 課程地圖' },
        progress,
        ready: status !== 'loading',
        footer: (
          <>
            {status === 'guest' && (
              <p className={styles.panelLogin}>
                <Link to={loginHref(pathname)}>登入</Link>後會記住你看到哪裡，下次從這裡接著看。
              </p>
            )}
            <nav className={styles.panelFooter} aria-label="上一課與下一課">
              {prev ? <Link to={lessonPath(LAUNCH_TOPIC.path, prev.id)}>← 上一課：{prev.id}</Link> : <span />}
              {next ? <Link to={lessonPath(LAUNCH_TOPIC.path, next.id)}>下一課：{next.id} →</Link> : <Link to={`${LAUNCH_TOPIC.path}#map`}>課程地圖 →</Link>}
            </nav>
          </>
        ),
      }}
    />
  )
}
