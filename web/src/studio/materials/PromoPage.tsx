import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { narrationClips } from '../../live/mixPlan'
import { mountShell } from '../../live/shell'
import { loadMix, loadScript, loadVoice, scriptPaths } from '../../live/scripts'
import { stageSize } from '../../live/place'
import { createStage } from '../../live/stage'
import type { Aspect } from '../../live/types'
import '../../live/shell.css'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'
import { hasPromoVoice, promoScriptPaths } from './promoScripts'
import styles from './PromoPage.module.css'

// 宣傳影片:用即時教學畫面(src/live)播放 src/content/live/promo/ 的腳本。
// 頁面用完整的播放器外殼播放,不記會員播放進度。
// 網址 ?script=promo/xxx.json 直接開某一支(script 可以是 src/content/live/ 底下任何腳本,例如 l0/0.2-site.json);
// &aspect=portrait 用直式舞台(1080×1920,播放器 9:16),預設橫式(1920×1080);
// 加 &record=1 只顯示舞台(橫式 1920×1080、直式 1080×1920,給 scripts/record-live.mjs 逐格截圖),
// 載入完成後 window.__promoReady = true,並提供 window.__promo = { renderAt(ms), duration, fps }。

const FPS = 30

declare global {
  interface Window {
    __promoReady?: boolean
    __promo?: {
      renderAt: (ms: number) => void
      duration: number
      fps: number
      /** 旁白的開始時間與文字(錄製時依此混音) */
      narrations: { at: number; text: string }[]
      /** 字幕(輸出 .srt 用) */
      captions: { from: number; to: number; text: string }[]
    }
  }
}

type Info = { title: string; duration: number; chars: number; voice: boolean }

