import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { loadScript } from '../live/scripts'
import { createStage, type Stage, type StageScript } from '../live/stage'
import { ACTORS } from '../live/actors'
import type { ActorControl, ScriptStep } from '../live/types'
import styles from './IntroDemo.module.css'

// 主題頁「互動式學習」的展示:序章開場那個可以操作的畫面(腳本裡當一般網頁操作的演員),在頁面上循環演一小段。
// 要讓人看出「上面那排做法、下面那排階段可以按」:這兩排畫在演員畫面外(不跟著縮小,手機上也看得清),
// 由虛擬游標移過去(目標先變成滑過的樣子)、按下去,畫面才換:按一個階段 → 從那個階段重演;按下一種做法 → 換過去演一段。
// 只是示範片段,訪客不能點(整塊對輔助工具是一張有說明的圖)。
// 捲到看得見才載入與播放,離開視窗就暫停;prefers-reduced-motion 時不播,停在 AI Agent 做完的畫面。

/** 演員照這個大小排版,再整個等比例縮放到欄寬 */
const W = 760
const H = 560
/** 游標移到目標、停在目標上、按下到畫面反應、各段之間、整段演完到重來各停多久(毫秒) */
const MOVE = 750
const HOVER = 320
const CLICK = 200
const GAP = 500
const HOLD = 2600
const FADE = 350
/** 一段最多演多久;超過就接下一個操作(演員會把沒演完的直接跳到結果) */
const CLIP = 3400
const CLIP_AGENT = 16000

/** 下面那排的一格:名稱、做完(done)/正在做(now)、是不是正在跑與跑到哪(0–1) */
type Cell = { name: string; state: string; run: boolean; p: number }

/** 元件卸載時用來中斷示範 */
const STOP = Symbol('stop')

