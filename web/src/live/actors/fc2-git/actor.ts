// 演員 fc2-git:Git 的示意圖(全環節課程單元 6–7 用)。上半部是三個區域:工作區(正在改的檔案)、暫存區(準備存進這一次的)、
// 儲存庫(存好的紀錄);下半部是 commit 的線圖:每個點是一次 commit,一條橫線是一個分支,HEAD 標出「現在在哪裡」。
// 檔案在三個區域之間移動、commit 點冒出、分支岔開再合併、標籤插上去,都是依時間算出來的(README 第 1 節)。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定,只描述起始狀態):
//   commits   一開始已經有的 commit(都在 main 上),由舊到新,例如 ["建立首頁", "加上自我介紹"];預設沒有
//   work      一開始工作區裡有變更的檔案 { 檔名: "M"(修改)| "U"(新檔)| "D"(刪除) };預設沒有
//   ignore    .gitignore 一開始就有的規則,例如 ["node_modules/", ".env", "*.log"];預設沒有
//             規則寫法:完整檔名、以 / 結尾的資料夾(資料夾裡的檔案都算)、*.副檔名
//   view      both(預設,上面三區、下面線圖)| areas(只有三區)| graph(只有線圖)
//
// 動作(依序操作;對不上目前狀態時載入就報錯,並指出第幾步):
//   { "change": "index.html" }        改了一個已經存進版控的檔案:出現在工作區,標「修改」
//   { "create": "about.html" }        新增檔案:出現在工作區,標「新檔」;符合 .gitignore 規則的檔案直接放到「忽略」那一格
//   { "remove": "old.css" }           刪掉一個檔案:出現在工作區,標「刪除」
//   { "add": "index.html" }           git add:檔案從工作區移到暫存區;"add": "." 是全部
//   { "unstage": "index.html" }       從暫存區拿回工作區(git restore --staged)
//   { "commit": "加上自我介紹區塊" }   git commit:暫存區的檔案收成一個 commit 點,接在目前分支的最後(暫存區要有東西)
//   { "restore": "index.html" }       git restore:丟掉工作區裡這個檔案的修改,回到上次 commit 的樣子(新檔不能 restore)
//   { "ignore": ".env" }              在 .gitignore 加一條規則:工作區裡符合的檔案移到「忽略」那一格,.gitignore 本身變成有修改
//   { "revert": "加上自我介紹" }       git revert:新增一個「還原」commit 抵銷那一次(寫 commit 訊息裡的一段字),原本的紀錄還在
//   { "reset": 1 }                    git reset:把目前分支最後 N 個 commit 拿掉(畫成被劃掉的虛線點),紀錄被改寫
//   { "branch": "feature/contact" }   開新分支並切過去(git switch -c),從目前的 commit 岔出去
//   { "switch": "main" }              切換到另一個分支,HEAD 移過去
//   { "pr": "加上聯絡表單" }           從目前分支對 main 開一個 Pull Request(下方出現卡片,標「開啟中」;目前分支不能是 main)
//   { "merge": "feature/contact" }    把那個分支合併進目前分支:多一個合併點;有開啟中的 Pull Request 時標成「已合併」
//   { "tag": "v0.1.0" }               在目前的 commit 插上版本標籤
//   { "view": "graph" }               切換顯示:both、areas、graph
//   舞台的 show / hide 也可以順便帶一個動作。
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、work、stage、repo、ignored(忽略那一格)、graph(線圖)、file:<檔名>(工作區/暫存區/忽略裡的那張卡)、
//   commit:last、commit:<N>(第 N 個,1 起算)、branch:<名稱>、tag:<名稱>、head、pr
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type GitKind = 'change' | 'create' | 'remove' | 'add' | 'unstage' | 'commit' | 'restore' | 'ignore' | 'revert' | 'reset' | 'branch' | 'switch' | 'pr' | 'merge' | 'tag' | 'view'
const KINDS: readonly GitKind[] = ['change', 'create', 'remove', 'add', 'unstage', 'commit', 'restore', 'ignore', 'revert', 'reset', 'branch', 'switch', 'pr', 'merge', 'tag', 'view']
type GitStep = CommonStepFields & {
  change?: string
  create?: string
  remove?: string
  add?: string
  unstage?: string
  commit?: string
  restore?: string
  ignore?: string
  revert?: string
  reset?: number
  branch?: string
  switch?: string
  pr?: string
  merge?: string
  tag?: string
  view?: View
}
type Status = 'M' | 'U' | 'D'
type View = 'both' | 'areas' | 'graph'
interface GitProps {
  commits?: string[]
  work?: Record<string, Status>
  ignore?: string[]
  view?: View
}
interface FileChip {
  name: string
  st: Status
}
interface Commit {
  id: string
  msg: string
  branch: string
  parents: string[]
  gone: boolean
  kind: 'normal' | 'merge' | 'revert'
}
interface Pr {
  title: string
  from: string
  to: string
  state: 'open' | 'merged'
}
interface GitState {
  work: FileChip[]
  stage: FileChip[]
  ignored: string[]
  rules: string[]
  commits: Commit[]
  branches: Record<string, string | null>
  order: string[]
  head: string
  tags: Record<string, string>
  pr: Pr | null
  view: View
}
type GitTarget = 'window' | 'work' | 'stage' | 'repo' | 'ignored' | 'graph' | 'head' | 'pr' | `file:${string}` | `commit:${string}` | `branch:${string}` | `tag:${string}`

