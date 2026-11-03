import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { coursePath, lessonLabel, lessonPath, type Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { SOFTWARE_TOPIC } from '../content/topics'
import type { StageScript } from '../live/stage'
import { documentTitle } from '../site/siteInfo'
import { InteractiveScenePage } from '../studio/interactive/InteractiveScenePage'
import styles from '../studio/interactive/InteractiveScenePage.module.css'
import { clearGuestProgress, memberProgress } from './progress'

// 互動版的單課頁:整個視窗都是舞台,學員直接操作演員,右側是課程章節與步驟(見 InteractiveScenePage)。
// 哪些課用互動版由 routes.tsx 決定。播放進度和一般課程頁一樣,只有登入的會員才記,也沿用同一份紀錄。

type Props = {
  course: Course
  lesson: CourseLesson
  prepare: (script: StageScript) => StageScript
}

export function InteractiveLessonPage({ course, lesson, prepare }: Props) {
  const script = lesson.videos[0].live!
  // 登入狀態確認前先不建立播放器,免得會員的進度被當成訪客略過
  const { status, user } = useAuth()
  const memberId = user?.id ?? null
  const location = useLocation()
  const progress = useMemo(() => (memberId ? memberProgress(`live:${script}`) : undefined), [memberId, script])
  useEffect(() => {
    if (status !== 'loading' && !memberId) clearGuestProgress()
  }, [status, memberId])

  const index = course.lessons.indexOf(lesson)
  const prev = course.lessons[index - 1]
  const next = course.lessons[index + 1]
  const name = `${lessonLabel(lesson)} ${lesson.title}`

  return (
    <InteractiveScenePage
      key={`${lesson.id}:${status === 'loading' ? 'loading' : (memberId ?? 'guest')}`}
      script={script}
      pageTitle={name}
      interaction="stage"
      prepare={prepare}
      course={{
        docTitle: documentTitle(name),
        heading: lesson.title,
        back: { to: coursePath(course), label: '← 課程' },
        progress,
        ready: status !== 'loading',
        prompts: Object.fromEntries(lesson.steps.flatMap((s, i) => (s.prompt ? [[i + 1, s.prompt]] : []))),
        footer: (
          <>
            {status === 'guest' && (
              <p className={styles.panelLogin}>
                <Link to={loginHref(location.pathname)}>登入</Link>後會記住你看到哪裡，下次從這裡接著看。
              </p>
            )}
            <nav className={styles.panelFooter} aria-label="上一課與下一課">
              {prev ? <Link to={lessonPath(course, prev)}>← 上一課：{lessonLabel(prev)}</Link> : <span />}
              {next ? <Link to={lessonPath(course, next)}>下一課：{lessonLabel(next)} →</Link> : <Link to={`${SOFTWARE_TOPIC.path}#map`}>課程地圖 →</Link>}
            </nav>
          </>
        ),
      }}
    />
  )
}
