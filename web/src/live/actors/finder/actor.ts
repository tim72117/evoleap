// 演員 finder:仿 macOS Finder 的小視窗,用來讓學員「親眼看到」檔案被建立、改名、移動、刪除。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定,只描述起始狀態):
//   tree    目錄樹。鍵是名稱;值是物件 = 資料夾,字串 = 檔案(內容目前不顯示)。
//           例:{ "文件": { "工作報告.docx": "", "旅行照片": {} } }
//   open    一開始打開的資料夾,用 "/" 分隔,相對 tree 的最上層;省略 = 最上層
//   title   選用:固定的視窗標題;省略時標題列顯示目前資料夾的名稱
//
// 動作(路徑都相對「目前打開的資料夾」,可以寫 a/b,".." 是上一層):
//   { "open": "practice" }                進入資料夾(內容淡入,標題換成新資料夾名稱)
//   { "mkdir": "notes" }                     新增資料夾(淡入並以螢光筆劃過)
//   { "create": "hello.txt" }                新增檔案(同上)
//   { "delete": "hello.txt" }                刪除檔案或資料夾(淡出)
//   { "rename": ["舊名", "新名"] }            改名(名稱變換並以螢光筆劃過)。
//       新名稱不含 "/" 時留在原本的資料夾;含 "/" 時相對目前資料夾解讀,等於移動,
//       例如 ["drafts/idea.txt", "notes/homepage-idea.txt"]
//   { "select": "idea.txt" }                 (滑鼠)點選目前資料夾裡的一個項目,反白
//   { "drag": "notes" }                      (滑鼠)把選取的項目拖到目前資料夾裡的某個資料夾上(要先 select)
//   { "drop": true }                         放開:真的移進去,目標資料夾短暫反白(要先 drag)
//   { "highlight": "hello.txt" }             只用螢光筆標出某個項目,不改目錄;false 取消標示
//   最近一次新增/改名(或 highlight)的項目會一直保持螢光筆標示,直到下一個改變目錄或 highlight 的動作。
//   舞台的 show / hide 也可以順便帶一個動作,例如 { "show": "finder", "create": "hello.txt" }。
//   操作對不上目前的狀態(名稱已存在、項目不存在、open 一個檔案…)時載入就報錯,並指出第幾步。
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、file:<名稱>(也可寫 item:<名稱>;名稱可以是目前資料夾裡的名稱或相對路徑)
import { kit } from '../../kit'
import { defineActor, type ActorEvent, type ActorView, type CommonStepFields, type CursorPlan } from '../../types'
import './actor.css'

// ---------- 型別 ----------

/** 目錄樹:鍵是名稱;值是物件 = 資料夾,字串 = 檔案 */
export interface FinderTree {
  [name: string]: FinderTree | string
}
type TreeNode = FinderTree | string

export interface FinderProps {
  tree?: FinderTree
  open?: string
  title?: string
}

/** 滑鼠操作中暫存的狀態(選取、拖曳),離開那個動作序列就清掉 */
interface Temp {
  selected?: string
  dragTo?: string
}
/** 這一步改了什麼,給過場動畫用 */
interface Fx {
  to?: string
  from?: string
  into?: string
}
/** 有狀態的演員:每一步前後的狀態(純資料,不含 DOM) */
export interface FinderState {
  tree: FinderTree
  cwd: string
  temp: Temp
  /** 最近一次新增/改名/highlight 的項目(保持螢光筆標示) */
  last: string | null
  fx: Fx | null
}

const KINDS = ['open', 'mkdir', 'create', 'delete', 'rename', 'select', 'drag', 'drop', 'highlight'] as const
type FinderKind = (typeof KINDS)[number]
/** 腳本 steps 裡的動作 */
export type FinderStep = CommonStepFields &
  (
    | { open: string }
    | { mkdir: string }
    | { create: string }
    | { delete: string }
    | { rename: [from: string, to: string] }
    | { select: string }
    | { drag: string }
    | { drop: true }
    | { highlight: string | false | null }
  )
type StepOf<K extends FinderKind> = Extract<FinderStep, Record<K, unknown>>

type FinderTarget = 'window' | `file:${string}` | `item:${string}`

// ---------- 路徑與目錄樹(全部是純函式,不改原本的物件) ----------

