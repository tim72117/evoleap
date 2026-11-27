import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import type { Aspect } from '../../live/types'
import { narrationClips } from '../../live/mixPlan'
import { loadMix, loadScript, loadVoice, type ScriptMix, type ScriptVoice } from '../../live/scripts'
import { ScriptError } from '../../live/ScriptError'
import { mountShell, type ProgressStore, type Shell } from '../../live/shell'
import { homeShowcaseKey, useGuestView } from '../../courses/guestActivity'
import { ACTORS } from '../../live/actors'
import { createStage, type Stage, type StageScript } from '../../live/stage'
import '../../live/shell.css'
import { useCopy } from '../../site/useCopy'
import { useLocale, useT } from '../../i18n/I18nProvider'
import { ActorPush } from './ActorPush'
import { StaticActor } from './StaticActor'
import type { DemoPlan } from './demoEngine'
import { checkDemoActions, demoSpeech, withDemoTimeline } from './demoTimeline'
import { captionAt, captionChars, splitTimedCaption } from './captionSplit'
import { answersOnActor, expandAnswers, momentsOf, withoutAnswer, type Answer, type Answers, type Moment } from './scene'
import { useAutoAspect } from '../../site/useAutoAspect'
import { CaptionToggle, ControlPanel, RateMenu } from './ControlPanel'
import { parseAspect } from './portrait'
import { ClaudePractice } from '../../courses/ClaudePractice'
import { useFeature } from '../../site/features'
import styles from './InteractiveScenePage.module.css'

// 互動教學場景:整個視窗都是舞台,播放條是浮動的膠囊。
// 播到互動點會暫停,題目浮在播放器上或直接在演員身上操作;學員回答後,回應的步驟插進時間軸(見 scene.ts),演員當場演出來。

/** 嵌進其他頁面時,從第一個互動點前面多少毫秒開始:先看一小段前情,再輪到學員動手 */
const EMBED_LEAD_MS = 15000

/** 目前時間與互動點相差多少毫秒內,算是停在互動點上 */
const AT_MOMENT_MS = 50
/** 停在互動段尾端之前多少毫秒暫停(播放位置每 200ms 回報一次,要大於它) */
const HOLD_LEAD_MS = 350
/** 開場旁白快講完(剩這麼多)就開始自動示範;要比 HOLD_LEAD_MS 長,影片在段尾停住前一定放行 */
const TALK_END_LEAD_MS = 600
/** 第一個互動點在這之內,就是「一開場就互動」的腳本 */
const OPENING_MOMENT_MS = 1500

type Timeline = { momentAt: Record<string, number>; /** 互動點那一步的尾端 */ momentEnd: Record<string, number>; /** 併進時間軸的示範(互動點 id → 清單的時間表);開始時間就是 momentAt */ demos?: Record<string, DemoPlan>; /** 互動點那一步開場旁白的結束時間(有語音的才有) */ talkEnd?: Record<string, number>; /** 腳本載好、時間軸排好了 */ loaded?: boolean }
type Controller = {
  shell: Shell
  /** 依回答重新載入舞台,回傳各互動點的時間 */
  sync(answers: Answers): Promise<Record<string, number>>
}

type Props = {
  /** 資料庫的腳本路徑 */
  script: string
  /** 頁面名稱(document.title 是「<名稱> · 課程提案」,要和 seo/pages.ts 一致) */
  pageTitle: string
  /** stage:把演員推到主畫面,學員直接操作演員;static:影片停止,演員畫在舞台外,學員直接操作這一份;不寫就在浮出的題目面板回答 */
  interaction?: 'stage' | 'static'
  /** 把載入的腳本加上互動點(用課程原本的腳本與語音時) */
  prepare?: (script: StageScript) => StageScript
  /** 正式課程頁用:標題、返回連結與播放進度;不寫就是研發基地的試做頁 */
  course?: {
    docTitle: string
    heading: string
    back: { to: string; label: string }
    progress?: ProgressStore
    /** false 時先不建立播放器(例如登入狀態還沒確認) */
    ready: boolean
    footer: ReactNode
    /** 課程第幾步(腳本的 lessonStep) → 提示詞:「提示詞」鈕打開的面板列出來,讓學員複製到自己的工具 */
    prompts?: Record<number, string>
    /** 上一課、下一課(沒有下一課時 next 是回課程地圖):手機底部工具列用圖示顯示 */
    pager?: { prev?: { to: string; label: string }; next: { to: string; label: string } }
  }
  /** 研發基地試做頁的返回連結;不寫就回構想 */
  back?: { to: string; label: string }
  /** 嵌進其他頁面(首頁的展示):一開始停在第一個互動點前面一點,按播放後很快就輪到學員動手,題目放在播放器下方(選項在演員身上),開始播放才放大(在頁面內變寬,外層用 data-expanded 調整版面),學員可以縮小,再播放時又放大;不記進度、不改頁面標題,不提供全螢幕 */
  embed?: boolean
  /** 嵌進展示頁(home/ShowcasePage.tsx,以前在首頁)時寫 'home':訪客播放展示影片的時間記成「展示影片」(home:live:<腳本>),和打開課程頁的紀錄分開算 */
  track?: 'home'
  /** 嵌進其他頁面時,「縮小播放器」要放在哪裡(開始播放放大後才出現);不寫就在播放器下方 */
  shrinkSlot?: HTMLElement | null
}

