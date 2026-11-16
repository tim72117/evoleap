import { useCallback, useEffect, useRef, useState } from 'react'
import { ACTORS } from '../live/actors'
import { ensureActors } from '../live/actors/lazy'
import { createStage, type Stage } from '../live/stage'
import type { Hotspot, ScriptStep, StageScript } from '../live/types'
import { useT } from '../i18n/I18nProvider'
import styles from './ClaudePractice.module.css'

// 播放中的「動手試試」:打開一個靜態的 Claude Code(claude-desktop 演員,沒有時間軸、不播腳本),學員按標籤按鈕練習。
// 標籤按鈕來自演員的 hotspots(目前狀態下可以點的地方:新增 session、切換、選單、確認提示的選項),另外加幾顆練習用的:
// 切換權限模式、請 AI 建立檔案(會跳出確認提示,學員選允許或拒絕)。點了就用舞台的 react 在目前的狀態上演一段回應。
// 全部是模擬:規則比對,不接真的 AI,也不會動到任何檔案。

type Step = Record<string, unknown>
type Props = { props?: Record<string, unknown>; onClose: () => void }
type Chip = { key: string; label: string; glyph?: string; steps: Step[] }

const ACTOR = 'claude-desktop'
const DEFAULT_PROPS = { title: '新的 session', folder: '~/Documents/practice', branch: null, mode: 'ask', sessions: [], labels: { placeholder: '描述你要做的事…' } }
const MODES = ['ask', 'auto', 'plan', 'accept'] as const

/** 只有這一位演員、放滿整個 1920×1080 舞台的腳本 */
const scriptOf = (props: Record<string, unknown>, steps: Step[], title: string): StageScript => ({ title, cast: { claude: { actor: ACTOR, props, place: 'full' } }, steps: steps as unknown as ScriptStep[] })

