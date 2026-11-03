import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { SiteLayout } from '../site/SiteLayout'
import { useCopy } from '../site/useCopy'
import type { CourseLesson, LessonStep } from '../content/lessonTypes'
import { coursePath, lessonLabel, lessonPath, type Course } from '../content/catalog'
import styles from './Lesson.module.css'
import type { PlayerHandle } from './playerHandle'
import { MockPlayer } from './MockPlayer'
import { LivePlayer } from './LivePlayer'
import { effectiveCues, mmss, stepAt } from './lessonTiming'
import { SOFTWARE_TOPIC } from '../content/topics'

// 學員端單課頁。第一屏（fold）剛好一個視窗高：左邊影片、右邊「步驟軌」（窄螢幕時上下堆疊），
// 影片播到哪一步（依 LessonVideo.cues），軌道裡就自動展開並捲到那一步，提示詞和複製鈕
// 跟影片永遠同屏，不用往下拉。目標、完成檢核、上下課放在第一屏下方。

function PromptBlock({ prompt }: { prompt: string }) {
  const { state, copy } = useCopy()
  return (
    <div className={styles.prompt}>
      <div className={styles.promptHead}>
        <span>提示詞</span>
        <button type="button" onClick={() => copy(prompt)} aria-live="polite">
          {state === 'copied' ? '已複製 ✓' : state === 'failed' ? '複製失敗，請手動選取' : '複製'}
        </button>
      </div>
      <pre>{prompt}</pre>
    </div>
  )
}

type StepProps = {
  step: LessonStep
  index: number
  open: boolean
  playing: boolean
  /** 影片已經播過這一步（在目前播放步驟之前） */
  passed: boolean
  cueAt?: number
  onToggle: () => void
  onSeek?: () => void
  /** 有下一步時，步驟內容底下顯示「下一步」 */
  onNext?: () => void
  /** 這一步在另一支影片（1 起算）示範時，顯示該影片編號，點了切過去 */
  otherVideo?: number
  onGo?: () => void
}

