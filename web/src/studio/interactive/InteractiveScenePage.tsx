import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { loadScript, loadVoice, type ScriptVoice } from '../../live/scripts'
import { mountShell, type ProgressStore, type Shell } from '../../live/shell'
import { createStage, type Stage, type StageChapter, type StageScript } from '../../live/stage'
import '../../live/shell.css'
import { useCopy } from '../../site/useCopy'
import { ActorPush } from './ActorPush'
import { answerLabel, expandAnswers, momentsOf, withoutAnswer, type Answer, type Answers, type Moment } from './scene'
import styles from './InteractiveScenePage.module.css'

// 互動教學場景(試做):整個視窗都是舞台,播放條是浮動的膠囊,右側在「步驟」與「互動」之間切換。
// 播到互動點會暫停並切到互動區;學員回答後,回應的步驟插進時間軸(見 scene.ts),演員當場演出來。

/** 目前時間與互動點相差多少毫秒內,算是停在互動點上 */
const AT_MOMENT_MS = 50

type Tab = 'steps' | 'interact'
type Timeline = { chapters: StageChapter[]; momentAt: Record<string, number> }
type Controller = {
  shell: Shell
  /** 依回答重新載入舞台,回傳各互動點的時間 */
  sync(answers: Answers): Promise<Record<string, number>>
}

const fmt = (ms: number): string => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type Props = {
  /** src/content/live/ 底下的腳本路徑 */
  script: string
  /** 頁面名稱(document.title 是「<名稱> · 課程提案」,要和 seo/pages.ts 一致) */
  pageTitle: string
  /** stage:把演員推到主畫面,學員直接操作演員;不寫就在側欄回答 */
  interaction?: 'stage'
  /** 把載入的腳本加上互動點(用課程原本的腳本與語音時) */
  prepare?: (script: StageScript) => StageScript
  /** 正式課程頁用:標題、返回連結、播放進度與側欄底部;不寫就是課程研發的試做頁 */
  course?: {
    docTitle: string
    heading: string
    back: { to: string; label: string }
    progress?: ProgressStore
    /** false 時先不建立播放器(例如登入狀態還沒確認) */
    ready: boolean
    footer: ReactNode
    /** 課程第幾步(腳本的 lessonStep) → 提示詞,顯示在側欄對應的章節底下,讓學員複製到自己的工具 */
    prompts?: Record<number, string>
  }
}