export function ClaudePractice({ props, onClose }: Props) {
  const t = useT().courses.live.practice
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const stateRef = useRef<unknown>(null)
  const rafRef = useRef(0)
  /** 做過的步驟(每次都接起來重新載入)與目前演到的時間 */
  const historyRef = useRef<Step[]>([])
  const endRef = useRef(0)
  const [round, setRound] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [chips, setChips] = useState<Chip[]>([])
  const [text, setText] = useState('')
  const actorProps = { ...DEFAULT_PROPS, ...props }

  /** 依目前的狀態算出有哪些按鈕 */
  const refresh = useCallback(() => {
    const def = ACTORS[ACTOR]
    const st = stateRef.current
    if (!def || st == null) return
    const spots = (def.hotspots?.(st, actorProps) ?? []) as Hotspot[]
    const list: Chip[] = spots.filter((s) => s.step).map((s) => ({ key: s.target, label: s.label, glyph: s.glyph, steps: [s.step as Step] }))
    // 確認提示的選項:選完接一句回覆(第 0 個是拒絕)
    for (const c of list) {
      const m = /^option:(\d+)$/.exec(c.key)
      if (m) c.steps = [...c.steps, { say: Number(m[1]) === 0 ? t.denied : t.allowed }]
    }
    const asking = list.some((c) => c.key.startsWith('option:'))
    // 選單開著時只有 Fork 接得上,不加其他按鈕
    const menuOpen = list.some((c) => c.key.startsWith('menuitem:'))
    if (!asking && !menuOpen) {
      for (const m of MODES) list.push({ key: `mode:${m}`, label: t.mode.replace('{mode}', t.modes[m]), steps: [{ mode: m }] })
      list.push({
        key: 'create',
        label: t.createFile,
        steps: [{ user: t.createFileUser }, { thinking: true, ms: 500 }, { ask: 'hello.txt', q: t.createFileQ, where: `${String(actorProps.folder)}/hello.txt`, preview: '你好' }],
      })
    }
    setChips(list)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  /**
   * 在目前的狀態上演一段步驟;演完更新狀態與按鈕。
   * claude-desktop 的對話是由時間軸上的動作逐步堆出來的(不是靠回應事件),所以把做過的步驟全部接起來重新載入,
   * 再從上一段的結尾演到這一段的結尾,畫面看起來就是接著演。
   */
  const play = useCallback(
    async (steps: Step[]) => {
      const stage = stageRef.current
      const def = ACTORS[ACTOR]
      if (!stage || !def?.apply) return
      setError('')
      setBusy(true)
      try {
        // 先在外面推一遍狀態:推不過就不演(畫面不變)
        let st = stateRef.current
        for (const s of steps) {
          const kind = def.kinds.find((k) => k in s)
          if (!kind) throw new Error(JSON.stringify(s))
          st = def.apply(st, kind, s as never)
        }
        const history = [...historyRef.current, ...steps.map((x) => ({ ...x, pause: 0 }))]
        const from = endRef.current
        const end = await stage.load(scriptOf(actorProps, history, t.title))
        if (stageRef.current !== stage) return
        historyRef.current = history
        stateRef.current = st
        endRef.current = end
        const t0 = performance.now()
        const tick = (): void => {
          const ms = Math.min(from + (performance.now() - t0), end)
          stage.renderAt(ms)
          if (ms < end) rafRef.current = requestAnimationFrame(tick)
          else {
            setBusy(false)
            refresh()
          }
        }
        stage.renderAt(from)
        tick()
      } catch (e) {
        setError(`${t.error}${e instanceof Error ? e.message : String(e)}`)
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refresh, t],
  )

  // 建立舞台:演員放滿 1920×1080 的舞台,再整個等比例縮放進這一格
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setReady(false)
    setBusy(false)
    setError('')
    const canvas = document.createElement('div')
    Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', width: '1920px', height: '1080px', transformOrigin: '0 0' })
    host.appendChild(canvas)
    const fit = (): void => {
      const w = 1920
      const h = 1080
      const k = Math.min(host.clientWidth / w, host.clientHeight / h)
      canvas.style.transform = `translate(${((host.clientWidth - w * k) / 2).toFixed(1)}px, ${((host.clientHeight - h * k) / 2).toFixed(1)}px) scale(${k.toFixed(4)})`
    }
    const ro = new ResizeObserver(fit)
    ro.observe(host)
    const stage = createStage(canvas)
    stageRef.current = stage
    ;(async () => {
      await ensureActors([ACTOR])
      await document.fonts.ready
      if (cancelled) return
      historyRef.current = []
      endRef.current = await stage.load(scriptOf(actorProps, [], t.title))
      if (cancelled) return
      stateRef.current = ACTORS[ACTOR].init?.(actorProps) ?? null
      stage.renderAt(0)
      fit()
      setReady(true)
      refresh()
    })().catch((e: unknown) => !cancelled && setError(String(e instanceof Error ? e.message : e)))
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      canvas.remove()
      stageRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  // Esc 關閉
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    const v = text.trim()
    if (!v || busy || !ready) return
    setText('')
    play([{ user: v }, { thinking: true, ms: 500 }, { say: t.replyToTyped }])
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t.title} data-testid="claude-practice">
      <div className={styles.head}>
        <strong>{t.title}</strong>
        <span className={styles.note}>{t.note}</span>
        <button type="button" className={styles.ghost} onClick={() => setRound((n) => n + 1)}>
          {t.reset}
        </button>
        <button type="button" className={styles.ghost} onClick={onClose} autoFocus>
          {t.close}
        </button>
      </div>
      <div ref={hostRef} className={styles.stage} />
      <div className={styles.chips} aria-busy={busy}>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.row}>
          {chips.map((c) => (
            <button key={c.key} type="button" className={styles.chip} disabled={busy || !ready} onClick={() => play(c.steps)}>
              {c.glyph && <span aria-hidden="true">{c.glyph} </span>}
              {c.label}
            </button>
          ))}
        </div>
        <form className={styles.form} onSubmit={submit}>
          <input onKeyDown={(e) => { if (e.nativeEvent.isComposing) e.stopPropagation() }} value={text} onChange={(e) => setText(e.target.value)} placeholder={String(((actorProps.labels as Record<string, string>) ?? {}).placeholder ?? '')} aria-label={String(((actorProps.labels as Record<string, string>) ?? {}).placeholder ?? '')} disabled={busy || !ready} />
          <button type="submit" className={styles.chip} disabled={busy || !ready || !text.trim()}>
            {t.send}
          </button>
        </form>
      </div>
    </div>
  )
}