function Step({ step, index, open, playing, passed, cueAt, onToggle, onSeek, onNext, otherVideo, onGo }: StepProps) {
  const cls = [styles.step, open ? styles.open : '', playing ? styles.playing : '', passed ? styles.passed : ''].join(' ')
  return (
    <li className={cls} id={`step-${index + 1}`}>
      <div className={styles.stepHeader}>
        <button type="button" className={styles.stepToggle} aria-expanded={open} onClick={onToggle}>
          <span className={styles.stepNum} aria-hidden="true">
            {passed && !open ? '✓' : index + 1}
          </span>
          <span className={styles.stepTitle}>{step.title}</span>
          {playing && <span className={styles.nowPlaying}>播放中</span>}
        </button>
        {cueAt !== undefined && onSeek ? (
          <button type="button" className={styles.seek} onClick={onSeek} title="從這一步開始播放">
            ▶ {mmss(cueAt)}
          </button>
        ) : otherVideo !== undefined ? (
          <button type="button" className={styles.seek} onClick={onGo} title={`這一步在影片 ${otherVideo} 示範`}>
            影片 {otherVideo}
          </button>
        ) : null}
      </div>
      {open && (
        <div className={styles.stepBody}>
          {step.prompt ? <PromptBlock prompt={step.prompt} /> : <p className={styles.noPrompt}>這一步是介面操作，不需要提示詞。</p>}
          <p className={styles.expected}>
            <strong>應該看到</strong>
            {step.expected}
          </p>
          {step.note && (
            <p className={styles.note}>
              <strong>注意</strong>
              {step.note}
            </p>
          )}
          {onNext && (
            <div className={styles.stepFoot}>
              <button type="button" className={styles.nextStep} onClick={onNext}>
                下一步 ›
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export function LessonPage({ course, lesson }: { course: Course; lesson: CourseLesson }) {
  const index = course.lessons.indexOf(lesson)
  const prev = course.lessons[index - 1]
  const next = course.lessons[index + 1]
  const label = lessonLabel(lesson)
  const auth = useAuth()
  const location = useLocation()
  const total = lesson.steps.length

  // ?video=2 直接打開第 2 支影片(分享連結、預覽用)
  const [searchParams] = useSearchParams()
  const [videoIdx, setVideoIdx] = useState(() => {
    const n = Number(searchParams.get('video'))
    return Number.isInteger(n) && n >= 1 && n <= lesson.videos.length ? n - 1 : 0
  })
  const video = lesson.videos[videoIdx]
  const playerRef = useRef<PlayerHandle>(null)
  // 自動展開：播放中的步驟；手動：學員自己點開或收合的步驟
  // （影片未上架時也有模擬播放器驅動，所以一開始不預先展開任何一步）
  const [playingStep, setPlayingStep] = useState<number | null>(null)
  const [manual, setManual] = useState<Record<number, boolean>>({})
  const [goalOpen, setGoalOpen] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  // 切換影片後要跳到的秒數（「下一步」跨影片時用）；新播放器掛好再 seek
  const pendingSeek = useRef<number | null>(null)
  // 同上,但目標是即時教學畫面:要跳到的步驟(時間等播放器回報 cues 才知道)
  const pendingLiveStep = useRef<number | null>(null)

  // 即時教學畫面的步驟對應由播放器載入腳本後回報(腳本裡的 lessonStep);null = 還沒回報(腳本還在載入)
  const [liveCues, setLiveCues] = useState<{ step: number; at: number }[] | null>(null)
  const cues = useMemo(() => (video?.live ? (liveCues ?? []) : effectiveCues(video)), [video, liveCues])
  const cueByStep = useMemo(() => new Map(cues.map((c) => [c.step, c.at])), [cues])

  const onTime = (t: number) => {
    const step = stepAt(cues, t)
    if (step !== playingStep) {
      // 進到新的一步：自動展開這一步，前一步自動收起（學員手動打開的保持打開）
      setPlayingStep(step)
    }
  }

  const isOpen = (n: number) => n === playingStep || manual[n] === true

  /** 跳到第 n 步：這支影片有 cue 就 seek；在別支影片就切過去再 seek；都沒有就手動展開 */
  const goStep = (n: number) => {
    if (n < 1 || n > total) return
    const cue = cueByStep.get(n)
    if (cue !== undefined) {
      playerRef.current?.seekTo(cue)
      return
    }
    if (video?.live && liveCues === null && video.steps.includes(n)) {
      // 同一支即時教學畫面,但播放器還沒回報 cues:先記下來,回報後再跳(見下方 effect)
      pendingLiveStep.current = n
      setManual({ [n]: true })
      return
    }
    const vi = lesson.videos.findIndex((v) => v.steps.includes(n))
    if (vi >= 0 && vi !== videoIdx) {
      if (lesson.videos[vi].live) {
        // 即時教學畫面的步驟時間要等播放器載入腳本、回報 cues 後才知道
        pendingLiveStep.current = n
        pendingSeek.current = null
      } else {
        pendingSeek.current = effectiveCues(lesson.videos[vi]).find((c) => c.step === n)?.at ?? null
      }
      setVideoIdx(vi)
      setPlayingStep(null)
      setLiveCues(null)
    }
    setManual({ [n]: true })
  }
  const goStepRef = useRef(goStep)
  goStepRef.current = goStep

  // 切到即時教學畫面(或它還沒載入完)時,等它回報 cues 再跳到要去的那一步;
  // 回報了但腳本裡沒有這一步,也一樣清掉,免得之後別支影片誤跳
  useEffect(() => {
    if (pendingLiveStep.current === null || liveCues === null) return
    const at = liveCues.find((c) => c.step === pendingLiveStep.current)?.at
    pendingLiveStep.current = null
    if (at !== undefined) playerRef.current?.seekTo(at)
  }, [liveCues])

  useEffect(() => {
    if (pendingSeek.current === null) return
    const at = pendingSeek.current
    pendingSeek.current = null
    playerRef.current?.seekTo(at)
  }, [videoIdx])

  // 播到新的一步：把那一步捲到步驟軌最上面（只捲軌道本身，不動整頁）
  useEffect(() => {
    if (playingStep === null) return
    const list = listRef.current
    const li = list?.querySelector<HTMLElement>(`#step-${playingStep}`)
    if (!list || !li) return
    list.scrollTo({ top: Math.max(0, li.offsetTop - 8), behavior: 'smooth' })
  }, [playingStep])

  // ← / → 切換上一步／下一步（在輸入欄位裡時不攔）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      // 焦點在即時教學畫面的播放器裡時,←/→ 由播放器處理(倒退/快轉)
      if (target?.closest('.vp')) return
      e.preventDefault()
      goStepRef.current((playingStep ?? 0) + (e.key === 'ArrowRight' ? 1 : -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playingStep])

  // 第一屏高度 = 視窗 − 站台 sticky header；header 高度隨視窗寬度與登入狀態變動，所以量出來給 CSS 用
  const lessonRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>('header')
    const root = lessonRef.current
    if (!header || !root) return
    const apply = () => root.style.setProperty('--hdr', `${Math.ceil(header.getBoundingClientRect().height)}px`)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])

  const current = playingStep ?? 0
  const hasTabs = lesson.videos.length > 1

  return (
    <SiteLayout title={`${label} ${lesson.title}`}>
      <div className={styles.lesson} ref={lessonRef}>
        <div className={styles.fold}>
          <div className={styles.topbar}>
            <nav className={styles.crumb} aria-label="麵包屑">
              <Link to={`${SOFTWARE_TOPIC.path}#map`}>課程地圖</Link>
              <span aria-hidden="true"> / </span>
              <Link to={coursePath(course)}>{course.level}</Link>
              <span aria-hidden="true"> / </span>
              <span>{label}</span>
            </nav>
            {/* h1 只放課名(搜尋引擎讀的主標題);課號與時長放在旁邊 */}
            <div className={styles.title}>
              <span className={styles.kicker}>
                {label} · {lesson.length}
              </span>
              <h1>{lesson.title}</h1>
            </div>
          </div>

          <div className={`${styles.stage} ${hasTabs ? styles.hasTabs : ''}`}>
            <div className={styles.stageMain}>
              <div className={styles.playerBox}>
                {video?.live ? (
                  <div className={styles.player}>
                    <LivePlayer
                      key={videoIdx}
                      ref={playerRef}
                      script={video.live}
                      title={video.title}
                      onTime={onTime}
                      onCues={setLiveCues}
                    />
                  </div>
                ) : video ? (
                  // 影片還沒上架：用模擬播放器跑一遍「播到哪一步就展開哪一步」；換影片時 key 改變，進度歸零
                  <MockPlayer
                    key={videoIdx}
                    ref={playerRef}
                    title={video.title}
                    duration={video.minutes * 60}
                    onTime={onTime}
                    chapters={cues.map((c) => ({ at: c.at, label: `${c.step}. ${lesson.steps[c.step - 1]?.title ?? ''}` }))}
                  />
                ) : null}
              </div>
              {video?.live && auth.status === 'guest' && (
                <p className={styles.guestHint}>
                  <Link to={loginHref(location.pathname)}>登入</Link>後會記住你看到哪裡，下次從這裡接著看；未登入不會儲存播放進度。
                </p>
              )}
              {hasTabs && (
                <div className={styles.videoTabs} role="tablist" aria-label="本課影片">
                  {lesson.videos.map((v, i) => (
                    <button
                      key={v.title}
                      type="button"
                      role="tab"
                      aria-selected={i === videoIdx}
                      className={i === videoIdx ? styles.tabActive : ''}
                      onClick={() => {
                        // 點目前這個分頁不重掛播放器,也就不會再回報 cues,所以不能清掉
                        if (i === videoIdx) return
                        setVideoIdx(i)
                        setPlayingStep(null)
                        setLiveCues(null)
                        // 學員自己換分頁:先前排著要跳的步驟作廢
                        pendingLiveStep.current = null
                        pendingSeek.current = null
                      }}
                    >
                      <small>影片 {i + 1}</small>
                      {v.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <aside className={styles.rail} aria-label="跟著步驟做">
              <div className={styles.railHead}>
                <div className={styles.progress}>
                  <span className={styles.progressText} aria-live="polite">
                    {playingStep === null ? (
                      <>
                        <strong>跟著步驟做</strong> · 共 {total} 步
                      </>
                    ) : (
                      <>
                        <strong>第 {current} 步</strong> / {total} 步
                      </>
                    )}
                  </span>
                  <div className={styles.progressNav}>
                    <button
                      type="button"
                      onClick={() => goStep(current - 1)}
                      disabled={current <= 1}
                      title="上一步（←）"
                      aria-label="上一步"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => goStep(current + 1)}
                      disabled={current >= total}
                      title="下一步（→）"
                      aria-label="下一步"
                    >
                      ›
                    </button>
                    <button
                      type="button"
                      className={goalOpen ? styles.goalOn : ''}
                      aria-expanded={goalOpen}
                      onClick={() => setGoalOpen((o) => !o)}
                    >
                      目標
                    </button>
                  </div>
                </div>
                <div className={styles.progressBar} aria-hidden="true">
                  <div style={{ width: `${(Math.max(0, current - 1) / total) * 100}%` }} />
                </div>
                {goalOpen && (
                  <div className={styles.railGoal}>
                    <p>{lesson.goal}</p>
                    <p className={styles.scenario}>{lesson.scenario}</p>
                  </div>
                )}
              </div>

              <ol className={styles.steps} ref={listRef}>
                {lesson.steps.map((st, i) => {
                  const n = i + 1
                  const cueAt = cueByStep.get(n)
                  const vi = lesson.videos.findIndex((v) => v.steps.includes(n))
                  const otherVideo = cueAt === undefined && vi >= 0 && vi !== videoIdx ? vi + 1 : undefined
                  return (
                    <Step
                      key={st.title}
                      step={st}
                      index={i}
                      open={isOpen(n)}
                      playing={n === playingStep}
                      passed={n < current}
                      cueAt={cueAt}
                      onToggle={() => setManual((m) => ({ ...m, [n]: !isOpen(n) }))}
                      onSeek={cueAt !== undefined ? () => playerRef.current?.seekTo(cueAt) : undefined}
                      onNext={n < total ? () => goStep(n + 1) : undefined}
                      otherVideo={otherVideo}
                      onGo={otherVideo !== undefined ? () => goStep(n) : undefined}
                    />
                  )
                })}
              </ol>

              <div className={styles.railFoot}>
                <span>影片播到哪一步就展開哪一步；也可以自己點開任一步。</span>
                <a href="#wrapup">完成檢核 ↓</a>
              </div>
            </aside>
          </div>
        </div>

        <div className={styles.below}>
          <section className={styles.goal} id="goal">
            <h2>這一課的目標</h2>
            <p>{lesson.goal}</p>
            <p className={styles.scenario}>{lesson.scenario}</p>
          </section>

          <section className={styles.wrapUp} id="wrapup">
            <div>
              <h2>完成檢核</h2>
              <ul className={styles.checklist}>
                {lesson.checkpoint.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2>完成後你會有</h2>
              <p>{lesson.deliverable}</p>
              <h2>需要準備</h2>
              <ul>
                {lesson.materials.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </section>

          {lesson.tryYourOwn && (
            <section className={styles.tryOwn}>
              <h2>換成你自己的點子</h2>
              <p>{lesson.tryYourOwn}</p>
            </section>
          )}

          <nav className={styles.pager} aria-label="上一課與下一課">
            {prev ? (
              <Link to={lessonPath(course, prev)}>
                <small>上一課</small>{lessonLabel(prev)} {prev.title}
              </Link>
            ) : (
              <Link to={coursePath(course)}>
                <small>回到</small>課程總覽
              </Link>
            )}
            {next ? (
              <Link to={lessonPath(course, next)} className={styles.next}>
                <small>下一課</small>{lessonLabel(next)} {next.title}
              </Link>
            ) : (
              <Link to={`${SOFTWARE_TOPIC.path}#map`} className={styles.next}>
                <small>完成這門課</small>回到課程地圖
              </Link>
            )}
          </nav>
        </div>
      </div>
    </SiteLayout>
  )
}