const ST_LABEL: Record<Status, string> = { M: '修改', U: '新檔', D: '刪除' }
const DUR: Record<GitKind, number> = {
  change: 900, create: 900, remove: 900, add: 1100, unstage: 1000, commit: 1500, restore: 1200, ignore: 1300,
  revert: 1500, reset: 1600, branch: 1200, switch: 1100, pr: 1300, merge: 1600, tag: 1100, view: 700,
}

/** 依序號產生固定的短雜湊(不用亂數) */
const hashOf = (i: number, msg: string): string => {
  let h = 2166136261 ^ (i * 7919)
  for (const ch of msg) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}
const matches = (rule: string, name: string): boolean => {
  if (rule.endsWith('/')) return name.startsWith(rule) || name === rule.slice(0, -1)
  if (rule.startsWith('*.')) return name.endsWith(rule.slice(1))
  return name === rule || name.endsWith(`/${rule}`)
}
const ignoredBy = (rules: string[], name: string): boolean => rules.some((r) => matches(r, name))
const tipOf = (st: GitState, b: string): Commit | null => {
  const id = st.branches[b]
  return id ? st.commits.find((c) => c.id === id) ?? null : null
}
const newCommit = (st: GitState, msg: string, kind: Commit['kind'], extraParent?: string): Commit => {
  const parent = st.branches[st.head]
  const parents = [parent, extraParent].filter((x): x is string => !!x)
  return { id: hashOf(st.commits.length, msg), msg, branch: st.head, parents, gone: false, kind }
}
const addCommit = (st: GitState, c: Commit): GitState => ({ ...st, commits: [...st.commits, c], branches: { ...st.branches, [st.head]: c.id } })
const putWork = (st: GitState, name: string, s: Status): GitState => {
  if (ignoredBy(st.rules, name)) return st.ignored.includes(name) ? st : { ...st, ignored: [...st.ignored, name] }
  const work = st.work.some((f) => f.name === name) ? st.work.map((f) => (f.name === name ? { name, st: f.st === 'U' ? 'U' : s } : f)) : [...st.work, { name, st: s }]
  return { ...st, work }
}