export function InteractiveScenePage({ script: scriptPath, pageTitle, interaction, prepare, course }: Props) {
  const docTitle = course?.docTitle ?? `${pageTitle} · 課程提案`
  const progress = course?.progress
  const ready = course?.ready ?? true
  const pageRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const momentHeadRef = useRef<HTMLHeadingElement>(null)
  const ctrl = useRef<Controller | null>(null)
  const [moments, setMoments] = useState<Moment[]>([])
  const [title, setTitle] = useState('')
  const [timeline, setTimeline] = useState<Timeline>({ chapters: [], momentAt: {} })
  const [answers, setAnswers] = useState<Answers>({})
  const [now, setNow] = useState({ t: 0, playing: false })
  const [tab, setTab] = useState<Tab>('steps')
  const [panelOpen, setPanelOpen] = useState(true)
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pushHost, setPushHost] = useState<{ stage: Stage; root: HTMLElement; layer: HTMLElement } | null>(null)
  const [lesson, setLesson] = useState('')

  useEffect(() => {
    document.title = docTitle
  }, [docTitle])

  useEffect(() => {
    const box = boxRef.current
    const page = pageRef.current
    if (!box || !page || !ready) return
    let cancelled = false
    let script: StageScript | null = null
    let voice: ScriptVoice | null = null
    let list: Moment[] = []
    const stageEl = document.createElement('div')
    const stage = createStage(stageEl)
    const tools = document.createElement('span')
    tools.className = 'vp-tools'
    const el = page as HTMLElement & { webkitRequestFullscreen?: () => void }
    const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void }
    const canFullscreen = !!(el.requestFullscreen || el.webkitRequestFullscreen)
    const shell = mountShell(box, {
      stage: stageEl,
      title: pageTitle,
      progress,
      layout: 'capsule',
      toolbar: tools,
      autoLandscape: false,
      onStop: (stop) => {
        if (!list.some((m) => m.title === stop.title)) return false
        if (interaction !== 'stage') {
          setPanelOpen(true)
          setTab('interact')
        }
        return true
      },
      // 全螢幕要包含側欄,所以是整頁進入全螢幕;瀏覽器不支援元素全螢幕(iPhone)時交回外殼的滿版備援
      onFullscreenRequest: canFullscreen
        ? (on) => {
            if (!on) {
              if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {})
              else doc.webkitExitFullscreen?.()
            } else if (el.requestFullscreen) void el.requestFullscreen().catch(() => {})
            else el.webkitRequestFullscreen?.()
          }
        : undefined,
    })
    const onFullscreen = () => shell.setExternalFullscreen((doc.fullscreenElement || doc.webkitFullscreenElement) === page)
    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('webkitfullscreenchange', onFullscreen)
    setToolbar(tools)
    const layer = document.createElement('div')
    layer.className = styles.pushLayer
    stageEl.appendChild(layer)
    setPushHost({ stage, root: stageEl, layer })

    const sync: Controller['sync'] = async (next) => {
      if (!script) return {}
      await stage.load(expandAnswers(script, next), { voice: voice?.durations })
      const momentAt: Record<string, number> = {}
      for (const m of list) {
        const stop = stage.stops.find((s) => s.title === m.title)
        if (stop) momentAt[m.id] = stop.at
      }
      shell.update({
        duration: stage.duration,
        renderAt: stage.renderAt,
        chapters: stage.chapters,
        // 回答過或略過的互動點不再停下來
        stops: stage.stops.filter((s) => !list.some((m) => m.title === s.title && next[m.id])),
        captions: (ms) => stage.captions.find((c) => ms >= c.from && ms < c.to)?.text || '',
        // 有語音的旁白才播;學員選其他選項時新寫的旁白還沒有語音,只顯示字幕
        clips: voice ? stage.narrations.filter((n) => voice?.urls[n.text]).map((n) => ({ at: n.at, ms: voice!.durations[n.text], url: voice!.urls[n.text] })) : [],
      })
      if (!cancelled) setTimeline({ chapters: stage.chapters, momentAt })
      return momentAt
    }
    ctrl.current = { shell, sync }

    // 語音是選用的:讀不到就只顯示字幕
    Promise.all([loadScript(scriptPath), loadVoice(scriptPath).catch(() => null)])
      .then(async ([raw, loaded]) => {
        await document.fonts.ready
        if (cancelled) return
        const data = prepare ? prepare(raw) : raw
        script = data
        voice = loaded
        list = momentsOf(data)
        setMoments(list)
        setTitle(data.title)
        setLesson(data.lesson ?? '')
        await sync({})
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })

    const timer = window.setInterval(() => setNow({ t: shell.time, playing: shell.playing }), 200)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.removeEventListener('webkitfullscreenchange', onFullscreen)
      ctrl.current = null
      shell.destroy()
      setToolbar(null)
      setPushHost(null)
    }
  }, [scriptPath, interaction, prepare, pageTitle, progress, ready])

  // 停在還沒回答的互動點上:由播放器目前的狀態決定,拖走或按播放就自然離開
  const current = moments.find((m) => {
    const at = timeline.momentAt[m.id]
    return at != null && !answers[m.id] && !now.playing && Math.abs(now.t - at) <= AT_MOMENT_MS
  })

  // 焦點移到問題標題(不是選項):習慣按空白鍵暫停的人才不會誤選答案
  const pushed = interaction === 'stage' && current?.stage ? current : undefined
  const currentId = tab === 'interact' && !pushed ? current?.id : undefined
  useEffect(() => {
    if (currentId) momentHeadRef.current?.focus({ preventScroll: true })
  }, [currentId])

  const answer = (moment: Moment, value: Answer) => {
    const c = ctrl.current
    if (!c) return
    const next = { ...answers, [moment.id]: value }
    setAnswers(next)
    c.sync(next)
      .then((at) => {
        c.shell.seek(at[moment.id])
        c.shell.play()
      })
      .catch((e: unknown) => setError(String(e instanceof Error ? e.message : e)))
  }

  /** 收回回答(或略過),回到互動點重新作答 */
  const reopen = (moment: Moment) => {
    const c = ctrl.current
    if (!c) return
    const next = withoutAnswer(moments, answers, moment.id)
    setAnswers(next)
    c.sync(next)
      .then((at) => {
        c.shell.pause()
        c.shell.seek(at[moment.id])
        setNow({ t: at[moment.id], playing: false })
      })
      .catch((e: unknown) => setError(String(e instanceof Error ? e.message : e)))
  }

  const seekTo = (ms: number) => {
    const c = ctrl.current
    if (!c) return
    c.shell.seek(ms)
    setNow({ t: ms, playing: c.shell.playing })
  }

  const openMoment = (m: Moment) => {
    const c = ctrl.current
    if (!c) return
    if (!answers[m.id]) c.shell.pause()
    seekTo(timeline.momentAt[m.id])
    if (interaction !== 'stage') setTab('interact')
  }

  const pendingCount = moments.filter((m) => !answers[m.id]).length
  const classes = [styles.page, panelOpen && styles.panelOpen, current && styles.atMoment, interaction === 'stage' && styles.pushable].filter(Boolean).join(' ')

  return (
    <div ref={pageRef} className={classes} lang="zh-Hant">
      <div ref={boxRef} className={styles.box} />

      <header className={styles.head}>
        <Link to={course?.back.to ?? '/proposal/mcp'} className={styles.back}>
          {course?.back.label ?? '← 構想'}
        </Link>
        <h1>{course?.heading ?? (title || pageTitle)}</h1>
        {!course && <span className={styles.draft}>試做</span>}
      </header>

      {error && (
        <p className={styles.error} role="alert">
          無法載入場景：{error}
        </p>
      )}

      {pushed && pushHost && <ActorPush key={pushed.id} {...pushHost} moment={pushed} onAnswer={(a) => answer(pushed, a)} />}

      {panelOpen && (
        <aside className={styles.panel} aria-label="課程章節與步驟">
          {interaction === 'stage' ? (
            <p className={styles.panelTitle}>{lesson}</p>
          ) : (
            <div className={styles.tabs}>
              <button type="button" aria-pressed={tab === 'steps'} onClick={() => setTab('steps')}>
                步驟
              </button>
              <button type="button" aria-pressed={tab === 'interact'} onClick={() => setTab('interact')}>
                互動
                {pendingCount > 0 && <span className={`${styles.count} ${current ? styles.countActive : ''}`}>{pendingCount}</span>}
              </button>
            </div>
          )}
          <div className={styles.panelBody}>
            {tab === 'steps' || interaction === 'stage' ? (
              <StepList timeline={timeline} moments={moments} answers={answers} t={now.t} onSeek={seekTo} onMoment={openMoment} onReopen={interaction === 'stage' ? reopen : undefined} prompts={course?.prompts} />
            ) : current && !pushed ? (
              <MomentForm key={current.id} moment={current} headRef={momentHeadRef} onAnswer={(a) => answer(current, a)} />
            ) : (
              <MomentList timeline={timeline} moments={moments} answers={answers} onOpen={openMoment} onReopen={reopen} />
            )}
          </div>
          {course?.footer}
        </aside>
      )}

      {toolbar &&
        createPortal(
          <button type="button" className="vp-btn" aria-pressed={panelOpen} aria-label="側欄" title={panelOpen ? '收合側欄' : '打開側欄'} onClick={() => setPanelOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 5h18v14H3zm2 2v10h9V7zm11 0v10h3V7z" fillRule="evenodd" />
            </svg>
          </button>,
          toolbar,
        )}
    </div>
  )
}