/** 視窗符不符合這個媒體查詢(轉向、改變大小時跟著變) */
function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const sync = () => setOn(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])
  return on
}

export function InteractiveScenePage({ script: scriptPath, pageTitle, interaction, prepare, course, back, embed, track, shrinkSlot }: Props) {
  const [params] = useSearchParams()
  const t = useT()
  const L = t.player.scene
  // 換語言時重建播放器(控制列的文字在建立時決定),從原本的時間接著播
  const { locale } = useLocale()
  // 手機直拿自動用直式;網址的 ?aspect= 優先(首頁的嵌入播放器不看網址,只看裝置)
  const auto = useAutoAspect()
  /** 手機直拿時按全螢幕:改用橫式舞台全螢幕(縮小回來就回到直式) */
  const [fsLandscape, setFsLandscape] = useState(false)
  const fsLandscapeRef = useRef(false)
  fsLandscapeRef.current = fsLandscape
  const aspect: Aspect = embed ? auto : fsLandscape ? 'landscape' : parseAspect(params.get('aspect'), auto)
  // 窄視窗(手機直立)的直式、手機橫放(矮視窗):版面緊湊,題目一律浮在控制列上方,不畫在舞台上
  const narrow = useMedia('(max-width: 820px)')
  // 手機橫放:矮、橫,而且是觸控裝置(桌機把視窗拉矮不算;CSS 的手機樣式用同一組條件)
  const phoneLandscape = useMedia('(max-height: 500px) and (orientation: landscape) and (pointer: coarse)')
  const compact = !embed && ((aspect === 'portrait' && narrow) || phoneLandscape)
  /** 手機直拿:播放器鋪滿整個畫面,最底下是固定的工具列 */
  const phonePortrait = compact && aspect === 'portrait'
  const phonePortraitRef = useRef(false)
  phonePortraitRef.current = phonePortrait
  // 手機橫放本身就是「放大」:全螢幕鈕顯示成「縮小」,按了請手機轉回直的
  const phoneLandscapeRef = useRef(false)
  phoneLandscapeRef.current = !embed && phoneLandscape && !fsLandscape
  const [rotateHint, setRotateHint] = useState(false)
  useEffect(() => {
    if (!rotateHint) return
    const t = window.setTimeout(() => setRotateHint(false), 2600)
    return () => window.clearTimeout(t)
  }, [rotateHint])
  // 手機橫放與否變了(舞台方向沒變時播放器不會重建):重新告訴播放器全螢幕鈕該顯示「放大」還是「縮小」
  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null }
    const full = !!pageRef.current && (doc.fullscreenElement || doc.webkitFullscreenElement) === pageRef.current
    ctrl.current?.shell.setExternalFullscreen(full || fsLandscape || (!embed && phoneLandscape && !fsLandscape))
  }, [phoneLandscape, fsLandscape, embed])
  // 搭配手機本身的轉向:橫式全螢幕時把手機轉成橫的、再轉回直的,就像影片 App 一樣自動縮小回直式
  useEffect(() => {
    if (!fsLandscape) return
    const mq = matchMedia('(orientation: portrait)')
    let wasLandscape = !mq.matches
    const on = (): void => {
      if (!mq.matches) wasLandscape = true
      else if (wasLandscape) {
        setFsLandscape(false)
        const doc = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element | null }
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
        else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.()
      }
    }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [fsLandscape])

  /** 重建播放器(切換橫/直)時帶著目前的播放時間 */
  const carry = useRef(0)
  const answersRef = useRef<Answers>({})
  /** 往回跳到回答過的互動點之前時要做的事(每次 render 換成最新的) */
  const rewindRef = useRef<(from: number, to: number) => void>(() => {})
  /** 頁面自己的跳轉(回答後接著播)不算學員往回跳 */
  const ownSeek = useRef(false)
  const rewindSync = useRef<Promise<unknown>>(Promise.resolve())
  const [muted, setMuted] = useState(false)
  const [promptsOpen, setPromptsOpen] = useState(false)
  const docTitle = course?.docTitle ?? `${pageTitle} · 課程提案`
  const progress = course?.progress
  const ready = course?.ready ?? true
  const pageRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const momentHeadRef = useRef<HTMLHeadingElement>(null)
  const embedMomentRef = useRef<HTMLDivElement>(null)
  /** 每個互動點那一步的尾端(載入時就要用,不等 state) */
  const endRef = useRef<Record<string, number>>({})
  const ctrl = useRef<Controller | null>(null)
  // 正式課程頁:訪客打開這一課與播放的時間要記下來(研發頁的試做、首頁的展示不記)
  const guest = useGuestView(embed ? (track === 'home' ? homeShowcaseKey(`live:${scriptPath}`) : null) : course ? `live:${scriptPath}` : null, () => ctrl.current?.shell.playing ?? false)
  const [moments, setMoments] = useState<Moment[]>([])
  const [title, setTitle] = useState('')
  const [timeline, setTimeline] = useState<Timeline>({
    momentAt: {},
    momentEnd: {},
  })
  const [answers, setAnswers] = useState<Answers>({})
  const [now, setNow] = useState<{ t: number; playing: boolean; ended?: boolean }>({ t: 0, playing: false })
  const [voiceData, setVoiceData] = useState<ScriptVoice | null>(null)
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 載入失敗也回報(訪客紀錄用來找出打開了卻沒有播放的原因)
  useEffect(() => {
    if (error) guest.fail(error)
  }, [error, guest])
  const [pushHost, setPushHost] = useState<{
    stage: Stage
    root: HTMLElement
    layer: HTMLElement
  } | null>(null)
  const [loaded, setLoaded] = useState<StageScript | null>(null)
  // 腳本有 practice 時,右上角有「動手試試」:打開靜態的 Claude Code 練習(courses/ClaudePractice.tsx)
  const [practiceOpen, setPracticeOpen] = useState(false)
  // 功能旗標 practice 沒開時不顯示(見 site/features.ts)
  const practiceOn = useFeature('practice')
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
      onRewind: (from, to) => rewindRef.current(from, to),
      // 互動點的暫停由這一頁接手,不顯示外殼的「停一下」畫面
      onStop: (stop) => list.some((m) => m.title === stop.title),
      // 全螢幕要包含浮在播放器上的標題列與題目,所以是整頁進入全螢幕;瀏覽器不支援元素全螢幕(iPhone)時交回外殼的滿版備援
      // 不支援整頁全螢幕又不是手機直拿(或它換成的橫式全螢幕)時不接手,交給外殼的滿版備援
      onFullscreenRequest: embed
        ? () => {}
        : !canFullscreen && !phonePortraitRef.current && !fsLandscapeRef.current && !phoneLandscapeRef.current
        ? undefined
        : (on) => {
            // 手機直拿放大:換成橫式舞台(播放器重建,整頁仍是全螢幕),能鎖定方向的瀏覽器順便轉成橫向;縮小:回到直式
            const toLandscape = on && phonePortraitRef.current
            const leaving = !on && fsLandscapeRef.current
            const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
            // 手機橫放按「縮小」:離開全螢幕,能鎖定方向的轉回直的,不行的提示把手機轉直
            if (!on && phoneLandscapeRef.current && !leaving) {
              const exit = () => {
                if (doc.fullscreenElement || doc.webkitFullscreenElement) {
                  if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {})
                  else doc.webkitExitFullscreen?.()
                }
              }
              // 全螢幕中能鎖定方向(Android):留在全螢幕、鎖成直向,畫面直接轉直(離開全螢幕會解除鎖定,又轉回橫的)
              if (orientation?.lock && (doc.fullscreenElement || doc.webkitFullscreenElement)) {
                void orientation.lock('portrait').catch(() => {
                  exit()
                  setRotateHint(true)
                })
              } else {
                exit()
                setRotateHint(true)
              }
              return
            }
            if (!canFullscreen && !toLandscape && !leaving) return
            if (on && canFullscreen) {
              if (el.requestFullscreen) void el.requestFullscreen().catch(() => {})
              else el.webkitRequestFullscreen?.()
            } else if (!on && (doc.fullscreenElement || doc.webkitFullscreenElement)) {
              if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {})
              else doc.webkitExitFullscreen?.()
            }
            if (toLandscape) {
              setFsLandscape(true)
              void orientation?.lock?.('landscape').catch(() => {})
            } else if (leaving) {
              setFsLandscape(false)
              orientation?.unlock?.()
            }
            shell.setExternalFullscreen(toLandscape || (on && isFull()) || phoneLandscapeRef.current)
          },
    })
    // 橫式全螢幕(手機直拿放大)時按鈕一律是「縮小」:瀏覽器不讓整頁全螢幕也能按回直式
    const isFull = (): boolean => (doc.fullscreenElement || doc.webkitFullscreenElement) === page
    const onFullscreen = () => {
      const full = isFull()
      shell.setExternalFullscreen(full || fsLandscapeRef.current || phoneLandscapeRef.current)
      // 用手勢或 Esc 離開全螢幕:橫式全螢幕也回到直式
      if (!full && fsLandscapeRef.current) setFsLandscape(false)
    }
    // 換成橫式全螢幕後播放器重建:只更新按鈕(這時全螢幕可能還沒生效,不能當成離開)
    shell.setExternalFullscreen(isFull() || fsLandscapeRef.current || phoneLandscapeRef.current)
    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('webkitfullscreenchange', onFullscreen)
    setToolbar(tools)
    const layer = document.createElement('div')
    layer.className = styles.pushLayer
    stageEl.appendChild(layer)
    setPushHost({ stage, root: stageEl, layer })

    const sync: Controller['sync'] = async (next) => {
      if (!script) return {}
      // 示範清單併進時間軸(嵌入的小播放器只播影片,不併)
      const demos = embed ? [] : list.filter((m) => m.demo)
      const timed = withDemoTimeline(expandAnswers(script, next), demos, voice?.durations)
      await stage.load(timed.script, {
        voice: voice?.durations,
        aspect,
      })
      // 演員在舞台載入時才下載:載好後才能照示範清單套一遍,動作或順序寫錯在這裡就報出來
      for (const m of list) if (m.demo && interaction !== 'static') throw new Error(`互動點「${m.id}」:demo 只能用在 static 模式的課頁(演員要是當一般網頁操作的演員)`)
      for (const m of list) if (m.demo) checkDemoActions(m.demo, script, (m.stage?.focus ?? '').split(':')[0], `互動點「${m.id}」`)
      const momentAt: Record<string, number> = {}
      for (const m of list) {
        const stop = stage.stops.find((s) => s.title === m.title)
        if (stop) momentAt[m.id] = stop.at
      }
      const speech = Object.entries(timed.plans).map(([id, plan]) => demoSpeech(plan, momentAt[id], voice?.durations))
      const spoken = [...stage.narrations, ...speech.flatMap((s) => s.narrations)].sort((a, b) => a.at - b.at)
      const demoCaptions = speech.flatMap((s) => s.captions)
      shell.update({
        duration: stage.duration,
        renderAt: stage.renderAt,
        chapters: stage.chapters,
        // 回答過或略過的互動點不再停下來
        stops: stage.stops.filter((s) => !list.some((m) => m.title === s.title && next[m.id])).map((s) => ({ ...s, live: list.find((m) => m.title === s.title)?.live })),
        captions: (ms) => {
          // 示範的一句是整句,依畫面寬度切短、跟著語音換行
          const said = demoCaptions.find((x) => ms >= x.from && ms < x.to)
          if (said) return captionAt(splitTimedCaption(said.text, said.to - said.from, captionChars(), voice?.levels?.[said.text]), ms - said.from)
          const c = stage.captions.find((x) => ms >= x.from && ms < x.to)
          // 手機直拿再切短:一次一行
          if (!c || captionChars() > 16 || c.text.length <= captionChars()) return c?.text || ''
          return captionAt(splitTimedCaption(c.text, c.to - c.from, captionChars()), ms - c.from)
        },
        // 有語音的旁白才播(合成過章節音軌的用章節音軌);學員選其他選項時新寫的旁白還沒有語音,只顯示字幕,回到主線的旁白接著用原本的語音
        clips: narrationClips(spoken, voice, mix),
      })
      // 互動段的尾端 = 下一個有旁白(或下一個互動點)的步驟開始:互動點的旁白會一直講到那裡,中間沒旁白的步驟(收起演員等)不算新的一段
      const momentEnd: Record<string, number> = {}
      for (const id of Object.keys(momentAt)) {
        const i = stage.steps.findIndex((x) => (x.step as { id?: string }).id === id)
        const after = i >= 0 ? stage.steps.slice(i + 1).find((x) => 'narration' in x.step || x.kind === 'checkpoint') : undefined
        momentEnd[id] = timed.plans[id] ? momentAt[id] + timed.plans[id].total : (after?.start ?? stage.duration)
      }
      endRef.current = momentEnd
      const talkEnd: Record<string, number> = {}
      for (const id of Object.keys(momentAt)) {
        const step = stage.steps.find((x) => (x.step as { id?: string }).id === id)
        const said = step && stage.narrations.find((n) => n.at >= step.start - 100 && n.at < step.start + 1000)
        const ms = said && voice?.durations[said.text]
        // 腳本的 demoStartMs:旁白講到這裡(毫秒)就開始示範,讓畫面對上那句話;沒寫就等整段講完
        const cue = (step?.step as { demoStartMs?: number } | undefined)?.demoStartMs
        if (said && ms) talkEnd[id] = said.at + (cue != null ? cue + TALK_END_LEAD_MS : ms)
      }
      if (!cancelled) setTimeline({ momentAt, momentEnd, talkEnd, demos: timed.plans, loaded: true })
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
        setVoiceData(loaded)
        mix = loadedMix
        list = momentsOf(data)
        setMoments(list)
        setTitle(data.title)
        setLoaded(data)
        const at = await sync(answersRef.current)
        if (!cancelled) guest.ready()
        if (embed && list[0]) carry.current = Math.max(0, (at[list[0].id] ?? 0) - EMBED_LEAD_MS)
        // 當一般網頁操作的互動(page 演員)小播放器裝不下:嵌入時只播影片,從它後面開始
        const first = list[0]
        if (embed && first && ACTORS[data.cast[first.stage?.focus?.split(':')[0] ?? '']?.actor]?.page) carry.current = endRef.current[first.id] ?? 0
        if (carry.current > 0) {
          shell.seek(carry.current)
          setNow({ t: carry.current, playing: false })
        } else if (!embed && list[0]?.live && (at[list[0].id] ?? Infinity) <= OPENING_MOMENT_MS) {
          // live 的互動點要在播放中才出現;開頭就是互動點時直接開始播,學員打開就能操作
          shell.play()
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })

    const timer = window.setInterval(() => {
      setNow({ t: shell.time, playing: shell.playing, ended: shell.ended })
      setMuted(shell.muted)
    }, 200)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptPath, interaction, prepare, pageTitle, progress, ready, aspect, guest, locale])

  // 停在還沒回答的互動點上:由播放器目前的狀態決定,拖走或按播放就自然離開
  useEffect(() => {
    answersRef.current = answers
  }, [answers])
  // 邊播邊互動(live)的互動點要播到才出現;出現之後暫停(按暫停、切到別的分頁)也留著,不退回影片被中央播放鍵擋住
  const liveShown = useRef<string | undefined>(undefined)
  /** 演員當一般網頁操作(page)的 live 互動點:只在它自己那一段顯示,走到段尾停下來等學員;之後回傳段尾,其他回傳 undefined */
  const holdAt = (m: Moment): number | undefined => {
    const actor = m.stage?.focus?.split(':')[0]
    return m.live && !m.demo && actor && loaded && ACTORS[loaded.cast[actor]?.actor]?.page ? timeline.momentEnd[m.id] : undefined
  }
  const current = moments.find((m) => {
    if (embed && holdAt(m) != null) return false
    // 示範是時間軸上的一段:位置在裡面就出現,走過去就接著播後面的影片
    const plan = timeline.demos?.[m.id]
    if (plan) {
      const from = timeline.momentAt[m.id]
      return (from <= OPENING_MOMENT_MS || now.t >= from) && now.t < from + plan.total
    }
    const at = timeline.momentAt[m.id]
    const end = holdAt(m)
    // 開場就是互動:一打開就顯示,不等播放開始(瀏覽器擋自動播放、在背景分頁打開時也一樣)
    if (at != null && !answers[m.id] && end != null && at <= OPENING_MOMENT_MS && now.t < end) return true
    return at != null && !answers[m.id] && (m.live ? now.t >= at && (end == null || now.t < end) && (now.playing || liveShown.current === m.id) : !now.playing && Math.abs(now.t - at) <= AT_MOMENT_MS)
  })
  liveShown.current = current?.live ? current.id : undefined

  // 走到這一段的尾端就停住(每次走到只停一次;學員再按播放就往下看影片)
  const heldRef = useRef<string | undefined>(undefined)
  const holdEnd = current ? holdAt(current) : undefined
  useEffect(() => {
    if (!current || holdEnd == null) {
      heldRef.current = undefined
      return
    }
    if (now.playing && now.t >= holdEnd - HOLD_LEAD_MS && heldRef.current !== current.id) {
      heldRef.current = current.id
      ctrl.current?.shell.pause()
    }
  }, [current, holdEnd, now.t, now.playing])

  // 焦點移到問題標題(不是選項):習慣按空白鍵暫停的人才不會誤選答案
  const pushed = interaction === 'stage' && current?.stage ? current : undefined
  /** 靜態演員:學員直接操作演員,不開詢問框(詢問框只用在沒有演員可以操作的互動點) */
  const onActor = interaction === 'static' && !!current && answersOnActor(current)
  /** 播完:播放鈕換成重播 */
  const replay = !!now.ended && !now.playing
  const demoPlan = current && timeline.demos?.[current.id]
  const demo = demoPlan ? { plan: demoPlan, at: timeline.momentAt[current.id], shell: () => ctrl.current?.shell } : null
  // 自動示範要等開場旁白:倒回開頭(又變成要等)或放行時重新掛一次演員,示範從頭演;學員自己操作過就不再重掛
  const holdAuto = !current?.demo && !!current?.live && now.t < (timeline.talkEnd?.[current.id] ?? 0) - TALK_END_LEAD_MS
  const pressed = useRef<string | undefined>(undefined)
  const actorGen = useRef('run')
  if (current?.demo) actorGen.current = 'demo'
  else if (current && pressed.current !== current.id) actorGen.current = holdAuto ? 'hold' : 'run'
  const staticActor = interaction === 'static' && current?.stage && loaded && <StaticActor key={`${current.id}:${actorGen.current}`} onPress={() => (pressed.current = current.id)} script={loaded} answers={answers} moment={current} interactive={onActor} holdAuto={holdAuto} demo={demo} headRef={momentHeadRef} hint={embed || !current.demo} hintSlot={embed ? hintSlot : undefined} onAnswer={(a) => answer(current, a)} />

  // 靜態演員上場時,影片舞台的同一位演員從 DOM 拿掉:畫面上只有一份(播放器重建或重載舞台後照樣有效)
  const standIns = staticActor && current ? (current.interact?.cast ?? [(current.stage?.focus ?? '').split(':')[0]]).join(' ') : ''
  useLayoutEffect(() => {
    pushHost?.stage.detach(standIns ? standIns.split(' ') : [])
  }, [pushHost, standIns])

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
  const currentId = embed || !pushed ? current?.id : undefined
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
    // 示範的互動點:按鈕是「跳過示範」,跳到示範結尾接著播。選項沒有要加的步驟就不記回答(往回拖照樣看得到示範)
    const plan = timeline.demos?.[moment.id]
    const skipDemo = () => {
      seekTo(timeline.momentAt[moment.id] + plan!.total)
      c.shell.play()
    }
    if (plan && 'option' in value && !moment.options[value.option]?.steps.length) return skipDemo()
    const next = { ...answers, [moment.id]: value }
    setAnswers(next)
    c.sync(next)
      .then((at) => {
        ownSeek.current = true
        c.shell.seek(at[moment.id] + (plan?.total ?? 0))
        ownSeek.current = false
        c.shell.play()
      })
      .catch((e: unknown) => setError(String(e instanceof Error ? e.message : e)))
  }

  // 往回跳到回答過的互動點之前:收回它(和接在它後面的)回答,播到時再問一次
  rewindRef.current = (from, to) => {
    const c = ctrl.current
    if (!c || ownSeek.current) return
    let next = answersRef.current
    for (const m of moments) {
      const at = timeline.momentAt[m.id]
      if (at != null && next[m.id] && to < at - AT_MOMENT_MS && from >= at - AT_MOMENT_MS) next = withoutAnswer(moments, next, m.id)
    }
    if (next === answersRef.current) return
    // 拖曳時會連續呼叫:先記下結果,舞台照順序重新載入
    answersRef.current = next
    pressed.current = undefined
    setAnswers(next)
    rewindSync.current = rewindSync.current.then(() => c.sync(answersRef.current)).catch((e: unknown) => setError(String(e instanceof Error ? e.message : e)))
  }

  const seekTo = (ms: number) => {
    const c = ctrl.current
    if (!c) return
    c.shell.seek(ms)
    setNow({ t: ms, playing: c.shell.playing })
  }

  const prompts = Object.entries(course?.prompts ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, prompt]) => prompt)
  useEffect(() => {
    if (!promptsOpen) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setPromptsOpen(false)
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [promptsOpen])
  const promptsIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12.500h5" />
    </svg>
  )

  if (embed) {
    return (
      <div ref={pageRef} data-expanded={expanded || undefined} className={[styles.embed, interaction === 'stage' && styles.pushable, current && styles.atMoment, staticActor && styles.staticOn, aspect === 'portrait' && styles.embedPortrait].filter(Boolean).join(' ')} lang="zh-Hant">
        <div className={styles.embedFrame}>
          <div ref={boxRef} className={styles.embedBox} />
          {staticActor}
        </div>
        <div ref={setHintSlot} className={styles.embedHint} />
        {error && <ScriptError className={styles.error} prefix={L.loadError} error={error} />}
        {pushed && pushHost && <ActorPush key={pushed.id} {...pushHost} aspect={aspect} outside moment={pushed} onAnswer={(a) => answer(pushed, a)} />}
        {current && !onActor && (
          <div ref={embedMomentRef} className={styles.embedMoment}>
            <MomentForm key={current.id} moment={current} headRef={momentHeadRef} onAnswer={(a) => answer(current, a)} />
          </div>
        )}
        {expanded &&
          (shrinkSlot
            ? createPortal(
                <button type="button" className={styles.embedShrink} onClick={shrink}>
                  {L.shrink}
                </button>,
                shrinkSlot,
              )
            : (
                <button type="button" className={styles.embedShrink} onClick={shrink}>
                  {L.shrink}
                </button>
              ))}
      </div>
    )
  }

  const classes = [
    styles.page,
    aspect === 'portrait' && styles.portrait,
    phonePortrait && styles.phoneBare,
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

      {practiceOn && loaded?.practice && practiceOpen && <ClaudePractice props={loaded.practice.props} onClose={() => setPracticeOpen(false)} />}

      {/* 在標題列之前:標題列才會在靜態舞台的上面 */}
      {staticActor}

      {/* 控制面板:標題列、右上角按鈕和播放器的控制列一起淡出淡入(ControlPanel.tsx) */}
      <ControlPanel box={boxRef} shell={() => ctrl.current?.shell}>
        <header className={styles.head}>
          <Link to={course?.back.to ?? back?.to ?? '/studio'} className={styles.back}>
            {course?.back.label ?? back?.label ?? '← 構想'}
          </Link>
          <h1>{course?.heading ?? (title || pageTitle)}</h1>
          {!course && <span className={styles.draft}>試做</span>}
        </header>

        {/* 右上角:動手試試、播放速度與字幕鈕(手機) */}
        <div className={styles.topRight}>
          {practiceOn && loaded?.practice && (
            <button
              type="button"
              className={styles.practiceTop}
              onClick={() => {
                ctrl.current?.shell.pause()
                setPracticeOpen(true)
              }}
            >
              {t.courses.live.practice.open}
            </button>
          )}
          <div className={styles.topTools}>
            <RateMenu box={boxRef} shell={() => ctrl.current?.shell} className={styles.rateTop} menuClassName={styles.rateMenu} />
            <CaptionToggle box={boxRef} className={styles.ccTop} />
          </div>
        </div>
      </ControlPanel>

      {/* 播完時:登入提示浮在播放條上方(上一課、下一課在底部工具列) */}
      {!current && !now.playing && timeline.loaded && course?.footer && <div className={styles.bareFooter}>{course.footer}</div>}
      {/* 要在面板裡回答的互動點直接浮出題目與選項;推到主畫面的互動,緊湊版面的題目也在這裡 */}
      {current && !onActor && (compact || !pushed) && (
        <div className={styles.momentPop}>
          <MomentForm key={current.id} moment={current} headRef={momentHeadRef} onAnswer={(a) => answer(current, a)} />
        </div>
      )}
      {phonePortrait && (
        <div className={styles.bareBar}>
          <button
            type="button"
            className={styles.barePlay}
            aria-label={replay ? t.player.replay : now.playing ? t.player.pause : t.player.play}
            onClick={() => {
              const shell = ctrl.current?.shell
              if (!shell) return
              if (shell.playing) shell.pause()
              else shell.play()
              setNow({ t: shell.time, playing: shell.playing })
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={replay ? 'M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z' : now.playing ? 'M7 5h3.5v14H7zM13.500 5H17v14h-3.500z' : 'M8 5v14l11-7z'} />
            </svg>
          </button>
          <span className={styles.barSpace} />
          {voiceData && (
            <button
              type="button"
              className={styles.barIcon}
              aria-label={muted ? t.player.unmute : t.player.mute}
              title={muted ? t.player.unmute : t.player.mute}
              onClick={() => {
                const shell = ctrl.current?.shell
                if (!shell) return
                shell.toggleMute()
                setMuted(shell.muted)
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={muted ? 'M4 9h4l5-4v14l-5-4H4zm12.6.2 1.4-1.4 2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2z' : 'M4 9h4l5-4v14l-5-4H4zm12.5 3a4 4 0 0 0-2-3.5v7a4 4 0 0 0 2-3.5zM14.5 4v2a6 6 0 0 1 0 12v2a8 8 0 0 0 0-16z'} />
              </svg>
            </button>
          )}
          {prompts.length > 0 && (
            <button type="button" className={styles.barIcon} aria-label={L.prompts} title={L.prompts} aria-expanded={promptsOpen} onClick={() => setPromptsOpen((v) => !v)}>
              {promptsIcon}
            </button>
          )}
          {course?.pager?.prev && (
            <Link className={styles.barIcon} to={course.pager.prev.to} aria-label={course.pager.prev.label} title={course.pager.prev.label}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6 5h2.500v14H6zM19 5v14l-9.500-7z" />
              </svg>
            </Link>
          )}
          {course?.pager && (
            <Link className={styles.barIcon} to={course.pager.next.to} aria-label={course.pager.next.label} title={course.pager.next.label}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M15.500 5H18v14h-2.500zM5 5l9.500 7L5 19z" />
              </svg>
            </Link>
          )}
        </div>
      )}

      {promptsOpen && prompts.length > 0 && (
        <div className={styles.promptPanel} role="dialog" aria-label={L.prompts}>
          <div className={styles.promptHead}>
            <h2>{L.prompts}</h2>
            <button type="button" aria-label={L.closePrompts} title={L.closePrompts} onClick={() => setPromptsOpen(false)}>
              ×
            </button>
          </div>
          {prompts.map((p, i) => (
            <PromptCopy key={i} prompt={p} />
          ))}
        </div>
      )}

      {rotateHint && (
        <p className={styles.rotateHint} role="status">
          {L.rotateBack}
        </p>
      )}

      {error && <ScriptError className={styles.error} prefix={L.loadError} error={error} />}

      {pushed && pushHost && <ActorPush key={pushed.id} {...pushHost} aspect={aspect} outside={compact} moment={pushed} onAnswer={(a) => answer(pushed, a)} />}

      {!phonePortrait &&
        prompts.length > 0 &&
        toolbar &&
        createPortal(
          <button type="button" className="vp-btn" aria-label={L.prompts} title={L.prompts} aria-expanded={promptsOpen} onClick={() => setPromptsOpen((v) => !v)}>
            {promptsIcon}
          </button>,
          toolbar,
        )}
      {/* 寬視窗:上一課、下一課放在播放器控制列 */}
      {!phonePortrait &&
        course?.pager &&
        toolbar &&
        createPortal(
          <>
            {course.pager.prev && (
              <Link className="vp-btn" to={course.pager.prev.to} aria-label={course.pager.prev.label} title={course.pager.prev.label}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 5h2.500v14H6zM19 5v14l-9.500-7z" />
                </svg>
              </Link>
            )}
            <Link className="vp-btn" to={course.pager.next.to} aria-label={course.pager.next.label} title={course.pager.next.label}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.500 5H18v14h-2.500zM5 5l9.500 7L5 19z" />
              </svg>
            </Link>
          </>,
          toolbar,
        )}
    </div>
  )
}

function PromptCopy({ prompt }: { prompt: string }) {
  const { state, copy } = useCopy()
  const t = useT().player
  return (
    <div className={styles.promptCopy}>
      <code>{prompt}</code>
      <button type="button" onClick={() => copy(prompt)} aria-live="polite">
        {state === 'copied' ? t.copied : state === 'failed' ? t.copyFailed : t.copy}
      </button>
    </div>
  )
}

/** 互動點的題目、選項、自由輸入與略過 */
function MomentForm({ moment, headRef, onAnswer }: { moment: Moment; headRef: RefObject<HTMLHeadingElement | null>; onAnswer: (a: Answer) => void }) {
  const [text, setText] = useState('')
  const L = useT().player.scene
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
        {L.submit}
      </button>
    </form>
  )
  return (
    <div className={styles.moment}>
      <p className={styles.eyebrow}>{L.yourTurn}</p>
      <h2 ref={headRef} tabIndex={-1}>
        {moment.title}
      </h2>
      {moment.body && <p className={styles.note}>{moment.body}</p>}
      {moment.options.length > 0 && (
        <div className={styles.options}>
          {moment.options.map((o, option) => (
            <button key={o.label} type="button" onClick={() => onAnswer({ option })}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {freeForm}
      {!moment.noSkip && (
        <button type="button" className={styles.skip} onClick={() => onAnswer({ skipped: true })}>
          {moment.skip?.label ?? L.skip}
        </button>
      )}
    </div>
  )
}
