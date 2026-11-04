import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ACTORS } from '../../live/actors'
import { mountShell, type Shell } from '../../live/shell'
import { ActorStaticDemo } from './ActorStaticDemo'
import { loadScript } from '../../live/scripts'
import { createStage, type Stage } from '../../live/stage'
import '../../live/shell.css'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'
import styles from './ActorsPage.module.css'

// 演員展示:一次看一位演員,示範腳本在 src/content/live/lab/actors/<演員>.json。
// 動態展示:在播放器裡照腳本播放。靜態展示:只有舞台,不播放,按操作按鈕才演出那個動作。
// 兩種都能勾選區塊看關掉之後的樣子,並產生可以貼進腳本 cast 的設定。
// 網址 ?actor=<名稱> 直接開某一位,&mode=static 開靜態展示。

const NAMES = Object.keys(ACTORS)
const CAST_ID = 'a'
type Mode = 'dynamic' | 'static'
const MODES: { id: Mode; label: string }[] = [
  { id: 'dynamic', label: '動態展示' },
  { id: 'static', label: '靜態展示' },
]

export function ActorsPage() {
  const [params, setParams] = useSearchParams()
  const asked = params.get('actor')
  const name = asked && asked in ACTORS ? asked : NAMES[0]
  const mode: Mode = params.get('mode') === 'static' ? 'static' : 'dynamic'
  const go = (actor: string, m: Mode): void => setParams({ actor, ...(m === 'static' ? { mode: m } : {}) })
  const def = ACTORS[name]
  const parts = useMemo(() => Object.keys(def.parts ?? {}), [def])
  // 被關掉的區塊;換演員時連同 key 一起重置
  const [off, setOff] = useState<{ actor: string; names: string[] }>({ actor: name, names: [] })
  const hidden = off.actor === name ? off.names : []
  const toggle = (part: string): void =>
    setOff({ actor: name, names: hidden.includes(part) ? hidden.filter((p) => p !== part) : [...hidden, part] })
  const snippet = JSON.stringify(Object.fromEntries(hidden.map((p) => [p, false])))

  return (
    <ProposalLayout title="演員展示" footer="研發基地 · 演員在 web/src/live/actors/，示範腳本在 web/src/content/live/lab/actors/">
      <h1>演員展示</h1>
      <p className={ui.lead}>看每位演員會演什麼，以及哪些區塊可以關掉，避免畫面在某些情境露出太多資訊。</p>
      <div className={styles.tabs} role="group" aria-label="選擇演員">
        {NAMES.map((n) => (
          <button key={n} type="button" className={n === name ? ui.btn : `${ui.btn} ${ui.ghost}`} aria-pressed={n === name} data-testid={`actor-${n}`} onClick={() => go(n, mode)}>
            {n}
          </button>
        ))}
      </div>
      <div className={styles.tabs} role="group" aria-label="展示方式">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={m.id === mode ? ui.btn : `${ui.btn} ${ui.ghost}`} aria-pressed={m.id === mode} data-testid={`mode-${m.id}`} onClick={() => go(name, m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className={styles.hint}>{mode === 'static' ? '只有舞台，不播放。直接點演員畫面上標示的地方，或按下方的操作，演員才會演出那個動作。' : '在播放器裡照示範腳本播放，可以拖曳時間軸。'}</p>
      <div className={mode === 'static' ? `${styles.layout} ${styles.layoutStatic}` : styles.layout}>
        {mode === 'static' ? <ActorStaticDemo key={name} actor={name} hidden={hidden} /> : <ActorDemo key={name} actor={name} hidden={hidden} />}
        <aside className={styles.panel}>
          <h3>可顯示的區塊</h3>
          {parts.map((p) => (
            <label key={p} className={styles.part}>
              <input type="checkbox" checked={!hidden.includes(p)} data-testid={`part-${p}`} onChange={() => toggle(p)} />
              <span>{p}</span>
            </label>
          ))}
          <h3>寫進腳本</h3>
          <p className={styles.hint}>放在 cast 的這位演員底下；要在播放途中切換，用舞台動作 <code>{'{ "parts": "代號", "set": { … } }'}</code>。</p>
          <pre className={styles.snippet} data-testid="parts-snippet">{`"parts": ${snippet}`}</pre>
          <h3>會的動作</h3>
          <div className={styles.kinds}>
            {def.kinds.map((k) => <code key={k}>{k}</code>)}
          </div>
        </aside>
      </div>
    </ProposalLayout>
  )
}

function ActorDemo({ actor, hidden }: { actor: string; hidden: string[] }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const live = useRef<{ stage: Stage; vp: Shell } | null>(null)
  const hiddenRef = useRef(hidden)
  const [error, setError] = useState<string | null>(null)

  const apply = (names: string[]): void => {
    if (!live.current) return
    const { stage, vp } = live.current
    stage.setParts(CAST_ID, Object.fromEntries(names.map((p) => [p, false])))
    stage.renderAt(vp.time)
  }

  useEffect(() => {
    hiddenRef.current = hidden
    apply(hidden)
  }, [hidden])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let cancelled = false
    const stageEl = document.createElement('div')
    const stage = createStage(stageEl)
    const vp = mountShell(box, { stage: stageEl, title: actor, globalKeys: false })
    loadScript(`lab/actors/${actor}.json`)
      .then(async (data) => {
        await document.fonts.ready
        if (cancelled) return
        await stage.load(data)
        if (cancelled) return
        live.current = { stage, vp }
        vp.update({ title: data.title, duration: stage.duration, renderAt: (ms) => stage.renderAt(ms), chapters: stage.chapters, stops: stage.stops })
        apply(hiddenRef.current)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })
    return () => {
      cancelled = true
      live.current = null
      vp.destroy()
    }
  }, [actor])

  return (
    <div>
      <div ref={boxRef} className={styles.box} data-testid="actor-player" />
      {error && <p role="alert">無法播放：{error}</p>}
    </div>
  )
}
