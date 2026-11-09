// 演員 fc1-terminal:通用的終端機視窗(不仿任何品牌),演出「自己在終端機打指令、看輸出」。
// 全環節課程第 1 組做的(單元 1–4:安裝 Node.js、路徑、終端機入門、PATH、套件管理器、Git…)。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定,只描述起始狀態):
//   os      mac(預設,提示字元像「~/projects %」)或 win(PowerShell 風格「PS C:\Users\you\projects>」)
//   cwd     一開始所在的資料夾,用 / 分隔,~ 是家目錄(預設 "~");win 也用同樣的寫法,畫面上自動換成 C:\Users\<user>\…
//   user    使用者名稱(預設 you;win 的家目錄、mac 的 /Users/<user> 用它)
//   title   視窗標題(預設 mac「終端機」、win「PowerShell」)
//   embed   true 時不畫視窗外框與標題列(放在別的畫面裡當「內建終端機」用)
//
// 動作:
//   { "type": "ls -la", "out": "第一行\n第二行", "tone": "err" }
//        在提示字元後逐字打出指令、按 Enter,接著一行行印出 out(選用)。tone:err(紅)、ok(綠)、dim(灰);預設一般顏色。
//        指令是 cd <路徑> 時,提示字元的資料夾自動跟著換(支援 ..、~、/ 開頭的絕對路徑、a/b);tone 是 err 時當作失敗,不換資料夾。cps 可調打字速度(預設 13)。
//   { "print": "文字", "tone": "ok" }   不打指令,直接印出一段輸出(例如安裝程式跑出來的進度、AI 在旁邊執行的結果)
//   { "secret": "Password:" }           出現要輸入密碼的提示:打字時畫面上不會顯示任何字(一律由學員自己輸入),按 Enter 後換行
//   { "clear": true }                   清除畫面(像 clear 指令),只留提示字元
//   { "restart": true }                 關掉終端機再打開:畫面清空、回到 props.cwd,顯示一行「新的視窗」提示(PATH 重新讀取的時機)
//   操作對不上(type 沒給指令…)時載入就報錯,並指出第幾步。
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、screen(文字區)、prompt(目前的提示字元那一行)、cmd:last、out:last(最後一段指令/輸出)、cmd:N、out:N(第 N 個指令,1 起算)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type TermKind = 'type' | 'print' | 'secret' | 'clear' | 'restart'
type Tone = 'err' | 'ok' | 'dim'
type TermStep = CommonStepFields & {
  type?: string
  out?: string
  tone?: Tone
  cps?: number
  print?: string
  secret?: string
  clear?: boolean
  restart?: boolean
}
interface TermProps {
  os?: 'mac' | 'win'
  cwd?: string
  user?: string
  title?: string
  embed?: boolean
}
/** 畫面上的一段:cmd(打過的指令,null = 只是輸出)、當時的資料夾、輸出 */
interface Block {
  cmd: string | null
  cwd: string
  out: string
  tone: Tone | null
  secret: string | null
  note: string | null
}
interface TermState {
  cwd: string
  blocks: Block[]
}
type TermTarget = 'window' | 'screen' | 'prompt' | `cmd:${string}` | `out:${string}`

const KINDS: readonly TermKind[] = ['type', 'print', 'secret', 'clear', 'restart']
const ENTER = 280
const LINE = 140
const TAIL = 500
const TONES = new Set(['err', 'ok', 'dim'])

/** cd 之後的資料夾(posix 寫法,~ 是家目錄) */
function cdTo(cwd: string, arg: string, user: string): string {
  const a = arg.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/')
  if (!a || a === '~') return '~'
  const home = `/Users/${user}`
  const abs = (p: string): string[] => (p === '~' ? home : p.startsWith('~/') ? home + p.slice(1) : p).split('/').filter(Boolean)
  let parts: string[]
  if (a.startsWith('/') || /^[a-zA-Z]:/.test(a)) parts = a.replace(/^[a-zA-Z]:/, '').split('/').filter(Boolean)
  else if (a.startsWith('~')) parts = abs(a)
  else parts = [...abs(cwd), ...a.split('/').filter(Boolean)]
  const out: string[] = []
  for (const p of parts) {
    if (p === '.') continue
    if (p === '..') out.pop()
    else out.push(p)
  }
  const s = '/' + out.join('/')
  if (s === home) return '~'
  if (s.startsWith(home + '/')) return '~' + s.slice(home.length)
  return s
}

