import { useEffect, useRef, useState } from 'react'
import { mountShell } from '../../live/shell'
import { createStage } from '../../live/stage'
import type { StageScript } from '../../live/types'
import '../../live/shell.css'
import styles from './agentStudio.module.css'

// 播放寫在程式裡的示範腳本(LivePlayer 只能播資料庫的腳本)。沒有語音,只顯示字幕。
export function DemoPlayer({ script }: { script: StageScript }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const stageEl = document.createElement('div')
    const stage = createStage(stageEl)
    const vp = mountShell(boxRef.current!, { stage: stageEl, title: script.title, globalKeys: false })
    setError(null)
    document.fonts.ready
      .then(async () => {
        if (cancelled) return
        await stage.load(script)
        if (cancelled) return
        const caps = stage.captions
        vp.update({
          duration: stage.duration,
          renderAt: (ms) => stage.renderAt(ms),
          chapters: stage.chapters,
          stops: stage.stops,
          captions: (ms) => caps.find((c) => ms >= c.from && ms < c.to)?.text || '',
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })
    return () => {
      cancelled = true
      vp.destroy()
    }
  }, [script])

  return (
    <>
      <div ref={boxRef} className={styles.player} />
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </>
  )
}
