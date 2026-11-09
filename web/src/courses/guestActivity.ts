// 訪客(未登入)的上課紀錄:打開一課時記一筆(展示頁 /showcase 的展示影片記成 home:…,按下播放才記;以前放在首頁),播放時累計實際播放的時間(不管倍速,是真實經過的時間)。
// 訪客代號在 evoleap_guest cookie(伺服器發的 HttpOnly cookie,前端讀不到也不用管);會員不記在這裡(會員有自己的播放進度)。
// 伺服器端見 server/internal/api/guest.go。送不出去都靜默略過,不影響上課。
// 為了看出「打開了卻沒有播放」的原因,另外回報:進站來源(document.referrer,伺服器只留網域)、頁面在前景的時間、
// 播放器多久載入完成(ready)或載入失敗的訊息(fail)。看到登入門檻的訪客也記一筆(gate: 開頭,LoginGate.tsx);
// 打開首頁、課程地圖也記一筆(page:<網址>,PageView),後台串成「從首頁進來的路徑」。
// 打開登入頁也記一筆(page:/login,auth/LoginPage.tsx):頁面用 note() 記下 next:<網址>、fail:<訊息>,用 ready／fail 記 Google 登入按鈕的載入時間;
// 登入或註冊成功由伺服器記在這筆紀錄上(store.NoteGuestLogin),因為登入後前端就不能再回報訪客紀錄。
// 另外記這次造訪的足跡(events):載入完成／失敗、按了哪個按鈕或連結(只記按鈕上的名稱與連結的站內網址,不記輸入的文字)、
// 捲動到頁面的幾成、切到別的分頁又回來、開始／暫停播放、最後離開到哪一頁或關掉頁面。後台用來看「打開了卻沒有播放的人做了什麼」。
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/** 展示影片的紀錄名稱前綴(以前在首頁,現在在展示頁 /showcase;名稱沿用 home:):和打開課程頁的紀錄分開算(後台標成「展示影片」) */
export const HOME_SHOWCASE_PREFIX = 'home:'
export const homeShowcaseKey = (lesson: string): string => HOME_SHOWCASE_PREFIX + lesson
export const isHomeShowcase = (lesson: string): boolean => lesson.startsWith(HOME_SHOWCASE_PREFIX)
/** 訪客打開首頁、課程地圖這類不是單課的頁面:page:<網址>(後台用來串出「從首頁進來的路徑」) */
export const PAGE_PREFIX = 'page:'
export const isPage = (lesson: string): boolean => lesson.startsWith(PAGE_PREFIX)

/** 訪客打開要登入的課、看到登入門檻的紀錄名稱前綴(後台標成「登入門檻」) */
export const GATE_PREFIX = 'gate:'
export const isGate = (lesson: string): boolean => lesson.startsWith(GATE_PREFIX)

/** 除了播放時間以外一起回報的資料 */
export interface GuestExtra {
  visibleMs: number
  readyMs?: number
  error?: string
  /** 到目前為止的整份足跡(只會往後加) */
  events?: GuestEvent[]
}

/** 足跡裡的一件事:t 是打開後第幾毫秒,e 是事件代碼(見檔案開頭) */
export interface GuestEvent {
  t: number
  e: string
}

/** 一次造訪最多記幾件事(伺服器也是這個上限) */
export const MAX_EVENTS = 40

/** 按到的按鈕或連結叫什麼:aria-label、按鈕上的字(最多 24 字);站內連結記網址。點在其他地方記成「畫面」 */
export function clickLabel(target: EventTarget | null): string {
  const el = typeof Element !== 'undefined' && target instanceof Element ? target.closest('a[href], button, [role="button"], summary, input, select, label') : null
  if (!el) return 'click:畫面'
  if (el instanceof HTMLAnchorElement) {
    const url = new URL(el.href, location.href)
    return url.origin === location.origin ? `link:${url.pathname}` : `link:${url.hostname}`
  }
  // 輸入框只記種類,不記內容
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) return `click:(${el.tagName.toLowerCase()})`
  const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)
  return `click:${name || el.tagName.toLowerCase()}`
}

