import { useEffect, useRef, useState } from 'react'
import { applyOp, basename, commandOf, get, inside, plan, relative, scopeOf, type Dir, type Plan } from './sim'
import styles from './practice.module.css'

// 第 0、1 課共用的練習:左邊是仿 Finder 的檔案樹,右邊是仿 AI 工具的對話視窗。
// 學員自己打字(或點提示詞晶片、把檔案拖到資料夾),AI 動手前跳出確認提示,允許或拒絕後檔案樹立刻變化。
// 沒有對錯與分數;做了危險的事就讓人看到後果,「重來」可以還原整個練習。

type Msg = { who: 'user' | 'ai' | 'tool' | 'note'; text: string; output?: string }

type Props = {
  initialRoot: Dir
  initialCwd: string
  /** 第 1 課:可以自己選工具開在哪個資料夾 */
  cwdPickable?: boolean
  /** 第 0 課:可以切換「每次詢問／自動允許」 */
  modeToggle?: boolean
  hints: string[]
}

type Pending = { plan: Plan; scope: Set<string> }

function Tree({
  root, node, path, cwd, scope, fresh, selected, onSelect, onMove, pickable, onOpen,
}: {
  root: Dir; node: Dir; path: string; cwd: string; scope: Set<string>; fresh: Set<string>; selected: string | null
  onSelect: (p: string) => void; onMove: (from: string, to: string) => void; pickable: boolean; onOpen: (p: string) => void
}) {
  return (
    <ul className={styles.tree}>
      {Object.entries(node.children)
        .sort(([a, x], [b, y]) => (x.kind === y.kind ? a.localeCompare(b) : x.kind === 'dir' ? -1 : 1))
        .map(([name, child]) => {
          const p = `${path === '/' ? '' : path}/${name}`
          const isDir = child.kind === 'dir'
          const cls = [styles.row, p === cwd ? styles.cwd : '', scope.has(p) ? styles.scope : '', fresh.has(p) ? styles.fresh : '', p === selected ? styles.selected : ''].join(' ')
          const draggable = inside(cwd, p) && p !== cwd
          return (
            <li key={p}>
              <div
                className={cls}
                draggable={draggable}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', p)}
                onDragOver={(e) => isDir && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = e.dataTransfer.getData('text/plain')
                  if (isDir && from && from !== p) onMove(from, p)
                }}
              >
                <button type="button" onClick={() => onSelect(p)}>
                  <span aria-hidden="true">{isDir ? '📁' : '📄'}</span> {name}
                </button>
                {p === cwd && <em className={styles.here}>工具開在這裡</em>}
                {pickable && isDir && p !== cwd && (
                  <button type="button" className={styles.open} onClick={() => onOpen(p)}>
                    在這裡開啟工具
                  </button>
                )}
              </div>
              {isDir && <Tree root={root} node={child} path={p} cwd={cwd} scope={scope} fresh={fresh} selected={selected} onSelect={onSelect} onMove={onMove} pickable={pickable} onOpen={onOpen} />}
            </li>
          )
        })}
    </ul>
  )
}

