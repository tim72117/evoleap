import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import type { Aspect } from '../../live/types'
import { narrationClips } from '../../live/mixPlan'
import { loadMix, loadScript, loadVoice, type ScriptMix, type ScriptVoice } from '../../live/scripts'
import { mountShell, type ProgressStore, type Shell } from '../../live/shell'
import { homeShowcaseKey, useGuestView } from '../../courses/guestActivity'
import { createStage, type Stage, type StageChapter, type StageScript } from '../../live/stage'
import '../../live/shell.css'
import { useCopy } from '../../site/useCopy'
import { ActorPush } from './ActorPush'
import { StaticActor } from './StaticActor'
import { answerLabel, answersOnActor, expandAnswers, INTERACTIVE_ICON, momentsOf, withoutAnswer, type Answer, type Answers, type Moment } from './scene'
import { useAutoAspect } from '../../site/useAutoAspect'
import { drawerSummary, nextDrawerOpen, parseAspect, usesDrawer } from './portrait'
import styles from './InteractiveScenePage.module.css'

// 互動教學場景(試做):整個視窗都是舞台,播放條是浮動的膠囊,右側在「步驟」與「互動」之間切換。
// 播到互動點會暫停並切到互動區;學員回答後,回應的步驟插進時間軸(見 scene.ts),演員當場演出來。

/** 嵌進其他頁面時,從第一個互動點前面多少毫秒開始:先看一小段前情,再輪到學員動手 */
const EMBED_LEAD_MS = 15000

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
  /** stage:把演員推到主畫面,學員直接操作演員;static:影片停止,演員畫在舞台外,學員直接操作這一份;不寫就在側欄回答 */
  interaction?: 'stage' | 'static'
  /** 把載入的腳本加上互動點(用課程原本的腳本與語音時) */
  prepare?: (script: StageScript) => StageScript
  /** 正式課程頁用:標題、返回連結、播放進度與側欄底部;不寫就是研發基地的試做頁 */
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
  /** 研發基地試做頁的返回連結;不寫就回構想 */
  back?: { to: string; label: string }
  /** 嵌進其他頁面(首頁的展示):一開始停在第一個互動點前面一點,按播放後很快就輪到學員動手,題目放在播放器下方(選項在演員身上),開始播放才放大(在頁面內變寬,外層用 data-expanded 調整版面),學員可以縮小,再播放時又放大;不記進度、不改頁面標題,不提供全螢幕 */
  embed?: boolean
  /** 嵌進首頁時寫 'home':訪客打開首頁與播放展示影片的時間記成「首頁展示」(home:live:<腳本>),和打開課程頁的紀錄分開算 */
  track?: 'home'
  /** 嵌進其他頁面時,「縮小播放器」要放在哪裡(開始播放放大後才出現);不寫就在播放器下方 */
  shrinkSlot?: HTMLElement | null
}

