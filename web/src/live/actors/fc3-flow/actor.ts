// 演員 fc3-flow:流程圖解。幾個節點(瀏覽器、伺服器、資料庫、第三方服務…)之間有線,
// 一則訊息(請求、回應、金鑰、事件)沿著線從一個節點跑到另一個,抵達後在線旁留下標籤;可選的右側紀錄欄逐筆列出。
// 用來畫「資料怎麼在系統之間跑」:HTTP 請求與回應、登入流程、OAuth 轉址、金流的 webhook…
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定,只描述起始狀態):
//   title   左上角的標題(選用)
//   nodes   節點:{ "<id>": { "label": "瀏覽器", "sub": "你的電腦", "icon": "browser", "x": 15, "y": 50 } }
//           x、y 是節點中心在畫面裡的位置(百分比,0–100;有紀錄欄時節點放在 x ≤ 68 的範圍)
//           icon:browser、server、db、phone、cloud、key、lock、user、file、card、mail、bank、id、shield、gear、
//                bell、chart、robot、store、receipt、globe、code、google(通用的「G」圓形標誌,不是商標)
//   links   一開始就畫好的線:[["browser", "server"], …]
//   log     有寫(例如 "請求紀錄")就在右側顯示紀錄欄,每次 send 多一列
//
// 動作(依序操作;節點不存在、重複新增時載入就報錯並指出第幾步):
//   { "send": ["browser", "server"], "label": "GET /api/menu", "tone": "req" }
//        一則訊息沿著線從第一個節點跑到第二個(沒有線會自動補一條),抵達後標籤留在線旁(同方向的下一則會取代它)。
//        tone:req(藍,預設)、ok(綠)、bad(紅)、warn(橘)、key(紫,金鑰/憑證)、data(青,資料)
//        "keep": false 抵達後不留標籤;"note": "…" 在紀錄欄那一列多一行說明
//   { "pulse": "server", "text": "查資料中…", "tone": "ok" }
//        節點亮一下(光圈擴散),節點下方的狀態文字換成 text(空字串清掉);tone 改節點外框顏色("none" 恢復)。
//        也可以同時帶 "label"、"sub"、"icon" 換掉節點的名稱、副標、圖示
//   { "spawn": "db", "label": "資料庫", "icon": "db", "x": 80, "y": 50, "sub": "Postgres", "link": "server" }
//        新增節點(彈出);link 選用:同時畫一條線連到那個節點
//   { "vanish": "db" }                    移除節點(淡出),連到它的線與標籤一起拿掉
//   { "wire": ["a", "b"] }                畫一條線(逐步畫出);"dashed": true 畫虛線;"cut": true 剪斷已有的線(變紅後消失)
//   { "tidy": true }                      清掉線旁的標籤與節點的狀態文字(換下一段說明前用)
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、node:<id>、tag:<from>><to>(例如 tag:browser>server,線旁的標籤)、packet(正在跑的訊息;沒在跑時量不到)、
//   log(紀錄欄)、log:last(最後一列)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type FlowKind = 'send' | 'pulse' | 'spawn' | 'vanish' | 'wire' | 'tidy'
type Tone = 'req' | 'ok' | 'bad' | 'warn' | 'key' | 'data' | 'none'
type FlowStep = CommonStepFields & {
  send?: [string, string]
  label?: string
  tone?: Tone
  keep?: boolean
  note?: string
  pulse?: string
  text?: string
  sub?: string
  icon?: string
  spawn?: string
  x?: number
  y?: number
  link?: string
  vanish?: string
  wire?: [string, string]
  dashed?: boolean
  cut?: boolean
  tidy?: boolean
}
interface FlowNode {
  label: string
  sub?: string
  icon?: string
  x: number
  y: number
  text?: string
  tone?: Tone
}
interface FlowProps {
  title?: string
  nodes?: Record<string, FlowNode>
  links?: [string, string][]
  log?: string
}
interface Link {
  a: string
  b: string
  dashed: boolean
}
interface LogRow {
  from: string
  to: string
  label: string
  tone: Tone
  note?: string
}
interface FlowState {
  nodes: Record<string, FlowNode>
  order: string[]
  links: Link[]
  tags: Record<string, { label: string; tone: Tone }>
  log: LogRow[]
}
type FlowTarget = 'window' | 'packet' | 'log' | 'log:last' | `node:${string}` | `tag:${string}`

