// narration.ts — 分段旁白音檔的播放(外殼用)。
//
// 一份腳本的旁白是很多段短音檔,每段在時間軸上有固定的開始時間(at)與長度(ms)。
// 這裡依外殼的時鐘決定「現在該播哪一段、播到哪裡」,拖曳、倍速、暫停都跟著外殼走。
// 兩個 <audio> 輪流用:一個播目前這段,另一個先載入下一段,換段時直接交換,開頭不會被網路延遲吃掉。
// 音檔會先整段抓成 Blob 放在記憶體(之後從本機播,不會因網路變慢而卡住或 seek 很慢);抓不到(例如跨網域被擋)就退回直接用網址。
// 播放中以音檔為主時鐘(clock):音檔卡住時時間軸也停住,不再需要「偏差校正」去強制 seek。

/** 一段旁白音檔:在 [at, at+ms) 之間播放;from 是音檔裡的起點(毫秒,章節音軌的一段範圍用),預設從頭 */
export type Clip = { at: number; ms: number; url: string; from?: number }

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
  /** 這一刻音檔正在播(或正在緩衝)的話,回傳依音檔算出的時間軸毫秒;沒有在播旁白時回傳 null,由外殼自己累加 */
  clock(): number | null
  /** 預先載入從 t 開始的幾段音檔(不播放) */
  warm(t: number): void
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
  // 預先抓成 Blob:網址 → blob: 網址。往後 PREFETCH 段先抓好,抓失敗的網址記在 failed,不重試
  const PREFETCH = 3
  // 預載要 fetch 存放音檔的 GCS bucket,跨網域,bucket 必須先設好 CORS(允許本站來源 GET)。沒設的話每次 fetch 都被瀏覽器擋下並在主控台報錯,
  // 所以預設關閉;bucket 設好 CORS 之後,在建置時設 VITE_VOICE_BLOB=1 開啟。關閉時直接用網址播放,音檔當主時鐘的部分不受影響。
  const BLOB_PREFETCH = import.meta.env.VITE_VOICE_BLOB === '1'
  const blobs = new Map<string, string>()
  const inflight = new Set<string>()
  const failed = new Map<string, number>() // 網址 → 失敗的時間;過了 RETRY_MS 才會再試
  const RETRY_MS = 5000
  let destroyed = false
  const prefetch = (url: string): void => {
    if (!BLOB_PREFETCH || blobs.has(url) || inflight.has(url)) return
    const f = failed.get(url)
    if (f != null && Date.now() - f < RETRY_MS) return
    inflight.add(url)
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (destroyed) return
        blobs.set(url, URL.createObjectURL(b))
        failed.delete(url)
      })
      .catch(() => failed.set(url, Date.now()))
      .finally(() => inflight.delete(url))
  }
  const prefetchFrom = (i: number): void => {
    const list = clips()
    for (let k = Math.max(0, i); k < Math.min(list.length, i + PREFETCH); k++) prefetch(list[k].url)
  }
  // 記憶體只留目前這段的前一段到往後 PREFETCH 段,其餘釋放(手機上整課的音檔放著會吃掉太多記憶體);正在被元素使用的不釋放
  const evict = (i: number): void => {
    const list = clips()
    const keep = new Set<string>()
    for (let k = Math.max(0, i - 1); k < Math.min(list.length, i + PREFETCH + 1); k++) keep.add(list[k].url)
    for (const el of [clipEl, nextEl]) if (el.dataset.url) keep.add(el.dataset.url)
    for (const [url, blob] of blobs) {
      if (keep.has(url)) continue
      URL.revokeObjectURL(blob)
      blobs.delete(url)
    }
  }
  const srcOf = (url: string): string => blobs.get(url) ?? url
  // el.dataset.url 記的是原本的網址;抓好 Blob 之後,閒置(沒在播)的元素換成本機的來源
  const setSrc = (el: HTMLAudioElement, url: string): void => {
    if (el.dataset.url !== url) {
      el.dataset.url = url
      el.src = srcOf(url)
    } else if (el.paused && el.readyState < 3 && el.getAttribute('src') !== srcOf(url)) el.src = srcOf(url) // 已經緩衝好的不換,免得白白重載
  }

  function startClip(i: number, off: number, view: PlaybackView): void {
    const list = clips()
    const c = list[i]
    prefetchFrom(i)
    evict(i)
    if (nextEl.dataset.url === c.url) {
      clipEl.pause() // 交換後舊的會變成預載用的元素,先停掉,否則聲音會疊在新的一段上
      clipEl.muted = true // 預載用的元素一律靜音(見 unlock 的說明)
      ;[clipEl, nextEl] = [nextEl, clipEl]
    }
    setSrc(clipEl, c.url) // 沒有預載好的就直接設;交換後若 Blob 已抓好,換成本機來源
    clipIdx = i
    clipEl.muted = view.muted
    clipEl.playbackRate = view.rate
    clipEl.currentTime = off + (c.from ?? 0) / 1000
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
        clipEl.currentTime = off + (c.from ?? 0) / 1000
        clipEl.play().catch(() => {})
        return
      }
    },

    clock() {
      const c = clips()[clipIdx]
      if (!c || clipEl.paused || clipEl.ended) return null
      // 音檔還在緩衝時 currentTime 不動,時間軸跟著停;不超過這段的長度,才不會越過下一段的開頭
      return c.at + Math.min(Math.max(clipEl.currentTime * 1000 - (c.from ?? 0), 0), c.ms)
    },

    warm(t) {
      prefetchFrom(Math.max(0, clipAt(t)))
    },

    unlock(view) {
      muted = view.muted
      if (unlocked || !hasClips()) return
      unlocked = true
      const list = clips()
      const i = Math.max(0, clipAt(view.t))
      // 靜音播一下再停,只為了取得播放權限(iOS 的權限是每個元素各自算的,換段時下一段的元素才能播);被瀏覽器拒絕(NotAllowedError)時下次按播放再試。
      // 預載下一段的元素解鎖後不取消靜音:iOS Safari 偶爾在剛開始播時 pause() 沒有真的停下(paused 已是 true,聲音還在出),
      // 取消靜音就會聽到下一段從頭疊在目前這段上,而且外殼按暫停也停不掉。輪到它播時 startClip 會設成正確的靜音狀態。
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
            el.muted = el === clipEl ? muted : true
          })
      }
    },

    reset() {
      clipIdx = -1
    },
    pause() {
      // 預載的元素也停:萬一它在背景出聲(見 unlock),按暫停至少能停掉
      clipEl.pause()
      nextEl.pause()
    },
    setRate(rate) {
      clipEl.playbackRate = nextEl.playbackRate = rate
    },
    setMuted(m) {
      muted = m
      clipEl.muted = m // 預載的元素保持靜音,輪到它播時 startClip 再設
    },
    destroy() {
      destroyed = true
      for (const url of blobs.values()) URL.revokeObjectURL(url)
      blobs.clear()
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