/** 窄視窗(手機直立):直式用底部抽屜 */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 820px)').matches)
  useEffect(() => {
    const mq = matchMedia('(max-width: 820px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

export function InteractiveScenePage({ script: scriptPath, pageTitle, interaction, prepare, course, back, embed, track, shrinkSlot }: Props) {
  const [params] = useSearchParams()
  // 手機直拿自動用直式;網址的 ?aspect= 優先(首頁的嵌入播放器不看網址,只看裝置)
  const auto = useAutoAspect()
  const aspect: Aspect = embed ? auto : parseAspect(params.get('aspect'), auto)
  const narrow = useNarrow()
  const drawer = !embed && usesDrawer(aspect, narrow)
  /** 重建播放器(切換橫/直)時帶著目前的播放時間 */
  const carry = useRef(0)
  const answersRef = useRef<Answers>({})
  const docTitle = course?.docTitle ?? `${pageTitle} · 課程提案`
  const progress = course?.progress
  const ready = course?.ready ?? true
  const pageRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const momentHeadRef = useRef<HTMLHeadingElement>(null)
  const embedMomentRef = useRef<HTMLDivElement>(null)
  const ctrl = useRef<Controller | null>(null)
  // 正式課程頁:訪客打開這一課與播放的時間要記下來(研發頁的試做、首頁的展示不記)
  useGuestView(embed ? (track === 'home' ? homeShowcaseKey(`live:${scriptPath}`) : null) : course ? `live:${scriptPath}` : null, () => ctrl.current?.shell.playing ?? false)
  const [moments, setMoments] = useState<Moment[]>([])
  const [title, setTitle] = useState('')
  const [timeline, setTimeline] = useState<Timeline>({
    chapters: [],
    momentAt: {},
  })
  const [answers, setAnswers] = useState<Answers>({})
  const [now, setNow] = useState({ t: 0, playing: false })
  const [tab, setTab] = useState<Tab>('steps')
  const [panelOpen, setPanelOpen] = useState(!drawer)
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pushHost, setPushHost] = useState<{
    stage: Stage
    root: HTMLElement
    layer: HTMLElement
  } | null>(null)
  const [lesson, setLesson] = useState('')
  const [loaded, setLoaded] = useState<StageScript | null>(null)
  const [hintSlot, setHintSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!embed) document.title = docTitle
  }, [docTitle, embed])

  useEffect(() => {
    const box = boxRef.current
    const page = pageRef.current
    if (!box || !page || !ready) return
    let cancelled = false
    let script: StageScript | null = null
    let voice: ScriptVoice | null = null
    let mix: ScriptMix | null = null
    let list: Moment[] = []
    const stageEl = document.createElement('div')
    const stage = createStage(stageEl, { aspect })
    const tools = document.createElement('span')
    tools.className = 'vp-tools'
    const el = page as HTMLElement & { webkitRequestFullscreen?: () => void }
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null
      webkitExitFullscreen?: () => void
    }
    const canFullscreen = !!(el.requestFullscreen || el.webkitRequestFullscreen)
    const shell = mountShell(box, {
      stage: stageEl,
      title: pageTitle,
      progress,
      layout: 'capsule',
      ...(embed ? { globalKeys: false } : { toolbar: tools }),
      aspect,
      autoLandscape: false,
      onStop: (stop) => {
        const stopped = list.find((m) => m.title === stop.title)
        if (!stopped) return false
        // 靜態互動的題目也放在導覽(側欄);首頁嵌入沒有側欄,題目留在演員旁邊
        if (interaction !== 'stage' && !drawer && !(embed && interaction === 'static' && answersOnActor(stopped))) {
          setPanelOpen(true)
          setTab('interact')
        }
        return true
      },
      // 全螢幕要包含側欄,所以是整頁進入全螢幕;瀏覽器不支援元素全螢幕(iPhone)時交回外殼的滿版備援
      onFullscreenRequest: embed
        ? () => {}
        : canFullscreen
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
      await stage.load(expandAnswers(script, next), {
        voice: voice?.durations,
        aspect,
      })
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
        // 有語音的旁白才播(合成過章節音軌的用章節音軌);學員選其他選項時新寫的旁白還沒有語音,只顯示字幕,回到主線的旁白接著用原本的語音
        clips: narrationClips(stage.narrations, voice, mix),
      })
      if (!cancelled) setTimeline({ chapters: stage.chapters, momentAt })
      return momentAt
    }
    ctrl.current = { shell, sync }

    // 語音是選用的:讀不到就只顯示字幕
    Promise.all([loadScript(scriptPath), loadVoice(scriptPath).catch(() => null), loadMix(scriptPath).catch(() => null)])
      .then(async ([raw, loaded, loadedMix]) => {
        await document.fonts.ready
        if (cancelled) return
        const data = prepare ? prepare(raw) : raw
        script = data
        voice = loaded
        mix = loadedMix
        list = momentsOf(data)
        setMoments(list)
        setTitle(data.title)
        setLesson(data.lesson ?? '')
        setLoaded(data)
        const at = await sync(answersRef.current)
        if (embed && list[0]) carry.current = Math.max(0, (at[list[0].id] ?? 0) - EMBED_LEAD_MS)
        if (carry.current > 0) {
          shell.seek(carry.current)
          setNow({ t: carry.current, playing: false })
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })

    const timer = window.setInterval(() => setNow({ t: shell.time, playing: shell.playing }), 200)
    return () => {
      cancelled = true
      carry.current = shell.time
      window.clearInterval(timer)
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.removeEventListener('webkitfullscreenchange', onFullscreen)
      ctrl.current = null
      shell.destroy()
      setToolbar(null)
      setPushHost(null)
    }
    // drawer 只在建立時決定要不要攔截 onStop,模式改變時另有效果處理側欄,不必重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptPath, interaction, prepare, pageTitle, progress, ready, aspect])

  // 停在還沒回答的互動點上:由播放器目前的狀態決定,拖走或按播放就自然離開
  useEffect(() => {
    answersRef.current = answers
  }, [answers])
  // 進入或離開抽屜模式:抽屜預設收合,側欄預設打開
  useEffect(() => {
    setPanelOpen(!drawer)
  }, [drawer])

  const current = moments.find((m) => {
    const at = timeline.momentAt[m.id]
    return at != null && !answers[m.id] && !now.playing && Math.abs(now.t - at) <= AT_MOMENT_MS
  })

  // 抽屜:停在新的互動點時自動展開;回答後收合(回應由演員在舞台上演出,不要被抽屜擋住)。在靜態演員身上回答時抽屜裡沒有題目,不展開,才不會擋住演員
  const drawerMoment = interaction === 'static' && current && answersOnActor(current) ? undefined : current?.id
  const prevMoment = useRef<string | undefined>(undefined)
  useEffect(() => {
    setPanelOpen((open) => nextDrawerOpen(open, drawer, prevMoment.current, drawerMoment))
    prevMoment.current = drawerMoment
  }, [drawer, drawerMoment])

  // 焦點移到問題標題(不是選項):習慣按空白鍵暫停的人才不會誤選答案
  const pushed = interaction === 'stage' && current?.stage ? current : undefined
  /** 靜態演員:學員直接操作演員,不開詢問框(詢問框只用在沒有演員可以操作的互動點) */
  const onActor = interaction === 'static' && !!current && answersOnActor(current)
  // 互動腳本的 until 還沒達成:選項先不能按(StaticActor 回報)
  const [locked, setLocked] = useState(false)
  const onLocked = useCallback((v: boolean) => setLocked(v), [])
  const staticActor = interaction === 'static' && current?.stage && loaded && <StaticActor key={current.id} script={loaded} answers={answers} moment={current} interactive={onActor} headRef={momentHeadRef} hint={embed} hintSlot={embed ? hintSlot : undefined} onLocked={onLocked} onAnswer={(a) => answer(current, a)} />

  // 嵌在頁面裡時,一開始不放大,開始播放才放大(在頁面內變寬,版面由外層用 data-expanded 決定,不是全螢幕);之後靜態互動也是這個大小,學員按縮小才變小,再開始播放又放大
  const [expanded, setExpanded] = useState(false)
  const wasPlaying = useRef(false)
  useEffect(() => {
    if (embed && now.playing && !wasPlaying.current) setExpanded(true)
    wasPlaying.current = now.playing
  }, [embed, now.playing])
  const shrink = () => {
    ctrl.current?.shell.pause()
    setExpanded(false)
  }
  // 變寬之後播放器可能超出視窗,等版面的過渡結束(HomePage.module.css 的 0.35 秒)才量得到放大後的大小,再捲到看得到的位置
  useEffect(() => {
    if (!expanded || !interacted.current) return
    const timer = window.setTimeout(() => pageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 400)
    return () => window.clearTimeout(timer)
  }, [expanded])
  const currentId = embed || onActor ? current?.id : tab === 'interact' && !pushed ? current?.id : undefined
  // 嵌在頁面裡時,學員動手之前不要搶焦點、捲動頁面
  const interacted = useRef(false)
  if (now.playing || Object.keys(answers).length > 0) interacted.current = true
  useEffect(() => {
    if (!currentId || (embed && !interacted.current)) return
    momentHeadRef.current?.focus({ preventScroll: true })
    // 問題在播放器下方,可能在視窗外
    embedMomentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentId, embed])

  const answer = (moment: Moment, value: Answer) => {
    const c = ctrl.current
    if (!c) return
    const next = { ...answers, [moment.id]: value }
    setAnswers(next)
    if (drawer) setPanelOpen(false)
    // 互動結束:側欄回到「步驟」
    setTab('steps')
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

  // 靜態互動:導覽點回答過的互動點,就回到互動點重新操作(收回回答、停在互動點);沒回答過的照常跳過去
  const goToMoment = (m: Moment) => (interaction === 'static' && answers[m.id] ? reopen(m) : openMoment(m))

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
    if (interaction !== 'stage' && !(embed && interaction === 'static' && answersOnActor(m))) setTab('interact')
  }

  if (embed) {
    return (
      <div ref={pageRef} data-expanded={expanded || undefined} className={[styles.embed, interaction === 'stage' && styles.pushable, current && styles.atMoment, staticActor && styles.staticOn, aspect === 'portrait' && styles.embedPortrait].filter(Boolean).join(' ')} lang="zh-Hant">
        <div className={styles.embedFrame}>
          <div ref={boxRef} className={styles.embedBox} />
          {staticActor}
        </div>
        <div ref={setHintSlot} className={styles.embedHint} />
        {error && (
          <p className={styles.error} role="alert">
            無法載入場景：{error}
          </p>
        )}
        {pushed && pushHost && <ActorPush key={pushed.id} {...pushHost} aspect={aspect} inDrawer moment={pushed} onAnswer={(a) => answer(pushed, a)} />}
        {current && !onActor && (
          <div ref={embedMomentRef} className={styles.embedMoment}>
            <MomentForm key={current.id} moment={current} headRef={momentHeadRef} onAnswer={(a) => answer(current, a)} />
          </div>
        )}
        {expanded &&
          (shrinkSlot
            ? createPortal(
                <button type="button" className={styles.embedShrink} onClick={shrink}>
                  縮小播放器
                </button>,
                shrinkSlot,
              )
            : (
                <button type="button" className={styles.embedShrink} onClick={shrink}>
                  縮小播放器
                </button>
              ))}
      </div>
    )
  }

  const pendingCount = moments.filter((m) => !answers[m.id]).length
  const summary = drawerSummary(timeline.chapters, now.t)
  const classes = [
    styles.page,
    panelOpen && styles.panelOpen,
    drawer && styles.drawerMode,
    drawer && panelOpen && styles.drawerOpen,
    aspect === 'portrait' && styles.portrait,
    current && styles.atMoment,
    // 換上靜態演員的舞台時,主舞台先藏起來(不是壓暗)
    staticActor && styles.staticOn,
    interaction === 'stage' && styles.pushable,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={pageRef} className={classes} lang="zh-Hant">
      <div ref={boxRef} className={styles.box} />

      {/* 在標題列之前:標題列才會在靜態舞台的上面 */}
      {staticActor}

      <header className={styles.head}>
        <Link to={course?.back.to ?? back?.to ?? '/studio/mcp'} className={styles.back}>
          {course?.back.label ?? back?.label ?? '← 構想'}
        </Link>
        <h1>{course?.heading ?? (title || pageTitle)}</h1>
        {!course && <span className={styles.draft}>試做</span>}
      </header>

      {error && (
        <p className={styles.error} role="alert">
          無法載入場景：{error}
        </p>
      )}

      {pushed && pushHost && <ActorPush key={pushed.id} {...pushHost} aspect={aspect} inDrawer={drawer} moment={pushed} onAnswer={(a) => answer(pushed, a)} />}

      {(panelOpen || drawer) && (
        <aside className={styles.panel} aria-label="課程章節與步驟">
          {drawer && (
            <button type="button" className={styles.handle} aria-expanded={panelOpen} onClick={() => setPanelOpen((v) => !v)}>
              <span className={styles.grip} aria-hidden="true" />
              <span className={styles.handleLabel}>{current ? `換你回答 · ${current.title}` : (summary?.label ?? '課程進度')}</span>
              {summary && <span className={styles.handleStep}>{current ? '互動' : `${summary.index}/${summary.total}`}</span>}
              <span className={styles.chevron} aria-hidden="true">
                {panelOpen ? '⌄' : '⌃'}
              </span>
            </button>
          )}
          <div className={styles.panelInner} inert={drawer && !panelOpen}>
            {interaction === 'stage' ? (
              !(drawer && pushed) && <p className={styles.panelTitle}>{lesson}</p>
            ) : (
              <div className={styles.tabs}>
                <button type="button" aria-pressed={tab === 'steps'} onClick={() => setTab('steps')}>
                  步驟
                </button>
                <button type="button" aria-pressed={tab === 'interact'} onClick={() => setTab('interact')}>
                  <InteractiveMark />
                  互動
                  {pendingCount > 0 && <span className={`${styles.count} ${current ? styles.countActive : ''}`}>{pendingCount}</span>}
                </button>
              </div>
            )}
            <div key={drawer && pushed ? pushed.id : 'list'} className={styles.panelBody}>
              {tab === 'steps' || interaction === 'stage' ? (
                drawer && pushed ? (
                  <MomentForm key={pushed.id} moment={pushed} headRef={momentHeadRef} onAnswer={(a) => answer(pushed, a)} />
                ) : (
                  <StepList
                    timeline={timeline}
                    moments={moments}
                    answers={answers}
                    t={now.t}
                    onSeek={seekTo}
                    onMoment={goToMoment}
                    onReopen={interaction === 'stage' ? reopen : undefined}
                    prompts={course?.prompts}
                    hidden={drawer && !panelOpen}
                  />
                )
              ) : current && !pushed ? (
                <MomentForm key={current.id} moment={current} headRef={momentHeadRef} locked={onActor && locked} onActor={onActor} onAnswer={(a) => answer(current, a)} />
              ) : (
                <MomentList timeline={timeline} moments={moments} answers={answers} onOpen={openMoment} onReopen={reopen} againLabel={interaction === 'static' ? '回到互動點' : '重新回答'} />
              )}
            </div>
            {!(drawer && pushed) && course?.footer}
          </div>
        </aside>
      )}

      {toolbar &&
        createPortal(
          <>
            <button type="button" className="vp-btn" aria-pressed={panelOpen} aria-label="側欄" title={panelOpen ? '收合側欄' : '打開側欄'} onClick={() => setPanelOpen((v) => !v)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5h18v14H3zm2 2v10h9V7zm11 0v10h3V7z" fillRule="evenodd" />
              </svg>
            </button>
          </>,
          toolbar,
        )}
    </div>
  )
}

/** 「互動」標籤的圖示,和課程清單同一個 */
function InteractiveMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={INTERACTIVE_ICON} />
    </svg>
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
  hidden,
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
  /** 底部抽屜收合時整個藏起來:不要捲動(捲動會把外層也一起捲走) */
  hidden?: boolean
}) {
  const activeRef = useRef<HTMLLIElement>(null)
  // 學員回答才出現的段落(你的回答、看示範)也是章節,但在清單上算前一個章節底下的步驟
  const inserted = new Set(['你的回答', ...moments.flatMap((m) => m.skip?.label ?? [])])
  const items = [
    ...timeline.chapters.map((c) => ({
      at: c.at,
      label: c.label,
      moment: null as Moment | null,
      isStep: inserted.has(c.label),
      prompt: c.step ? prompts?.[c.step] : undefined,
    })),
    ...moments
      .filter((m) => timeline.momentAt[m.id] != null)
      .map((m) => ({
        at: timeline.momentAt[m.id],
        label: m.title,
        moment: m as Moment | null,
        isStep: true,
        prompt: undefined,
      })),
  ].sort((x, y) => x.at - y.at)
  const active = items.filter((x) => x.at <= t).length - 1
  // 章節多的時候,播到哪裡就捲到哪裡
  useEffect(() => {
    if (!hidden) activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active, hidden])
  if (!items.length) return <p className={styles.note}>載入中…</p>
  return (
    <ol className={styles.steps}>
      {items.map((x, i) => (
        <li key={`${x.at}-${x.label}`} ref={i === active ? activeRef : undefined} className={x.isStep ? styles.stepChild : styles.stepChapter}>
          <button type="button" aria-current={i === active ? 'step' : undefined} onClick={() => (x.moment ? onMoment(x.moment) : onSeek(x.at))}>
            <span className={styles.stepTime}>{fmt(x.at)}</span>
            <span className={styles.stepLabel}>
              {x.moment && (
                <span className={styles.stepTag}>
                  <InteractiveMark />
                  {answers[x.moment.id] ? '互動 ✓' : '互動'}
                </span>
              )}
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

/** onActor:靜態互動時,已經畫在演員身上的選項(有 target,或放進 stage.choices 那一區的)不再列一次 */
function MomentForm({ moment, headRef, locked = false, onActor = false, onAnswer }: { moment: Moment; headRef: RefObject<HTMLHeadingElement | null>; locked?: boolean; onActor?: boolean; onAnswer: (a: Answer) => void }) {
  const listed = moment.options.map((o, option) => ({ ...o, option })).filter((o) => !onActor || (!o.target && !moment.stage?.choices))
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
      {listed.length > 0 && (
        <div className={styles.options}>
          {listed.map((o) => (
            <button key={o.label} type="button" disabled={locked} onClick={() => onAnswer({ option: o.option })}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {freeForm}
      {!moment.noSkip && (
        <button type="button" className={styles.skip} onClick={() => onAnswer({ skipped: true })}>
          {moment.skip?.label ?? '略過，繼續看'}
        </button>
      )}
    </div>
  )
}

/** 回答過的互動點:againLabel 是收回回答、回到互動點的按鈕文字(靜態互動叫「回到互動點」) */
function MomentList({ timeline, moments, answers, onOpen, onReopen, againLabel }: { timeline: Timeline; moments: Moment[]; answers: Answers; onOpen: (m: Moment) => void; onReopen: (m: Moment) => void; againLabel: string }) {
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
              <span className={styles.note}>{a ? (label ? `你的回答：${label}` : m.skip ? `已選擇：${m.skip.label}` : '已略過') : at != null ? `還沒回答 · ${fmt(at)}` : '回答上一題後才會出現'}</span>
              {a ? (
                <button type="button" onClick={() => onReopen(m)}>
                  {againLabel}
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
