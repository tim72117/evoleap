import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { courseMapId, coursePath, lessonUrl, type Course } from '../content/catalog'
import type { MapLesson } from '../content/courseMap'
import { L0_LESSONS } from '../content/l0Lessons'
import { L1_LESSONS } from '../content/l1Lessons'
import { useCourseName } from '../content/courseMap'
import { lessonDocTitle, lessonLabelOf } from '../content/lessonDisplay'
import { TOPIC_PATHS } from '../content/topics'
import { ACTORS } from '../live/actors'
import { loadScript } from '../live/scripts'
import type { StageScript } from '../live/stage'
import { useT } from '../i18n/I18nProvider'
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
  // 函式名稱與檔名照腳本(l0/0.0-tools.json 等);課號在插入 0.0(準備工具)後往後移了一號
  '0.1': withL0Moments,
  '0.2': withL01Moments,
  '0.3': withL02Moments,
  '0.intro': withL0IntroMoments,
}
const asIs = (script: StageScript) => script

/** 腳本裡有沒有當一般網頁操作的演員(序章的新版);演員要先由 loadScript 載好 */
const hasPageActor = (script: StageScript): boolean => Object.values(script.cast ?? {}).some((c) => ACTORS[c.actor]?.page)

/** 每一課固定的一個函式(播放器拿它當重建的依據);自帶互動的腳本不套前端的互動點 */
const PREPARE: Record<string, (script: StageScript) => StageScript> = Object.fromEntries(
  Object.entries(INTERACTIVE_LESSONS).map(([id, add]) => [id, (script: StageScript) => (hasPageActor(script) ? script : add(script))]),
)

/** 判斷用的那次讀取失敗時,隔多久再試(毫秒);試完還是不行才當成一般腳本 */
const RETRY_MS = [600, 1800]

/**
 * 腳本是不是自己帶互動點、演員在靜態舞台上自己操作(序章的新版):不用在前端加互動點,用靜態互動。
 * 看腳本內容(有沒有當一般網頁操作的演員),不看檔名:腳本改名、換回舊版都不用改程式。
 * 還沒讀到時是 null;讀取失敗先重試(網路瞬斷時才不會把新版當舊版),仍讀不到(例如要登入)當成不是,錯誤由播放器顯示。
 */
function useSelfContained(script: string, ready: boolean): boolean | null {
  const [result, setResult] = useState<{ script: string; value: boolean } | null>(null)
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    let timer = 0
    const attempt = (n: number): void => {
      loadScript(script).then(
        (data) => !cancelled && setResult({ script, value: hasPageActor(data) }),
        () => {
          if (cancelled) return
          if (n < RETRY_MS.length) timer = window.setTimeout(() => attempt(n + 1), RETRY_MS[n])
          else setResult({ script, value: false })
        },
      )
    }
    attempt(0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [script, ready])
  return result?.script === script ? result.value : null
}

/**
 * 每一步的提示詞(學員複製貼上的):暫時還從前端的單課資料(l0Lessons 等的 steps)取,用課號對;找不到的課沒有提示詞。
 * TODO(第二階段):提示詞併進腳本,這個 import 就能拿掉。
 */
const STEP_LESSONS = [...L0_LESSONS, ...L1_LESSONS]
const promptsOf = (id: string): Record<number, string> =>
  Object.fromEntries((STEP_LESSONS.find((l) => l.id === id)?.steps ?? []).flatMap((s, i) => (s.prompt ? [[i + 1, s.prompt]] : [])))

type Props = {
  course: Course
  /** 課程地圖上的這一課(LessonGate 給的):課號、課名、腳本 */
  lesson: MapLesson
  /** 上一課、下一課(課程地圖上能上的課,已跳過先不公開單元的課) */
  prev?: MapLesson
  next?: MapLesson
}

export function InteractiveLessonPage({ course, lesson, prev, next }: Props) {
  const script = lesson.script!
  // 登入狀態確認前先不建立播放器,免得會員的進度被當成訪客略過
  const { status, user } = useAuth()
  const selfContained = useSelfContained(script, status !== 'loading')
  const prepare = PREPARE[lesson.id] ?? asIs
  const memberId = user?.id ?? null
  const location = useLocation()
  const t = useT()
  const c = t.courses.lesson
  const courseName = useCourseName(courseMapId(course))
  const progress = useMemo(() => (memberId ? memberProgress(`live:${script}`) : undefined), [memberId, script])
  useEffect(() => {
    if (status !== 'loading' && !memberId) clearGuestProgress()
  }, [status, memberId])

  const labelOf = (l: Pick<MapLesson, 'id'>) => lessonLabelOf(course.slug, l.id)

  // 還不知道用哪種互動前先不建立播放器(建好再換會整個重來)
  if (selfContained === null) return null

  return (
    <InteractiveScenePage
      key={`${lesson.id}:${status === 'loading' ? 'loading' : (memberId ?? 'guest')}`}
      script={script}
      pageTitle={lesson.title}
      interaction={selfContained ? 'static' : 'stage'}
      prepare={prepare}
      course={{
        docTitle: documentTitle(lessonDocTitle(lesson.title, courseName)),
        heading: lesson.title,
        back: { to: coursePath(course), label: c.back },
        progress,
        ready: status !== 'loading',
        prompts: promptsOf(lesson.id),
        footer: (
          <>
            {status === 'guest' && (
              <p className={styles.panelLogin}>
                <Link to={loginHref(location.pathname)}>{t.common.signIn}</Link>
                {c.resumeAfterSignIn}
              </p>
            )}
            <LessonAd course={course.slug} lesson={lesson} />
            <nav className={styles.panelFooter} aria-label={c.pager}>
              {prev ? <Link to={lessonUrl(course.slug, prev.id)}>{c.prev(labelOf(prev))}</Link> : <span />}
              {next ? (
                <Link to={lessonUrl(course.slug, next.id)}>{c.next(labelOf(next))}</Link>
              ) : (
                <Link to={`${TOPIC_PATHS.software}#map`}>{c.courseMapNext}</Link>
              )}
            </nav>
          </>
        ),
      }}
    />
  )
}
