import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { coursePath, lessonLabel, lessonPath, nextCourse, type Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { SOFTWARE_TOPIC } from '../content/topics'
import type { StageScript } from '../live/stage'
import { documentTitle } from '../site/siteInfo'
import { InteractiveScenePage } from '../studio/interactive/InteractiveScenePage'
import { withL0Moments } from '../studio/interactive/l0-0.0'
import { withL01Moments } from '../studio/interactive/l0-0.1'
import { withL02Moments } from '../studio/interactive/l0-0.2'
import { withL0IntroMoments } from '../studio/interactive/l0-intro'
import styles from '../studio/interactive/InteractiveScenePage.module.css'
import { LessonAd } from './LessonAd'
import { clearGuestProgress, memberProgress } from './progress'

// 互動版的單課頁:整個視窗都是舞台,學員直接操作演員,右側是課程章節與步驟(見 InteractiveScenePage)。
// 有即時教學影片的課用互動版(routes.tsx 決定),有互動點的課在這裡把互動點加進腳本(INTERACTIVE_LESSONS)。播放進度和一般課程頁一樣,只有登入的會員才記,也沿用同一份紀錄。

/** 有互動點的課:課號 → 把互動點加進課程腳本的函式。放在這裡(不在 routes.tsx),才會跟著上課頁用到才下載 */
const INTERACTIVE_LESSONS: Record<string, (script: StageScript) => StageScript> = {
  '0.0': withL0Moments,
  '0.1': withL01Moments,
  '0.2': withL02Moments,
  '0.intro': withL0IntroMoments,
}
const asIs = (script: StageScript) => script

type Props = {
  course: Course
  lesson: CourseLesson
}

export function InteractiveLessonPage({ course, lesson }: Props) {
  const prepare = INTERACTIVE_LESSONS[lesson.id] ?? asIs
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
  const nextC = next ? undefined : nextCourse(course)
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
            <LessonAd course={course} lesson={lesson} />
            <nav className={styles.panelFooter} aria-label="上一課與下一課">
              {prev ? <Link to={lessonPath(course, prev)}>← 上一課：{lessonLabel(prev)}</Link> : <span />}
              {next ? (
                <Link to={lessonPath(course, next)}>下一課：{lessonLabel(next)} →</Link>
              ) : nextC ? (
                <Link to={coursePath(nextC)}>下一章：{nextC.level} →</Link>
              ) : (
                <Link to={`${SOFTWARE_TOPIC.path}#map`}>課程地圖 →</Link>
              )}
            </nav>
          </>
        ),
      }}
    />
  )
}
