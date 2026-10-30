import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// 以 YouTube IFrame Player API 嵌入影片，並每 0.5 秒回報播放秒數，
// 讓課程頁依進度展開對應的步驟。API 腳本整站只載入一次。

type YTPlayer = {
  getCurrentTime(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  destroy(): void
}

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      playerVars?: Record<string, number | string>
      events?: { onReady?: () => void }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | undefined

function loadYouTubeAPI(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

export type YouTubePlayerHandle = {
  seekTo(seconds: number): void
}

type Props = {
  videoId: string
  title: string
  onTime: (seconds: number) => void
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(function YouTubePlayer(
  { videoId, title, onTime },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const onTimeRef = useRef(onTime)
  onTimeRef.current = onTime

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      playerRef.current?.seekTo(seconds, true)
      playerRef.current?.playVideo()
    },
  }))

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const host = hostRef.current
    if (!host) return
    // YT.Player 會把傳入的元素換成 iframe，所以每次建立一個新的子元素給它。
    const mount = document.createElement('div')
    host.appendChild(mount)

    loadYouTubeAPI().then((YT) => {
      if (cancelled) return
      playerRef.current = new YT.Player(mount, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            timer = window.setInterval(() => {
              const t = playerRef.current?.getCurrentTime()
              if (typeof t === 'number') onTimeRef.current(t)
            }, 500)
          },
        },
      })
    })

    return () => {
      cancelled = true
      window.clearInterval(timer)
      playerRef.current?.destroy()
      playerRef.current = null
      host.replaceChildren()
    }
  }, [videoId])

  return <div ref={hostRef} className="yt-host" title={title} />
})