export function AgentSandbox({ initialRoot, initialCwd, cwdPickable, modeToggle, hints }: Props) {
  const [root, setRoot] = useState(initialRoot)
  const [cwd, setCwd] = useState(initialCwd)
  const [msgs, setMsgs] = useState<Msg[]>([{ who: 'note', text: `工具已在 ${initialCwd} 開啟。` }])
  const [pending, setPending] = useState<Pending | null>(null)
  const [mode, setMode] = useState<'ask' | 'auto'>('ask')
  const [selected, setSelected] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [msgs, pending])
  useEffect(() => {
    if (!fresh.size) return
    const id = setTimeout(() => setFresh(new Set()), 1600)
    return () => clearTimeout(id)
  }, [fresh])

  const say = (...m: Msg[]) => setMsgs((x) => [...x, ...m])

  const commit = (p: Plan) => {
    let next = root
    for (const op of p.ops) next = applyOp(next, op)
    setRoot(next)
    setFresh(new Set(p.ops.map((o) => (o.t === 'move' ? o.to : o.t === 'rm' ? '' : o.path)).filter(Boolean)))
    if (selected && !get(next, selected)) setSelected(null)
    say(...p.ops.map((o): Msg => ({ who: 'tool', text: commandOf(o, cwd) })), { who: 'ai', text: '完成了。記得到左邊的檔案總管親眼確認一次。' })
  }

  const submit = (text: string) => {
    if (pending || !text.trim()) return
    setDraft('')
    const p = plan(text, cwd, root)
    say({ who: 'user', text }, { who: 'ai', text: p.say, output: p.output })
    if (!p.ops.length) return
    if (mode === 'auto') commit(p)
    else setPending({ plan: p, scope: new Set(p.ops.flatMap((o) => scopeOf(root, o))) })
  }

  const decide = (d: 'allow' | 'always' | 'deny') => {
    if (!pending) return
    const p = pending.plan
    setPending(null)
    if (d === 'deny') return say({ who: 'note', text: '你拒絕了這個動作，沒有任何檔案被動到。' }, { who: 'ai', text: '好的，我不會動手。需要的話，換個說法再告訴我。' })
    if (d === 'always') {
      setMode('auto')
      say({ who: 'note', text: '已改成「自動允許」：之後同類的動作不會再問你。' })
    }
    commit(p)
  }

  const openHere = (p: string) => {
    setCwd(p)
    setPending(null)
    say({ who: 'note', text: `工具已關閉，改從 ${p} 重新開啟。現在它的工作範圍是 ${p}。` })
  }

  const reset = () => {
    setRoot(initialRoot)
    setCwd(initialCwd)
    setMsgs([{ who: 'note', text: `已重來。工具在 ${initialCwd} 開啟。` }])
    setPending(null)
    setMode('ask')
    setSelected(null)
  }

  const rel = selected ? relative(cwd, selected) : ''
  const selectedInside = selected ? inside(cwd, selected) : false
  const danger = pending?.plan.ops.some((o) => o.t === 'rm') ?? false
  const recursive = pending?.plan.ops.some((o) => o.t === 'rm' && o.recursive) ?? false
  const move = (from: string, to: string) => submit(`把 ${relative(cwd, from)} 移到 ${relative(cwd, to)} 資料夾`)

  return (
    <div className={styles.sandbox}>
      <section className={styles.finder} aria-label="檔案總管">
        <header>
          <strong>檔案總管</strong>
          <button type="button" className={styles.link} onClick={reset}>重來</button>
        </header>
        <Tree root={root} node={root} path="/" cwd={cwd} scope={pending?.scope ?? new Set()} fresh={fresh} selected={selected} onSelect={setSelected} onMove={move} pickable={Boolean(cwdPickable)} onOpen={openHere} />
        <footer className={styles.pathbar}>
          {selected ? (
            <>
              <span>完整路徑 <code>{selected}</code></span>
              {selectedInside ? (
                <span>相對路徑（從工作目錄出發）<code>{rel}</code>{rel !== '.' && <button type="button" className={styles.link} onClick={() => setDraft((d) => `${d}${d && !d.endsWith(' ') ? ' ' : ''}${rel}`)}>放進輸入框</button>}</span>
              ) : (
                <span className={styles.warn}>在工作目錄外面，AI 碰不到這裡</span>
              )}
            </>
          ) : (
            <span className={styles.muted}>點一個檔案或資料夾，看它的路徑；檔案可以拖到資料夾裡。</span>
          )}
        </footer>
      </section>

      <section className={styles.chat} aria-label="AI 工具">
        <header>
          <strong>AI 工具</strong>
          <span className={styles.badge}>工作目錄 {basename(cwd) || '/'}</span>
          {modeToggle && (
            <label className={styles.mode}>
              權限模式
              <select value={mode} onChange={(e) => setMode(e.target.value as 'ask' | 'auto')}>
                <option value="ask">每次動手前先詢問</option>
                <option value="auto">自動允許</option>
              </select>
            </label>
          )}
        </header>
        <div className={styles.log} ref={logRef} aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`${styles.msg} ${styles[m.who]}`}>
              {m.who === 'tool' ? <code>$ {m.text}</code> : <p>{m.text}</p>}
              {m.output && <pre>{m.output}</pre>}
            </div>
          ))}
          {pending && (
            <div className={`${styles.ask} ${danger ? styles.askDanger : ''}`} role="alertdialog" aria-label="確認提示">
              <strong>{danger ? '⚠ AI 想刪除東西，要允許嗎？' : 'AI 想動你的檔案，要允許嗎？'}</strong>
              <dl>
                <dt>哪個檔案</dt>
                <dd>{[...new Set(pending.plan.ops.map((o) => relative(cwd, o.t === 'move' ? o.from : o.path)))].join('、')}</dd>
                <dt>在哪個資料夾</dt>
                <dd>{cwd}</dd>
                <dt>做什麼</dt>
                <dd>{pending.plan.ops.map((o) => commandOf(o, cwd)).join('；')}</dd>
              </dl>
              {danger && (
                <p className={styles.range}>
                  會影響 {pending.scope.size} 個項目（左邊紅框）。{recursive ? '指令帶了 -rf：資料夾裡面的東西會一起消失，而且不一定進得了資源回收筒。' : ''}
                </p>
              )}
              <div className={styles.actions}>
                <button type="button" onClick={() => decide('allow')}>允許一次</button>
                <button type="button" onClick={() => decide('deny')}>拒絕</button>
                {modeToggle && <button type="button" className={styles.dim} onClick={() => decide('always')}>一律允許</button>}
              </div>
            </div>
          )}
        </div>
        <div className={styles.chips}>
          {hints.map((h) => (
            <button key={h} type="button" disabled={Boolean(pending)} onClick={() => submit(h)}>{h}</button>
          ))}
        </div>
        <form className={styles.composer} onSubmit={(e) => { e.preventDefault(); submit(draft) }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={Boolean(pending)} placeholder={pending ? '先回答上面的確認提示' : '對 AI 說一句話，例如：建立 hello.txt，寫一句問候'} aria-label="對 AI 說話" />
          <button type="submit" disabled={Boolean(pending) || !draft.trim()}>送出</button>
        </form>
      </section>
    </div>
  )
}
