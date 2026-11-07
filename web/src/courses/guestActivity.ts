// 訪客(未登入)的上課紀錄:打開一課時記一筆(首頁的展示影片記成 home:…,按下播放才記),播放時累計實際播放的時間(不管倍速,是真實經過的時間)。
// 訪客代號在 evoleap_guest cookie(伺服器發的 HttpOnly cookie,前端讀不到也不用管);會員不記在這裡(會員有自己的播放進度)。
// 伺服器端見 server/internal/api/guest.go。送不出去都靜默略過,不影響上課。
import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'

/** 首頁展示影片的紀錄名稱前綴:和打開課程頁的紀錄分開算(後台標成「首頁展示」) */
export const HOME_SHOWCASE_PREFIX = 'home:'
export const homeShowcaseKey = (lesson: string): string => HOME_SHOWCASE_PREFIX + lesson
export const isHomeShowcase = (lesson: string): boolean => lesson.startsWith(HOME_SHOWCASE_PREFIX)

/** 每隔多久檢查一次是不是在播放 */
const TICK_MS = 1000
/** 累計多少新的播放時間就回報一次(另外在暫停後、離開頁面與換課時補送) */
export const FLUSH_MS = 30_000
/** 兩次檢查的間隔超過這個值就不算(電腦休眠、分頁在背景被節流太久),免得一次加上好幾個小時 */
const MAX_GAP_MS = 65_000

export const guestApi = {
  open: async (lesson: string): Promise<string | null> => {
    const res = await fetch('/api/guest/views', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson }),
    })
    if (res.status !== 200) return null // 204:其實已登入;503:伺服器沒開放
    return ((await res.json()) as { id: string }).id
  },
  /** keepalive:離開頁面時送出的請求不會被瀏覽器中斷 */
  watch: (id: string, watchedMs: number): Promise<Response> =>
    fetch(`/api/guest/views/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchedMs: Math.round(watchedMs) }),
    }),
}

/**
 * 開始記錄訪客打開了這一課;isPlaying 回報播放器現在是不是在播放。回傳停止記錄的函式(會補送最後的播放時間)。
 * onPlay 為 true 時(首頁展示),第一次開始播放才記一筆,只打開頁面不記。
 */
export function startGuestView(lesson: string, isPlaying: () => boolean, api = guestApi, onPlay = false): () => void {
  let id: string | null = null
  let opened = false
  let watched = 0
  let sent = 0
  let wasPlaying = false
  let last = performance.now()
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
  const flush = (): void => {
    if (!id || watched - sent < 1000) return
    sent = watched
    void api.watch(id, watched).catch(() => {})
  }
  const tick = (): void => {
    const t = performance.now()
    const gap = t - last
    last = t
    const playing = isPlaying()
    if (playing && !opened) open()
    // 這次檢查時還在播放,就把上次檢查到現在算進去(剛按播放的那一下最多多算一秒)
    if (playing && gap > 0 && gap <= MAX_GAP_MS) watched += gap
    if (wasPlaying && !playing) flush() // 剛暫停:送一次,不用等到累計滿 FLUSH_MS
    wasPlaying = playing
    if (watched - sent >= FLUSH_MS) flush()
  }
  const timer = window.setInterval(tick, TICK_MS)
  const onHide = (): void => {
    if (document.visibilityState === 'hidden') {
      tick()
      flush()
    }
  }
  const onPageHide = (): void => {
    tick()
    flush()
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onPageHide)
    tick()
    flush()
  }
}

/**
 * 訪客打開這一課時開始記錄(lesson 為 null 就不記,例如研發頁的預覽)。登入狀態確認是訪客才記;
 * isPlaying 每次都讀最新的(播放器轉向重建時不會算成重新打開一課)。
 */
export function useGuestView(lesson: string | null, isPlaying: () => boolean): void {
  // 首頁展示(home: 開頭)按下播放才記,只打開首頁不記
  const onPlay = lesson != null && isHomeShowcase(lesson)
  const { status } = useAuth()
  const playing = useRef(isPlaying)
  playing.current = isPlaying
  useEffect(() => {
    if (!lesson || status !== 'guest') return
    return startGuestView(lesson, () => playing.current(), guestApi, onPlay)
  }, [lesson, status, onPlay])
}