/** 每隔多久檢查一次是不是在播放 */
const TICK_MS = 1000
/** 累計多少新的播放時間就回報一次(另外在暫停後、離開頁面與換課時補送) */
export const FLUSH_MS = 30_000
/** 有新的足跡或前景時間時,最多隔多久就送一次:關掉分頁、離開到別的網站時,離開那一刻補送的請求不一定送得到,最多只掉這麼久的資料 */
export const HEARTBEAT_MS = 10_000
/** 沒有新的足跡、沒有播放,只有前景時間變多時,心跳間隔從 HEARTBEAT_MS 逐次加倍到這個值 */
export const MAX_IDLE_BEAT_MS = 5 * 60_000
/** 兩次檢查的間隔超過這個值就不算(電腦休眠、分頁在背景被節流太久),免得一次加上好幾個小時 */
const MAX_GAP_MS = 65_000

export const guestApi = {
  open: async (lesson: string): Promise<string | null> => {
    const res = await fetch('/api/guest/views', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson, from: document.referrer }),
    })
    if (res.status !== 200) return null // 204:其實已登入;503:伺服器沒開放
    return ((await res.json()) as { id: string }).id
  },
  /** keepalive:離開頁面時送出的請求不會被瀏覽器中斷 */
  watch: (id: string, watchedMs: number, extra?: GuestExtra): Promise<Response> =>
    fetch(`/api/guest/views/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watchedMs: Math.round(watchedMs),
        visibleMs: Math.round(extra?.visibleMs ?? 0),
        ...(extra?.readyMs ? { readyMs: Math.max(1, Math.round(extra.readyMs)) } : {}),
        ...(extra?.error ? { error: extra.error } : {}),
        ...(extra?.events?.length ? { events: extra.events.map((x) => ({ t: Math.round(x.t), e: x.e })) } : {}),
      }),
    }),
}

/** startGuestView 的回傳值:呼叫它停止記錄;ready()、fail() 回報播放器載入完成或失敗(只記第一次) */
export type GuestTracker = (() => void) & { ready: (elapsedMs?: number) => void; fail: (message: string) => void; note: (event: string) => void }

/**
 * 開始記錄訪客打開了這一課;isPlaying 回報播放器現在是不是在播放。回傳停止記錄的函式(會補送最後的資料)。
 * onPlay 為 true 時(展示影片),第一次開始播放才記一筆,只打開頁面不記。
 */
export function startGuestView(lesson: string, isPlaying: () => boolean, api = guestApi, onPlay = false): GuestTracker {
  let id: string | null = null
  let opened = false
  let watched = 0
  let sent = 0
  /** 頁面在前景的時間(和播放時間一樣用兩次檢查的間隔累計) */
  let visible = 0
  let visibleSent = 0
  const started = performance.now()
  /** 載入完成花的時間、載入錯誤:還沒送出時留著,下次一起送 */
  let readyMs = 0
  let error = ''
  let pending = false
  let wasPlaying = false
  let last = started
  let lastFlush = started
  /** 只有前景時間變多時的心跳間隔(有新的足跡或播放就回到 HEARTBEAT_MS) */
  let idleBeat = HEARTBEAT_MS
  const events: GuestEvent[] = []
  let eventsSent = 0
  const startPath = location.pathname
  /** 關掉頁面之後(pagehide 之後還會再來一次 visibilitychange)不再記 */
  let closed = false
  const mark = (e: string): void => {
    if (closed || events.length >= MAX_EVENTS) return
    // 連按同一個按鈕只記一次
    if (events.at(-1)?.e === e && e.startsWith('click:')) return
    events.push({ t: performance.now() - started, e })
  }
  const open = (): void => {
    opened = true
    api
      .open(lesson)
      .then((v) => {
        id = v
        flush()
      })
      .catch(() => {})
  }
  if (!onPlay) open()
  /** force:切到背景、離開時,前景時間有變也送 */
  const flush = (force = false): void => {
    if (!id) return
    const newEvents = events.length > eventsSent
    if (!pending && watched - sent < 1000 && !(force && (visible - visibleSent >= 1000 || newEvents))) return
    sent = watched
    visibleSent = visible
    eventsSent = events.length
    lastFlush = performance.now()
    const extra: GuestExtra = { visibleMs: visible, events: [...events] }
    if (pending) {
      if (readyMs) extra.readyMs = readyMs
      if (error) extra.error = error
      pending = false
    }
    void api.watch(id, watched, extra).catch(() => {})
  }
  const tick = (): void => {
    const t = performance.now()
    const gap = t - last
    last = t
    const playing = isPlaying()
    if (playing && !opened) open()
    // 這次檢查時還在播放,就把上次檢查到現在算進去(剛按播放的那一下最多多算一秒)
    if (playing && gap > 0 && gap <= MAX_GAP_MS) watched += gap
    if (document.visibilityState === 'visible' && gap > 0 && gap <= MAX_GAP_MS) visible += gap
    if (playing && !wasPlaying) mark('play')
    if (wasPlaying && !playing) {
      mark('pause')
      flush() // 剛暫停:送一次,不用等到累計滿 FLUSH_MS
    }
    wasPlaying = playing
    if (watched - sent >= FLUSH_MS) flush()
    // 心跳:有新的足跡或播放時,每 HEARTBEAT_MS 送一次
    else if (t - lastFlush >= HEARTBEAT_MS && (events.length > eventsSent || watched - sent >= 1000)) {
      idleBeat = HEARTBEAT_MS
      flush(true)
    }
    // 只是頁面開著(前景時間變多)時間隔逐次加倍,最多 MAX_IDLE_BEAT_MS:放著不動一小時只送十幾次
    else if (t - lastFlush >= idleBeat && visible - visibleSent >= 1000) {
      idleBeat = Math.min(idleBeat * 2, MAX_IDLE_BEAT_MS)
      flush(true)
    }
  }
  const timer = window.setInterval(tick, TICK_MS)
  const onHide = (): void => {
    if (document.visibilityState === 'hidden') {
      tick()
      mark('hide')
      flush(true)
    } else mark('show')
  }
  const onPageHide = (): void => {
    tick()
    mark('close')
    closed = true
    flush(true)
  }
  const onClick = (ev: Event): void => mark(clickLabel(ev.target))
  // 捲動:到 25%、50%、75%、100% 各記一次(頁面不能捲動就不會有)
  let depth = 0
  const onScroll = (): void => {
    const el = document.documentElement
    const room = el.scrollHeight - window.innerHeight
    if (room <= 0) return
    const pct = Math.min(100, Math.floor(((window.scrollY / room) * 100) / 25) * 25)
    if (pct > depth) {
      depth = pct
      mark(`scroll:${pct}%`)
    }
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('click', onClick, true)
  window.addEventListener('scroll', onScroll, { passive: true })
  const stop = (): void => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('click', onClick, true)
    window.removeEventListener('scroll', onScroll)
    tick()
    // 站內換頁:這時網址已經是下一頁
    if (location.pathname !== startPath) mark(`leave:${location.pathname}`)
    flush(true)
  }
  return Object.assign(stop, {
    /** elapsedMs:從打開頁面算起的載入時間(開始記錄前就載入完成時由外面算好傳進來);不給就從開始記錄算起 */
    ready: (elapsedMs?: number) => {
      if (readyMs || error) return
      readyMs = Math.max(1, elapsedMs ?? performance.now() - started)
      mark('ready')
      pending = true
      flush()
    },
    /** 頁面自己的事件(例如登入頁的 next:<網址>、fail:<訊息>),記進足跡並馬上送出 */
    note: (event: string) => {
      mark(event)
      flush(true)
    },
    fail: (message: string) => {
      if (error) return
      error = message.slice(0, 200) || '載入失敗'
      mark('error')
      pending = true
      flush()
    },
  })
}

/** 一進網站打開的那一頁(著陸頁):那一頁上的載入時間從瀏覽器開始載入頁面算起(performance.now() 的起點,含下載程式),
 * 換過頁之後從換頁時算起。同一頁上可以有好幾筆(例如首頁的 page:/ 與展示影片),都從頁面開始載入算。 */
const landingPath = typeof location === 'undefined' ? '' : location.pathname
let navigated = false
const noteNavigation = (): void => {
  if (location.pathname !== landingPath) navigated = true
}
const viewStart = (): number => {
  noteNavigation()
  return navigated ? performance.now() : 0
}

/** useGuestView 的回傳值:播放器載入完成、失敗時呼叫(不是訪客或不記錄時什麼都不做;同一課只記第一次) */
export interface GuestReporter {
  ready: () => void
  fail: (message: string) => void
  /** 記一件頁面自己的事(足跡的事件代碼);開始記錄前發生的先存著,開始時補上 */
  note: (event: string) => void
}

/**
 * 訪客打開這一課時開始記錄(lesson 為 null 就不記,例如研發頁的預覽)。登入狀態確認是訪客才記;
 * isPlaying 每次都讀最新的(播放器轉向重建時不會算成重新打開一課)。
 * 登入狀態還在確認時就載入完成的,確認是訪客後補記(載入時間照樣從打開頁面算起)。
 */
export function useGuestView(lesson: string | null, isPlaying: () => boolean): GuestReporter {
  // 展示影片(home: 開頭)按下播放才記,只打開頁面不記
  const onPlay = lesson != null && isHomeShowcase(lesson)
  const { status } = useAuth()
  const playing = useRef(isPlaying)
  playing.current = isPlaying
  const tracker = useRef<GuestTracker | null>(null)
  /** 還沒開始記錄(登入狀態確認中)時先記下載入結果,開始記錄時補上 */
  // since:打開這一課的時間(載入時間從這裡算,不是從確認完登入狀態、開始記錄時算)
  const early = useRef<{ lesson: string | null; since: number; readyMs?: number; error?: string; notes?: string[] } | null>(null)
  if (!early.current || early.current.lesson !== lesson) early.current = { lesson, since: lesson ? viewStart() : 0 }
  useEffect(() => {
    if (!lesson || status !== 'guest') return
    const t = startGuestView(lesson, () => playing.current(), guestApi, onPlay)
    tracker.current = t
    if (early.current?.error) t.fail(early.current.error)
    else if (early.current?.readyMs) t.ready(early.current.readyMs)
    for (const e of early.current?.notes ?? []) t.note(e)
    if (early.current) early.current.notes = []
    return () => {
      tracker.current = null
      noteNavigation() // 站內換頁時這裡已經是下一頁的網址(換到沒有記錄的頁面再回來也算換過頁)
      t()
    }
  }, [lesson, status, onPlay])
  return useMemo(
    () => ({
      ready: () => {
        const e = early.current!
        e.readyMs ??= Math.max(1, performance.now() - e.since)
        tracker.current?.ready(e.readyMs)
      },
      fail: (message: string) => {
        early.current!.error ??= message
        tracker.current?.fail(message)
      },
      note: (event: string) => {
        if (tracker.current) tracker.current.note(event)
        else (early.current!.notes ??= []).push(event)
      },
    }),
    [],
  )
}

/** 首頁、課程地圖這類頁面:訪客打開時記一筆 page:<網址>(沒有播放器,只看停留時間與足跡) */
export function PageView({ children }: { children: ReactNode }): ReactNode {
  const { pathname } = useLocation()
  useGuestView(PAGE_PREFIX + pathname, () => false)
  return children
}