const isDir = (n: unknown): n is FinderTree => n !== null && typeof n === 'object'
const segs = (p: string): string[] => (p ? p.split('/') : [])
const baseOf = (p: string): string => segs(p).at(-1) || ''
const parentOf = (p: string): string => segs(p).slice(0, -1).join('/')
const inside = (p: string, dir: string): boolean => p === dir || p.startsWith(dir + '/') // p 是 dir 本身或在 dir 裡面
const show = (p: string): string => `「${p || '最上層'}」` // 訊息裡的資料夾名稱

function resolve(cwd: string, rel: unknown, what: string): string {
  if (typeof rel !== 'string' || !rel.trim()) throw new Error(`${what}要給名稱或路徑(字串)`)
  const out = rel.startsWith('/') ? [] : segs(cwd)
  for (const s of rel.split('/')) {
    if (!s || s === '.') continue
    if (s === '..') {
      if (!out.length) throw new Error(`${what}:「${rel}」超出了最上層資料夾`)
      out.pop()
    } else out.push(s)
  }
  return out.join('/')
}
function nodeAt(tree: FinderTree, path: string): TreeNode | undefined {
  let n: TreeNode = tree
  for (const s of segs(path)) {
    if (!isDir(n) || !Object.prototype.hasOwnProperty.call(n, s)) return undefined
    n = n[s]
  }
  return n
}
// 沿路複製:回傳新的樹;value 為 undefined 表示刪除
function setAt(tree: FinderTree, path: string, value: TreeNode | undefined): FinderTree {
  const ss = segs(path)
  const rec = (n: FinderTree, i: number): FinderTree => {
    const copy = { ...n }
    if (i === ss.length - 1) {
      if (value === undefined) delete copy[ss[i]]
      else copy[ss[i]] = value
    } else copy[ss[i]] = rec(n[ss[i]] as FinderTree, i + 1)
    return copy
  }
  return rec(tree, 0)
}
const mustExist = (st: FinderState, path: string, rel: string, what: string): TreeNode => {
  const n = nodeAt(st.tree, path)
  if (n === undefined) throw new Error(`${what}:找不到「${rel}」(目前在${show(st.cwd)})`)
  return n
}
const mustBeFree = (st: FinderState, path: string, rel: string, what: string): void => {
  const parent = nodeAt(st.tree, parentOf(path))
  if (!isDir(parent)) throw new Error(`${what}:資料夾${show(parentOf(path))}不存在`)
  if (nodeAt(st.tree, path) !== undefined) throw new Error(`${what}:${show(parentOf(path))}裡已經有「${baseOf(path)}」了`)
  if (!baseOf(path)) throw new Error(`${what}:「${rel}」不是有效的名稱`)
}
const mustNotHoldCwd = (st: FinderState, path: string, what: string): void => {
  if (inside(st.cwd, path)) throw new Error(`${what}:不能動到目前打開的資料夾${show(path)}(先 open 到別的地方)`)
}
// 只能點選/拖到「目前資料夾裡看得到的項目」
const mustBeVisible = (st: FinderState, path: string, rel: string, what: string): void => {
  mustExist(st, path, rel, what)
  if (parentOf(path) !== st.cwd || !path) throw new Error(`${what}:「${rel}」不在目前打開的資料夾${show(st.cwd)}裡,畫面上看不到`)
}

interface Entry {
  name: string
  path: string
  dir: boolean
}
// 目前資料夾的內容:資料夾在前,依名稱排序
const coll = new Intl.Collator('zh-Hant', { numeric: true })
function listOf(tree: FinderTree, cwd: string): Entry[] {
  const n = nodeAt(tree, cwd)
  if (!isDir(n)) return []
  return Object.keys(n)
    .map((name) => ({ name, path: cwd ? `${cwd}/${name}` : name, dir: isDir(n[name]) }))
    .sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : coll.compare(a.name, b.name)))
}

// ---------- 時間表(毫秒,相對動作開始) ----------
const T = {
  open: 650,
  mkdir: 1100,
  create: 1100,
  delete: 700,
  rename: 1300,
  highlight: 900,
  select: 1000,
  selectAt: 700, // 滑鼠 150 出發、700 到達並點下
  drag: 1700,
  dragGo: 850,
  dragMove: 550, // 先移到項目上,850 起拖向目標
  drop: 1000,
} as const
const durationOf = (kind: FinderKind): number => (T as Record<string, number>)[kind] ?? 600
const kindOf = (ev: ActorEvent): FinderKind | null =>
  (KINDS as readonly string[]).includes(ev.kind) ? (ev.kind as FinderKind) : (KINDS.find((k) => k in ev.step) ?? null)

