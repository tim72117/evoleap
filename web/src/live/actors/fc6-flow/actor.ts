// 演員 fc6-flow:流程圖解。方塊(節點)與連線,一封「封包」沿著連線送過去,節點亮起成功/失敗等狀態。
// 用來畫出看不見的流程:部署管線、權限交換、流量切換、告警通知、資料流向、同意前後送出什麼……
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定,只描述起始狀態):
//   title   左上角的小標題(選用)
//   nodes   節點清單:[{ "id": "gh", "label": "GitHub", "sub": "推送標籤 v1.2.0", "icon": "⌥",
//                      "x": 20, "y": 50, "w": 11, "shape": "box", "hidden": true, "tone": "idle" }, …]
//           x、y 是節點中心在演員區域裡的位置(百分比 0–100);w 是寬度(em,預設 10,1em ≈ 22px)
//           shape:box(預設)、round(圓角膠囊)、db(資料庫圓柱)、person(人)、cloud(雲)、doc(文件)
//           icon:一兩個字元或 emoji,畫在標籤前面(選用)
//           hidden:一開始藏起來,之後用 appear 出場
//   edges   連線清單:[{ "from": "gh", "to": "run", "label": "部署", "hidden": true, "dashed": false }, …]
//           連線的代號寫成 "from>to";兩端節點都看得到、連線本身沒藏起來時才畫出來(有箭頭指向 to)
//
// 狀態色 tone:idle(預設)、on(藍,進行中/選中)、ok(綠,成功)、bad(紅,失敗)、warn(黃,注意)、dim(變淡,不重要)
//
// 動作(順序不對、代號不存在時載入就報錯,並指出第幾步):
//   { "appear": "run" } 或 { "appear": ["run", "gh>run"] }    節點(或連線)出場:彈出、淡入,多個依序出現
//   { "fade": "old" } 或陣列                               節點(或連線)退場淡出
//   { "light": "run", "tone": "ok", "sub": "部署完成" }        節點換狀態色(亮一下的光圈);sub 換掉下方的小字(選用)
//   { "light": "gh>run", "tone": "bad", "label": "403" }        連線換顏色;label 換掉連線上的字(選用)
//   { "send": "gh>run", "label": "v1.2.0", "tone": "on" }      封包沿連線送過去(也可以逆向寫 "run>gh"),到達時終點閃一下。
//                                                             連線被 cut 時封包走到一半變紅、停住消失(送不到)
//   { "cut": "run>db" }                                       連線斷掉:變成紅色虛線,中間打 ✕
//   { "mend": "run>db" }                                      斷掉的連線接回來
//   舞台的 show / hide 也可以順便帶一個動作。
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、node:<id>、edge:<from>><to>(連線的中段)、packet(正在送的封包;沒在送時量不到)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type Tone = 'idle' | 'on' | 'ok' | 'bad' | 'warn' | 'dim'
type Shape = 'box' | 'round' | 'db' | 'person' | 'cloud' | 'doc'
const TONES: readonly Tone[] = ['idle', 'on', 'ok', 'bad', 'warn', 'dim']
const SHAPES: readonly Shape[] = ['box', 'round', 'db', 'person', 'cloud', 'doc']

interface NodeDef {
  id: string
  label: string
  sub?: string
  icon?: string
  x: number
  y: number
  w?: number
  shape?: Shape
  hidden?: boolean
  tone?: Tone
}
interface EdgeDef {
  from: string
  to: string
  label?: string
  hidden?: boolean
  dashed?: boolean
}
interface FlowProps {
  title?: string
  nodes?: NodeDef[]
  edges?: EdgeDef[]
}

type FlowKind = 'appear' | 'fade' | 'light' | 'send' | 'cut' | 'mend'
const KINDS: readonly FlowKind[] = ['appear', 'fade', 'light', 'send', 'cut', 'mend']
type FlowStep = CommonStepFields & {
  appear?: string | string[]
  fade?: string | string[]
  light?: string
  tone?: Tone
  sub?: string
  label?: string
  send?: string
  cut?: string
  mend?: string
}

