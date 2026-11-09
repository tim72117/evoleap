// 演員 fc3-table:資料表圖解。幾張資料表並排(表名、欄位、幾列資料),可以新增列、改格子、加欄位、改欄位名稱、
// 刪欄位(資料跟著不見)、複製一份表、畫出關聯線、用查詢挑出符合的列。用來教資料庫、搬移(migration)、SQL 查詢與對帳。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定,只描述起始狀態):
//   title    左上角的標題(選用)
//   tables   資料表(依序由左到右排):[{ "name": "members", "label": "會員", "key": "id", "cols": ["id", "name", "email"], "rows": [[1, "小安", "an@example.com"]] }]
//            label 選用(表名旁的中文說明);key 是主鍵欄位(標 PK)
//   links    一開始就有的關聯:[["orders.member_id", "members.id"]](前者標 FK)
//
// 動作(表名、欄位、列號對不上時載入就報錯並指出第幾步;列號從 1 起算):
//   { "create": "orders", "label": "訂單", "key": "id", "cols": ["id", "member_id", "total"], "rows": [] }   新增一張表(淡入)
//   { "insert": "members", "row": [3, "小林", "lin@example.com"] }   新增一列(滑入、亮一下)
//   { "cell": "members", "row": 2, "col": "email", "value": "new@example.com" }   改一格(閃一下)
//   { "erase": "members", "row": 2 }                         刪一列(變紅淡出)
//   { "addcol": "members", "col": "phone", "fill": "" }       加一個欄位;fill 是每列的值(字串,或和列數一樣多的陣列)
//   { "rename": "members", "from": "name", "to": "nickname" } 欄位改名(資料保留,欄名逐字換掉並亮起)
//   { "dropcol": "members", "col": "name" }                   刪欄位(整欄變紅淡出:資料跟著不見)
//   { "clone": "members", "as": "members_copy", "label": "複本" }   複製整張表(新表從原本的位置滑出)
//   { "discard": "members_copy" }                             拿掉一張表(淡出)
//   { "relate": ["orders.member_id", "members.id"] }          畫出關聯線(逐步畫出)
//   { "where": "orders", "rows": [1, 3], "sql": "SELECT … WHERE …" }
//        查詢:上方出現查詢語句(逐字打出),符合的列亮起、其他列變淡,表名旁顯示「3 筆」。
//        "cols": ["name", "total"] 選用:只亮這幾欄。{ "where": false } 清掉查詢
//   { "stamp": "members_copy", "text": "120 筆 ✓", "tone": "ok" }   表名旁蓋一個章(tone:ok、bad、warn);"text": "" 拿掉
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、sql(查詢語句)、table:<表名>、col:<表名>.<欄位>(欄名那一格)、row:<表名>.<列號>、stamp:<表名>
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type TableKind = 'create' | 'insert' | 'cell' | 'erase' | 'addcol' | 'rename' | 'dropcol' | 'clone' | 'discard' | 'relate' | 'where' | 'stamp'
type Val = string | number
type TableStep = CommonStepFields & {
  create?: string
  label?: string
  key?: string
  cols?: string[]
  rows?: Val[][] | number[]
  insert?: string
  row?: Val[] | number
  cell?: string
  col?: string
  value?: Val
  erase?: string
  addcol?: string
  fill?: Val | Val[]
  rename?: string
  from?: string
  to?: string
  dropcol?: string
  clone?: string
  as?: string
  discard?: string
  relate?: [string, string]
  where?: string | false
  sql?: string
  stamp?: string
  text?: string
  tone?: 'ok' | 'bad' | 'warn'
}
interface Tbl {
  name: string
  label?: string
  key?: string
  cols: string[]
  rows: Val[][]
  stamp?: { text: string; tone: string }
}
interface TableProps {
  title?: string
  tables?: { name: string; label?: string; key?: string; cols: string[]; rows?: Val[][] }[]
  links?: [string, string][]
}
interface TableState {
  tables: Tbl[]
  links: [string, string][]
  query: { table: string; rows: number[]; cols?: string[]; sql: string } | null
}
type TableTarget = 'window' | 'sql' | `table:${string}` | `col:${string}` | `row:${string}` | `stamp:${string}`