/** 量一支腳本:標題、總長度、旁白字數(掛在畫面外的舞台上載入,語音長度算進去) */
async function measure(path: string, aspect: Aspect): Promise<Info> {
  const [script, voice] = await Promise.all([loadScript(path), loadVoice(path).catch(() => null)])
  await document.fonts.ready
  const host = document.createElement('div')
  const { w, h } = stageSize(aspect)
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${w}px;height:${h}px;visibility:hidden`
  document.body.appendChild(host)
  try {
    const stage = createStage(host, { aspect })
    await stage.load(script, { voice: voice?.durations, aspect })
    const chars = stage.narrations.reduce((n, x) => n + [...x.text].length, 0)
    return { title: script.title ?? path, duration: stage.duration, chars, voice: hasPromoVoice(path) }
  } finally {
    host.remove()
  }
}

function promoHook(stage: ReturnType<typeof createStage>): NonNullable<Window['__promo']> {
  return {
    renderAt: (ms) => stage.renderAt(ms),
    duration: stage.duration,
    fps: FPS,
    narrations: stage.narrations.map((n) => ({ at: n.at, text: n.text })),
    captions: stage.captions.map((c) => ({ from: c.from, to: c.to, text: c.text })),
  }
}

const sec = (ms: number): string => `${(ms / 1000).toFixed(1)} 秒`

export function PromoPage() {
  const [params, setParams] = useSearchParams()
  const script = params.get('script')
  const aspect: Aspect = params.get('aspect') === 'portrait' ? 'portrait' : 'landscape'
  const record = params.get('record') === '1'
  if (record && script) return <RecordStage script={script} aspect={aspect} />
  const go = (next: { script?: string | null; aspect?: Aspect }): void => {
    const sc = next.script === undefined ? script : next.script
    const asp = next.aspect ?? aspect
    setParams({ ...(sc ? { script: sc } : {}), ...(asp === 'portrait' ? { aspect: 'portrait' } : {}) })
  }
  return (
    <ProposalLayout title="宣傳影片" footer="研發基地 · 宣傳影片腳本在 web/src/content/live/promo/">
      <h1>宣傳影片</h1>
      <p className={ui.lead}>
        用即時教學畫面做的宣傳片，腳本放在 web/src/content/live/promo/。網頁上直接播放；要輸出 mp4 在 web/ 執行
        <code> npm run record:live -- promo/檔名.json</code>。
      </p>
      <div className={styles.tools}>
        <span>舞台方向</span>
        <div role="group" aria-label="舞台方向">
          {(['landscape', 'portrait'] as const).map((a) => (
            <button key={a} type="button" className={aspect === a ? ui.btn : `${ui.btn} ${ui.ghost}`} aria-pressed={aspect === a} data-testid={`aspect-${a}`} onClick={() => go({ aspect: a })}>
              {a === 'landscape' ? '橫式 16:9' : '直式 9:16'}
            </button>
          ))}
        </div>
        <ScriptInput key={script ?? ''} value={script ?? ''} onSubmit={(p) => go({ script: p })} />
      </div>
      <ScriptList selected={script} aspect={aspect} onSelect={(p) => go({ script: p })} />
      {script && <PromoPlayer key={`${script}|${aspect}`} script={script} aspect={aspect} />}
    </ProposalLayout>
  )
}

/** 輸入 src/content/live/ 底下任何腳本的路徑(例如 l0/0.2-site.json),看它在目前方向下的樣子 */
function ScriptInput({ value, onSubmit }: { value: string; onSubmit: (path: string) => void }) {
  const [text, setText] = useState(value)
  const paths = scriptPaths().filter((p) => !/\.(voice|mix)\.json$/.test(p)).sort()
  return (
    <form
      className={styles.pathform}
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) onSubmit(text.trim())
      }}
    >
      <input list="live-script-paths" value={text} onChange={(e) => setText(e.target.value)} placeholder="腳本路徑,例如 l0/0.2-site.json" aria-label="腳本路徑" data-testid="script-input" />
      <datalist id="live-script-paths">{paths.map((p) => <option key={p} value={p} />)}</datalist>
      <button type="submit" className={ui.btn}>載入腳本</button>
    </form>
  )
}

function ScriptList({ selected, aspect, onSelect }: { selected: string | null; aspect: Aspect; onSelect: (path: string) => void }) {
  const [infos, setInfos] = useState<Record<string, Info | string>>({})
  useEffect(() => {
    let cancelled = false
    void (async () => {
      // 一支一支量(舞台載入會掛 DOM,不要同時進行)
      for (const p of promoScriptPaths) {
        const info = await measure(p, aspect).catch((e: unknown) => String(e instanceof Error ? e.message : e))
        if (cancelled) return
        setInfos((prev) => ({ ...prev, [p]: info }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [aspect])

  if (!promoScriptPaths.length) return <p className={ui.lead}>web/src/content/live/promo/ 底下還沒有腳本。</p>
  return (
    <div>
      {promoScriptPaths.map((p) => {
        const info = infos[p]
        return (
          <section className={ui.card} key={p} data-testid="promo-item">
            <div className={ui['card-head']}>
              <div className={ui['head-left']}>
                <div>
                  <h3>{typeof info === 'object' ? info.title : p}</h3>
                  <div className={ui.meta}>
                    {info === undefined ? '量測中…' : typeof info === 'string' ? `腳本有誤：${info}` : `長度 ${sec(info.duration)} · 旁白 ${info.chars} 字 · ${info.voice ? '已有旁白語音' : '尚無旁白語音（只有字幕）'}`}
                  </div>
                </div>
              </div>
            </div>
            <div className={ui['card-body']}>
              <p className={ui['kv-lead']}>
                <span className={ui['repo-path']}>web/src/content/live/{p}</span>
              </p>
            </div>
            <div className={ui['card-foot']}>
              <div className={ui.links}>
                <button type="button" className={selected === p ? `${ui.btn} ${ui.ghost}` : ui.btn} onClick={() => onSelect(p)}>
                  {selected === p ? '播放中' : '播放這支'}
                </button>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** 完整播放器外殼:旁白語音與章節音軌照 courses/LivePlayer.tsx,但不記進度、不用登入狀態 */
export function PromoPlayer({ script, aspect }: { script: string; aspect: Aspect }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let cancelled = false
    const stageEl = document.createElement('div')
    const stage = createStage(stageEl, { aspect })
    const vp = mountShell(box, { stage: stageEl, title: '宣傳影片', globalKeys: false, aspect })
    setError(null)
    window.__promoReady = false
    Promise.all([loadScript(script), loadVoice(script).catch(() => null), loadMix(script).catch(() => null)])
      .then(async ([data, voice, mix]) => {
        await document.fonts.ready
        if (cancelled) return
        await stage.load(data, { voice: voice?.durations, aspect })
        if (cancelled) return
        const caps = stage.captions
        vp.update({
          title: data.title,
          duration: stage.duration,
          renderAt: (ms) => stage.renderAt(ms),
          chapters: stage.chapters,
          stops: stage.stops,
          captions: (ms) => caps.find((c) => ms >= c.from && ms < c.to)?.text || '',
          clips: narrationClips(stage.narrations, voice, mix),
        })
        window.__promo = promoHook(stage)
        window.__promoReady = true
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })
    return () => {
      cancelled = true
      window.__promoReady = false
      window.__promo = undefined
      vp.destroy()
    }
  }, [script, aspect])

  return (
    <div className={aspect === 'portrait' ? `${styles.player} ${styles['player-portrait']}` : styles.player}>
      <div ref={boxRef} className={aspect === 'portrait' ? `${styles.box} ${styles['box-portrait']}` : styles.box} data-testid="promo-player" data-aspect={aspect} />
      {error && <p role="alert">無法播放：{error}</p>}
    </div>
  )
}

/** record=1:只有舞台(橫式 1920×1080、直式 1080×1920),沒有外殼與頁面其他元素;時間完全由 window.__promo.renderAt 決定 */
function RecordStage({ script, aspect }: { script: string; aspect: Aspect }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    const stage = createStage(host, { aspect })
    window.__promoReady = false
    Promise.all([loadScript(script), loadVoice(script).catch(() => null)])
      .then(async ([data, voice]) => {
        await document.fonts.ready
        if (cancelled) return
        await stage.load(data, { voice: voice?.durations, aspect })
        if (cancelled) return
        stage.renderAt(0)
        window.__promo = promoHook(stage)
        window.__promoReady = true
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })
    return () => {
      cancelled = true
    }
  }, [script, aspect])
  const { w, h } = stageSize(aspect)
  return (
    <div className={styles.record}>
      <div ref={hostRef} className={styles['record-stage']} style={aspect === 'portrait' ? { width: w, height: h } : undefined} />
      {error && <p role="alert">無法載入：{error}</p>}
    </div>
  )
}