const KINDS: readonly FlowKind[] = ['send', 'pulse', 'spawn', 'vanish', 'wire', 'tidy']
const TONES: readonly Tone[] = ['req', 'ok', 'bad', 'warn', 'key', 'data', 'none']

const ICONS: Record<string, string> = {
  browser: '<rect x="5" y="9" width="38" height="30" rx="4"/><path d="M5 17h38"/><circle cx="10" cy="13" r="1.2"/><circle cx="14.5" cy="13" r="1.2"/>',
  server: '<rect x="9" y="6" width="30" height="14" rx="3"/><rect x="9" y="26" width="30" height="14" rx="3"/><path d="M15 13h2M15 33h2M27 13h6M27 33h6"/>',
  db: '<ellipse cx="24" cy="11" rx="14" ry="5"/><path d="M10 11v26c0 2.8 6.3 5 14 5s14-2.2 14-5V11"/><path d="M10 20c0 2.8 6.3 5 14 5s14-2.2 14-5M10 29c0 2.8 6.3 5 14 5s14-2.2 14-5"/>',
  phone: '<rect x="14" y="5" width="20" height="38" rx="4"/><path d="M21 37h6"/>',
  cloud: '<path d="M14 36h21a8 8 0 0 0 0-16 11 11 0 0 0-21-2 9 9 0 0 0 0 18z"/>',
  key: '<circle cx="16" cy="24" r="8"/><path d="M24 24h18M36 24v6M41 24v5"/>',
  lock: '<rect x="11" y="21" width="26" height="20" rx="3"/><path d="M16 21v-6a8 8 0 0 1 16 0v6"/><path d="M24 29v5"/>',
  user: '<circle cx="24" cy="16" r="8"/><path d="M8 42c2-9 9-13 16-13s14 4 16 13"/>',
  file: '<path d="M12 5h17l9 9v29H12z"/><path d="M29 5v9h9M17 24h14M17 31h14"/>',
  card: '<rect x="5" y="11" width="38" height="26" rx="4"/><path d="M5 19h38M11 30h8"/>',
  mail: '<rect x="6" y="11" width="36" height="26" rx="3"/><path d="M6 13l18 13 18-13"/>',
  bank: '<path d="M6 18L24 7l18 11z"/><path d="M10 20v15M19 20v15M29 20v15M38 20v15M6 39h36"/>',
  id: '<rect x="5" y="10" width="38" height="28" rx="4"/><circle cx="17" cy="22" r="5"/><path d="M10 33c1-4 4-6 7-6s6 2 7 6M28 19h10M28 26h8"/>',
  shield: '<path d="M24 5l16 6v11c0 10-7 17-16 21C15 39 8 32 8 22V11z"/><path d="M17 24l5 5 9-10"/>',
  gear: '<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>',
  bell: '<path d="M12 34V22a12 12 0 0 1 24 0v12l3 4H9z"/><path d="M20 41a4 4 0 0 0 8 0"/>',
  chart: '<path d="M7 41h34"/><rect x="11" y="25" width="6" height="14"/><rect x="21" y="15" width="6" height="24"/><rect x="31" y="20" width="6" height="19"/>',
  robot: '<rect x="9" y="15" width="30" height="22" rx="5"/><circle cx="18" cy="26" r="3"/><circle cx="30" cy="26" r="3"/><path d="M24 8v7M5 24v6M43 24v6"/>',
  store: '<path d="M7 18l4-10h26l4 10z"/><path d="M9 18v22h30V18M20 40V29h8v11"/>',
  receipt: '<path d="M11 5h26v38l-4-3-4 3-5-3-5 3-4-3-4 3z"/><path d="M17 15h14M17 22h14M17 29h9"/>',
  globe: '<circle cx="24" cy="24" r="17"/><path d="M7 24h34M24 7c-6 6-6 28 0 34M24 7c6 6 6 28 0 34"/>',
  code: '<rect x="5" y="9" width="38" height="30" rx="4"/><path d="M12 19l6 5-6 5M22 30h12"/>',
  google: '<circle cx="24" cy="24" r="17"/><path d="M33 22H24v5h5a6 6 0 1 1-2-7" stroke-width="3.4"/>',
}