// ---------- 一格畫面要畫的東西(不碰 DOM) ----------
type RowState = 'same' | 'new' | 'gone' | 'renamed'
interface Row extends Entry {
  st: RowState
  /** 改名前的名稱(renamed 才有) */
  old?: string
}
interface Scene {
  state: FinderState
  prev: FinderState
  ev: ActorEvent | null
  k: FinderKind | null
  local: number
  rows: Row[]
  body: Record<string, string> | null
  cwd: string
  flash?: string
}

const actor = defineActor<FinderKind, FinderStep, FinderProps, FinderState, FinderTarget>({
  name: 'finder',
  kinds: KINDS,

  init(props) {
    const tree = props.tree ?? {}
    if (!isDir(tree)) throw new Error('finder 的 props.tree 要是物件(鍵是名稱,值是物件=資料夾、字串=檔案)')
    const check = (n: FinderTree, at: string): void => {
      for (const [k, v] of Object.entries(n)) {
        if (k.includes('/')) throw new Error(`finder 的 props.tree:名稱「${k}」不能含 "/"(用巢狀物件表示資料夾)`)
        if (isDir(v)) check(v, `${at}${k}/`)
        else if (typeof v !== 'string') throw new Error(`finder 的 props.tree:「${at}${k}」要是物件(資料夾)或字串(檔案)`)
      }
    }
    check(tree, '')
    const cwd = props.open ? resolve('', props.open, 'props.open') : ''
    if (!isDir(nodeAt(tree, cwd))) throw new Error(`finder 的 props.open:找不到資料夾「${props.open}」`)
    return { tree, cwd, temp: {}, last: null, fx: null }
  },

  // 純函式:回傳新狀態。fx 記下「這一步改了什麼」,給過場動畫用。
  apply(st, kind, s) {
    const v = (s as Record<FinderKind, unknown>)[kind]
    const at = (rel: unknown, what: string): string => resolve(st.cwd, rel, what)
    switch (kind) {
      case 'open': {
        const p = at(v, 'open')
        const n = mustExist(st, p, v as string, 'open')
        if (!isDir(n)) throw new Error(`open:「${v}」是檔案,不是資料夾`)
        return { ...st, cwd: p, temp: {}, fx: null }
      }
      case 'mkdir':
      case 'create': {
        const p = at(v, kind)
        mustBeFree(st, p, v as string, kind)
        return { ...st, tree: setAt(st.tree, p, kind === 'mkdir' ? {} : ''), temp: {}, last: p, fx: { to: p } }
      }
      case 'delete': {
        const p = at(v, 'delete')
        mustExist(st, p, v as string, 'delete')
        mustNotHoldCwd(st, p, 'delete')
        return { ...st, tree: setAt(st.tree, p, undefined), temp: {}, last: null, fx: { from: p } }
      }
      case 'rename': {
        if (!Array.isArray(v) || v.length !== 2) throw new Error(`rename 要寫成 ["舊名稱", "新名稱"]`)
        const [a, b] = v as [string, unknown]
        const from = at(a, 'rename 的舊名稱')
        const n = mustExist(st, from, a, 'rename')
        mustNotHoldCwd(st, from, 'rename')
        if (typeof b !== 'string' || !b.trim()) throw new Error('rename 的新名稱要是字串')
        // 新名稱不含路徑:留在原本的資料夾;含路徑:相對目前資料夾,等於移動
        const to = b.includes('/') ? at(b, 'rename 的新名稱') : parentOf(from) ? `${parentOf(from)}/${b}` : b
        if (to === from) throw new Error(`rename:新舊名稱一樣(「${a}」)`)
        if (isDir(n) && inside(to, from)) throw new Error(`rename:不能把資料夾「${a}」移到它自己裡面`)
        mustBeFree(st, to, b, 'rename')
        const tree = setAt(setAt(st.tree, from, undefined), to, n)
        return { ...st, tree, temp: {}, last: to, fx: { from, to } }
      }
      case 'select': {
        const p = at(v, 'select')
        mustBeVisible(st, p, v as string, 'select')
        return { ...st, temp: { selected: p }, fx: null }
      }
      case 'drag': {
        const sel = st.temp.selected
        if (!sel) throw new Error('drag 之前要先 select 一個項目')
        const p = at(v, 'drag')
        mustBeVisible(st, p, v as string, 'drag')
        if (!isDir(nodeAt(st.tree, p))) throw new Error(`drag:「${v}」是檔案,只能拖到資料夾上`)
        if (p === sel) throw new Error(`drag:不能把「${v}」拖到它自己上面`)
        if (nodeAt(st.tree, `${p}/${baseOf(sel)}`) !== undefined) throw new Error(`drag:「${v}」裡已經有「${baseOf(sel)}」了`)
        return { ...st, temp: { ...st.temp, dragTo: p }, fx: null }
      }
      case 'drop': {
        const { selected: sel, dragTo } = st.temp
        if (!sel || !dragTo) throw new Error('drop 之前要先 select 再 drag')
        const to = `${dragTo}/${baseOf(sel)}`
        const tree = setAt(setAt(st.tree, sel, undefined), to, nodeAt(st.tree, sel))
        return { ...st, tree, temp: {}, last: null, fx: { from: sel, to, into: dragTo } }
      }
      case 'highlight': {
        if (v === false || v === null) return { ...st, last: null, fx: null }
        const p = at(v, 'highlight')
        mustExist(st, p, v as string, 'highlight')
        return { ...st, last: p, fx: null }
      }
    }
    throw new Error(`finder 不會「${kind}」`)
  },

  duration(kind) {
    return durationOf(kind)
  },
  autoFocus: () => undefined,

  // 虛擬滑鼠:select 移到項目點下;drag 先移到選取的項目,再拖到目標資料夾
  cursor(kind, step, prev): CursorPlan | null {
    if (kind === 'select') return { moves: [{ at: 150, target: `file:${(step as StepOf<'select'>).select}` }], clickAt: T.selectAt }
    if (kind === 'drag' && prev?.temp?.selected) {
      return {
        moves: [
          { at: 150, target: `file:${baseOf(prev.temp.selected)}` },
          { at: T.dragGo, target: `file:${(step as StepOf<'drag'>).drag}` },
        ],
        clickAt: T.dragGo + T.dragMove,
      }
    }
    return null
  },

  mount(root, props) {
    root.classList.add('A-finder')
    root.innerHTML = `<div class="fd-window"><div class="fd-bar"><span class="light red"></span><span class="light yellow"></span><span class="light green"></span><span class="fd-title"></span></div><div class="fd-body"><div class="fd-list"></div><div class="fd-ghost" hidden></div></div></div>`
    const title = root.querySelector<HTMLElement>('.fd-title')!
    const list = root.querySelector<HTMLElement>('.fd-list')!
    const ghost = root.querySelector<HTMLElement>('.fd-ghost')!
    const icon = (dir: boolean | undefined): string => `<span class="fd-ico ${dir ? 'dir' : 'file'}"></span>`
    const rowHtml = (r: Row): string =>
      `<div class="fd-row${r.dir ? ' is-dir' : ''}" data-path="${kit.esc(r.path)}" data-name="${kit.esc(r.name)}" data-st="${r.st}">${icon(r.dir)}<span class="fd-name">${kit.esc(r.name)}</span></div>`
    let shownCwd = ''

    // 依 view 算出這一格要畫的東西(不碰 DOM)
    function scene(view: ActorView<FinderState>): Scene {
      let { state, prev, ev } = view
      let k = ev ? kindOf(ev) : null
      // show/hide 沒帶動作:畫面不變;hide 時舞台清掉了 temp,退場過程中仍畫退場前的樣子
      if (ev && !k) {
        if (ev.kind === 'hide') state = prev
        ev = null
      }
      const local = ev ? ev.local : Infinity
      const sc: Scene = { state, prev, ev, k, local, rows: [], body: null, cwd: state.cwd }

      // open:舊內容淡出,新內容淡入
      if (ev && prev.cwd !== state.cwd) {
        if (local < 220) {
          sc.cwd = prev.cwd
          sc.state = prev
          sc.body = { opacity: (1 - kit.progress(local, 0, 220)).toFixed(3), transform: 'none' }
        } else sc.body = kit.enter(kit.progress(local, 220, 400), { dist: '0.6em' })
        sc.rows = listOf(sc.state.tree, sc.cwd).map((r) => ({ ...r, st: 'same' as const }))
        sc.k = null
        return sc
      }
      const now = listOf(state.tree, state.cwd)
      if (!ev) {
        sc.rows = now.map((r) => ({ ...r, st: 'same' as const }))
        return sc
      }
      // 動作進行中:前後兩份清單合併,標出新出現、消失、改名的項目
      const before = listOf(prev.tree, prev.cwd)
      const had = new Set(before.map((r) => r.path))
      const has = new Set(now.map((r) => r.path))
      const fx: Fx = state.fx || {}
      const renameInPlace = k === 'rename' && !!fx.from && !!fx.to && parentOf(fx.from) === state.cwd && parentOf(fx.to) === state.cwd
      const rows: Row[] = now.map((r) => ({ ...r, st: had.has(r.path) ? 'same' : renameInPlace && r.path === fx.to ? 'renamed' : 'new' }))
      for (const r of before) if (!has.has(r.path) && !(renameInPlace && r.path === fx.from)) rows.push({ ...r, st: 'gone' })
      rows.sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : coll.compare(a.name, b.name)))
      if (renameInPlace && fx.from) {
        const renamed = rows.find((r) => r.path === fx.to)
        if (renamed) renamed.old = baseOf(fx.from)
      }
      sc.rows = rows
      // 改到看不見的子資料夾裡(例如 create notes/a.txt、rename 移進 notes):讓那個資料夾閃一下
      const dest = fx.into || fx.to
      const pre = state.cwd ? `${state.cwd}/` : ''
      if (dest && dest.startsWith(pre) && parentOf(dest) !== state.cwd) sc.flash = pre + segs(dest.slice(pre.length))[0]
      return sc
    }

    const rowOf = (path: string, gone = false): HTMLElement | null =>
      ([...list.children] as HTMLElement[]).find((r) => r.dataset.path === path && (gone || r.dataset.st !== 'gone')) || null

    return {
      render(frame, ms) {
        void ms
        const view = frame.view
        if (!view || !view.state) return
        const sc = scene(view)
        const { state, prev, k, local } = sc
        shownCwd = sc.cwd
        kit.setIf(title, 'text', props.title || baseOf(sc.cwd) || 'Finder')
        kit.setIf(list, 'html', sc.rows.length ? sc.rows.map(rowHtml).join('') : `<div class="fd-empty">(空的)</div>`)
        kit.css(list, sc.body || { opacity: '1', transform: 'none' })

        // 拖曳相關:進行中的 drag、拖好還沒放(temp.dragTo)、drop 的前段
        const drag =
          k === 'drag'
            ? { sel: prev.temp.selected, to: state.temp.dragTo, e: kit.ease.inOutCubic(kit.progress(local, T.dragGo, T.dragMove)) }
            : k === 'drop'
              ? { sel: prev.temp.selected, to: prev.temp.dragTo, e: 1 }
              : state.temp.dragTo
                ? { sel: state.temp.selected, to: state.temp.dragTo, e: 1 }
                : null
        const selected = k === 'drop' ? prev.temp.selected : sc.state.temp.selected
        const selWas = k === 'select' ? prev.temp.selected : null

        for (const row of list.querySelectorAll<HTMLElement>('.fd-row')) {
          const path = row.dataset.path
          const st = row.dataset.st
          const nm = row.querySelector<HTMLElement>('.fd-name')!
          const s: Record<string, string> = { opacity: '1', height: '', background: '', color: '' }
          // 出現/消失:高度展開或收起,搭配淡入淡出
          if (st === 'new') {
            s.height = `calc(var(--fd-row) * ${kit.ease.outCubic(kit.progress(local, 0, 250)).toFixed(3)})`
            s.opacity = kit.progress(local, 100, 350).toFixed(3)
          } else if (st === 'gone') {
            const p = kit.progress(local, k === 'drop' ? 150 : 0, 320)
            s.opacity = ((1 - p) * (k === 'drop' ? 0.45 : 1)).toFixed(3)
            s.height = `calc(var(--fd-row) * ${(1 - kit.ease.inOutCubic(kit.progress(local, k === 'drop' ? 350 : 250, 300))).toFixed(3)})`
          }
          // 改名:舊名稱淡出,新名稱逐字出現
          let text = row.dataset.name ?? ''
          let textOp = 1
          if (st === 'renamed') {
            if (local < 350) {
              text = sc.rows.find((r) => r.path === path)?.old ?? text
              textOp = 1 - kit.progress(local, 0, 350)
            } else {
              const n = row.dataset.name ?? ''
              text = kit.typewriter(n, local, { start: 350, cps: Math.max(14, kit.graphemes(n).length / 0.45) }).text
            }
          }
          kit.setIf(nm, 'text', text)
          kit.css(nm, { opacity: textOp.toFixed(3) })

          // 選取反白(select 在滑鼠點下時切換)
          let sel = 0
          if (path === selected) sel = k === 'select' ? kit.progress(local, T.selectAt, 100) : 1
          else if (path === selWas) sel = 1 - kit.progress(local, T.selectAt, 100)
          // 拖曳中:原本的項目變淡;目標資料夾在項目快到時反白
          let hover = 0
          if (drag) {
            if (path === drag.sel && st !== 'gone') s.opacity = kit.lerp(1, 0.45, k === 'drag' ? kit.progress(local, T.dragGo, 200) : 1).toFixed(3)
            if (path === drag.to) hover = k === 'drag' ? kit.progress(local, T.dragGo + T.dragMove - 200, 150) : k === 'drop' ? 1 - kit.progress(local, 200, 150) : 1
          }
          // drop 後(或改動進了這個資料夾)短暫反白
          const flashAt = k === 'drop' && path === prev.temp.dragTo ? 250 : path === sc.flash ? 300 : null
          const flash = flashAt == null ? 0 : Math.sin(Math.PI * kit.progress(local, flashAt, 650))
          const bg = Math.max(sel, hover * 0.35, flash * 0.55)
          s.background = bg > 0 ? `rgba(10, 99, 233, ${(bg * (sel >= bg ? 1 : 0.6)).toFixed(3)})` : 'transparent'
          s.color = sel > 0.5 && sel >= bg ? '#fff' : ''
          row.classList.toggle('on', sel > 0.5)
          kit.css(row, s)

          // 螢光筆:這一步新增/改名/highlight 的項目劃過去;之前的 last 保持標示
          let mk = 0
          if (path === sc.state.last) {
            if (k === 'mkdir' || k === 'create') mk = kit.progress(local, 450, 500)
            else if (k === 'rename') mk = kit.progress(local, 850, 400)
            else if (k === 'highlight') mk = kit.progress(local, 0, 600)
            else mk = 1
          }
          kit.css(nm, kit.marker(mk, 'rgba(217,119,87,0.28)'))
        }

        // 拖著走的項目:從原位置沿路徑移到目標資料夾那一列
        const src = drag?.sel ? rowOf(drag.sel, true) : null
        const dst = drag?.to ? rowOf(drag.to) : null
        if (drag && drag.sel && src && dst && !(k === 'drag' && local < T.dragGo)) {
          ghost.hidden = false
          const r = sc.rows.find((x) => x.path === drag.sel)
          kit.setIf(ghost, 'html', `${icon(r?.dir)}<span class="fd-name">${kit.esc(baseOf(drag.sel))}</span>`)
          // 跟著虛擬滑鼠:舞台把滑鼠放在目標的 (55%, 60%),項目以同樣的緩動從來源列移到目標列
          const at = (row: HTMLElement): [number, number] => [row.offsetLeft + row.offsetWidth * 0.55, row.offsetTop + row.offsetHeight * 0.6]
          const [sx, sy] = at(src)
          const [tx, ty] = at(dst)
          const dx = kit.lerp(0, tx - sx, drag.e)
          const dy = kit.lerp(0, ty - sy, drag.e)
          const out = k === 'drop' ? kit.ease.inCubic(kit.progress(local, 0, 300)) : 0
          const lift = k === 'drag' ? kit.progress(local, T.dragGo, 150) : 1
          kit.css(ghost, {
            left: `${(sx - ghost.offsetWidth * 0.35).toFixed(1)}px`,
            top: `${(sy - ghost.offsetHeight * 0.3).toFixed(1)}px`,
            transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${kit.lerp(1, 0.35, out).toFixed(3)})`,
            opacity: (lift * (1 - out) * 0.92).toFixed(3),
          })
        } else ghost.hidden = true
      },

      target(name, view) {
        if (name === 'window') return root.querySelector<HTMLElement>('.fd-window')
        const m = /^(?:file|item):(.+)$/s.exec(name)
        if (!m) return null
        const cwd = view?.state ? shownCwd : ''
        let path: string | null = null
        try {
          path = resolve(cwd, m[1], '目標')
        } catch {
          /* 名稱不合法就找不到 */
        }
        const rows = [...list.querySelectorAll<HTMLElement>('.fd-row')]
        const pick = (st: (s: string | undefined) => boolean) => rows.find((r) => (r.dataset.path === path || r.dataset.name === m[1]) && st(r.dataset.st))
        return pick((st) => st !== 'gone') || pick(() => true) || null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入:舞台、外殼、演員是掛上去就一直在跑的物件,不是 React 元件,
// 交給 LivePlayer 熱更新的話它的 effect 不會重跑,畫面仍是舊程式建出來的舊物件,看起來像沒有熱重載。
// 必須直接寫 import.meta.hot.accept(Vite 靠這段文字判斷模組會自己處理更新,包成函式它就認不得)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