function StepList({
  timeline,
  moments,
  answers,
  t,
  onSeek,
  onMoment,
  onReopen,
  prompts,
}: {
  timeline: Timeline
  moments: Moment[]
  answers: Answers
  t: number
  onSeek: (ms: number) => void
  onMoment: (m: Moment) => void
  /** 有傳才顯示「重新回答」(互動在主畫面時,側欄是唯一重新回答的地方) */
  onReopen?: (m: Moment) => void
  prompts?: Record<number, string>
}) {
  const activeRef = useRef<HTMLLIElement>(null)
  // 學員回答才出現的段落(你的回答、看示範)也是章節,但在清單上算前一個章節底下的步驟
  const inserted = new Set(['你的回答', ...moments.flatMap((m) => m.skip?.label ?? [])])
  const items = [
    ...timeline.chapters.map((c) => ({ at: c.at, label: c.label, moment: null as Moment | null, isStep: inserted.has(c.label), prompt: c.step ? prompts?.[c.step] : undefined })),
    ...moments.filter((m) => timeline.momentAt[m.id] != null).map((m) => ({ at: timeline.momentAt[m.id], label: m.title, moment: m as Moment | null, isStep: true, prompt: undefined })),
  ].sort((x, y) => x.at - y.at)
  const active = items.filter((x) => x.at <= t).length - 1
  // 章節多的時候,播到哪裡就捲到哪裡
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active])
  if (!items.length) return <p className={styles.note}>載入中…</p>
  return (
    <ol className={styles.steps}>
      {items.map((x, i) => (
        <li key={`${x.at}-${x.label}`} ref={i === active ? activeRef : undefined} className={x.isStep ? styles.stepChild : styles.stepChapter}>
          <button type="button" aria-current={i === active ? 'step' : undefined} onClick={() => (x.moment ? onMoment(x.moment) : onSeek(x.at))}>
            <span className={styles.stepTime}>{fmt(x.at)}</span>
            <span className={styles.stepLabel}>
              {x.moment && <span className={styles.stepTag}>{answers[x.moment.id] ? '互動 ✓' : '互動'}</span>}
              {x.label}
            </span>
          </button>
          {x.moment && answers[x.moment.id] && onReopen && (
            <button type="button" className={styles.stepAgain} onClick={() => onReopen(x.moment!)}>
              重新回答
            </button>
          )}
          {x.prompt && <PromptCopy prompt={x.prompt} />}
        </li>
      ))}
    </ol>
  )
}