interface NodeSt {
  shown: boolean
  tone: Tone
  sub: string
}
interface EdgeSt {
  shown: boolean
  tone: Tone
  label: string
  cut: boolean
}
interface FlowState {
  nodes: Record<string, NodeSt>
  edges: Record<string, EdgeSt>
}
type FlowTarget = 'window' | 'packet' | `node:${string}` | `edge:${string}`

const T = { appear: 700, appearGap: 220, fade: 600, light: 800, send: 1600, sendMove: [200, 1100] as const, cut: 900, mend: 800 }

const listOf = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : [])

/** 依 props 找出連線的正式代號(可以逆向寫);回傳 [代號, 是否逆向] */
function edgeKey(edges: Record<string, EdgeSt>, ref: string): [string, boolean] | null {
  if (edges[ref]) return [ref, false]
  const [a, b] = ref.split('>')
  if (a && b && edges[`${b}>${a}`]) return [`${b}>${a}`, true]
  return null
}

function kindOf(step: FlowStep): FlowKind | null {
  for (const k of KINDS) if (k in step) return k
  return null
}

const actor = defineActor<FlowKind, FlowStep, FlowProps, FlowState, FlowTarget>({
  name: 'fc6-flow',
  kinds: KINDS,

  init(props) {
    const nodes: Record<string, NodeSt> = {}
    for (const n of props.nodes ?? []) {
      if (!n.id || typeof n.label !== 'string') throw new Error('fc6-flow 的 nodes 每一項要有 id 與 label')
      if (nodes[n.id]) throw new Error(`fc6-flow 的節點「${n.id}」重複`)
      if (n.shape && !SHAPES.includes(n.shape)) throw new Error(`fc6-flow 節點「${n.id}」的 shape 只能是 ${SHAPES.join('、')}`)
      if (n.tone && !TONES.includes(n.tone)) throw new Error(`fc6-flow 節點「${n.id}」的 tone 只能是 ${TONES.join('、')}`)
      nodes[n.id] = { shown: !n.hidden, tone: n.tone ?? 'idle', sub: n.sub ?? '' }
    }
    const edges: Record<string, EdgeSt> = {}
    for (const e of props.edges ?? []) {
      if (!nodes[e.from] || !nodes[e.to]) throw new Error(`fc6-flow 的連線「${e.from}>${e.to}」連到不存在的節點`)
      edges[`${e.from}>${e.to}`] = { shown: !e.hidden, tone: 'idle', label: e.label ?? '', cut: false }
    }
    return { nodes, edges }
  },

  apply(st, kind, s) {
    const nodes = { ...st.nodes }
    const edges = { ...st.edges }
    const setShown = (ids: string[], shown: boolean, what: string) => {
      if (!ids.length) throw new Error(`${what} 要給節點或連線的代號`)
      for (const id of ids) {
        if (nodes[id]) nodes[id] = { ...nodes[id], shown }
        else {
          const k = edgeKey(edges, id)
          if (!k) throw new Error(`${what}:找不到節點或連線「${id}」`)
          edges[k[0]] = { ...edges[k[0]], shown }
        }
      }
    }
    switch (kind) {
      case 'appear':
        setShown(listOf(s.appear), true, 'appear')
        break
      case 'fade':
        setShown(listOf(s.fade), false, 'fade')
        break
      case 'light': {
        const id = s.light ?? ''
        const tone = s.tone ?? 'on'
        if (!TONES.includes(tone)) throw new Error(`light 的 tone 只能是 ${TONES.join('、')}`)
        if (nodes[id]) nodes[id] = { ...nodes[id], tone, sub: s.sub ?? nodes[id].sub }
        else {
          const k = edgeKey(edges, id)
          if (!k) throw new Error(`light:找不到節點或連線「${id}」`)
          edges[k[0]] = { ...edges[k[0]], tone, label: s.label ?? edges[k[0]].label }
        }
        break
      }
      case 'send': {
        const k = edgeKey(edges, s.send ?? '')
        if (!k) throw new Error(`send:找不到連線「${s.send}」`)
        const [a, b] = k[0].split('>')
        if (!edges[k[0]].shown || !nodes[a].shown || !nodes[b].shown) throw new Error(`send:連線「${s.send}」還看不到(先 appear)`)
        if (s.tone && !TONES.includes(s.tone)) throw new Error(`send 的 tone 只能是 ${TONES.join('、')}`)
        break
      }
      case 'cut':
      case 'mend': {
        const ref = (kind === 'cut' ? s.cut : s.mend) ?? ''
        const k = edgeKey(edges, ref)
        if (!k) throw new Error(`${kind}:找不到連線「${ref}」`)
        if (kind === 'cut' && edges[k[0]].cut) throw new Error(`cut:連線「${ref}」已經斷了`)
        if (kind === 'mend' && !edges[k[0]].cut) throw new Error(`mend:連線「${ref}」沒有斷`)
        edges[k[0]] = { ...edges[k[0]], cut: kind === 'cut' }
        break
      }
    }
    return { nodes, edges }
  },

  duration(kind, s) {
    if (kind === 'appear') return T.appear + (listOf(s.appear).length - 1) * T.appearGap
    if (kind === 'fade') return T.fade
    return T[kind]
  },

  autoFocus() {
    return false
  },

  mount(root, props) {
    root.classList.add('A-fc6-flow')
    const defs = props.nodes ?? []
    const edgeDefs = props.edges ?? []
    const shapeOf = (n: NodeDef): Shape => n.shape ?? 'box'
    root.innerHTML =
      `<div class="fl-board">${props.title ? `<div class="fl-title">${kit.esc(props.title)}</div>` : ''}` +
      `<svg class="fl-lines"></svg>` +
      `<div class="fl-elabels">${edgeDefs.map((e) => `<div class="fl-elabel" data-e="${kit.esc(`${e.from}>${e.to}`)}"><span></span></div>`).join('')}</div>` +
      `<div class="fl-nodes">${defs
        .map(
          (n) =>
            `<div class="fl-node" data-id="${kit.esc(n.id)}" data-shape="${shapeOf(n)}" style="left:${n.x}%;top:${n.y}%;width:${n.w ?? 10}em">` +
            `<div class="fl-ring"></div><div class="fl-body">${n.icon ? `<span class="fl-icon">${kit.esc(n.icon)}</span>` : ''}<span class="fl-label">${kit.esc(n.label)}</span></div><div class="fl-sub"></div></div>`,
        )
        .join('')}</div>` +
      `<div class="fl-packet"><span></span></div></div>`
    const board = root.querySelector<HTMLElement>('.fl-board')!
    const svg = root.querySelector<SVGSVGElement>('.fl-lines')!
    const packet = root.querySelector<HTMLElement>('.fl-packet')!
    const packetText = packet.querySelector<HTMLElement>('span')!
    const nodeEl = new Map<string, HTMLElement>()
    root.querySelectorAll<HTMLElement>('.fl-node').forEach((el) => nodeEl.set(el.dataset.id!, el))
    const labelEl = new Map<string, HTMLElement>()
    root.querySelectorAll<HTMLElement>('.fl-elabel').forEach((el) => labelEl.set(el.dataset.e!, el))

    /** 節點在 board 裡的中心與半寬高(px) */
    const boxOf = (id: string) => {
      const el = nodeEl.get(id)!
      const W = board.clientWidth
      const H = board.clientHeight
      const d = defs.find((n) => n.id === id)!
      return { cx: (d.x / 100) * W, cy: (d.y / 100) * H, hw: el.offsetWidth / 2 + 6, hh: el.offsetHeight / 2 + 6 }
    }
    /** 從 a 中心往 b 中心的線段,兩端停在節點外框 */
    const segOf = (a: string, b: string) => {
      const A = boxOf(a)
      const B = boxOf(b)
      const dx = B.cx - A.cx
      const dy = B.cy - A.cy
      const clip = (hw: number, hh: number) => Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity)
      const ta = Math.min(0.45, clip(A.hw, A.hh))
      const tb = Math.min(0.45, clip(B.hw, B.hh))
      return { x1: A.cx + dx * ta, y1: A.cy + dy * ta, x2: B.cx - dx * tb, y2: B.cy - dy * tb }
    }

    return {
      render(frame, ms) {
        const view = frame.view
        if (!view) return
        const evStep = view.ev ? (view.ev.step as FlowStep) : null
        const k = evStep ? kindOf(evStep) : null
        const local = view.ev ? view.ev.local : Infinity
        const hiding = view.ev?.kind === 'hide'
        const st = hiding ? view.prev : view.state
        const prev = view.prev

        // 出場/退場中的項目:依序淡入
        const appearList = k === 'appear' ? listOf(evStep!.appear) : []
        const fadeList = k === 'fade' ? listOf(evStep!.fade) : []
        const opOf = (id: string, nowShown: boolean, wasShown: boolean): number => {
          if (!nowShown && !wasShown) return 0
          const ri = appearList.indexOf(id)
          if (ri >= 0 && !wasShown) return kit.progress(local, ri * T.appearGap, T.appear - 200)
          if (fadeList.includes(id) && wasShown && !nowShown) return 1 - kit.progress(local, 0, T.fade - 100)
          return nowShown ? 1 : 0
        }

        const nodeOp: Record<string, number> = {}
        for (const d of defs) {
          const el = nodeEl.get(d.id)!
          const s = st.nodes[d.id]
          const op = opOf(d.id, s.shown, prev.nodes[d.id].shown && !(appearList.includes(d.id) && !prev.nodes[d.id].shown))
          nodeOp[d.id] = op
          const ri = appearList.indexOf(d.id)
          const pop = ri >= 0 && !prev.nodes[d.id].shown ? kit.lerp(0.7, 1, kit.ease.outBack(kit.progress(local, ri * T.appearGap, T.appear - 150))) : 1
          // 換狀態:光圈擴散
          const lit = k === 'light' && evStep!.light === d.id
          const arrive = k === 'send' && (() => {
            const ek = edgeKey(st.edges, evStep!.send ?? '')
            if (!ek) return false
            const [a, b] = ek[0].split('>')
            return (ek[1] ? a : b) === d.id && !st.edges[ek[0]].cut
          })()
          const rp = lit ? kit.progress(local, 0, 700) : arrive ? kit.progress(local, T.sendMove[1], 500) : 0
          el.dataset.tone = s.tone
          kit.css(el, { opacity: op.toFixed(3), transform: `translate(-50%, -50%) scale(${(pop * (1 + 0.06 * Math.sin(Math.PI * rp))).toFixed(4)})`, visibility: op > 0 ? 'visible' : 'hidden' })
          const ring = el.querySelector<HTMLElement>('.fl-ring')!
          kit.css(ring, { opacity: (rp > 0 && rp < 1 ? 0.7 * (1 - rp) : 0).toFixed(3), transform: `scale(${kit.lerp(1, 1.35, kit.ease.outCubic(rp)).toFixed(4)})` })
          kit.setIf(el.querySelector<HTMLElement>('.fl-sub')!, 'text', s.sub)
          el.querySelector<HTMLElement>('.fl-sub')!.style.display = s.sub ? '' : 'none'
        }

        // 連線
        const W = board.clientWidth
        const H = board.clientHeight
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
        let html = `<defs>${TONES.map((t) => `<marker id="fl-ah-${t}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="fl-ah" data-tone="${t}"/></marker>`).join('')}</defs>`
        const sendKey = k === 'send' ? edgeKey(st.edges, evStep!.send ?? '') : null
        for (const e of edgeDefs) {
          const key = `${e.from}>${e.to}`
          const s = st.edges[key]
          const was = prev.edges[key]
          const eop = opOf(key, s.shown, was.shown && !(appearList.includes(key) && !was.shown)) * Math.min(nodeOp[e.from], nodeOp[e.to])
          const lab = labelEl.get(key)!
          if (eop <= 0) {
            lab.style.visibility = 'hidden'
            continue
          }
          const g = segOf(e.from, e.to)
          const active = sendKey?.[0] === key
          const tone: Tone = s.cut ? 'bad' : active && s.tone === 'idle' ? 'on' : s.tone
          // 斷線:cut 進行中由實線變虛線
          const cutP = k === 'cut' && edgeKey(st.edges, evStep!.cut ?? '')?.[0] === key ? kit.progress(local, 0, 500) : s.cut ? 1 : 0
          const dashed = e.dashed || cutP > 0 || active
          const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1)
          // 出場時線由起點畫出
          const draw = appearList.includes(key) || appearList.includes(e.from) || appearList.includes(e.to) ? eop : 1
          const flow = active ? (-(ms / 18) % 24).toFixed(1) : '0'
          html += `<line class="fl-line" data-tone="${tone}" x1="${g.x1.toFixed(1)}" y1="${g.y1.toFixed(1)}" x2="${(g.x1 + (g.x2 - g.x1) * draw).toFixed(1)}" y2="${(g.y1 + (g.y2 - g.y1) * draw).toFixed(1)}" style="opacity:${eop.toFixed(3)};${dashed ? `stroke-dasharray:${cutP > 0 ? '10 12' : '14 10'};stroke-dashoffset:${flow}` : ''}" marker-end="${draw >= 0.98 ? `url(#fl-ah-${tone})` : ''}"/>`
          void len
          const mx = (g.x1 + g.x2) / 2
          const my = (g.y1 + g.y2) / 2
          if (cutP > 0) {
            const sc = kit.ease.outBack(kit.progress(cutP, 0, 1))
            html += `<g class="fl-x" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) scale(${sc.toFixed(3)})" style="opacity:${(eop * Math.min(1, cutP * 2)).toFixed(3)}"><circle r="20"/><path d="M-8 -8 L8 8 M8 -8 L-8 8"/></g>`
          }
          // 連線上的字
          lab.style.visibility = s.label ? 'visible' : 'hidden'
          lab.dataset.tone = tone
          kit.setIf(lab.querySelector('span')!, 'text', s.label)
          kit.css(lab, { left: `${mx.toFixed(1)}px`, top: `${(my - (cutP > 0 ? 34 : 0)).toFixed(1)}px`, opacity: eop.toFixed(3) })
        }
        kit.setIf(svg, 'html', html)

        // 封包
        if (sendKey && local < T.send) {
          const [a, b] = sendKey[0].split('>')
          const g = sendKey[1] ? segOf(b, a) : segOf(a, b)
          const cut = st.edges[sendKey[0]].cut
          let p = kit.ease.inOutCubic(kit.progress(local, T.sendMove[0], T.sendMove[1] - T.sendMove[0]))
          if (cut) p = Math.min(p, 0.42)
          const fail = cut && local > T.sendMove[0] + (T.sendMove[1] - T.sendMove[0]) * 0.5
          const op = Math.min(kit.progress(local, 0, 200), fail ? 1 - kit.progress(local, 1100, 400) : local > 1250 ? 1 - kit.progress(local, 1250, 300) : 1)
          packet.style.display = op > 0 ? '' : 'none'
          packet.dataset.tone = fail ? 'bad' : evStep!.tone ?? 'on'
          kit.setIf(packetText, 'text', fail ? '✕ 送不到' : evStep!.label ?? '')
          packet.dataset.empty = (fail ? '✕' : evStep!.label) ? '0' : '1'
          kit.css(packet, {
            left: `${kit.lerp(g.x1, g.x2, p).toFixed(1)}px`,
            top: `${kit.lerp(g.y1, g.y2, p).toFixed(1)}px`,
            opacity: op.toFixed(3),
            transform: `translate(-50%, -50%) translateX(${fail ? kit.shake(local, 650, 400, 6).toFixed(1) : 0}px)`,
          })
        } else packet.style.display = 'none'
      },

      target(name) {
        if (name === 'window') return board
        if (name === 'packet') return packet.style.display === 'none' ? null : packet
        if (name.startsWith('node:')) return nodeEl.get(name.slice(5)) ?? null
        if (name.startsWith('edge:')) {
          const ref = name.slice(5)
          const [a, b] = ref.split('>')
          return labelEl.get(ref) ?? labelEl.get(`${b}>${a}`) ?? null
        }
        return null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
