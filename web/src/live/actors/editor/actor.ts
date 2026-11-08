// 演員 editor:通用的程式碼編輯器(深色主題,不仿任何品牌),用來演出「以前要自己一行一行寫程式」。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定):
//   project   專案資料夾名稱,顯示在標題列與檔案清單上方(預設 bakery)
//   files     一開始就有的檔案 { 檔名: 內容 },依序開成分頁;最後一個是目前的檔案
//
// 動作:
//   { "open": "index.html" }      打開檔案(沒有就新增一個空白檔案),切到它的分頁
//   { "type": "<h1>小森烘焙</h1>\n" }  在目前檔案的最後逐字輸入(\n 換行);依副檔名上色(html、css、js)
//   { "paste": "<p>…</p>\n" }        把一段文字一次貼到目前檔案的最後(從別處複製過來)
//   { "suggest": "  <p>…</p>\n" }    AI 補全:游標後面出現灰色的建議文字,還沒真的寫進檔案
//   { "accept": true }               按 Tab 接受建議,灰字變成程式碼;open、type、paste 會清掉沒接受的建議
//   操作對不上(還沒打開檔案就輸入、沒有建議就 accept)時載入就報錯。
//
// 目標:window、code(程式碼區)、caret(游標所在的那一行)、ghost(灰色建議的第一行)、tab:<檔名>
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type EditorKind = 'open' | 'type' | 'paste' | 'suggest' | 'accept'
type EditorStep = CommonStepFields & { open?: string; type?: string; paste?: string; suggest?: string; accept?: boolean }
interface EditorProps {
  project?: string
  files?: Record<string, string>
}
interface EditorState {
  files: Record<string, string>
  tabs: string[]
  active: string | null
  /** AI 補全的灰色建議(還沒接受) */
  ghost: string | null
}
type EditorTarget = 'window' | 'code' | 'caret' | 'ghost' | `tab:${string}`

const KINDS: readonly EditorKind[] = ['open', 'type', 'paste', 'suggest', 'accept']
const CPS = 28
const T = { open: 500, typeLead: 250, typeTail: 500, paste: 600, suggest: 700, accept: 500 }

// ---------- 上色(極簡,只求看起來像程式碼) ----------
const span = (cls: string, s: string) => `<span class="ed-${cls}">${kit.esc(s)}</span>`
function tokenize(line: string, re: RegExp, classes: string[]): string {
  let out = ''
  let last = 0
  for (const m of line.matchAll(re)) {
    out += kit.esc(line.slice(last, m.index))
    const g = m.slice(1).findIndex((x) => x !== undefined)
    out += span(classes[g], m[0])
    last = m.index! + m[0].length
  }
  return out + kit.esc(line.slice(last))
}
const HTML_RE = /(<\/?[\w!-]+)|((?<=\s)[\w-]+(?==))|("[^"]*"?)|(\/?>)/g
const CSS_RE = /(^[^{}:]+(?=\{))|([\w-]+(?=\s*:))|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|%|em)?\b)/g
const JS_RE = /(\b(?:const|let|function|return|if|else|=>)\b)|('[^']*'?|"[^"]*"?)|(\b\d+\b)/g
function highlight(line: string, file: string): string {
  if (/\.html?$/.test(file)) return tokenize(line, HTML_RE, ['tag', 'attr', 'str', 'tag'])
  if (/\.css$/.test(file)) return tokenize(line, CSS_RE, ['sel', 'prop', 'n'])
  if (/\.js$/.test(file)) return tokenize(line, JS_RE, ['kw', 'str', 'n'])
  return kit.esc(line)
}
const extOf = (f: string) => (/\.(\w+)$/.exec(f)?.[1] ?? '').toLowerCase()