function PromptCopy({ prompt }: { prompt: string }) {
  const { state, copy } = useCopy()
  return (
    <div className={styles.promptCopy}>
      <code>{prompt}</code>
      <button type="button" onClick={() => copy(prompt)} aria-live="polite">
        {state === 'copied' ? '已複製 ✓' : state === 'failed' ? '複製失敗，請手動選取' : '複製'}
      </button>
    </div>
  )
}

function MomentForm({ moment, headRef, onAnswer }: { moment: Moment; headRef: RefObject<HTMLHeadingElement | null>; onAnswer: (a: Answer) => void }) {
  const [text, setText] = useState('')
  const typed = text.trim()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (typed) onAnswer({ text: typed })
  }
  const freeForm = moment.free && (
    <form className={styles.free} onSubmit={submit}>
      <input
        value={text}
        maxLength={60}
        placeholder={moment.free.placeholder}
        aria-label={moment.free.placeholder}
        onChange={(e) => setText(e.target.value)}
        // 輸入法選字時的 Enter 不是送出
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault()
        }}
      />
      <button type="submit" disabled={!typed}>
        送出
      </button>
    </form>
  )
  return (
    <div className={styles.moment}>
      <p className={styles.eyebrow}>換你回答</p>
      <h2 ref={headRef} tabIndex={-1}>
        {moment.title}
      </h2>
      {moment.body && <p className={styles.note}>{moment.body}</p>}
      <div className={styles.options}>
        {moment.options.map((o, option) => (
          <button key={o.label} type="button" onClick={() => onAnswer({ option })}>
            {o.label}
          </button>
        ))}
      </div>
      {freeForm}
      <button type="button" className={styles.skip} onClick={() => onAnswer({ skipped: true })}>
        {moment.skip?.label ?? '略過，繼續看'}
      </button>
    </div>
  )
}

function MomentList({
  timeline,
  moments,
  answers,
  onOpen,
  onReopen,
}: {
  timeline: Timeline
  moments: Moment[]
  answers: Answers
  onOpen: (m: Moment) => void
  onReopen: (m: Moment) => void
}) {
  return (
    <div>
      <p className={styles.note}>播到互動點會自動暫停，在這裡回答，演員會當場回應；你的回答會加進時間軸。</p>
      <ul className={styles.momentList}>
        {moments.map((m) => {
          const a = answers[m.id]
          const label = answerLabel(m, a)
          const at = timeline.momentAt[m.id]
          return (
            <li key={m.id}>
              <strong>{m.title}</strong>
              <span className={styles.note}>{a ? (label ? `你的回答：${label}` : (m.skip ? `已選擇：${m.skip.label}` : '已略過')) : at != null ? `還沒回答 · ${fmt(at)}` : '回答上一題後才會出現'}</span>
              {a ? (
                <button type="button" onClick={() => onReopen(m)}>
                  重新回答
                </button>
              ) : (
                <button type="button" disabled={at == null} onClick={() => onOpen(m)}>
                  跳到這裡
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
