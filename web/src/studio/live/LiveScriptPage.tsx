import { useEffect, useRef, useState } from 'react'
import { mountShell, type Shell } from '../../live/shell'
import '../../live/shell.css'
import { createStage, type Stage } from '../../live/stage'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'
import { LIVE_EVENTS, parseSnapshot, reportLoad, resumeAt, type LiveSnapshot } from './liveScript'
import styles from './LiveScriptPage.module.css'

// 即時腳本:AI 工具透過 MCP(evoleap mcp)改後端的臨時腳本,這一頁訂閱推播,收到新版本就重新載入舞台、停在原本的位置附近,
// 並把載入結果回報給後端(成功的長度,或錯在哪一步),AI 用 wait_live_report 看。規則見 ./liveScript.ts。

type Conn = 'connecting' | 'open' | 'retrying'
const CONN_LABEL: Record<Conn, string> = { connecting: '連線中…', open: '已連線', retrying: '連線中斷，重新連線中…' }

export function LiveScriptPage() {
  const boxRef = useRef<HTMLDivElement>(null)
  const [conn, setConn] = useState<Conn>('connecting')
  const [snap, setSnap] = useState<LiveSnapshot | null>(null)
  const [loaded, setLoaded] = useState<{ version: number; error?: string; duration?: number } | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const stageEl = document.createElement('div')
    const stage: Stage = createStage(stageEl)
    const vp: Shell = mountShell(box, { stage: stageEl, title: '即時腳本', globalKeys: false })
    let disposed = false
    // 一次只載入一版;載入中又來了新版本,載完再載最新的那一版(中間的版本跳過)
    let busy = false
    let pending: LiveSnapshot | null = null
    // 上一個載入成功的版本:新版本載入失敗時(load 會先清掉舞台)重新載回它,舞台不會停在一半
    let lastGood: LiveSnapshot | null = null

    const apply = async (s: LiveSnapshot) => {
      if (busy) {
        pending = s
        return
      }
      busy = true
      const prev = vp.time
      try {
        await document.fonts.ready
        const duration = await stage.load(s.script)
        if (disposed) return
        vp.update({ title: s.script.title || '即時腳本', duration, renderAt: (ms) => stage.renderAt(ms), chapters: stage.chapters, stops: stage.stops })
        vp.seek(resumeAt(prev, duration))
        stage.renderAt(vp.time)
        lastGood = s
        setLoaded({ version: s.version, duration })
        void reportLoad(s.version, { duration })
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        if (!disposed) setLoaded({ version: s.version, error })
        void reportLoad(s.version, { error })
        if (lastGood && !disposed) {
          try {
            const duration = await stage.load(lastGood.script)
            vp.update({ duration, chapters: stage.chapters, stops: stage.stops })
            vp.seek(resumeAt(prev, duration))
            stage.renderAt(vp.time)
          } catch {
            // 上一版本來能載入,這裡不會失敗;萬一失敗就留著空的舞台
          }
        }
      } finally {
        busy = false
        const next = pending
        pending = null
        if (next && !disposed) void apply(next)
      }
    }

    // EventSource 斷線會自己重連,重連後伺服器先送目前的版本
    const es = new EventSource(LIVE_EVENTS)
    es.onopen = () => setConn('open')
    es.onerror = () => setConn('retrying')
    es.addEventListener('script', (ev) => {
      const s = parseSnapshot((ev as MessageEvent<string>).data)
      if (!s) return
      setSnap(s)
      void apply(s)
    })
    return () => {
      disposed = true
      es.close()
      vp.destroy()
    }
  }, [])

  const steps = snap?.script.steps?.length ?? 0
  const stale = snap && loaded && loaded.version !== snap.version
  return (
    <ProposalLayout title="即時腳本" footer="API：server/internal/api/livescript.go · MCP：evoleap mcp">
      <h1>即時腳本</h1>
      <p className={ui.lead}>
        在 AI 工具裡透過 MCP 改這份臨時腳本，這裡會即時照著演。加入 Claude Code：
        <code className={styles.cmd}>claude mcp add evoleap -- evoleap -api http://localhost:8190 mcp</code>
        （先用 <code>evoleap -api http://localhost:8190 login -console http://localhost:5190</code> 以管理員登入）。臨時腳本只放在伺服器的記憶體，重啟就沒了。
      </p>
      <div className={styles.status} role="status">
        <span className={`${styles.dot} ${styles[conn]}`} aria-hidden="true" />
        <span>{CONN_LABEL[conn]}</span>
        {snap && (
          <span>
            第 {snap.version} 版 · {steps} 步
          </span>
        )}
        {loaded && !loaded.error && !stale && <span>已載入，長度 {((loaded.duration ?? 0) / 1000).toFixed(1)} 秒</span>}
        {stale && <span>載入新版本中…</span>}
      </div>
      {loaded?.error && !stale && (
        <p className={ui.note} role="alert">
          第 {loaded.version} 版載入失敗：{loaded.error}（已回報給 AI；舞台停在上一個能演的版本）
        </p>
      )}
      <div ref={boxRef} className={styles.box} data-testid="live-script-player" />
      {snap && (
        <details className={styles.source}>
          <summary>目前的腳本（第 {snap.version} 版）</summary>
          <pre>{JSON.stringify(snap.script, null, 2)}</pre>
        </details>
      )}
    </ProposalLayout>
  )
}