const actor = defineActor<EditorKind, EditorStep, EditorProps, EditorState, EditorTarget>({
  name: 'editor',
  kinds: KINDS,
  parts: { bar: '.ed-bar', files: '.ed-side', tabs: '.ed-tab', lineNumbers: '.ed-num' },

  hotspots(st) {
    const tabs = st.tabs.filter((f) => f !== st.active).map((f) => ({ target: `tab:${f}`, label: `切換到 ${f}`, step: { open: f } }))
    if (!st.active) return tabs
    if (st.ghost) return [...tabs, { target: 'ghost', label: '按 Tab 接受建議', step: { accept: true } }]
    return [...tabs, { target: 'code', label: '輸入程式碼', input: { placeholder: '打一行程式碼', step: (text: string) => ({ type: `${text}\n` }) } }]
  },

  init(props) {
    const files = { ...(props.files ?? {}) }
    const tabs = Object.keys(files)
    return { files, tabs, active: tabs.at(-1) ?? null, ghost: null }
  },

  apply(st, kind, s) {
    if (kind === 'open') {
      const f = s.open
      if (typeof f !== 'string' || !f.trim()) throw new Error('open 要給檔名')
      return { files: { ...st.files, [f]: st.files[f] ?? '' }, tabs: st.tabs.includes(f) ? st.tabs : [...st.tabs, f], active: f, ghost: null }
    }
    if (!st.active) throw new Error(`${kind}:還沒打開檔案,先用 open`)
    if (kind === 'accept') {
      if (!st.ghost) throw new Error('accept:沒有建議可以接受,先用 suggest')
      return { ...st, files: { ...st.files, [st.active]: st.files[st.active] + st.ghost }, ghost: null }
    }
    const text = s[kind]
    if (typeof text !== 'string' || !text) throw new Error(`${kind} 要給文字`)
    if (kind === 'suggest') return { ...st, ghost: text }
    return { ...st, files: { ...st.files, [st.active]: st.files[st.active] + text }, ghost: null }
  },

  duration(kind, step) {
    if (kind === 'type') return T.typeLead + kit.typeDuration(step.type ?? '', CPS) + T.typeTail
    return T[kind]
  },

  mount(root, props) {
    root.classList.add('A-editor')
    const project = props.project || 'bakery'
    root.innerHTML =
      `<div class="ed-window"><div class="ed-bar"><span class="light red"></span><span class="light yellow"></span><span class="light green"></span><span class="ed-title"></span></div>` +
      `<div class="ed-main"><div class="ed-side"><div class="ed-proj">${kit.esc(project.toUpperCase())}</div><div class="ed-files"></div></div>` +
      `<div class="ed-pane"><div class="ed-tabs"></div><div class="ed-code"><div class="ed-scroll"><div class="ed-lines"></div></div><div class="ed-empty">打開一個檔案開始寫程式</div></div></div></div></div>`
    const $ = (s: string) => root.querySelector<HTMLElement>(s)!
    const title = $('.ed-title')
    const files = $('.ed-files')
    const tabs = $('.ed-tabs')
    const code = $('.ed-code')
    const scroll = $('.ed-scroll')
    const lines = $('.ed-lines')
    const empty = $('.ed-empty')

    return {
      render(frame, ms) {
        const v = frame.view
        if (!v) return
        const ev = v.ev && KINDS.includes(v.ev.kind as EditorKind) ? v.ev : null
        const st = v.ev?.kind === 'hide' ? v.prev : v.state
        const active = st.active
        let text = active ? st.files[active] : ''
        let typing = false
        if (ev?.kind === 'type' && active) {
          const t = kit.typewriter((ev.step as EditorStep).type ?? '', ev.local, { start: T.typeLead, cps: CPS })
          text = v.prev.files[active] + t.text
          typing = !t.done
        }
        kit.setIf(title, 'text', active ? `${active} — ${project}` : project)
        kit.setIf(files, 'html', st.tabs.map((f) => `<div class="ed-file${f === active ? ' on' : ''}"><i class="ed-ico ed-${extOf(f)}"></i>${kit.esc(f)}</div>`).join(''))
        kit.setIf(tabs, 'html', st.tabs.map((f) => `<div class="ed-tab${f === active ? ' on' : ''}" data-f="${kit.esc(f)}"><i class="ed-ico ed-${extOf(f)}"></i>${kit.esc(f)}</div>`).join(''))
        empty.hidden = !!active
        const rows = active ? text.split('\n') : []
        // 灰色建議:第一段接在游標後面,其餘各自一行;出現時淡入,被接受的那一下亮一下
        const ghost = ev?.kind === 'accept' ? null : st.ghost
        const ghostRows = ghost ? ghost.split('\n') : []
        const ghostOp = ev?.kind === 'suggest' ? kit.progress(ev.local, 150, 450) : 1
        const flash = ev?.kind === 'accept' || ev?.kind === 'paste' ? 1 - kit.progress(ev.local, 100, T[ev.kind]) : 0
        const added = ev?.kind === 'accept' ? (v.prev.ghost ?? '') : ev?.kind === 'paste' ? ((ev.step as EditorStep).paste ?? '') : ''
        const firstAdded = added ? v.prev.files[active!]?.split('\n').length ?? 1 : 0
        // 游標:輸入中一直亮著,停下來時閃爍
        const caretOn = typing || Math.floor(ms / 530) % 2 === 0
        kit.setIf(
          lines,
          'html',
          rows
            .map((r, i) => {
              const last = i === rows.length - 1
              const lit = flash > 0 && i + 1 >= firstAdded && i < rows.length - (added.endsWith('\n') ? 1 : 0)
              const g = last && ghostRows.length ? `<span class="ed-ghost" style="opacity:${ghostOp.toFixed(3)}">${kit.esc(ghostRows[0])}</span>` : ''
              return `<div class="ed-row${last ? ' cur' : ''}"${lit ? ` style="background:rgba(120,180,255,${(0.22 * flash).toFixed(3)})"` : ''}><span class="ed-num">${i + 1}</span><span class="ed-src">${highlight(r, active!)}${last ? `<span class="ed-caret"${caretOn ? '' : ' data-off'}></span>` : ''}${g}</span></div>`
            })
            .concat(
              ghostRows.slice(1).filter((r, i, a) => r || i < a.length - 1).map(
                (r, i) => `<div class="ed-row ed-ghost-row" style="opacity:${ghostOp.toFixed(3)}"><span class="ed-num">${rows.length + i + 1}</span><span class="ed-src"><span class="ed-ghost">${kit.esc(r)}</span></span></div>`,
              ),
            )
            .join(''),
        )
        // 打開新分頁時程式碼區淡入
        kit.css(lines, { opacity: ev?.kind === 'open' ? kit.progress(ev.local, 0, 250).toFixed(3) : '1' })
        // 游標那一行保持在畫面裡(超出時往上捲)
        const row = lines.querySelector<HTMLElement>('.ed-row.cur')
        const lh = row?.offsetHeight || 1
        const visible = Math.floor(code.clientHeight / lh)
        const over = Math.max(0, rows.length - visible + 2)
        kit.css(scroll, { transform: `translateY(${(-over * lh).toFixed(1)}px)` })
      },

      target(name) {
        if (name === 'window') return $('.ed-window')
        if (name === 'code') return code
        if (name === 'caret') return lines.querySelector<HTMLElement>('.ed-row.cur')
        if (name === 'ghost') return lines.querySelector<HTMLElement>('.ed-ghost')
        if (name.startsWith('tab:')) return [...tabs.children].find((t) => (t as HTMLElement).dataset.f === name.slice(4)) as HTMLElement | null
        return null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
