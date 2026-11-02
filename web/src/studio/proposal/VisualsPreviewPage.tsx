import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { mountShell } from '../../live/shell.js'
import { createStage, type Stage, type StageCaption, type StageChapter } from '../../live/stage.js'
import { loadScript, scriptPaths } from '../../live/scripts'
import '../../live/shell.css'
import { ProposalLayout } from './ProposalLayout'
import styles from './VisualsPreviewPage.module.css'

// 即時教學畫面的內部預覽頁:/proposal/visuals/preview?script=l0/0.0-tools.json&t=12000
// - 沒有 script:列出 src/content/live/ 底下的腳本。
// - 有 t(毫秒):只用舞台畫出那個時間點的畫面(不掛播放器),給截圖與檢查用。
//   載入完成後設 window.__livePreviewReady = true,並提供 window.__livePreview(renderAt、duration、chapters、captions),
//   方便 Playwright 逐段截圖。
// - 沒有 t:掛完整的播放器外殼(可播放、拖曳)。

declare global {
  interface Window {
    __livePreviewReady?: boolean
    __livePreview?: {
      renderAt(ms: number): void
      duration: number
      chapters: StageChapter[]
      captions: StageCaption[]
    }
  }
}

type Info = { title: string; duration: number; chapters: StageChapter[] }

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const errorText = (e: unknown) => String(e instanceof Error ? e.message : e)

export function VisualsPreviewPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const script = params.get('script')
  const tRaw = params.get('t')
  const t = tRaw == null ? null : Math.max(0, Number(tRaw) || 0)

  const go = (next: { t?: number | null }) => {
    // 腳本路徑保留斜線,網址比較好讀(和 README 的寫法一致)
    const q = [script ? `script=${encodeURI(script)}` : '', next.t != null ? `t=${Math.round(next.t)}` : ''].filter(Boolean)
    navigate(`/proposal/visuals/preview${q.length ? `?${q.join('&')}` : ''}`, { replace: true })
  }

  return (
    <ProposalLayout title="即時教學畫面預覽" footer="內部預覽 · 引擎在 web/src/live/，腳本在 web/src/content/live/">
      <h1>即時教學畫面預覽</h1>
      {!script ? (
        <ScriptList />
      ) : (
        <>
          <p className="lead">
            <span className="repo-path" style={{ marginLeft: 0 }}>
              src/content/live/{script}
            </span>
          </p>
          <div className={styles.toolbar}>
            <Link className="btn ghost" to="/proposal/visuals/preview">
              ← 所有腳本
            </Link>
            {t == null ? (
              <button type="button" className="btn ghost" onClick={() => go({ t: 0 })}>
                改看靜態畫面
              </button>
            ) : (
              <button type="button" className="btn ghost" onClick={() => go({ t: null })}>
                改用播放器
              </button>
            )}
          </div>
          {t == null ? (
            <PlayerPreview key={script} script={script} />
          ) : (
            <StillPreview key={script} script={script} t={t} onSeek={(ms) => go({ t: ms })} />
          )}
        </>
      )}
    </ProposalLayout>
  )
}