export function IntroDemo({ script, label, artwork }: { script: string; label: string; artwork: React.ReactNode }) {
  const demoRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(true)
  // 暫停中的下一格(看不見時不排動畫,回到畫面上才接著跑)
  const wakeRef = useRef<(() => void) | null>(null)
  const [controls, setControls] = useState<ActorControl[]>([])
  const [cells, setCells] = useState<Cell[]>([])
  // 游標停在哪個目標上、是不是正按著
  const [hot, setHot] = useState<{ name: string; down: boolean } | null>(null)
  const [scale, setScale] = useState(0)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => setScale(wrap.clientWidth / W))
    ro.observe(wrap)
    // 快捲到時先載入;真的看得見才播放,離開就暫停
    const near = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '200px' })
    near.observe(wrap)
    const seen = new IntersectionObserver(
      (entries) => {
        pausedRef.current = !entries[entries.length - 1].isIntersecting
        if (pausedRef.current) return
        const wake = wakeRef.current
        wakeRef.current = null
        wake?.()
      },
      { threshold: 0.2 },
    )
    seen.observe(wrap)
    return () => {
      ro.disconnect()
      near.disconnect()
      seen.disconnect()
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    const demo = demoRef.current
    const cursor = cursorRef.current
    if (!visible || !root || !demo || !cursor) return
    let cancelled = false
    let raf = 0
    let stage: Stage | null = null
    let actor = ''
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    const read = (): ActorControl[] => (stage?.controls(actor) ?? []).filter((c) => c.group)

    /** 把演員身上的階段(下方進度)抄到外面那一排;有變才更新 */
    let cellsKey = ''
    const sync = (): void => {
      const list: Cell[] = [...root.querySelectorAll<HTMLElement>('.tn-progress li')].map((li) => {
        const step = li.querySelector('.tn-step')
        const name = [...(step?.childNodes ?? [])].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('')
        return { name, state: li.dataset.s ?? '', run: li.dataset.run === '1', p: Math.round(Number(li.style.getPropertyValue('--p')) * 50) / 50 }
      })
      const key = JSON.stringify(list)
      if (key === cellsKey) return
      cellsKey = key
      setCells(list)
    }

    /** 每一格呼叫 frame(這一格過了幾毫秒),它回傳 true 就結束。看不見時完全停下來,不重畫 */
    const loop = (frame: (dt: number) => boolean): Promise<void> =>
      new Promise((resolve, reject) => {
        let last = performance.now()
        const tick = (): void => {
          if (cancelled) return reject(STOP)
          if (pausedRef.current) {
            wakeRef.current = () => {
              last = performance.now()
              raf = requestAnimationFrame(tick)
            }
            return
          }
          const now = performance.now()
          const dt = Math.min(100, now - last)
          last = now
          if (frame(dt)) resolve()
          else raf = requestAnimationFrame(tick)
        }
        tick()
      })
    const sleep = (ms: number): Promise<void> => {
      let left = ms
      return loop((dt) => (left -= dt) <= 0)
    }
    /** 演一段步驟,最多演 max 毫秒 */
    const play = (steps: unknown, max = Infinity): Promise<void> => {
      const r = stage!.react(steps as never)
      let t = 0
      return loop((dt) => {
        t = Math.min(r.duration, t + dt)
        stage!.reactAt(r.id, t)
        sync()
        return t >= r.duration || t >= max
      })
    }
    /** 直接跳到這段步驟演完的畫面 */
    const jump = (steps: unknown): void => {
      const r = stage!.react(steps as never)
      stage!.reactAt(r.id, r.duration)
    }
    /** 這一邊接下來自動示範的那一段 */
    const playNext = async (max: number): Promise<void> => {
      const steps = stage!.auto(actor)
      if (steps) await play(steps, max)
    }

    /** 游標移到外面那兩排的某個目標上、停一下(目標變成滑過的樣子)、按下去,然後演它觸發的步驟 */
    const operate = async (name: string, max: number): Promise<void> => {
      const el = demo.querySelector(`[data-name="${name}"]`)
      const steps = stage!.press(actor, name)
      if (!el || !steps) return
      const box = demo.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      cursor.style.transform = `translate(${(r.left - box.left + r.width * 0.62).toFixed(1)}px, ${(r.top - box.top + r.height * 0.6).toFixed(1)}px)`
      cursor.dataset.on = '1'
      await sleep(MOVE)
      setHot({ name, down: false })
      await sleep(HOVER)
      // 按下去:擴散圈、游標與目標都壓一下(重新加上屬性讓動畫從頭播)
      delete cursor.dataset.click
      void cursor.offsetWidth
      cursor.dataset.click = '1'
      setHot({ name, down: true })
      await sleep(CLICK)
      setHot({ name, down: false })
      if (name.startsWith('tab:')) setControls((list) => list.map((c) => ({ ...c, on: c.name === name })))
      await play(steps)
      setHot(null)
      await playNext(max)
      await sleep(GAP)
    }

    const fresh = async (data: StageScript, id: string): Promise<void> => {
      // 只留那位演員,鋪滿整個畫面
      const only = { ...data, camera: undefined, blocking: undefined, cast: { [id]: { ...data.cast[id], place: 'full', hidden: false } }, steps: [] as ScriptStep[] }
      await stage!.load(only as unknown as StageScript, { cursor: false })
      if (cancelled) throw STOP
      stage!.renderAt(stage!.duration)
      setControls(read())
      sync()
    }

    const show = async (data: StageScript): Promise<void> => {
      if (calm) {
        // 不播動畫:停在 AI Agent 做完的畫面
        const turn = stage!.press(actor, 'tab:now')
        if (turn) jump(turn)
        for (let steps = stage!.auto(actor), n = 0; steps && n < 8; steps = stage!.auto(actor), n++) jump(steps)
        setControls(read())
        sync()
        return
      }
      for (;;) {
        root.dataset.fade = '0'
        // 游標從右下角進場
        cursor.style.transform = `translate(${(demo.clientWidth * 0.82).toFixed(1)}px, ${(demo.clientHeight * 0.7).toFixed(1)}px)`
        await sleep(GAP)
        // 以前:自己打第一段,再按第二個階段
        await playNext(CLIP)
        await sleep(GAP)
        await operate('stage:2', CLIP)
        // 後來:用框架
        await operate('tab:frame', CLIP)
        await operate('stage:2', CLIP)
        // 現在:對 AI Agent 說一句話;再按第二個階段,看它從讀程式演到測試、修錯重跑
        await operate('tab:now', CLIP)
        await operate('stage:2', CLIP_AGENT)
        cursor.dataset.on = '0'
        await sleep(HOLD)
        // 淡出,回到一開始
        root.dataset.fade = '1'
        await sleep(FADE)
        await fresh(data, actor)
      }
    }

    loadScript(script)
      .then(async (data) => {
        const found = Object.entries(data.cast ?? {}).find(([, c]) => ACTORS[c.actor]?.page)
        if (!found) throw new Error('這個腳本沒有可以展示的互動演員')
        if (cancelled) return
        actor = found[0]
        // 演員依它決定把分頁交給外面畫(上面那一排),要在載入前標好
        root.dataset.pressable = '1'
        stage = createStage(root)
        await fresh(data as StageScript, actor)
        await show(data as StageScript)
      })
      .catch((e) => e !== STOP && !cancelled && setFailed(true))
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      wakeRef.current = null
      root.replaceChildren()
    }
  }, [visible, script])

  if (failed) return <>{artwork}</>
  return (
    <div ref={demoRef} className={styles.demo} role="img" aria-label={label}>
      <div className={styles.tabs} aria-hidden="true">
        {controls.map((c) => (
          <span key={c.name} data-name={c.name} data-on={c.on ? '1' : '0'} data-hot={hot?.name === c.name ? '1' : '0'} data-down={hot?.name === c.name && hot.down ? '1' : '0'}>
            <b>{c.label}</b>
            <i>{c.sub}</i>
          </span>
        ))}
      </div>
      <div ref={wrapRef} className={styles.frame} style={{ height: scale ? H * scale : undefined }} aria-hidden="true" inert>
        <div ref={rootRef} className={styles.canvas} style={{ width: W, height: H, transform: `scale(${scale})` }} />
      </div>
      <ol className={styles.stages} aria-hidden="true">
        {cells.map((c, i) => {
          const name = `stage:${i + 1}`
          return (
            <li key={name} data-name={name} data-s={c.state} data-run={c.run ? '1' : '0'} data-hot={hot?.name === name ? '1' : '0'} data-down={hot?.name === name && hot.down ? '1' : '0'} style={{ '--p': c.p } as CSSProperties}>
              <span className={styles.dot}>
                {c.state === 'done' ? (
                  <svg viewBox="0 0 16 16">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={styles.stageName}>{c.name}</span>
            </li>
          )
        })}
      </ol>
      <div ref={cursorRef} className={styles.cursor} aria-hidden="true">
        <span className={styles.ring} />
        <svg viewBox="0 0 24 24">
          <path d="M4 2.5v17.2l4.6-4.3 3 6.6 3-1.4-3-6.4h6.3z" />
        </svg>
      </div>
    </div>
  )
}
