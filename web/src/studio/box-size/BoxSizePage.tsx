import { useEffect, useRef, useState } from 'react'
import { createStage, type Stage } from '../../live/stage'
import type { ScriptStep } from '../../live/types'
import { ProposalLayout } from '../proposal/ProposalLayout'
import styles from './BoxSizePage.module.css'

// 試看演員 box-size(兒童 3D 列印 1.2「尺寸要說清楚」):直接操作演員,不需要資料庫裡的腳本。
const SCRIPT = { title: '尺寸要說清楚', cast: { box: { actor: 'box-size', place: { x: 0, y: 0, w: 1920, h: 1080 } } }, steps: [{ wait: 100 }] }

export function BoxSizePage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const frame = useRef(0)
  const [round, setRound] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const host = hostRef.current!
    const canvas = document.createElement('div')
    canvas.dataset.pressable = '1'
    host.replaceChildren(canvas)
    const stage = createStage(canvas)
    stageRef.current = stage
    stage.load(SCRIPT as never, { cursor: false }).then(
      () => stage.renderAt(stage.duration),
      (e) => setError(String(e)),
    )
    return () => cancelAnimationFrame(frame.current)
  }, [round])

  const press = (target: EventTarget) => {
    const stage = stageRef.current
    const name = target instanceof Element ? target.closest<HTMLElement>('[data-t]')?.dataset.t : undefined
    const steps = name && stage?.press('box', name)
    if (!stage || !steps) return
    const run = stage.react(steps as ScriptStep[] as never)
    cancelAnimationFrame(frame.current)
    const t0 = performance.now()
    const tick = () => {
      const t = Math.min(run.duration, performance.now() - t0)
      stage.reactAt(run.id, t)
      if (t < run.duration) frame.current = requestAnimationFrame(tick)
    }
    tick()
  }

  return (
    <ProposalLayout title="3D 列印 1.2:尺寸要說清楚" footer="研發基地 · 試作 · 演員 box-size" wide>
      <p>拿一個橡皮擦或積木量一量：點寬、深、高，按數字輸入，再按「記下來」。</p>
      <p>
        <button type="button" onClick={() => {
          setError('')
          setRound((n) => n + 1)
        }}>重新開始</button>
      </p>
      {error && <p role="alert">{error}</p>}
      <div ref={hostRef} onClick={(e) => press(e.target)} className={styles.host} />
    </ProposalLayout>
  )
}