function ScriptList() {
  return (
    <>
      <p className="lead">選一份腳本。「靜態畫面」只畫出某個時間點（給截圖與檢查用），「播放器」可以播放與拖曳。</p>
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>腳本（src/content/live/）</th>
              <th>預覽</th>
            </tr>
          </thead>
          <tbody>
            {scriptPaths.map((p) => (
              <tr key={p}>
                <td>
                  <span className="repo-path" style={{ marginLeft: 0 }}>
                    {p}
                  </span>
                </td>
                <td className="nowrap">
                  <Link to={`/proposal/visuals/preview?script=${encodeURI(p)}&t=0`}>靜態畫面</Link>
                  {' · '}
                  <Link to={`/proposal/visuals/preview?script=${encodeURI(p)}`}>播放器</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

/** 只用舞台畫出 t 時的畫面:固定 1920×1080,以 transform 縮放到頁寬。 */
function StillPreview({ script, t, onSeek }: { script: string; t: number; onSeek: (ms: number) => void }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const scalerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState(String(t))

  useEffect(() => setInput(String(t)), [t])

  // 縮放到頁寬
  useLayoutEffect(() => {
    const frame = frameRef.current
    const scaler = scalerRef.current
    if (!frame || !scaler) return
    const fit = () => {
      scaler.style.transform = `scale(${frame.clientWidth / 1920})`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [])

  // 載入腳本
  useEffect(() => {
    const scaler = scalerRef.current
    if (!scaler) return
    let cancelled = false
    const stageEl = document.createElement('div')
    scaler.replaceChildren(stageEl)
    const stage = createStage(stageEl)
    window.__livePreviewReady = false
    delete window.__livePreview

    loadScript(script)
      .then(async (data) => {
        await document.fonts.ready
        if (cancelled) return
        await stage.load(data)
        if (cancelled) return
        stageRef.current = stage
        window.__livePreview = {
          renderAt: (ms) => stage.renderAt(ms),
          duration: stage.duration,
          chapters: stage.chapters,
          captions: stage.captions,
        }
        setInfo({ title: data.title, duration: stage.duration, chapters: stage.chapters })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorText(e))
      })

    return () => {
      cancelled = true
      stageRef.current = null
      window.__livePreviewReady = false
      delete window.__livePreview
      scaler.replaceChildren()
    }
  }, [script])

  // 畫出 t 時的畫面
  useEffect(() => {
    const stage = stageRef.current
    if (!info || !stage) return
    try {
      stage.renderAt(t)
      window.__livePreviewReady = true
    } catch (e) {
      setError(errorText(e))
    }
  }, [info, t])

  const chapters = info?.chapters ?? []
  const currentIdx = chapters.reduce((acc, c, i) => (t >= c.at ? i : acc), -1)

  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          無法載入：{error}
        </p>
      )}
      <div ref={frameRef} className={styles.frame}>
        <div ref={scalerRef} className={styles.scaler} />
      </div>
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault()
          onSeek(Math.max(0, Number(input) || 0))
        }}
      >
        <label>
          t（毫秒）{' '}
          <input type="number" min={0} step={100} value={input} onChange={(e) => setInput(e.target.value)} />
        </label>
        <button type="submit">畫出</button>
        <span>
          {fmt(t)}
          {info && ` / ${fmt(info.duration)}（${Math.round(info.duration)} 毫秒）`}
        </span>
      </form>

      {info && (
        <>
          <h2>{info.title}</h2>
          <section className="card">
            <table>
              <thead>
                <tr>
                  <th>時間</th>
                  <th>章節</th>
                  <th>課程步驟</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((c, i) => (
                  <tr key={`${c.at}-${c.label}`} className={i === currentIdx ? styles.current : undefined}>
                    <td className="nowrap">
                      {fmt(c.at)}
                      <span className="repo-path">{Math.round(c.at)}</span>
                    </td>
                    <td>
                      <button type="button" className={styles.chapterBtn} onClick={() => onSeek(c.at)}>
                        {c.label}
                      </button>
                    </td>
                    <td className="nowrap">{c.step ?? ''}</td>
                  </tr>
                ))}
                <tr>
                  <td className="nowrap">
                    {fmt(info.duration)}
                    <span className="repo-path">{Math.round(info.duration)}</span>
                  </td>
                  <td>總長度</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  )
}

/** 完整播放器(外殼 + 舞台),和課程頁的 LivePlayer 相同的掛法。 */
function PlayerPreview({ script }: { script: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let cancelled = false
    const stageEl = document.createElement('div')
    const stage = createStage(stageEl)
    const vp = mountShell(box, { stage: stageEl, title: script, globalKeys: true })

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
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorText(e))
      })

    return () => {
      cancelled = true
      vp.destroy()
    }
  }, [script])

  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          無法載入：{error}
        </p>
      )}
      <div ref={boxRef} className={styles.player} />
    </>
  )
}