const actor = defineActor<GitKind, GitStep, GitProps, GitState, GitTarget>({
  name: 'fc2-git',
  kinds: KINDS,

  init(props) {
    const st: GitState = {
      work: [], stage: [], ignored: [], rules: [...(props.ignore ?? [])], commits: [],
      branches: { main: null }, order: ['main'], head: 'main', tags: {}, pr: null, view: props.view ?? 'both',
    }
    if (!['both', 'areas', 'graph'].includes(st.view)) throw new Error(`fc2-git:view 只能是 both、areas、graph`)
    let s = st
    for (const msg of props.commits ?? []) s = addCommit(s, newCommit(s, msg, 'normal'))
    for (const [name, v] of Object.entries(props.work ?? {})) {
      if (!['M', 'U', 'D'].includes(v)) throw new Error(`fc2-git:work 的「${name}」狀態要是 M、U 或 D`)
      s = putWork(s, name, v)
    }
    return s
  },

  apply(st, kind, s) {
    const v = s[kind]
    const str = (): string => {
      if (typeof v !== 'string' || !v.trim()) throw new Error(`${kind} 要給文字`)
      return v
    }
    switch (kind) {
      case 'change': return putWork(st, str(), 'M')
      case 'create': return putWork(st, str(), 'U')
      case 'remove': return putWork(st, str(), 'D')
      case 'add': {
        const name = str()
        const pick = name === '.' ? st.work : st.work.filter((f) => f.name === name)
        if (!pick.length) throw new Error(name === '.' ? 'add:工作區沒有變更' : `add:工作區沒有「${name}」`)
        const stage = [...st.stage.filter((f) => !pick.some((p) => p.name === f.name)), ...pick]
        return { ...st, work: st.work.filter((f) => !pick.includes(f)), stage }
      }
      case 'unstage': {
        const name = str()
        const f = st.stage.find((x) => x.name === name)
        if (!f) throw new Error(`unstage:暫存區沒有「${name}」`)
        return { ...st, stage: st.stage.filter((x) => x !== f), work: [...st.work.filter((x) => x.name !== name), f] }
      }
      case 'commit': {
        if (!st.stage.length) throw new Error('commit:暫存區是空的,先 add')
        return { ...addCommit(st, newCommit(st, str(), 'normal')), stage: [] }
      }
      case 'restore': {
        const name = str()
        const f = st.work.find((x) => x.name === name)
        if (!f) throw new Error(`restore:工作區沒有「${name}」的修改`)
        if (f.st === 'U') throw new Error(`restore:「${name}」是新檔,restore 救不回(還沒存進版控)`)
        return { ...st, work: st.work.filter((x) => x !== f) }
      }
      case 'ignore': {
        const rule = str()
        if (st.rules.includes(rule)) throw new Error(`ignore:.gitignore 已經有「${rule}」`)
        const rules = [...st.rules, rule]
        const moved = st.work.filter((f) => f.st === 'U' && matches(rule, f.name)).map((f) => f.name)
        const next: GitState = { ...st, rules, work: st.work.filter((f) => !moved.includes(f.name)), ignored: [...st.ignored, ...moved] }
        return putWork(next, '.gitignore', 'M')
      }
      case 'revert': {
        const key = str()
        const target = [...st.commits].reverse().find((c) => !c.gone && c.msg.includes(key))
        if (!target) throw new Error(`revert:找不到訊息含「${key}」的 commit`)
        return addCommit(st, newCommit(st, `還原「${target.msg}」`, 'revert'))
      }
      case 'reset': {
        const n = typeof v === 'number' ? v : NaN
        if (!Number.isInteger(n) || n < 1) throw new Error('reset 要給 1 以上的整數(拿掉幾個 commit)')
        let tip = tipOf(st, st.head)
        const drop: string[] = []
        for (let i = 0; i < n; i++) {
          if (!tip) throw new Error(`reset:目前分支沒有 ${n} 個 commit`)
          drop.push(tip.id)
          const pid: string | undefined = tip.parents[0]
          tip = pid ? st.commits.find((c) => c.id === pid) ?? null : null
        }
        return { ...st, commits: st.commits.map((c) => (drop.includes(c.id) ? { ...c, gone: true } : c)), branches: { ...st.branches, [st.head]: tip?.id ?? null } }
      }
      case 'branch': {
        const name = str()
        if (name in st.branches) throw new Error(`branch:已經有「${name}」這個分支`)
        return { ...st, branches: { ...st.branches, [name]: st.branches[st.head] }, order: [...st.order, name], head: name }
      }
      case 'switch': {
        const name = str()
        if (!(name in st.branches)) throw new Error(`switch:沒有「${name}」這個分支`)
        if (st.work.length || st.stage.length) throw new Error('switch:工作區或暫存區還有變更,先 commit 再切換')
        return { ...st, head: name }
      }
      case 'pr': {
        if (st.head === 'main') throw new Error('pr:目前在 main,先開分支')
        if (!tipOf(st, st.head) || st.branches[st.head] === st.branches.main) throw new Error('pr:這個分支還沒有新的 commit')
        return { ...st, pr: { title: str(), from: st.head, to: 'main', state: 'open' } }
      }
      case 'merge': {
        const name = str()
        if (!(name in st.branches)) throw new Error(`merge:沒有「${name}」這個分支`)
        if (name === st.head) throw new Error('merge:不能合併自己')
        const other = st.branches[name]
        if (!other) throw new Error(`merge:「${name}」沒有 commit`)
        const merged = addCommit(st, newCommit(st, `合併 ${name}`, 'merge', other))
        const pr = st.pr && st.pr.from === name && st.pr.to === st.head ? { ...st.pr, state: 'merged' as const } : st.pr
        return { ...merged, pr }
      }
      case 'tag': {
        const name = str()
        if (name in st.tags) throw new Error(`tag:已經有「${name}」這個標籤`)
        const id = st.branches[st.head]
        if (!id) throw new Error('tag:目前分支沒有 commit')
        return { ...st, tags: { ...st.tags, [name]: id } }
      }
      case 'view': {
        if (!['both', 'areas', 'graph'].includes(String(v))) throw new Error('view 只能是 both、areas、graph')
        return { ...st, view: v as View }
      }
    }
    return st
  },

  duration(kind) {
    return DUR[kind]
  },

  autoFocus() {
    return false
  },

  mount(root) {
    root.classList.add('A-fc2-git')
    root.innerHTML = `
      <div class="gt-frame">
        <div class="gt-areas">
          <div class="gt-box gt-work" data-box="work"><div class="gt-h"><b>工作區</b><span>正在改的檔案</span></div><div class="gt-list"></div>
            <div class="gt-ign"><div class="gt-ign-h">被 .gitignore 忽略</div><div class="gt-ign-list"></div></div></div>
          <div class="gt-arrow">git add →</div>
          <div class="gt-box gt-stage" data-box="stage"><div class="gt-h"><b>暫存區</b><span>這次要存的</span></div><div class="gt-list"></div></div>
          <div class="gt-arrow">git commit →</div>
          <div class="gt-box gt-repo" data-box="repo"><div class="gt-h"><b>儲存庫</b><span>存好的紀錄</span></div><div class="gt-list"></div></div>
        </div>
        <div class="gt-graph">
          <div class="gt-lanes"><svg class="gt-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div class="gt-nodes"></div></div>
          <div class="gt-pr"></div>
        </div>
      </div>`
    const frame = root.querySelector<HTMLElement>('.gt-frame')!
    const areas = root.querySelector<HTMLElement>('.gt-areas')!
    const graph = root.querySelector<HTMLElement>('.gt-graph')!
    const workList = root.querySelector<HTMLElement>('.gt-work .gt-list')!
    const stageList = root.querySelector<HTMLElement>('.gt-stage .gt-list')!
    const repoList = root.querySelector<HTMLElement>('.gt-repo .gt-list')!
    const ign = root.querySelector<HTMLElement>('.gt-ign')!
    const ignList = root.querySelector<HTMLElement>('.gt-ign-list')!
    const lines = root.querySelector<SVGElement>('.gt-lines')!
    const nodes = root.querySelector<HTMLElement>('.gt-nodes')!
    const prBox = root.querySelector<HTMLElement>('.gt-pr')!

    type Row = { name: string; st: Status | 'I'; mode: 'in' | 'out' | 'stay' }
    const union = (a: { name: string; st: Status }[], b: { name: string; st: Status }[]): Row[] => {
      const rows: Row[] = a.map((f) => ({ name: f.name, st: b.find((x) => x.name === f.name)?.st ?? f.st, mode: b.some((x) => x.name === f.name) ? 'stay' : 'out' }))
      for (const f of b) if (!a.some((x) => x.name === f.name)) rows.push({ name: f.name, st: f.st, mode: 'in' })
      return rows
    }
    const chip = (r: Row): string =>
      `<div class="gt-chip st-${r.st}" data-file="${kit.esc(r.name)}" data-mode="${r.mode}"><span class="gt-name">${kit.esc(r.name)}</span><span class="gt-st">${r.st === 'I' ? '忽略' : ST_LABEL[r.st]}</span></div>`

    // 線圖的座標(百分比)
    const layout = (st: GitState) => {
      const rowOf: Record<string, number> = {}
      st.order.forEach((b, i) => (rowOf[b] = i))
      const rows = Math.max(1, st.order.length)
      const cols = Math.max(8, st.commits.length)
      const pos: Record<string, { x: number; y: number }> = {}
      const ys = rows === 1 ? [42] : rows === 2 ? [28, 66] : st.order.map((_, i) => 20 + (i * 56) / (rows - 1))
      st.commits.forEach((c, i) => (pos[c.id] = { x: ((i + 0.5) / cols) * 100, y: ys[rowOf[c.branch]] ?? 42 }))
      const branchAt = (b: string): { x: number; y: number } => {
        const id = st.branches[b]
        if (id && pos[id]) return pos[id]
        return { x: 3, y: ys[rowOf[b]] ?? 42 }
      }
      return { pos, branchAt, ys, rowOf }
    }

    return {
      render(fr) {
        const view = fr.view
        if (!view) return
        const ev = view.ev && (KINDS as readonly string[]).includes(view.ev.kind) ? view.ev : null
        const kind = ev?.kind as GitKind | undefined
        const p = ev ? ev.p : 1
        const st = view.ev?.kind === 'hide' ? view.prev : view.state
        const pv = ev ? view.prev : st

        // ---------- 版面 ----------
        frame.dataset.view = st.view
        if (kind === 'view') {
          const a = kit.ease.inOutCubic(p)
          const showA = (vw: View) => (vw === 'graph' ? 0 : 1)
          const showG = (vw: View) => (vw === 'areas' ? 0 : 1)
          kit.css(areas, { opacity: kit.lerp(showA(pv.view), showA(st.view), a).toFixed(3) })
          kit.css(graph, { opacity: kit.lerp(showG(pv.view), showG(st.view), a).toFixed(3) })
        } else {
          kit.css(areas, { opacity: '1' })
          kit.css(graph, { opacity: '1' })
        }

        // ---------- 三個區域 ----------
        const workRows = union(pv.work, st.work)
        const stageRows = union(pv.stage, st.stage)
        const ignRows: Row[] = [...pv.ignored.map((n) => ({ name: n, st: 'I' as const, mode: 'stay' as const })), ...st.ignored.filter((n) => !pv.ignored.includes(n)).map((n) => ({ name: n, st: 'I' as const, mode: 'in' as const }))]
        kit.setIf(workList, 'html', workRows.map(chip).join('') || '<div class="gt-empty">沒有變更</div>')
        kit.setIf(stageList, 'html', stageRows.map(chip).join('') || '<div class="gt-empty">空的</div>')
        kit.setIf(ignList, 'html', ignRows.map(chip).join(''))
        kit.css(ign, { display: ignRows.length ? 'block' : 'none' })
        const live = (s: GitState): Commit[] => {
          const out: Commit[] = []
          let c = tipOf(s, s.head)
          while (c && out.length < 4) {
            out.push(c)
            const pid: string | undefined = c.parents[0]
            c = pid ? s.commits.find((x) => x.id === pid) ?? null : null
          }
          return out
        }
        const repoNow = live(st)
        const repoPrev = live(pv)
        kit.setIf(repoList, 'html', repoNow.length ? repoNow.map((c) => `<div class="gt-rc k-${c.kind}" data-id="${c.id}" data-new="${repoPrev.some((x) => x.id === c.id) ? 0 : 1}"><code>${c.id}</code><span>${kit.esc(c.msg)}</span></div>`).join('') : '<div class="gt-empty">還沒有 commit</div>')

        const animChips = (list: HTMLElement, dx: number) => {
          for (const el of list.querySelectorAll<HTMLElement>('.gt-chip')) {
            const m = el.dataset.mode
            if (m === 'in') {
              const q = kit.ease.outCubic(kit.progress(p, 0.25, 0.75))
              kit.css(el, { opacity: q.toFixed(3), transform: `translateX(${((1 - q) * dx).toFixed(2)}em) scale(${kit.lerp(0.85, 1, q).toFixed(3)})` })
            } else if (m === 'out') {
              const q = kit.ease.inCubic(kit.progress(p, 0, 0.6))
              const restoring = kind === 'restore'
              kit.css(el, { opacity: (1 - q).toFixed(3), transform: restoring ? `rotate(${(-q * 8).toFixed(1)}deg) scale(${(1 - q * 0.3).toFixed(3)})` : `translateX(${(q * 3).toFixed(2)}em)` })
            } else kit.css(el, { opacity: '1', transform: 'none' })
          }
        }
        animChips(workList, kind === 'unstage' ? 3 : -2)
        animChips(stageList, -3)
        animChips(ignList, -2)
        if (kind === 'commit') {
          // 暫存區的卡片收進儲存庫
          for (const el of stageList.querySelectorAll<HTMLElement>('.gt-chip')) {
            const q = kit.ease.inCubic(kit.progress(p, 0, 0.55))
            kit.css(el, { opacity: (1 - q).toFixed(3), transform: `translateX(${(q * 6).toFixed(2)}em) scale(${(1 - q * 0.5).toFixed(3)})` })
          }
        }
        for (const el of repoList.querySelectorAll<HTMLElement>('.gt-rc')) {
          const q = el.dataset.new === '1' && ev ? kit.ease.outBack(kit.progress(p, 0.4, 0.6)) : 1
          kit.css(el, { opacity: kit.clamp(q).toFixed(3), transform: `scale(${kit.lerp(0.7, 1, q).toFixed(3)})` })
        }
        for (const [box, on] of [
          ['work', kind === 'change' || kind === 'create' || kind === 'remove' || kind === 'restore' || kind === 'ignore' || kind === 'unstage'],
          ['stage', kind === 'add'],
          ['repo', kind === 'commit' || kind === 'revert' || kind === 'reset'],
        ] as const) {
          const el = root.querySelector<HTMLElement>(`[data-box="${box}"]`)!
          kit.css(el, { boxShadow: on ? `0 0 0 ${(Math.sin(Math.PI * p) * 6).toFixed(2)}px rgba(59,130,246,0.35)` : 'none' })
        }

        // ---------- 線圖 ----------
        const L = layout(st)
        const Lp = layout(pv)
        const lerpPos = (a: { x: number; y: number }, b: { x: number; y: number }, q: number) => ({ x: kit.lerp(a.x, b.x, q), y: kit.lerp(a.y, b.y, q) })
        const move = kit.ease.inOutCubic(kit.progress(p, 0.2, 0.8))
        const isNew = (c: Commit) => !!ev && !pv.commits.some((x) => x.id === c.id)
        const newGone = (c: Commit) => !!ev && c.gone && !pv.commits.find((x) => x.id === c.id)?.gone
        const grow = kit.ease.outBack(kit.progress(p, 0.35, 0.65))

        // 線
        let svg = ''
        for (const c of st.commits) {
          const b = L.pos[c.id]
          c.parents.forEach((pid) => {
            const a = L.pos[pid]
            if (!a) return
            const q = isNew(c) ? kit.progress(p, 0.2, 0.5) : 1
            const end = lerpPos(a, b, q)
            const d = a.y === b.y ? `M${a.x},${a.y} L${end.x},${end.y}` : `M${a.x},${a.y} C${(a.x + end.x) / 2},${a.y} ${(a.x + end.x) / 2},${end.y} ${end.x},${end.y}`
            svg += `<path class="gt-ln${c.gone ? ' gone' : ''}${c.kind === 'merge' && pid !== c.parents[0] ? ' mg' : ''}" d="${d}"/>`
          })
        }
        // 分支的起點線(還沒有 commit 的 main)
        kit.setIf(lines, 'html', svg)

        // 點與標籤
        let html = ''
        st.commits.forEach((c, i) => {
          const o = L.pos[c.id]
          const q = isNew(c) ? grow : 1
          const g = newGone(c) ? kit.progress(p, 0, 0.6) : c.gone ? 1 : 0
          html += `<div class="gt-dot k-${c.kind}${g > 0.5 ? ' gone' : ''}" data-i="${i + 1}" data-id="${c.id}" style="left:${o.x}%;top:${o.y}%;transform:translate(-50%,-50%) scale(${kit.clamp(q, 0, 1.3).toFixed(3)});opacity:${kit.clamp(q).toFixed(3)}"></div>`
          html += `<div class="gt-msg${g > 0.5 ? ' gone' : ''}" style="left:${o.x}%;top:${o.y}%;opacity:${kit.clamp(q).toFixed(3)}"><span>${kit.esc(c.msg)}</span><code>${c.id}</code></div>`
          if (g > 0 && g < 1) html += `<div class="gt-strike" style="left:${o.x}%;top:${o.y}%;width:${(g * 5).toFixed(2)}em"></div>`
        })
        // 分支名稱(疊在 tip 上方),HEAD 標在目前分支
        const stackAt: Record<string, number> = {}
        for (const b of st.order) {
          const now = L.branchAt(b)
          const before = b in pv.branches ? Lp.branchAt(b) : now
          const o = lerpPos(before, now, move)
          const key = `${Math.round(now.x)}:${Math.round(now.y)}`
          const k = (stackAt[key] = (stackAt[key] ?? 0) + 1) - 1
          const born = ev && !(b in pv.branches) ? kit.ease.outBack(kit.progress(p, 0, 0.6)) : 1
          const headHere = st.head === b
          html += `<div class="gt-br${headHere ? ' head' : ''}${b === 'main' ? ' main' : ''}" data-branch="${kit.esc(b)}" style="left:${o.x}%;top:${o.y}%;transform:translate(-50%, calc(-100% - ${(1.1 + k * 1.6).toFixed(2)}em)) scale(${kit.clamp(born, 0, 1.2).toFixed(3)})">${headHere ? '<i>HEAD →</i>' : ''}${kit.esc(b)}</div>`
        }
        // 標籤
        for (const [t, id] of Object.entries(st.tags)) {
          const o = L.pos[id]
          if (!o) continue
          const born = ev && !(t in pv.tags) ? kit.ease.outBack(kit.progress(p, 0.1, 0.6)) : 1
          html += `<div class="gt-tag" data-tag="${kit.esc(t)}" style="left:${o.x}%;top:${o.y}%;transform:translate(-50%, 4.6em) rotate(${((1 - kit.clamp(born)) * -20).toFixed(1)}deg) scale(${kit.clamp(born, 0, 1.2).toFixed(3)})">標籤 ${kit.esc(t)}</div>`
        }
        kit.setIf(nodes, 'html', html)

        // Pull Request 卡片
        const pr = st.pr
        if (pr) {
          const born = ev && !pv.pr ? kit.ease.outCubic(kit.progress(p, 0, 0.7)) : 1
          const mergedNow = pr.state === 'merged' && pv.pr?.state !== 'merged' && !!ev
          const label = pr.state === 'merged' && (!mergedNow || p > 0.6) ? '已合併' : '開啟中'
          kit.setIf(prBox, 'html', `<div class="gt-pr-card s-${label === '已合併' ? 'merged' : 'open'}"><span class="gt-pr-k">Pull Request</span><b>${kit.esc(pr.title)}</b><span class="gt-pr-flow">${kit.esc(pr.from)} → ${kit.esc(pr.to)}</span><span class="gt-pr-s">${label}</span></div>`)
          kit.css(prBox, { display: 'block', opacity: born.toFixed(3), transform: `translateY(${((1 - born) * 1.5).toFixed(2)}em)` })
        } else {
          kit.setIf(prBox, 'html', '')
          kit.css(prBox, { display: 'none' })
        }
      },

      target(name) {
        if (name === 'window') return frame
        if (name === 'work' || name === 'stage' || name === 'repo') return root.querySelector<HTMLElement>(`[data-box="${name}"]`)
        if (name === 'ignored') return ign
        if (name === 'graph') return graph
        if (name === 'pr') return prBox.querySelector<HTMLElement>('.gt-pr-card')
        if (name === 'head') return nodes.querySelector<HTMLElement>('.gt-br.head')
        const m = /^(file|commit|branch|tag):(.+)$/.exec(name)
        if (!m) return null
        const v = m[2]
        if (m[1] === 'file') return [...root.querySelectorAll<HTMLElement>('.gt-chip')].find((el) => el.dataset.file === v && el.dataset.mode !== 'out') ?? null
        if (m[1] === 'branch') return [...nodes.querySelectorAll<HTMLElement>('.gt-br')].find((el) => el.dataset.branch === v) ?? null
        if (m[1] === 'tag') return [...nodes.querySelectorAll<HTMLElement>('.gt-tag')].find((el) => el.dataset.tag === v) ?? null
        const dots = [...nodes.querySelectorAll<HTMLElement>('.gt-dot')]
        return (v === 'last' ? dots[dots.length - 1] : dots[Number(v) - 1]) ?? null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
