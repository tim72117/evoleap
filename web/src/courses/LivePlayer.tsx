import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { mountShell, type Shell } from '../live/shell.js'
import { createStage } from '../live/stage.js'
import { loadScript } from '../live/scripts'
import '../live/shell.css'
import type { PlayerHandle } from './playerHandle'
import styles from './LivePlayer.module.css'

// 即時教學畫面:不是影片檔,而是 src/live 的舞台依腳本(src/content/live/)即時畫出,由播放器外殼負責播放。
// 透過 onTime 回報播放秒數、透過 ref.seekTo 跳轉(課程頁播放器共用的 PlayerHandle);
// 腳本裡標了 lessonStep 的章節會透過 onCues 回報,讓課程頁播到那裡就展開對應的步驟。
// 全螢幕、手機橫放滿版、播放器的快捷鍵都由外殼處理(焦點在播放器裡時 ←/→ 是倒退/快轉,在頁面上時由課程頁切換步驟)。

type Props = {
  /** src/content/live/ 底下的腳本路徑,例如 l0/0.0-tools.json */
  script: string
  title: string
  onTime: (seconds: number) => void
  onCues?: (cues: { step: number; at: number }[]) => void
}

export const LivePlayer = forwardRef<PlayerHandle, Props>(function LivePlayer({ script, title, onTime, onCues }, ref) {
  const boxRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<Shell | null>(null)
  const onTimeRef = useRef(onTime)
  const onCuesRef = useRef(onCues)
  onTimeRef.current = onTime
  onCuesRef.current = onCues
  const [error, setError] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      shellRef.current?.seek(seconds * 1000)
      shellRef.current?.play()
    },
  }))

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let cancelled = false
    const stageEl = document.createElement('div')
    const stage = createStage(stageEl)
    const vp = mountShell(box, { stage: stageEl, title, resumeKey: `live:${script}`, globalKeys: false })
    shellRef.current = vp
    setError(null)

    loadScript(script)
      .then(async (data) => {
        await document.fonts.ready
        if (cancelled) return
        await stage.load(data)
        if (cancelled) return
        const caps = stage.captions
        vp.update({
          title: data.title,
          duration: stage.duration,
          renderAt: (ms) => stage.renderAt(ms),
          chapters: stage.chapters,
          stops: stage.stops,
          captions: (ms) => caps.find((c) => ms >= c.from && ms < c.to)?.text || '',
        })
        onCuesRef.current?.(stage.chapters.filter((c) => c.step).map((c) => ({ step: c.step!, at: c.at / 1000 })))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })

    // 播放秒數變了才回報(課程頁依此展開步驟)
    let last = -1
    const timer = window.setInterval(() => {
      const t = Math.round(vp.time)
      if (t !== last) {
        last = t
        onTimeRef.current(t / 1000)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      vp.destroy()
      shellRef.current = null
    }
  }, [script, title])

  return (
    <div ref={boxRef} className={styles.box}>
      {error && (
        <p className={styles.error} role="alert">
          無法播放：{error}
        </p>
      )}
    </div>
  )
})