const promptOf = (os: 'mac' | 'win', cwd: string, user: string): string => {
  if (os === 'win') {
    const p = cwd === '~' ? `C:\\Users\\${user}` : cwd.startsWith('~/') ? `C:\\Users\\${user}\\${cwd.slice(2).replace(/\//g, '\\')}` : `C:${cwd.replace(/\//g, '\\')}`
    return `PS ${p}>`
  }
  const tail = cwd === '~' ? '~' : cwd.split('/').filter(Boolean).slice(-1)[0] || '/'
  return `${user}@mac ${tail} %`
}

const outLines = (s: string): string[] => (s ? s.split('\n') : [])

const actor = defineActor<TermKind, TermStep, TermProps, TermState, TermTarget>({
  name: 'fc1-terminal',
  kinds: KINDS,
  parts: { bar: '.ft-bar' },

  init(props) {
    if (props.os && props.os !== 'mac' && props.os !== 'win') throw new Error('fc1-terminal 的 props.os 要是 mac 或 win')
    return { cwd: props.cwd || '~', blocks: [] }
  },

  apply(st, kind, s) {
    const tone = (t: unknown): Tone | null => {
      if (t === undefined) return null
      if (typeof t !== 'string' || !TONES.has(t)) throw new Error('tone 要是 err、ok 或 dim')
      return t as Tone
    }
    switch (kind) {
      case 'type': {
        if (typeof s.type !== 'string' || !s.type.trim()) throw new Error('type 要給指令文字')
        if (s.out !== undefined && typeof s.out !== 'string') throw new Error('out 要是文字')
        const m = /^\s*cd(?:\s+(.*))?$/.exec(s.type)
        const next = m && s.tone !== 'err' ? cdTo(st.cwd, m[1] ?? '~', 'you') : st.cwd
        return { cwd: next, blocks: [...st.blocks, { cmd: s.type, cwd: st.cwd, out: s.out ?? '', tone: tone(s.tone), secret: null, note: null }] }
      }
      case 'print':
        if (typeof s.print !== 'string') throw new Error('print 要給文字')
        return { ...st, blocks: [...st.blocks, { cmd: null, cwd: st.cwd, out: s.print, tone: tone(s.tone), secret: null, note: null }] }
      case 'secret':
        if (typeof s.secret !== 'string' || !s.secret) throw new Error('secret 要給提示文字,例如 "Password:"')
        return { ...st, blocks: [...st.blocks, { cmd: null, cwd: st.cwd, out: '', tone: null, secret: s.secret, note: null }] }
      case 'clear':
        return { ...st, blocks: [] }
      case 'restart':
        return { cwd: '~', blocks: [{ cmd: null, cwd: '~', out: '', tone: 'dim', secret: null, note: '— 新的終端機視窗 —' }] }
    }
    throw new Error(`fc1-terminal 不會「${String(kind)}」`)
  },

  duration(kind, s) {
    if (kind === 'type') return kit.typeDuration(s.type || '', s.cps || 13) + ENTER + outLines(s.out || '').length * LINE + TAIL
    if (kind === 'print') return outLines(s.print || '').length * LINE + TAIL
    if (kind === 'secret') return 2200
    return 600
  },

  autoFocus(): TermTarget {
    return 'screen'
  },

  mount(root, props) {
    const os = props.os === 'win' ? 'win' : 'mac'
    const user = props.user || 'you'
    const home = props.cwd || '~'
    root.classList.add('A-fc1-terminal')
    if (os === 'win') root.classList.add('win')
    if (props.embed) root.classList.add('embed')
    root.innerHTML = `<div class="ft-window"><div class="ft-bar"><span class="ft-dot"></span><span class="ft-dot"></span><span class="ft-dot"></span><span class="ft-title"></span></div><div class="ft-screen"><div class="ft-log"></div></div></div>`
    kit.setIf(root.querySelector<HTMLElement>('.ft-title')!, 'text', props.title || (os === 'win' ? 'PowerShell' : '終端機'))
    const screen = root.querySelector<HTMLElement>('.ft-screen')!
    const log = root.querySelector<HTMLElement>('.ft-log')!

    // cd 的資料夾要用 props.user 算:apply 拿不到 props,所以在畫面上重算一次(apply 用預設 you)。
    const cwdAfter = (blocks: Block[]): string => {
      let c = home
      for (const b of blocks) {
        if (b.note) c = home
        const m = b.cmd && b.tone !== 'err' ? /^\s*cd(?:\s+(.*))?$/.exec(b.cmd) : null
        if (m) c = cdTo(c, m[1] ?? '~', user)
      }
      return c
    }
    const cwdsOf = (blocks: Block[]): string[] => {
      let c = home
      return blocks.map((b) => {
        if (b.note) c = home
        const at = c
        const m = b.cmd && b.tone !== 'err' ? /^\s*cd(?:\s+(.*))?$/.exec(b.cmd) : null
        if (m) c = cdTo(c, m[1] ?? '~', user)
        return at
      })
    }

    const caret = (on: boolean): string => `<span class="ft-caret${on ? '' : ' off'}"></span>`
    const prompt = (cwd: string): string => `<span class="ft-prompt">${kit.esc(promptOf(os, cwd, user))}</span>`

    return {
      render(frame, ms) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && (KINDS as readonly string[]).includes(view.ev.kind) ? view.ev : null
        const blocks = view.ev?.kind === 'hide' ? view.prev.blocks : view.state.blocks
        const cwds = cwdsOf(blocks)
        const last = blocks.length - 1
        let cmdN = 0
        let typingLive = false
        const html = blocks
          .map((b, i) => {
            const live = ev && i === last && (ev.kind === 'type' || ev.kind === 'print' || ev.kind === 'secret')
            const local = live ? ev!.local : Infinity
            const step = (live ? ev!.step : {}) as TermStep
            let lineHtml = ''
            let shownOut = outLines(b.out)
            let afterType = 0
            if (b.note) return `<div class="ft-block"><div class="ft-out dim">${kit.esc(b.note)}</div></div>`
            if (b.cmd !== null) {
              cmdN++
              const tw = kit.typewriter(b.cmd, local, { cps: step.cps || 13 })
              const typing = local < kit.typeDuration(b.cmd, step.cps || 13) + ENTER * 0.5
              if (typing) typingLive = true
              lineHtml = `<div class="ft-line ft-cmd" data-n="${cmdN}">${prompt(cwds[i])} <span class="ft-text">${kit.esc(tw.text)}</span>${typing ? caret(kit.blink(ms)) : ''}</div>`
              afterType = kit.typeDuration(b.cmd, step.cps || 13) + ENTER
            }
            if (b.secret !== null) {
              const done = local >= 1900
              lineHtml = `<div class="ft-line ft-secret"><span class="ft-text">${kit.esc(b.secret)}</span> ${done ? '' : `<span class="ft-key">🔑 你自己輸入(畫面不會顯示)</span>${caret(kit.blink(ms))}`}</div>`
              if (!done) typingLive = true
            }
            if (live) {
              const n = Math.max(0, Math.floor((local - afterType) / LINE) + 1)
              shownOut = local < afterType ? [] : shownOut.slice(0, n)
            }
            const out = shownOut.length ? `<div class="ft-out${b.tone ? ' ' + b.tone : ''}" data-n="${b.cmd !== null ? cmdN : ''}">${shownOut.map((l) => kit.esc(l) || '&nbsp;').join('\n')}</div>` : ''
            return `<div class="ft-block">${lineHtml}${out}</div>`
          })
          .join('')
        const cur = view.ev?.kind === 'hide' ? cwdAfter(view.prev.blocks) : cwdAfter(blocks)
        const tail = typingLive ? '' : `<div class="ft-line ft-now">${prompt(cur)} ${caret(kit.blink(ms))}</div>`
        kit.setIf(log, 'html', html + tail)
      },

      target(name) {
        if (name === 'window') return root.querySelector<HTMLElement>('.ft-window')
        if (name === 'screen') return screen
        if (name === 'prompt') return (log.querySelector<HTMLElement>('.ft-now') ?? [...log.querySelectorAll<HTMLElement>('.ft-line')].pop()) || null
        const m = /^(cmd|out):(\d+|last)$/.exec(name)
        if (!m) return null
        const sel = m[1] === 'cmd' ? '.ft-cmd' : '.ft-out'
        const all = [...log.querySelectorAll<HTMLElement>(sel)]
        if (m[2] === 'last') return all[all.length - 1] ?? null
        if (m[1] === 'cmd') return log.querySelector<HTMLElement>(`.ft-cmd[data-n="${m[2]}"]`)
        return log.querySelector<HTMLElement>(`.ft-out[data-n="${m[2]}"]`)
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
