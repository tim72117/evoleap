import { useState } from 'react'
import { adjust, firstDraft, SECTION_NAME, STYLE_NAME, type Section, type Site } from './siteSim'
import styles from './practice.module.css'

// 第 2 課練習:左邊寫需求、對話調整,右邊是小森烘焙網頁的即時預覽。
// 預覽的區塊可以直接點選(再對 AI 說「卡片改兩欄」),寬度可以拖,每一次修改都能還原。

type Target = Section | 'nav' | 'title'
type Msg = { who: 'user' | 'ai' | 'warn'; text: string }

const PALETTE = {
  warm: { bg: '#fbf3e6', ink: '#4a3322', card: '#fff', accent: '#c0703a', font: 'Georgia, "Noto Serif TC", serif' },
  tech: { bg: '#0f1424', ink: '#dfe6ff', card: '#1a2240', accent: '#3be0ff', font: '"SF Mono", Menlo, monospace' },
  minimal: { bg: '#ffffff', ink: '#222', card: '#f4f4f4', accent: '#222', font: 'system-ui, sans-serif' },
} as const

const PRODUCTS = ['肉桂捲', '鹽之花可頌', '檸檬塔', '全麥吐司']
const H = { s: 20, m: 28, l: 40 } as const

function Preview({ site, width, selected, onPick }: { site: Site; width: number; selected: Target | null; onPick: (t: Target) => void }) {
  const c = PALETTE[site.style]
  const compact = width < 560
  const cols = compact ? 1 : site.cols
  const pick = (t: Target) => ({
    onClick: () => onPick(t),
    className: `${styles.block} ${selected === t ? styles.picked : ''}`,
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && onPick(t),
  })
  const body = (s: Section) => {
    switch (s) {
      case 'products':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
            {PRODUCTS.map((p) => (
              <div key={p} style={{ background: c.card, padding: 12, borderRadius: 8 }}>
                <div style={{ height: 44, background: c.accent, opacity: 0.25, borderRadius: 6, marginBottom: 8 }} />
                {p}
                {site.shout && <div style={{ marginTop: 8, background: '#e11', color: '#fff', textAlign: 'center', padding: '8px 0', fontWeight: 800, fontSize: 18 }}>立即購買！！</div>}
              </div>
            ))}
          </div>
        )
      case 'booking':
        return <ol style={{ margin: 0, paddingLeft: 20 }}><li>前一天選好商品</li><li>留下姓名與電話</li><li>當天到店取貨</li></ol>
      case 'hours':
        return <table style={{ width: '100%' }}><tbody><tr><td>週二至週五</td><td>08:00–17:00</td></tr><tr><td>週六日</td><td>08:00–15:00</td></tr><tr><td>週一</td><td>公休</td></tr></tbody></table>
      case 'faq':
        return <details><summary>可以現場買嗎？</summary>可以，但熱門商品建議先預約。</details>
      case 'contact':
        return <p style={{ margin: 0 }}>小森烘焙（虛構）· 示範街 1 號</p>
    }
  }
  return (
    <div className={styles.site} style={{ background: c.bg, color: c.ink, fontFamily: c.font, width }}>
      <div {...pick('nav')} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${c.accent}44` }}>
        <strong>小森烘焙</strong>
        {compact && site.burger ? <span aria-label="選單">☰</span> : compact ? <span style={{ fontSize: 11, opacity: 0.8 }}>商品 預約 時間 問答 聯絡 (擠成一排)</span> : <span>{site.sections.map((s) => SECTION_NAME[s]).join('　')}</span>}
      </div>
      <div {...pick('title')} style={{ padding: '18px 14px 4px' }}>
        <div style={{ fontSize: H[site.heading], fontWeight: 700, lineHeight: 1.2 }}>每天現烤，手作的小森烘焙</div>
      </div>
      {site.sections.map((s) => (
        <div key={s} {...pick(s)} style={{ padding: 14 }}>
          <h4 style={{ margin: '0 0 8px', color: c.accent }}>{SECTION_NAME[s]}</h4>
          {body(s)}
        </div>
      ))}
    </div>
  )
}

export function SiteSandbox() {
  const [site, setSite] = useState<Site | null>(null)
  /** 目前的網頁是需求模糊時亂猜的第一版 */
  const [guessed, setGuessed] = useState(false)
  const [history, setHistory] = useState<Site[]>([])
  const [msgs, setMsgs] = useState<Msg[]>([{ who: 'ai', text: '請先描述想要的網站：放哪些區塊、什麼風格。送出後我會產生第一版。' }])
  const [draft, setDraft] = useState('')
  const [selected, setSelected] = useState<Target | null>(null)
  const [width, setWidth] = useState(560)

  const send = (text: string) => {
    if (!text.trim()) return
    setDraft('')
    const user: Msg = { who: 'user', text: selected && site ? `（選取：${selected === 'nav' ? '導覽列' : selected === 'title' ? '標題' : SECTION_NAME[selected]}）${text}` : text }
    // 還沒有網頁,或第一版是亂猜的(需求太模糊):這一句再當成需求產生第一版。
    // 亂猜之後送的如果仍然模糊(例如「卡片改兩欄」),就當成調整,不再重猜一次。
    const d = !site || guessed ? firstDraft(text) : null
    if (d && (!site || !d.vague)) {
      if (site) setHistory((h) => [...h, site])
      setSite(d.site)
      setGuessed(d.vague)
      setMsgs((m) => [...m, user, { who: d.vague ? 'warn' : 'ai', text: d.say }])
      return
    }
    if (!site) return
    setGuessed(false)
    const r = adjust(site, text, selected ?? undefined)
    if (r.site !== site) setHistory((h) => [...h, site])
    setSite(r.site)
    setMsgs((m) => [...m, user, { who: r.broad ? 'warn' : 'ai', text: r.broad ? `${r.say}你只說了籠統的一句，我一口氣動了 ${r.changed.length} 個地方（${r.changed.join('、')}）。不是你要的就按「還原」，下次指名要改哪裡。` : r.say }])
  }

  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setSite(prev)
    setHistory((h) => h.slice(0, -1))
    setMsgs((m) => [...m, { who: 'ai', text: '已還原上一次修改。' }])
  }
  const restart = () => {
    setSite(null)
    setGuessed(false)
    setHistory([])
    setSelected(null)
    setMsgs([{ who: 'ai', text: '重來了。請先描述想要的網站。' }])
  }

  const hints = site && !guessed
    ?['卡片改兩欄', '標題放大', '加手機選單', '拿掉常見問題', '風格改簡約', '整個再改好看一點']
    : ['幫我做個好看的網站', '為小森烘焙做一頁式網站，介紹商品、預約取貨流程、營業時間和常見問題，風格溫暖有手作感。']

  return (
    <div className={styles.sandbox}>
      <section className={styles.chat} aria-label="AI 工具">
        <header>
          <strong>提出需求</strong>
          <button type="button" className={styles.link} onClick={restart}>重來</button>
        </header>
        <div className={styles.log}>
          {msgs.map((m, i) => (
            <div key={i} className={`${styles.msg} ${m.who === 'user' ? styles.user : m.who === 'warn' ? styles.warnMsg : styles.ai}`}><p>{m.text}</p></div>
          ))}
        </div>
        <div className={styles.chips}>
          {hints.map((h) => (
            <button key={h} type="button" onClick={() => send(h)}>{h.length > 22 ? `${h.slice(0, 22)}…` : h}</button>
          ))}
        </div>
        <form className={styles.composer} onSubmit={(e) => { e.preventDefault(); send(draft) }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={site ? '說一句要改哪裡，例如：卡片改兩欄' : '描述你要的網站'} aria-label="對 AI 說話" />
          <button type="submit" disabled={!draft.trim()}>送出</button>
        </form>
      </section>

      <section className={styles.previewPane} aria-label="預覽">
        <header>
          <strong>預覽</strong>
          {site && <span className={styles.badge}>{STYLE_NAME[site.style]}</span>}
          <button type="button" className={styles.link} onClick={undo} disabled={!history.length}>還原上一次</button>
          <label className={styles.mode}>
            寬度 {width}px
            <input type="range" min={360} max={900} step={10} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </label>
          {[['手機', 390], ['平板', 768], ['桌機', 900]].map(([n, w]) => (
            <button key={n} type="button" className={styles.link} onClick={() => setWidth(w as number)}>{n}</button>
          ))}
        </header>
        <div className={styles.stageBox}>
          {site ? <Preview site={site} width={width} selected={selected} onPick={(t) => setSelected((x) => (x === t ? null : t))} /> : <p className={styles.muted}>還沒有網頁。先在左邊描述需求。</p>}
        </div>
        {site && <p className={styles.muted}>{selected ? '已選取一個區塊，下一句調整會針對它；再點一次取消。' : '點預覽裡的區塊可以指名要改哪裡；拖曳上方寬度檢查手機版。'}</p>}
      </section>
    </div>
  )
}