const KINDS: readonly TableKind[] = ['create', 'insert', 'cell', 'erase', 'addcol', 'rename', 'dropcol', 'clone', 'discard', 'relate', 'where', 'stamp']
const SQL_CPS = 30

type Ev = { kind: string; step: TableStep; local: number; dur: number; p: number }

function find(st: TableState, name: unknown, what: string): Tbl {
  const t = st.tables.find((x) => x.name === name)
  if (!t) throw new Error(`${what}:找不到資料表「${String(name)}」(有:${st.tables.map((x) => x.name).join('、')})`)
  return t
}
function colIn(t: Tbl, col: unknown, what: string): number {
  const i = t.cols.indexOf(col as string)
  if (i < 0) throw new Error(`${what}:資料表「${t.name}」沒有欄位「${String(col)}」(有:${t.cols.join('、')})`)
  return i
}
function rowIn(t: Tbl, row: unknown, what: string): number {
  if (typeof row !== 'number' || row < 1 || row > t.rows.length || !Number.isInteger(row)) throw new Error(`${what}:資料表「${t.name}」沒有第 ${String(row)} 列(共 ${t.rows.length} 列)`)
  return row - 1
}
const swap = (st: TableState, t: Tbl): TableState => ({ ...st, tables: st.tables.map((x) => (x.name === t.name ? t : x)) })
function checkRef(st: TableState, ref: string, what: string): void {
  const [tn, col] = ref.split('.')
  colIn(find(st, tn, what), col, what)
}

