// narration.ts — 分段旁白音檔的播放(外殼用)。
//
// 一份腳本的旁白是很多段短音檔,每段在時間軸上有固定的開始時間(at)與長度(ms)。
// 這裡依外殼的時鐘決定「現在該播哪一段、播到哪裡」,拖曳、倍速、暫停都跟著外殼走。
// 兩個 <audio> 輪流用:一個播目前這段,另一個先載入下一段,換段時直接交換,開頭不會被網路延遲吃掉。

/** 一段旁白音檔:在 [at, at+ms) 之間播放 */
export type Clip = { at: number; ms: number; url: string }

/** 外殼的播放狀態中,旁白需要知道的部分 */
export interface PlaybackView {
  t: number
  playing: boolean
  scrubbing: boolean
  muted: boolean
  rate: number
}

export interface Narration {
  /** 有沒有旁白音檔(決定要不要顯示音量鈕) */
  readonly hasClips: boolean
  /** 依目前時間與播放狀態,播放、暫停或校正音檔 */
  sync(view: PlaybackView): void
  /** 在使用者按播放的當下解鎖音訊(iOS 等瀏覽器只允許在使用者操作中開始播放) */
  unlock(view: PlaybackView): void
  /** 時間被跳轉或旁白資料更換:下次 sync 重新找該播哪一段 */
  reset(): void
  pause(): void
  setRate(rate: number): void
  setMuted(muted: boolean): void
  destroy(): void
}

export function createNarration(getClips: () => Clip[] | undefined): Narration {
  let clipEl = new Audio()
  let nextEl = new Audio()
  clipEl.preload = nextEl.preload = 'auto'
  let clipIdx = -1
  let unlocked = false
  let muted = false // 最新的靜音狀態(解鎖的非同步結算時要用最新值,不能用呼叫當下的)
  const clips = (): Clip[] => getClips() ?? []
  const hasClips = (): boolean => clips().length > 0
  const clipAt = (t: number): number => {
    const list = clips()
    let i = -1
    for (let k = 0; k < list.length; k++) if (list[k].at <= t) i = k
    return i
  }
  const setSrc = (el: HTMLAudioElement, url: string): void => {
    if (el.getAttribute('src') !== url) el.src = url
  }

  function startClip(i: number, off: number, view: PlaybackView): void {
    const list = clips()
    const c = list[i]
    if (nextEl.getAttribute('src') === c.url) {
      clipEl.pause() // 交換後舊的會變成預載用的元素,先停掉,否則聲音會疊在新的一段上
      ;[clipEl, nextEl] = [nextEl, clipEl]
    } else setSrc(clipEl, c.url)
    clipIdx = i
    clipEl.muted = view.muted
    clipEl.playbackRate = view.rate
    clipEl.currentTime = off
    clipEl.play().catch(() => {})
    const n = list[i + 1]
    if (n) setSrc(nextEl, n.url)
  }

  return {
    get hasClips() {
      return hasClips()
    },

    sync(view) {
      muted = view.muted
      if (!hasClips()) return
      const list = clips()
      const i = clipAt(view.t)
      const c = list[i]
      const off = c ? (view.t - c.at) / 1000 : 0
      const inClip = !!c && off * 1000 < c.ms
      if (!view.playing || view.scrubbing || !inClip) {
        if (!clipEl.paused) clipEl.pause()
        if (!c) clipIdx = -1
        // 還沒播到第一段時,先載入第一段
        else if (!inClip && list[i + 1]) setSrc(nextEl, list[i + 1].url)
        return
      }
      if (i !== clipIdx) return startClip(i, off, view)
      if (clipEl.paused && !clipEl.ended) {
        clipEl.currentTime = off
        clipEl.play().catch(() => {})
        return
      }
      // 偏差校正:只在音檔已經能順暢播放時做(還在緩衝時重設位置只會一直重新緩衝)
      if (!clipEl.paused && !clipEl.seeking && clipEl.readyState >= 3 && Math.abs(clipEl.currentTime - off) > 0.35) clipEl.currentTime = off
    },

    unlock(view) {
      muted = view.muted
      if (unlocked || !hasClips()) return
      unlocked = true
      const list = clips()
      const i = Math.max(0, clipAt(view.t))
      // 靜音播一下再停,只為了取得播放權限,不會聽到聲音;被瀏覽器拒絕(NotAllowedError)時下次按播放再試
      for (const el of [clipEl, nextEl]) {
        setSrc(el, list[Math.min(i + (el === nextEl ? 1 : 0), list.length - 1)].url)
        el.muted = true
        el.play()
          .then(() => {
            if (el !== clipEl || clipIdx < 0) el.pause()
          })
          .catch((e: unknown) => {
            if ((e as { name?: string } | null)?.name === 'NotAllowedError') unlocked = false
          })
          .finally(() => {
            el.muted = muted
          })
      }
    },

    reset() {
      clipIdx = -1
    },
    pause() {
      clipEl.pause()
    },
    setRate(rate) {
      clipEl.playbackRate = nextEl.playbackRate = rate
    },
    setMuted(m) {
      muted = m
      clipEl.muted = nextEl.muted = m
    },
    destroy() {
      for (const el of [clipEl, nextEl]) {
        el.pause()
        el.removeAttribute('src')
      }
    },
  }
}

// 開發時引擎的程式一改就整頁重新載入:舞台、外殼、演員是掛上去就一直在跑的物件,不是 React 元件,
// 交給 LivePlayer 熱更新的話它的 effect 不會重跑,畫面仍是舊程式建出來的舊物件,看起來像沒有熱重載。
// 必須直接寫 import.meta.hot.accept(Vite 靠這段文字判斷模組會自己處理更新,包成函式它就認不得)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