type Ev = { kind: string; step: FlowStep; local: number; dur: number; p: number }

const tagKey = (a: string, b: string): string => `${a}>${b}`
const hasLink = (links: Link[], a: string, b: string): boolean => links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))
const toneOf = (t: unknown, dflt: Tone): Tone => {
  if (t === undefined) return dflt
  if (!TONES.includes(t as Tone)) throw new Error(`tone 只能是 ${TONES.join('、')}(收到「${String(t)}」)`)
  return t as Tone
}

const actor = defineActor<FlowKind, FlowStep, FlowProps, FlowState, FlowTarget>({
  name: 'fc3-flow',
  kinds: KINDS,
  parts: { title: '.fl-title', log: '.fl-log' },

  init(props) {
    const nodes: Record<string, FlowNode> = {}
    for (const [id, n] of Object.entries(props.nodes ?? {})) {
      if (!n || typeof n.label !== 'string') throw new Error(`fc3-flow 的節點「${id}」要有 label`)
      if (typeof n.x !== 'number' || typeof n.y !== 'number') throw new Error(`fc3-flow 的節點「${id}」要有 x、y(百分比)`)
      if (n.icon && !ICONS[n.icon]) throw new Error(`fc3-flow 沒有圖示「${n.icon}」(有:${Object.keys(ICONS).join('、')})`)
      nodes[id] = { ...n }
    }
    const links: Link[] = []
    for (const [a, b] of props.links ?? []) {
      if (!nodes[a] || !nodes[b]) throw new Error(`fc3-flow 的 links 指向不存在的節點「${nodes[a] ? b : a}」`)
      links.push({ a, b, dashed: false })
    }
    return { nodes, order: Object.keys(nodes), links, tags: {}, log: [] }
  },

  apply(st, kind, s) {
    const need = (id: unknown, what: string): string => {
      if (typeof id !== 'string' || !st.nodes[id]) throw new Error(`${what}:找不到節點「${String(id)}」(有:${st.order.join('、')})`)
      return id
    }
    switch (kind) {
      case 'send': {
        if (!Array.isArray(s.send) || s.send.length !== 2) throw new Error('send 要寫 ["起點", "終點"]')
        const a = need(s.send[0], 'send')
        const b = need(s.send[1], 'send')
        if (a === b) throw new Error(`send:起點和終點不能是同一個節點「${a}」(要標示節點自己的變化用 pulse)`)
        const tone = toneOf(s.tone, 'req')
        const label = s.label ?? ''
        const links = hasLink(st.links, a, b) ? st.links : [...st.links, { a, b, dashed: false }]
        const tags = { ...st.tags }
        if (s.keep !== false && label) tags[tagKey(a, b)] = { label, tone }
        const log = [...st.log, { from: a, to: b, label, tone, ...(s.note ? { note: s.note } : {}) }]
        return { ...st, links, tags, log }
      }
      case 'pulse': {
        const id = need(s.pulse, 'pulse')
        if (s.icon && !ICONS[s.icon]) throw new Error(`pulse:沒有圖示「${s.icon}」`)
        const n = { ...st.nodes[id] }
        if (s.text !== undefined) n.text = s.text
        if (s.tone !== undefined) n.tone = toneOf(s.tone, 'none')
        if (s.label !== undefined) n.label = s.label
        if (s.sub !== undefined) n.sub = s.sub
        if (s.icon !== undefined) n.icon = s.icon
        return { ...st, nodes: { ...st.nodes, [id]: n } }
      }
      case 'spawn': {
        const id = s.spawn
        if (typeof id !== 'string' || !id) throw new Error('spawn 要寫節點代號')
        if (st.nodes[id]) throw new Error(`spawn:節點「${id}」已經存在`)
        if (typeof s.label !== 'string' || typeof s.x !== 'number' || typeof s.y !== 'number') throw new Error(`spawn「${id}」要有 label、x、y`)
        if (s.icon && !ICONS[s.icon]) throw new Error(`spawn:沒有圖示「${s.icon}」`)
        const n: FlowNode = { label: s.label, x: s.x, y: s.y, ...(s.sub ? { sub: s.sub } : {}), ...(s.icon ? { icon: s.icon } : {}), ...(s.tone ? { tone: toneOf(s.tone, 'none') } : {}) }
        const nodes = { ...st.nodes, [id]: n }
        let links = st.links
        if (s.link !== undefined) {
          need(s.link, 'spawn 的 link')
          links = [...links, { a: s.link, b: id, dashed: false }]
        }
        return { ...st, nodes, order: [...st.order, id], links }
      }
      case 'vanish': {
        const id = need(s.vanish, 'vanish')
        const nodes = { ...st.nodes }
        delete nodes[id]
        const tags = Object.fromEntries(Object.entries(st.tags).filter(([k]) => !k.split('>').includes(id)))
        return { ...st, nodes, order: st.order.filter((x) => x !== id), links: st.links.filter((l) => l.a !== id && l.b !== id), tags }
      }
      case 'wire': {
        if (!Array.isArray(s.wire) || s.wire.length !== 2) throw new Error('wire 要寫 ["a", "b"]')
        const a = need(s.wire[0], 'wire')
        const b = need(s.wire[1], 'wire')
        if (s.cut) {
          if (!hasLink(st.links, a, b)) throw new Error(`wire cut:「${a}」和「${b}」之間沒有線`)
          const tags = { ...st.tags }
          delete tags[tagKey(a, b)]
          delete tags[tagKey(b, a)]
          return { ...st, links: st.links.filter((l) => !((l.a === a && l.b === b) || (l.a === b && l.b === a))), tags }
        }
        if (hasLink(st.links, a, b)) throw new Error(`wire:「${a}」和「${b}」之間已經有線`)
        return { ...st, links: [...st.links, { a, b, dashed: !!s.dashed }] }
      }
      case 'tidy': {
        const nodes = Object.fromEntries(Object.entries(st.nodes).map(([k, n]) => [k, { ...n, text: undefined }]))
        return { ...st, nodes, tags: {} }
      }
    }
    return st
  },

  duration(kind, step) {
    if (kind === 'send') return 1900
    if (kind === 'pulse') return 1300
    if (kind === 'spawn') return 900
    if (kind === 'vanish') return 700
    if (kind === 'wire') return step.cut ? 1100 : 900
    return 500
  },

  mount(root, props) {
    root.classList.add('A-fc3-flow')
    root.innerHTML =
      `<div class="fl-board${props.log ? ' has-log' : ''}">` +
      (props.title ? `<div class="fl-title">${kit.esc(props.title)}</div>` : '') +
      `<div class="fl-area"><svg class="fl-wires" preserveAspectRatio="none"></svg><div class="fl-tags"></div><div class="fl-nodes"></div><div class="fl-packet"><span></span></div></div>` +
      (props.log ? `<div class="fl-log"><div class="fl-log-h">${kit.esc(props.log)}</div><div class="fl-rows"></div></div>` : '') +
      `</div>`
    const $ = <E extends Element>(s: string): E => root.querySelector<E>(s)!
    const area = $<HTMLElement>('.fl-area')
    const wires = $<SVGSVGElement>('.fl-wires')
    const tagsEl = $<HTMLElement>('.fl-tags')
    const nodesEl = $<HTMLElement>('.fl-nodes')
    const packet = $<HTMLElement>('.fl-packet')
    const rows = props.log ? $<HTMLElement>('.fl-rows') : null

    const nodeHtml = (id: string, n: FlowNode): string =>
      `<div class="fl-node" data-id="${kit.esc(id)}" data-tone="${n.tone ?? 'none'}"><div class="fl-ring"></div>` +
      `<div class="fl-ic">${n.icon ? `<svg viewBox="0 0 48 48">${ICONS[n.icon]}</svg>` : ''}</div>` +
      `<div class="fl-lb">${kit.esc(n.label)}</div>${n.sub ? `<div class="fl-sub">${kit.esc(n.sub)}</div>` : ''}` +
      `<div class="fl-st">${n.text ? kit.esc(n.text) : ''}</div></div>`

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = (view.ev && KINDS.includes(view.ev.kind as FlowKind) ? view.ev : null) as Ev | null
        const hiding = view.ev?.kind === 'hide'
        // 移除類的動作(vanish、wire cut)進行中畫動作前的樣子再淡出;其他動作畫動作後的樣子再淡入
        const leaving = ev && (ev.kind === 'vanish' || (ev.kind === 'wire' && ev.step.cut))
        const st = hiding || leaving ? view.prev : view.state
        const W = area.clientWidth || 1
        const H = area.clientHeight || 1
        const P = (n: FlowNode): [number, number] => [(n.x / 100) * W, (n.y / 100) * H]

        // 節點
        kit.setIf(nodesEl, 'html', st.order.map((id) => nodeHtml(id, st.nodes[id])).join(''))
        for (const el of [...nodesEl.children] as HTMLElement[]) {
          const id = el.dataset.id!
          const n = st.nodes[id]
          let op = 1
          let sc = 1
          if (ev?.kind === 'spawn' && ev.step.spawn === id) {
            op = kit.progress(ev.local, 0, 250)
            sc = kit.lerp(0.5, 1, kit.ease.outBack(kit.progress(ev.local, 0, 600)))
          }
          if (ev?.kind === 'vanish' && ev.step.vanish === id) {
            op = 1 - kit.progress(ev.local, 0, 600)
            sc = kit.lerp(1, 0.8, kit.progress(ev.local, 0, 600))
          }
          let ring = 0
          let ringSc = 1
          if (ev?.kind === 'pulse' && ev.step.pulse === id) {
            const q = kit.progress(ev.local, 0, 1000)
            ring = (1 - q) * 0.9
            ringSc = kit.lerp(1, 1.6, kit.ease.outCubic(q))
            sc = 1 + 0.06 * Math.sin(Math.PI * kit.progress(ev.local, 0, 500))
          }
          if (ev?.kind === 'send' && ev.step.send?.[1] === id) {
            const q = kit.progress(ev.local, ev.dur * 0.68, 500)
            sc = 1 + 0.05 * Math.sin(Math.PI * q)
          }
          kit.css(el, { left: `${(n.x).toFixed(2)}%`, top: `${(n.y).toFixed(2)}%`, opacity: op.toFixed(3), transform: `translate(-50%, -50%) scale(${sc.toFixed(3)})` })
          const r = el.querySelector<HTMLElement>('.fl-ring')!
          kit.css(r, { opacity: ring.toFixed(3), transform: `scale(${ringSc.toFixed(3)})` })
          const stEl = el.querySelector<HTMLElement>('.fl-st')!
          const changing = ev?.kind === 'pulse' && ev.step.pulse === id && ev.step.text !== undefined
          kit.css(stEl, { opacity: changing ? kit.progress(ev!.local, 200, 400).toFixed(3) : '1' })
        }

        // 線
        const linkSvg = st.links
          .filter((l) => st.nodes[l.a] && st.nodes[l.b])
          .map((l) => {
            const [x1, y1] = P(st.nodes[l.a])
            const [x2, y2] = P(st.nodes[l.b])
            return `<line data-k="${kit.esc(l.a)}|${kit.esc(l.b)}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" pathLength="1"${l.dashed ? ' class="dash"' : ''}/>`
          })
          .join('')
        wires.setAttribute('viewBox', `0 0 ${W} ${H}`)
        kit.setIf(wires as unknown as HTMLElement, 'html', linkSvg + '<line class="flow" pathLength="1"/>')
        for (const line of [...wires.querySelectorAll<SVGLineElement>('line[data-k]')]) {
          const [a, b] = line.dataset.k!.split('|')
          let draw = 1
          let op = 1
          let cutting = false
          if (ev?.kind === 'wire' && ev.step.wire && ((ev.step.wire[0] === a && ev.step.wire[1] === b) || (ev.step.wire[0] === b && ev.step.wire[1] === a))) {
            if (ev.step.cut) {
              cutting = true
              op = 1 - kit.progress(ev.local, 500, 500)
            } else draw = kit.ease.outCubic(kit.progress(ev.local, 0, 800))
          }
          if (ev?.kind === 'send' && view.prev && !hasLink(view.prev.links, a, b) && ev.step.send && ev.step.send.includes(a) && ev.step.send.includes(b)) draw = kit.progress(ev.local, 0, 400)
          if ((ev?.kind === 'vanish' && (a === ev.step.vanish || b === ev.step.vanish))) op = 1 - kit.progress(ev.local, 0, 600)
          if (ev?.kind === 'spawn' && b === ev.step.spawn) draw = kit.progress(ev.local, 300, 500)
          line.classList.toggle('cut', cutting)
          const dashed = line.classList.contains('dash')
          kit.css(line, dashed ? { opacity: (op * draw).toFixed(3) } : { strokeDasharray: '1', strokeDashoffset: (1 - draw).toFixed(3), opacity: op.toFixed(3) })
        }
        // 傳送中:線上有一段流動的亮線
        const flow = wires.querySelector<SVGLineElement>('line.flow')!
        if (ev?.kind === 'send' && ev.step.send && st.nodes[ev.step.send[0]] && st.nodes[ev.step.send[1]]) {
          const [x1, y1] = P(st.nodes[ev.step.send[0]])
          const [x2, y2] = P(st.nodes[ev.step.send[1]])
          flow.setAttribute('x1', x1.toFixed(1))
          flow.setAttribute('y1', y1.toFixed(1))
          flow.setAttribute('x2', x2.toFixed(1))
          flow.setAttribute('y2', y2.toFixed(1))
          flow.setAttribute('data-tone', ev.step.tone ?? 'req')
          const q = kit.progress(ev.local, 0, ev.dur * 0.7)
          kit.css(flow, { strokeDasharray: '0.18 1', strokeDashoffset: (0.18 - q * 1.18).toFixed(3), opacity: q > 0 && q < 1 ? '0.9' : '0' })
        } else kit.css(flow, { opacity: '0' })

        // 線旁的標籤(送達之後才出現)
        const tags = Object.entries(st.tags).filter(([k]) => {
          const [a, b] = k.split('>')
          return st.nodes[a] && st.nodes[b]
        })
        kit.setIf(tagsEl, 'html', tags.map(([k, t]) => `<div class="fl-tag" data-k="${kit.esc(k)}" data-tone="${t.tone}">${kit.esc(t.label)}</div>`).join(''))
        for (const el of [...tagsEl.children] as HTMLElement[]) {
          const [a, b] = el.dataset.k!.split('>')
          const [x1, y1] = P(st.nodes[a])
          const [x2, y2] = P(st.nodes[b])
          const len = Math.hypot(x2 - x1, y2 - y1) || 1
          // 標籤放在行進方向的左手邊:往右走的在線上方、往左走(回程)的在線下方,來回兩則不會疊在一起
          const nx = (y2 - y1) / len
          const ny = -(x2 - x1) / len
          const mx = (x1 + x2) / 2 + nx * 34
          const my = (y1 + y2) / 2 + ny * 34
          let op = 1
          if (ev?.kind === 'send' && ev.step.send && tagKey(ev.step.send[0], ev.step.send[1]) === el.dataset.k) op = kit.progress(ev.local, ev.dur * 0.7, 300)
          if (ev?.kind === 'vanish' && (a === ev.step.vanish || b === ev.step.vanish)) op = 1 - kit.progress(ev.local, 0, 400)
          kit.css(el, { left: `${mx.toFixed(1)}px`, top: `${my.toFixed(1)}px`, opacity: op.toFixed(3) })
        }

        // 跑動中的訊息
        if (ev?.kind === 'send' && ev.step.send && st.nodes[ev.step.send[0]] && st.nodes[ev.step.send[1]]) {
          const [x1, y1] = P(st.nodes[ev.step.send[0]])
          const [x2, y2] = P(st.nodes[ev.step.send[1]])
          const travel = ev.dur * 0.7
          const q = kit.ease.inOutCubic(kit.progress(ev.local, 150, travel - 150))
          const op = Math.min(kit.progress(ev.local, 0, 200), 1 - kit.progress(ev.local, travel, 250))
          packet.dataset.tone = ev.step.tone ?? 'req'
          kit.setIf(packet.firstElementChild as HTMLElement, 'text', ev.step.label ?? '')
          kit.css(packet, { left: `${kit.lerp(x1, x2, q).toFixed(1)}px`, top: `${kit.lerp(y1, y2, q).toFixed(1)}px`, opacity: op.toFixed(3), display: op > 0 ? 'flex' : 'none' })
        } else kit.css(packet, { display: 'none', opacity: '0' })

        // 紀錄欄
        if (rows) {
          const name = (id: string): string => st.nodes[id]?.label ?? view.prev.nodes[id]?.label ?? id
          kit.setIf(
            rows,
            'html',
            st.log
              .map(
                (r, i) =>
                  `<div class="fl-row" data-tone="${r.tone}" data-i="${i}"><span class="n">${i + 1}</span><div><div class="who">${kit.esc(name(r.from))} → ${kit.esc(name(r.to))}</div><div class="what">${kit.esc(r.label)}</div>${r.note ? `<div class="note">${kit.esc(r.note)}</div>` : ''}</div></div>`,
              )
              .join(''),
          )
          const all = [...rows.children] as HTMLElement[]
          all.forEach((el, i) => {
            const isNew = ev?.kind === 'send' && i === st.log.length - 1
            kit.css(el, kit.enter(isNew ? kit.progress(ev!.local, 200, 400) : 1, { dist: '0.6em' }))
          })
          // 太多列時貼齊底部
          const over = rows.scrollHeight - rows.clientHeight
          if (over > 0 && Math.abs(rows.scrollTop - over) > 0.5) rows.scrollTop = over
        }
      },

      target(name) {
        if (name === 'window') return root.querySelector<HTMLElement>('.fl-board')
        if (name === 'packet') return packet.style.display === 'none' ? null : packet
        if (name === 'log') return root.querySelector<HTMLElement>('.fl-log')
        if (name === 'log:last') return (rows?.lastElementChild as HTMLElement | null) ?? null
        const m = /^(node|tag):(.+)$/.exec(name)
        if (!m) return null
        const box = m[1] === 'node' ? nodesEl : tagsEl
        const attr = m[1] === 'node' ? 'id' : 'k'
        return ([...box.children] as HTMLElement[]).find((el) => el.dataset[attr] === m[2]) ?? null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