const actor = defineActor<TableKind, TableStep, TableProps, TableState, TableTarget>({
  name: 'fc3-table',
  kinds: KINDS,
  parts: { title: '.tb-title' },

  init(props) {
    const tables: Tbl[] = (props.tables ?? []).map((t) => {
      if (!t || typeof t.name !== 'string' || !Array.isArray(t.cols)) throw new Error('fc3-table 的每張表要有 name 和 cols')
      const rows = (t.rows ?? []).map((r) => {
        if (r.length !== t.cols.length) throw new Error(`fc3-table 的資料表「${t.name}」每列要有 ${t.cols.length} 格`)
        return [...r]
      })
      return { name: t.name, label: t.label, key: t.key, cols: [...t.cols], rows }
    })
    const st: TableState = { tables, links: [], query: null }
    for (const l of props.links ?? []) {
      checkRef(st, l[0], 'links')
      checkRef(st, l[1], 'links')
      st.links.push([l[0], l[1]])
    }
    return st
  },

  apply(st, kind, s) {
    switch (kind) {
      case 'create': {
        if (typeof s.create !== 'string' || !Array.isArray(s.cols)) throw new Error('create 要寫表名與 cols')
        if (st.tables.some((t) => t.name === s.create)) throw new Error(`create:資料表「${s.create}」已經存在`)
        const rows = ((s.rows ?? []) as Val[][]).map((r) => [...r])
        return { ...st, tables: [...st.tables, { name: s.create, label: s.label, key: s.key, cols: [...s.cols], rows }] }
      }
      case 'insert': {
        const t = find(st, s.insert, 'insert')
        if (!Array.isArray(s.row) || s.row.length !== t.cols.length) throw new Error(`insert:「${t.name}」的一列要有 ${t.cols.length} 格`)
        return swap(st, { ...t, rows: [...t.rows, [...s.row]] })
      }
      case 'cell': {
        const t = find(st, s.cell, 'cell')
        const r = rowIn(t, s.row, 'cell')
        const c = colIn(t, s.col, 'cell')
        if (s.value === undefined) throw new Error('cell 要寫 value')
        return swap(st, { ...t, rows: t.rows.map((row, i) => (i === r ? row.map((v, j) => (j === c ? s.value! : v)) : row)) })
      }
      case 'erase': {
        const t = find(st, s.erase, 'erase')
        const r = rowIn(t, s.row, 'erase')
        return { ...swap(st, { ...t, rows: t.rows.filter((_, i) => i !== r) }), query: st.query?.table === t.name ? null : st.query }
      }
      case 'addcol': {
        const t = find(st, s.addcol, 'addcol')
        if (typeof s.col !== 'string' || !s.col) throw new Error('addcol 要寫 col')
        if (t.cols.includes(s.col)) throw new Error(`addcol:「${t.name}」已經有欄位「${s.col}」`)
        const fill = s.fill ?? ''
        if (Array.isArray(fill) && fill.length !== t.rows.length) throw new Error(`addcol:fill 要有 ${t.rows.length} 個值`)
        return swap(st, { ...t, cols: [...t.cols, s.col], rows: t.rows.map((r, i) => [...r, Array.isArray(fill) ? fill[i] : fill]) })
      }
      case 'rename': {
        const t = find(st, s.rename, 'rename')
        const c = colIn(t, s.from, 'rename')
        if (typeof s.to !== 'string' || !s.to) throw new Error('rename 要寫 to')
        const ref = (x: string): string => (x === `${t.name}.${s.from}` ? `${t.name}.${s.to}` : x)
        return { ...swap(st, { ...t, key: t.key === s.from ? s.to : t.key, cols: t.cols.map((x, i) => (i === c ? s.to! : x)) }), links: st.links.map(([a, b]) => [ref(a), ref(b)] as [string, string]) }
      }
      case 'dropcol': {
        const t = find(st, s.dropcol, 'dropcol')
        const c = colIn(t, s.col, 'dropcol')
        const gone = `${t.name}.${s.col}`
        return { ...swap(st, { ...t, cols: t.cols.filter((_, i) => i !== c), rows: t.rows.map((r) => r.filter((_, i) => i !== c)) }), links: st.links.filter(([a, b]) => a !== gone && b !== gone) }
      }
      case 'clone': {
        const t = find(st, s.clone, 'clone')
        if (typeof s.as !== 'string' || !s.as) throw new Error('clone 要寫 as(新表名)')
        if (st.tables.some((x) => x.name === s.as)) throw new Error(`clone:資料表「${s.as}」已經存在`)
        const i = st.tables.indexOf(t)
        const copy: Tbl = { name: s.as, label: s.label ?? t.label, key: t.key, cols: [...t.cols], rows: t.rows.map((r) => [...r]) }
        return { ...st, tables: [...st.tables.slice(0, i + 1), copy, ...st.tables.slice(i + 1)] }
      }
      case 'discard': {
        const t = find(st, s.discard, 'discard')
        return { ...st, tables: st.tables.filter((x) => x !== t), links: st.links.filter(([a, b]) => !a.startsWith(t.name + '.') && !b.startsWith(t.name + '.')), query: st.query?.table === t.name ? null : st.query }
      }
      case 'relate': {
        if (!Array.isArray(s.relate) || s.relate.length !== 2) throw new Error('relate 要寫 ["表.欄位", "表.欄位"]')
        checkRef(st, s.relate[0], 'relate')
        checkRef(st, s.relate[1], 'relate')
        return { ...st, links: [...st.links, [s.relate[0], s.relate[1]]] }
      }
      case 'where': {
        if (s.where === false) return { ...st, query: null }
        const t = find(st, s.where, 'where')
        const rows = (s.rows ?? []) as number[]
        for (const r of rows) rowIn(t, r, 'where')
        for (const c of s.cols ?? []) colIn(t, c, 'where')
        return { ...st, query: { table: t.name, rows: [...rows], cols: s.cols ? [...s.cols] : undefined, sql: s.sql ?? '' } }
      }
      case 'stamp': {
        const t = find(st, s.stamp, 'stamp')
        return swap(st, { ...t, stamp: s.text ? { text: s.text, tone: s.tone ?? 'ok' } : undefined })
      }
    }
    return st
  },

  duration(kind, step) {
    if (kind === 'where') return step.where === false ? 500 : 600 + kit.typeDuration(step.sql ?? '', SQL_CPS) + 900
    if (kind === 'rename') return 1600
    if (kind === 'relate') return 1100
    if (kind === 'clone') return 1300
    if (kind === 'dropcol' || kind === 'erase') return 1300
    return 1000
  },

  mount(root, props) {
    root.classList.add('A-fc3-table')
    root.innerHTML =
      `<div class="tb-board">${props.title ? `<div class="tb-title">${kit.esc(props.title)}</div>` : ''}` +
      `<div class="tb-sql"><span class="tb-sql-k">SQL</span><code></code></div>` +
      `<div class="tb-wrap"><svg class="tb-links"></svg><div class="tb-tables"></div></div></div>`
    const $ = <E extends Element>(s: string): E => root.querySelector<E>(s)!
    const sqlEl = $<HTMLElement>('.tb-sql')
    const code = $<HTMLElement>('.tb-sql code')
    const wrap = $<HTMLElement>('.tb-wrap')
    const svg = $<SVGSVGElement>('.tb-links')
    const box = $<HTMLElement>('.tb-tables')

    const fks = (st: TableState): Set<string> => new Set(st.links.map((l) => l[0]))
    const tableHtml = (t: Tbl, st: TableState, renameTo: { col: number; text: string } | null): string => {
      const fk = fks(st)
      const q = st.query?.table === t.name ? st.query : null
      const head = t.cols
        .map((c, i) => {
          const name = renameTo && renameTo.col === i ? renameTo.text : c
          const tag = t.key === c ? '<i class="pk">PK</i>' : fk.has(`${t.name}.${c}`) ? '<i class="fk">FK</i>' : ''
          return `<div class="th" data-c="${i}" data-col="${kit.esc(c)}">${tag}<span>${kit.esc(name)}</span></div>`
        })
        .join('')
      const body = t.rows
        .map((r, ri) => `<div class="tr" data-r="${ri + 1}">${r.map((v, ci) => `<div class="td" data-c="${ci}">${kit.esc(String(v))}</div>`).join('')}</div>`)
        .join('')
      return (
        `<div class="tb" data-name="${kit.esc(t.name)}" style="--n:${t.cols.length}">` +
        `<div class="tb-h"><b>${kit.esc(t.name)}</b>${t.label ? `<span class="lb">${kit.esc(t.label)}</span>` : ''}` +
        (q ? `<span class="cnt">${q.rows.length} 筆</span>` : '') +
        (t.stamp ? `<span class="stamp" data-tone="${t.stamp.tone}">${kit.esc(t.stamp.text)}</span>` : '') +
        `</div><div class="grid"><div class="tr head">${head}</div>${body || '<div class="tr empty"><div class="td">(還沒有資料)</div></div>'}</div></div>`
      )
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = (view.ev && KINDS.includes(view.ev.kind as TableKind) ? view.ev : null) as Ev | null
        const hiding = view.ev?.kind === 'hide'
        const leaving = ev && ['erase', 'dropcol', 'discard'].includes(ev.kind)
        const st = hiding || leaving ? view.prev : view.state
        // 改名進行中:欄名逐字換成新名字
        let renameTo: { table: string; col: number; text: string } | null = null
        if (ev?.kind === 'rename') {
          const t = view.prev.tables.find((x) => x.name === ev.step.rename)!
          const c = t.cols.indexOf(ev.step.from!)
          const p = kit.progress(ev.local, 300, 900)
          const from = ev.step.from!
          const to = ev.step.to!
          const gFrom = kit.graphemes(from)
          const gTo = kit.graphemes(to)
          const text = p < 0.5 ? gFrom.slice(0, Math.round(gFrom.length * (1 - p * 2))).join('') : gTo.slice(0, Math.round(gTo.length * (p - 0.5) * 2)).join('')
          renameTo = { table: t.name, col: c, text: text || ' ' }
        }
        kit.setIf(box, 'html', st.tables.map((t) => tableHtml(t, st, renameTo && renameTo.table === t.name ? renameTo : null)).join(''))

        const tblEl = (name: string): HTMLElement | undefined => ([...box.children] as HTMLElement[]).find((el) => el.dataset.name === name)
        // 先全部還原
        for (const el of [...box.querySelectorAll<HTMLElement>('.tb, .tr, .th, .td')]) kit.css(el, { opacity: '1', transform: 'none', background: '', color: '' })

        if (ev) {
          const k = ev.kind
          const s = ev.step
          const t = (name: unknown) => tblEl(name as string)
          if (k === 'create' || k === 'clone') {
            const el = t(k === 'create' ? s.create : s.as)
            if (el) {
              const p = kit.ease.outCubic(kit.progress(ev.local, 0, k === 'clone' ? 900 : 600))
              const dx = k === 'clone' ? (1 - p) * -60 : 0
              kit.css(el, { opacity: p.toFixed(3), transform: `translate(${dx.toFixed(1)}%, ${((1 - p) * (k === 'clone' ? 0 : 30)).toFixed(1)}px)` })
            }
          }
          if (k === 'insert') {
            const el = t(s.insert)
            const rows = el ? [...el.querySelectorAll<HTMLElement>('.tr:not(.head)')] : []
            const last = rows[rows.length - 1]
            if (last) {
              const p = kit.ease.outCubic(kit.progress(ev.local, 0, 500))
              kit.css(last, { opacity: p.toFixed(3), transform: `translateY(${((1 - p) * -20).toFixed(1)}px)`, background: `rgba(250, 204, 21, ${(0.45 * (1 - kit.progress(ev.local, 500, 500))).toFixed(3)})` })
            }
          }
          if (k === 'cell') {
            const el = t(s.cell)
            const tb = view.state.tables.find((x) => x.name === s.cell)!
            const td = el?.querySelector<HTMLElement>(`.tr[data-r="${s.row}"] .td[data-c="${tb.cols.indexOf(s.col!)}"]`)
            if (td) kit.css(td, { background: `rgba(250, 204, 21, ${(0.6 * Math.sin(Math.PI * kit.progress(ev.local, 0, 1000))).toFixed(3)})` })
          }
          if (k === 'erase') {
            const tr = t(s.erase)?.querySelector<HTMLElement>(`.tr[data-r="${s.row}"]`)
            if (tr) kit.css(tr, { background: 'rgba(248, 113, 113, 0.35)', opacity: (1 - kit.progress(ev.local, 500, 700)).toFixed(3) })
          }
          if (k === 'addcol') {
            const el = t(s.addcol)
            const tb = view.state.tables.find((x) => x.name === s.addcol)!
            const c = tb.cols.length - 1
            const p = kit.progress(ev.local, 0, 600)
            for (const cell of el ? [...el.querySelectorAll<HTMLElement>(`[data-c="${c}"]`)] : []) kit.css(cell, { opacity: p.toFixed(3), background: `rgba(134, 239, 172, ${(0.5 * (1 - kit.progress(ev.local, 600, 400))).toFixed(3)})` })
          }
          if (k === 'rename') {
            const el = t(s.rename)
            const th = el?.querySelector<HTMLElement>(`.th[data-c="${renameTo?.col}"]`)
            if (th) kit.css(th, { background: `rgba(250, 204, 21, ${(0.6 * Math.sin(Math.PI * kit.progress(ev.local, 0, 1600))).toFixed(3)})` })
          }
          if (k === 'dropcol') {
            const el = t(s.dropcol)
            const tb = view.prev.tables.find((x) => x.name === s.dropcol)!
            const c = tb.cols.indexOf(s.col!)
            const op = 1 - kit.progress(ev.local, 600, 600)
            for (const cell of el ? [...el.querySelectorAll<HTMLElement>(`[data-c="${c}"]`)] : []) kit.css(cell, { background: 'rgba(248, 113, 113, 0.45)', color: '#7f1d1d', opacity: op.toFixed(3) })
          }
          if (k === 'discard') {
            const el = t(s.discard)
            if (el) kit.css(el, { opacity: (1 - kit.progress(ev.local, 200, 900)).toFixed(3), transform: `scale(${kit.lerp(1, 0.9, kit.progress(ev.local, 200, 900)).toFixed(3)})` })
          }
          if (k === 'stamp') {
            const sp = t(s.stamp)?.querySelector<HTMLElement>('.stamp')
            if (sp) {
              const p = kit.progress(ev.local, 0, 500)
              kit.css(sp, { opacity: p.toFixed(3), transform: `scale(${kit.lerp(1.8, 1, kit.ease.outBack(p)).toFixed(3)}) rotate(-6deg)` })
            }
          }
        }

        // 查詢:符合的列亮起、其他列變淡
        const q = st.query
        const qp = ev?.kind === 'where' && ev.step.where !== false ? kit.progress(ev.local, 600 + kit.typeDuration(ev.step.sql ?? '', SQL_CPS), 500) : 1
        if (q) {
          const el = tblEl(q.table)
          const tb = st.tables.find((x) => x.name === q.table)!
          const colIdx = q.cols ? q.cols.map((c) => tb.cols.indexOf(c)) : null
          for (const tr of el ? [...el.querySelectorAll<HTMLElement>('.tr:not(.head)')] : []) {
            const hit = q.rows.includes(Number(tr.dataset.r))
            kit.css(tr, { opacity: hit ? '1' : kit.lerp(1, 0.25, qp).toFixed(3) })
            for (const td of [...tr.querySelectorAll<HTMLElement>('.td')]) {
              const on = hit && (!colIdx || colIdx.includes(Number(td.dataset.c)))
              kit.css(td, { background: on ? `rgba(96, 165, 250, ${(0.28 * qp).toFixed(3)})` : '' })
            }
          }
          const cnt = el?.querySelector<HTMLElement>('.cnt')
          if (cnt) kit.css(cnt, { opacity: qp.toFixed(3) })
        }
        const sql = q?.sql ?? (ev?.kind === 'where' && ev.step.where === false ? view.prev.query?.sql ?? '' : '')
        const typed = ev?.kind === 'where' && ev.step.where !== false ? kit.typewriter(sql, ev.local, { start: 300, cps: SQL_CPS }).text : sql
        kit.setIf(code, 'text', typed)
        const sqlOp = !sql ? 0 : ev?.kind === 'where' && ev.step.where === false ? 1 - kit.progress(ev.local, 0, 400) : ev?.kind === 'where' && !view.prev.query ? kit.progress(ev.local, 0, 300) : 1
        kit.css(sqlEl, { opacity: sqlOp.toFixed(3), visibility: sqlOp > 0 ? 'visible' : 'hidden' })

        // 關聯線(量欄名格子的位置,畫在表格後面)
        const W = wrap.clientWidth || 1
        const H = wrap.clientHeight || 1
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
        const at = (ref: string): { l: number; r: number; y: number } | null => {
          const [tn, col] = ref.split('.')
          const th = tblEl(tn)?.querySelector<HTMLElement>(`.th[data-col="${CSS.escape(col)}"]`)
          if (!th) return null
          const rc = kit.rectIn(th, wrap)
          return { l: rc.x, r: rc.x + rc.w, y: rc.y + rc.h / 2 }
        }
        const paths = st.links
          .map(([a, b], i) => {
            const A = at(a)
            const B = at(b)
            if (!A || !B) return ''
            const [x1, x2] = A.r <= B.l ? [A.r, B.l] : A.l >= B.r ? [A.l, B.r] : [A.r, B.r]
            const bend = Math.max(60, Math.abs(x2 - x1) * 0.4) * (x2 >= x1 ? 1 : -1)
            const d = A.l < B.r && A.r > B.l ? `M ${x1} ${A.y} C ${x1 + 80} ${A.y}, ${x2 + 80} ${B.y}, ${x2} ${B.y}` : `M ${x1} ${A.y} C ${x1 + bend} ${A.y}, ${x2 - bend} ${B.y}, ${x2} ${B.y}`
            return `<path data-i="${i}" d="${d}" pathLength="1"/><circle cx="${x2}" cy="${B.y}" r="7"/>`
          })
          .join('')
        kit.setIf(svg as unknown as HTMLElement, 'html', paths)
        if (ev?.kind === 'relate') {
          const i = st.links.length - 1
          const p = kit.ease.outCubic(kit.progress(ev.local, 0, 900))
          const path = svg.querySelector<SVGPathElement>(`path[data-i="${i}"]`)
          if (path) kit.css(path, { strokeDasharray: '1', strokeDashoffset: (1 - p).toFixed(3) })
        } else for (const path of [...svg.querySelectorAll<SVGPathElement>('path')]) kit.css(path, { strokeDasharray: '1', strokeDashoffset: '0' })
      },

      target(name) {
        if (name === 'window') return root.querySelector<HTMLElement>('.tb-board')
        if (name === 'sql') return sqlEl
        const m = /^(table|col|row|stamp):([^.]+)(?:\.(.+))?$/.exec(name)
        if (!m) return null
        const el = ([...box.children] as HTMLElement[]).find((x) => x.dataset.name === m[2])
        if (!el) return null
        if (m[1] === 'table') return el
        if (m[1] === 'stamp') return el.querySelector<HTMLElement>('.stamp')
        if (m[1] === 'col') return el.querySelector<HTMLElement>(`.th[data-col="${CSS.escape(m[3] ?? '')}"]`)
        return el.querySelector<HTMLElement>(`.tr[data-r="${m[3]}"]`)
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
