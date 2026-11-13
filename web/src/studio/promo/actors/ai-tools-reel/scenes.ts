// ai-tools-reel 的各個場景:l 是場景自己的時間(毫秒),回傳 1080×1920 設計座標裡的 SVG 字串。
// 安全區(FB Reels):x 70–940、y 250–1500;看得到的內容都放在裡面,背景可以滿版。
import logoSvg from '../../../../../public/brand/evoleap-logo.svg?raw'
import { LOOKS, binder, books, essayStack, lamp, magnifier, mug, noteCards, person, plant, redPen, roomBack, roomDesk, ROOMS, scheduleSheet, sparkles, thought, toolIcon, type Look, type Room } from './people'
import { shiftIcon, TOOL_H, TOOL_MS, TOOL_W, TOOLS, type ToolId } from './tools'
import { ACCENT, circle, clamp, cursor, grp, hash, inOutCubic, INK, lerp, MONO, n2, outCubic, path, pop, rect, seg, sparkle, text, tint, track, W, H } from './util'

export type SceneId = 'pain' | 'ask' | 'teacher' | 'nurse' | 'lawyer' | 'historian' | 'toolbox' | 'course' | 'brand'
/** 各場景的自然長度(毫秒);腳本的 ms 會把整段動畫依比例放慢或加快 */
export const NATURAL: Record<SceneId, number> = { pain: 7000, ask: 10000, teacher: 8000, nurse: 8000, lawyer: 8000, historian: 8000, toolbox: 6000, course: 7600, brand: 4600 }
export const SCENES = Object.keys(NATURAL) as SceneId[]

const TONES: Record<SceneId, [string, string]> = {
  pain: ['#fff3e2', '#ffd9bf'],
  ask: ['#efeaff', '#d6e4ff'],
  teacher: ['#fff0ec', '#ffd2c8'],
  nurse: ['#e8faf6', '#bdece4'],
  lawyer: ['#eceeff', '#cdd3fb'],
  historian: ['#fff4d9', '#fadf9f'],
  toolbox: ['#fff3e2', '#ffd9bf'],
  course: ['#e8f4ff', '#d3e6ff'],
  brand: ['#fffaf0', '#ffe9d2'],
}

/** 滿版背景:漸層加幾顆慢慢飄的柔光 */
export function background(id: SceneId, t: number): string {
  const [a, b] = TONES[id]
  const blobs = [0, 1, 2, 3]
    .map((i) => {
      const x = 180 + i * 260 + Math.sin(t / 2300 + i * 1.7) * 60
      const y = 260 + ((i * 457) % 1400) + Math.cos(t / 2900 + i) * 50
      return circle(x, y, 190 + i * 30, i % 2 ? '#ffffff' : tintOf(i), { op: 0.28 })
    })
    .join('')
  return `<defs><linearGradient id="bg${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>${rect(0, 0, W, H, `url(#bg${id})`)}${blobs}`
}
const tintOf = (i: number): string => ['#ffd3b6', '#cbe3ff', '#ffe0f0', '#d7f5e6'][i % 4]

const PANEL = { x: 70, y: 330 }

/** 小房間(870×1000 的圓角面板):nested 在 PANEL 位置 */
function panelWrap(inner: string, o: { s?: number; op?: number; y?: number } = {}): string {
  const body = `<g clip-path="url(#clipPanel)">${inner}</g>${rect(0, 0, 870, 1000, 'none', { rx: 40, stroke: '#ffffff', sw: 6 })}`
  return grp(`<rect x="0" y="12" width="870" height="1000" rx="40" fill="#2a2f45" opacity="0.12" filter="url(#blur18)"/>${body}`, { x: PANEL.x, y: PANEL.y + (o.y ?? 0), s: o.s ?? 1, op: o.op ?? 1, ox: 435, oy: 500 })
}

// ====================================================== 1. 痛點
export function painScene(l: number): string {
  const room = ROOMS.hero
  const fadeIn = clamp(seg(l, 0, 500))
  // 作文一張張堆起來
  const n = 3 + Math.floor(clamp(seg(l, 500, 2000)) * 11)
  const mood = l < 3300 ? 0 : clamp(seg(l, 3300, 4300)) * 0.45
  const b = pop(l, 3100, 700)
  const inner = [
    roomBack(room, l),
    // 牆上的排班表
    grp(scheduleSheet(0, 0, 190, 250, -3), { op: clamp(seg(l, 900, 1300)), x: 290, y: 80 - (1 - clamp(seg(l, 900, 1300))) * 30 }),
    person(LOOKS.hero, 435, 700, 1.3, mood, l),
    roomDesk(room),
    // 桌上的一疊作文、兩份合約
    grp(essayStack(0, 0, 1.15, n, l), { x: 150, y: 668 }),
    grp(binder(0, 0, 1.1, '#4f5bd5', 74), { x: 700, y: 672, op: clamp(seg(l, 1500, 1900)) }),
    grp(binder(0, 0, 1.1, '#e8576b', 68), { x: 712, y: 590, op: clamp(seg(l, 1900, 2300)) }),
    mug(570, 670, 1, '#ffffff', l),
    // 飄過的紙(被淹沒的感覺)
    [0, 1, 2, 3, 4]
      .map((i) => {
        const a = clamp(seg(l, 1200 + i * 250, 1800 + i * 250))
        const x = 90 + i * 170 + Math.sin(l / 700 + i * 2) * 26
        const y = 520 - hash(i + 4) * 120 + Math.cos(l / 800 + i) * 16
        return grp(rect(-26, -34, 52, 68, '#fff', { rx: 5, stroke: '#00000018', sw: 2 }) + rect(-16, -20, 32, 4, '#ef5b5b', { rx: 2 }) + rect(-16, -8, 26, 4, '#c9cde0', { rx: 2 }) + rect(-16, 4, 30, 4, '#c9cde0', { rx: 2 }), { x, y: y - (1 - a) * 60, rot: Math.sin(l / 500 + i) * 14 + i * 9, op: a * 0.9 })
      })
      .join(''),
    thought(645, 235, 330, 200, toolIcon('#4f5bd5', l, 1.1), b, l),
    b > 0.2 ? sparkles(645, 235, 7, 190, clamp(seg(l, 3300, 5200)), l) : '',
  ].join('')
  return panelWrap(inner, { op: fadeIn, y: (1 - fadeIn) * 40 })
}

// ====================================================== 2. AI 幫你寫
const USER_MSG = '我是國文老師，想要一個貼上作文，就能標出錯字，還能依評分規準整理的工具。'
const CODE = [
  "const essay = $('#essay')",
  '',
  'function check(text) {',
  '  const typos = findTypos(text)',
  '  const repeats = findRepeats(text)',
  "  mark(typos, 'red')",
  "  mark(repeats, 'yellow')",
  '  return { typos, repeats }',
  '}',
  '',
  'function score(text, rubric) {',
  '  return rubric.map((item) => ({',
  '    name: item.name,',
  '    value: rate(text, item),',
  '  }))',
  '}',
  '',
  'button.onclick = () => {',
  '  render(check(essay.value))',
  '}',
]

function colorCode(line: string, y: number): string {
  const tokens = line.match(/(\s+|\w+|'[^']*'|[^\w\s])/g) ?? []
  let x = 30
  const out: string[] = []
  for (const tk of tokens) {
    const kw = /^(const|function|return)$/.test(tk)
    const str = tk.startsWith("'")
    const fill = kw ? '#ff9ab2' : str ? '#a6e3a1' : /^[A-Za-z_$]\w*$/.test(tk) && line.slice(x).length >= 0 && /^\(/.test(line.slice(line.indexOf(tk) + tk.length)) ? '#8fd0ff' : /^[(){}[\].,;=>]+$/.test(tk) ? '#9aa4c8' : '#e6e9f8'
    out.push(`<text x="${n2(x)}" y="${y}" font-size="25" font-family="${MONO}" fill="${fill}" xml:space="preserve">${tk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`)
    x += tk.length * 15
  }
  return out.join('')
}

export function askScene(l: number): string {
  const out: string[] = []
  // 對話卡
  const cardP = pop(l, 0, 600)
  const chat: string[] = []
  chat.push(rect(0, 0, 870, 520, '#ffffff', { rx: 32 }))
  chat.push(rect(0, 0, 870, 78, '#f3f1ff', { rx: 32 }) + rect(0, 40, 870, 38, '#f3f1ff'))
  chat.push(circle(50, 39, 22, '#7b6cf6') + sparkle(50, 39, 12, '#fff'))
  chat.push(text('AI 程式助手', 88, 48, 26, { weight: 800 }))
  // 使用者訊息:逐字打出來
  const total = [...USER_MSG].length
  const shown = Math.floor(clamp(seg(l, 500, 3300)) * total)
  const msg = [...USER_MSG].slice(0, shown).join('')
  const lines = [msg.slice(0, 18), msg.slice(18, 36), msg.slice(36, 54)].filter(Boolean)
  const bw = 560
  chat.push(rect(870 - 100 - bw, 108, bw, 56 + 44 * 3, '#e7e9ff', { rx: 26, op: clamp(seg(l, 400, 700)) }))
  lines.forEach((ln, i) => chat.push(text(ln, 870 - 100 - bw + 28, 164 + i * 44, 29, { fill: '#2f3350', weight: 500 })))
  if (shown < total && l > 500) chat.push(rect(870 - 100 - bw + 28 + (lines[lines.length - 1]?.length ?? 0) * 29 + 3, 140 + (lines.length - 1) * 44, 3, 32, '#7b6cf6', { op: Math.sin(l / 120) > 0 ? 1 : 0.2 }))
  chat.push(grp(circle(0, 0, 34, '#ffe9d6') + `<g clip-path="url(#clipAv)">${person(LOOKS.teacher, 0, 38, 0.34, 0.9, l)}</g>`, { x: 818, y: 140, op: clamp(seg(l, 400, 700)) }))
  // AI 回覆
  const r = seg(l, 3500, 3900)
  const dots = l > 3500 && l < 4300
  if (r > 0) {
    chat.push(rect(30, 334, dots ? 130 : 400, 76, '#f1f2f7', { rx: 26 }))
    if (dots) for (let i = 0; i < 3; i++) chat.push(circle(66 + i * 30, 372 - Math.abs(Math.sin(l / 160 + i * 0.9)) * 8, 8, '#9aa0bd'))
    else chat.push(text('沒問題，我來做給你。', 56, 382, 29, { fill: '#2f3350', weight: 500, op: clamp(seg(l, 4300, 4600)) }))
  }
  chat.push(rect(30, 440, 810, 56, '#f6f6fb', { rx: 28 }) + text('用說的就好，不用先學語法', 60, 477, 24, { fill: '#a0a5c0' }))
  out.push(grp(`<rect x="0" y="12" width="870" height="520" rx="32" fill="#2a2f45" opacity="0.12" filter="url(#blur18)"/>${chat.join('')}`, { x: 70, y: 300 + (1 - clamp(cardP)) * 60, op: clamp(cardP), s: 0.9 + 0.1 * clamp(cardP), ox: 435, oy: 260 }))

  // 程式碼卡:一行一行自己長出來
  const codeP = pop(l, 3600, 600)
  const dim = clamp(seg(l, 7400, 7900))
  const code: string[] = []
  code.push(rect(0, 0, 870, 590, '#1f2338', { rx: 30 }))
  code.push(circle(38, 36, 8, '#ff6b5b') + circle(64, 36, 8, '#ffc83d') + circle(90, 36, 8, '#3cc89a') + text('app.js', 435, 44, 24, { anchor: 'middle', fill: '#8e96c0', weight: 700, font: MONO }))
  const totalChars = CODE.reduce((a, c) => a + c.length + 1, 0)
  const chars = Math.floor(clamp(seg(l, 3900, 7300)) ** 0.9 * totalChars)
  let left = chars
  const vis: string[] = []
  for (const ln of CODE) {
    if (left <= 0) break
    vis.push(ln.slice(0, left))
    left -= ln.length + 1
  }
  const maxRows = 17
  const start = Math.max(0, vis.length - maxRows)
  vis.slice(start).forEach((ln, i) => code.push(colorCode(ln, 96 + i * 28)))
  const caretRow = vis.length - 1 - start
  const lastLen = vis.length ? vis[vis.length - 1].length : 0
  if (vis.length && l < 7600) code.push(rect(30 + lastLen * 15 + 2, 76 + caretRow * 28, 12, 26, '#a6e3a1', { op: Math.sin(l / 140) > -0.2 ? 0.9 : 0.2 }))
  out.push(grp(code.join(''), { x: 70 - dim * 30, y: 850 + (1 - clamp(codeP)) * 80, op: clamp(codeP) * (1 - dim * 0.35), s: 1 - dim * 0.05, ox: 0, oy: 295 }).replace(/^<g/, '<g'))

  // 小工具跳出來
  const tp = pop(l, 7500, 650)
  if (tp > 0) {
    const sc = 0.5
    out.push(sparkles(700, 1010, 9, 250, clamp(seg(l, 7500, 9400)), l))
    out.push(grp(`<g transform="scale(${sc})">${TOOLS.teacher(TOOL_MS)}</g>`, { x: 470, y: 900 + (1 - clamp(tp)) * 60, s: clamp(tp) * 1, op: clamp(tp * 1.6), ox: (TOOL_W * sc) / 2, oy: (TOOL_H * sc) / 2 }))
  }
  return out.join('')
}

// ====================================================== 3. 四個專業案例
interface Persona {
  room: Room
  look: Look
  accent: string
  /** 想法泡泡裡的圖 */
  icon: (l: number) => string
}
const PERSONAS: Record<ToolId, Persona> = {
  teacher: {
    room: ROOMS.teacher,
    look: LOOKS.teacher,
    accent: ACCENT.teacher,
    icon: (l) => grp(path('M-50 -40 h70 l22 22 v70 h-92z', '#fff', { stroke: '#e8576b', sw: 6 }) + path('M-34 -10 h50 M-34 10 h36 M-34 30 h44', 'none', { stroke: '#c9cde0', sw: 7 }) + path('M-40 -22 q6 -8 12 0 t12 0', 'none', { stroke: '#ef4b4b', sw: 5 }) + sparkle(54, -48, 16, '#ffc83d'), { s: 1.0 + 0.04 * Math.sin(l / 300) }),
  },
  nurse: {
    room: ROOMS.nurse,
    look: LOOKS.nurse,
    accent: ACCENT.nurse,
    icon: (l) => grp(rect(-56, -44, 112, 96, '#fff', { rx: 12, stroke: '#18b5a4', sw: 6 }) + rect(-56, -44, 112, 26, '#18b5a4', { rx: 12 }) + rect(-56, -32, 112, 14, '#18b5a4') + [0, 1, 2, 3, 4, 5].map((i) => circle(-34 + (i % 3) * 34, -2 + Math.floor(i / 3) * 30, 9, i === 4 ? '#ef4b4b' : '#cfd5ea')).join('') + sparkle(60, -48, 15, '#ffc83d'), { s: 1 + 0.04 * Math.sin(l / 300) }),
  },
  lawyer: {
    room: ROOMS.lawyer,
    look: LOOKS.lawyer,
    accent: ACCENT.lawyer,
    icon: (l) => grp(rect(-64, -44, 56, 80, '#fff', { rx: 8, stroke: '#4f5bd5', sw: 5 }) + rect(8, -44, 56, 80, '#fff', { rx: 8, stroke: '#4f5bd5', sw: 5 }) + path('M-52 -20 h30 M-52 -4 h30 M-52 12 h20', 'none', { stroke: '#ef4b4b', sw: 5 }) + path('M20 -20 h30 M20 -4 h30 M20 12 h20', 'none', { stroke: '#2fb67f', sw: 5 }) + sparkle(62, -52, 15, '#ffc83d'), { s: 1 + 0.04 * Math.sin(l / 300) }),
  },
  historian: {
    room: ROOMS.historian,
    look: LOOKS.historian,
    accent: ACCENT.historian,
    icon: (l) => grp(rect(-4, -48, 8, 100, '#e6c982', { rx: 4 }) + [0, 1, 2].map((i) => circle(0, -30 + i * 34, 11, '#f2a31b', { stroke: '#fff', sw: 4 }) + rect(i % 2 ? -62 : 18, -38 + i * 34, 44, 16, i % 2 ? '#bfe3ff' : '#ffe9a8', { rx: 6 })).join('') + sparkle(60, -54, 15, '#ffc83d'), { s: 1 + 0.04 * Math.sin(l / 300) }),
  },
}

function clipboard(x: number, y: number): string {
  return grp(rect(-70, -170, 140, 170, '#c98a5b', { rx: 12 }) + rect(-58, -156, 116, 146, '#fff', { rx: 6 }) + rect(-24, -184, 48, 24, '#8b8fa8', { rx: 8 }) + [0, 1, 2, 3, 4].map((i) => rect(-44, -130 + i * 26, 88 - (i % 2) * 18, 8, i === 2 ? '#18b5a4' : '#d6d9ea', { rx: 4 })).join(''), { x, y, rot: -4 })
}

/** 桌面上的道具(畫在桌面之後);牆上的道具在 PERSONAS.props 裡一起畫在人物之前,這裡只放桌上的 */
function deskProps(id: ToolId, l: number): string {
  switch (id) {
    case 'teacher':
      return grp(essayStack(0, 0, 1.2, 13, l), { x: 150, y: 668 }) + redPen(560, 650, -10) + mug(720, 672, 1, '#fff7ec', l)
    case 'nurse':
      return plant(780, 672, 1.1, l) + clipboard(200, 668) + mug(590, 672, 1, '#ffffff', l)
    case 'lawyer':
      return lamp(790, 672, 0.85, 1) + grp(binder(0, 0, 1.15, '#4f5bd5', 76), { x: 160, y: 672 }) + grp(binder(0, 0, 1.15, '#e8576b', 70), { x: 180, y: 588 }) + grp(binder(0, 0, 1.0, '#2d3a8c', 60), { x: 600, y: 672 }) + mug(700, 672, 0.9, '#fff', l)
    default:
      return lamp(780, 672, 0.85, 1) + noteCards(160, 640, -8, '#fff') + noteCards(260, 632, 6, '#ffe9a8') + noteCards(210, 600, -2, '#ffd0d0') + noteCards(620, 650, 9, '#d8f1ff') + magnifier(560, 640, 1, 0)
  }
}

/** 牆上的道具(畫在人物之前) */
function wallProps(id: ToolId, l: number): string {
  switch (id) {
    case 'teacher':
      return books(330, 330, 7, 2)
    case 'nurse':
      return grp(scheduleSheet(0, 0, 250, 270, 2), { x: 300, y: 70 })
    case 'lawyer':
      return books(300, 330, 8, 5)
    default:
      return books(300, 330, 7, 9)
  }
  void l
}

function personaPanel(id: ToolId, l: number): string {
  const p = PERSONAS[id]
  const mood = l < 900 ? 0 : clamp(seg(l, 900, 1700)) * 0.75
  const b = pop(l, 800, 600)
  const inner = [roomBack(p.room, l), wallProps(id, l), person(p.look, 435, 700, 1.3, mood, l), roomDesk(p.room), deskProps(id, l), thought(660, 230, 300, 190, p.icon(l), b, l), b > 0.3 ? sparkles(660, 230, 6, 170, clamp(seg(l, 900, 2200)), l) : ''].join('')
  return inner
}

function badge(id: ToolId, l: number, p: number): string {
  const per = PERSONAS[id]
  if (p <= 0) return ''
  return grp(
    circle(0, 0, 64, '#ffffff') + `<g clip-path="url(#clipBadge)">${circle(0, 0, 60, per.room.bottom)}${person(per.look, 0, 62, 0.5, 0.9, l)}</g>` + circle(0, 0, 60, 'none', { stroke: per.accent, sw: 7 }),
    { x: 150, y: 352, s: clamp(p) * 1, op: clamp(p * 2) },
  )
}

export function caseScene(id: ToolId, l: number): string {
  const L1 = 1500
  const L2 = 2300
  const out: string[] = []
  const toTool = inOutCubic(seg(l, L1, L2))
  const fadeIn = clamp(seg(l, 0, 450))
  if (toTool < 1) out.push(panelWrap(personaPanel(id, l), { s: lerp(1, 0.93, toTool), op: fadeIn * (1 - toTool), y: (1 - fadeIn) * 40 }))
  if (toTool > 0) {
    const tl = Math.max(0, l - 1900)
    const tp = outCubic(toTool)
    out.push(grp(TOOLS[id](tl), { x: PANEL.x, y: PANEL.y + 60 + (1 - tp) * 40, s: lerp(0.93, 1, tp), op: tp, ox: 435, oy: 500 }))
  }
  out.push(badge(id, l, pop(l, 1700, 500)))
  return out.join('')
}

// ====================================================== 4. 工具箱
function toolTile(id: ToolId): string {
  const c = ACCENT[id]
  const base = rect(-59, -59, 118, 118, c, { rx: 28 }) + rect(-59, -59, 118, 118, '#ffffff', { rx: 28, op: 0.12 })
  let ic = ''
  if (id === 'teacher') ic = path('M-26 -34 h38 l14 14 v52 h-52z', '#fff') + path('M-16 -8 h26 M-16 6 h26 M-16 20 h16', 'none', { stroke: '#c9cde0', sw: 5 }) + path('M-18 -20 q4 -6 8 0 t8 0', 'none', { stroke: '#ef4b4b', sw: 4 }) + circle(24, 26, 17, '#3cc89a') + path('M16 26 l6 6 l11 -13', 'none', { stroke: '#fff', sw: 5 })
  if (id === 'nurse') ic = rect(-34, -30, 68, 62, '#fff', { rx: 10 }) + rect(-34, -30, 68, 16, '#0f8f80', { rx: 10 }) + rect(-34, -22, 68, 8, '#0f8f80') + grp(shiftIcon('N', 1.3), { x: 0, y: 8 }) + circle(-14, -36, 5, '#fff') + circle(14, -36, 5, '#fff')
  if (id === 'lawyer') ic = rect(-40, -32, 38, 62, '#fff', { rx: 6 }) + rect(2, -32, 38, 62, '#fff', { rx: 6 }) + path('M-33 -14 h24 M-33 0 h24 M-33 14 h16', 'none', { stroke: '#ef4b4b', sw: 4 }) + path('M9 -14 h24 M9 0 h24 M9 14 h16', 'none', { stroke: '#2fb67f', sw: 4 })
  if (id === 'historian') ic = rect(-3, -38, 6, 76, '#fff', { rx: 3 }) + [0, 1, 2].map((i) => circle(0, -26 + i * 26, 8, '#fff', { stroke: '#a96b0a', sw: 3 }) + rect(i % 2 ? -42 : 12, -33 + i * 26, 30, 14, '#fff', { rx: 5, op: 0.9 })).join('')
  return base + ic
}

const SLOT_X = [221, 363, 505, 647]
export function toolboxScene(l: number): string {
  const room = ROOMS.hero
  const order: ToolId[] = ['teacher', 'nurse', 'lawyer', 'historian']
  const mood = clamp(seg(l, 3200, 4200))
  const boxP = outCubic(seg(l, 0, 700))
  const inner: string[] = [roomBack(room, l), books(330, 330, 6, 11), person(LOOKS.hero, 435, 700, 1.3, 0.3 + mood * 0.7, l), roomDesk(room)]
  // 工具箱:後內壁、格子、再來是飛進來的圖示,最後是前板
  const boxY = 700 + (1 - boxP) * 320
  const box: string[] = []
  box.push(rect(130, 590, 610, 150, '#b9503f', { rx: 22 }), rect(146, 604, 578, 120, '#7d2f26', { rx: 14 }))
  for (let i = 1; i < 4; i++) box.push(rect(150 + i * 142 - 4, 604, 8, 120, '#5a1f19'))
  const tiles: string[] = []
  order.forEach((id, i) => {
    const t0 = 600 + i * 800
    const f = inOutCubic(seg(l, t0, t0 + 900))
    const appear = pop(l, t0 - 300, 450)
    const sx = lerp(435, SLOT_X[i], f)
    const sy = lerp(300, 640, f) - Math.sin(f * Math.PI) * 110
    const s = lerp(0.46, 1, f)
    const tileAlpha = clamp((f - 0.5) / 0.4)
    const win = `<g transform="scale(0.12)" opacity="${n2(1 - tileAlpha)}">${TOOLS[id](TOOL_MS)}</g>`
    // 縮圖(以 0.12 倍的視窗,中心對齊)
    const winG = grp(`<g transform="translate(${n2(-TOOL_W * 0.06)} ${n2(-TOOL_H * 0.06)})">${win}</g>`, { s: s * 1, ox: 0, oy: 0 })
    // 第一階段以大視窗的縮小版開始(放大 4 倍倍率換算)
    const bigScale = lerp(0.5, 0.12, clamp(f * 1.6))
    const big = grp(`<g transform="translate(${n2(-TOOL_W / 2)} ${n2(-TOOL_H / 2)})">${TOOLS[id](TOOL_MS)}</g>`, { s: bigScale, op: 1 - tileAlpha })
    const tile = grp(toolTile(id), { s: (0.9 + 0.1 * tileAlpha) * 1, op: tileAlpha })
    void winG
    tiles.push(grp(big + tile, { x: sx, y: sy, op: clamp(appear * 1.5), s: 1 }))
    if (f >= 1 && l < t0 + 1500) tiles.push(sparkle(SLOT_X[i] + 40, 590, 16 * (1 - seg(l, t0 + 900, t0 + 1500)), '#ffc83d', 1), sparkle(SLOT_X[i] - 36, 610, 10 * (1 - seg(l, t0 + 900, t0 + 1500)), '#ff8fa3', 1))
  })
  const front = rect(110, 700, 650, 210, '#e0634f', { rx: 26 }) + rect(110, 700, 650, 34, '#ffffff', { rx: 20, op: 0.18 }) + rect(110, 880, 650, 30, '#000', { rx: 14, op: 0.12 }) + rect(405, 744, 60, 34, '#ffd27a', { rx: 10 }) + rect(420, 754, 30, 8, '#b8791e', { rx: 4 })
  inner.push(grp(box.join('') + tiles.join('') + front, { y: boxY - 700, x: 0 }))
  inner.push(sparkles(435, 360, 10, 260, clamp(seg(l, 3300, 5200)), l))
  const fade = clamp(seg(l, 0, 400))
  return panelWrap(inner.join(''), { op: fade })
}

// ====================================================== 5. evoleap 課程
function browserChrome(w: number, urlText: string, urlShown: number): string {
  return (
    rect(0, 0, w, 76, '#e9edf7', { rx: 0 }) +
    circle(34, 38, 9, '#ff6b5b') + circle(62, 38, 9, '#ffc83d') + circle(90, 38, 9, '#3cc89a') +
    rect(130, 14, w - 160, 48, '#fff', { rx: 24 }) +
    path('M160 34 v-6 a8 8 0 0 1 16 0 v6 M156 34 h24 v18 h-24z', 'none', { stroke: '#8a90ad', sw: 3.5 }) +
    text(urlText.slice(0, urlShown), 196, 48, 26, { fill: INK, weight: 600 })
  )
}

const COURSES = [
  { label: '起步', title: 'AI 工具介紹', sub: '讓 AI 在你的電腦上做出第一個網站', col: '#2fb6a5' },
  { label: '零基礎', title: 'AI 工具入門', sub: '用 AI 把點子整理成可以開工的需求', col: '#4f5bd5' },
  { label: '基礎', title: 'Vibe Coding 入門', sub: '用 AI 做出你的第一個小工具', col: '#ff6b5b' },
]

function courseMap(l: number): string {
  const o: string[] = []
  COURSES.forEach((c, i) => {
    const a = pop(l, 900 + i * 180, 520)
    const sel = i === 0 ? clamp(seg(l, 2200, 2400)) : 0
    const y = 24 + i * 214
    o.push(
      grp(
        rect(0, 0, 790, 190, '#fff', { rx: 26, stroke: sel > 0 ? c.col : '#e5e8f4', sw: sel > 0 ? 6 : 3 }) +
          rect(0, 0, 150, 190, tint(c.col, 0.78), { rx: 26 }) + rect(110, 0, 40, 190, tint(c.col, 0.78)) +
          courseArt(i, c.col) +
          rect(176, 28, c.label.length * 24 + 34, 40, c.col, { rx: 20 }) + text(c.label, 176 + (c.label.length * 24 + 34) / 2, 57, 24, { anchor: 'middle', weight: 800, fill: '#fff' }) +
          text(c.title, 176, 112, 32, { weight: 800 }) + text(c.sub, 176, 154, 22, { fill: '#7c82a6', weight: 500 }),
        { x: 30, y: y + (1 - clamp(a)) * 50, op: clamp(a), s: 1 + sel * 0.012, ox: 395, oy: 95 },
      ),
    )
  })
  return o.join('')
}

function courseArt(i: number, col: string): string {
  const o: string[] = []
  if (i === 0) o.push(path('M75 140 L75 100', 'none', { stroke: '#2a8f67', sw: 7 }), path('M75 104 q-34 -4 -36 -40 q34 2 36 40z', '#4ccf94'), path('M75 96 q30 -2 34 -34 q-32 0 -34 34z', '#37b57c'), rect(45, 138, 60, 10, '#a9743c', { rx: 5 }))
  if (i === 1) o.push(rect(34, 40, 82, 96, '#fff', { rx: 14 }), path('M50 70 h50 M50 90 h38 M50 110 h46', 'none', { stroke: col, sw: 7 }), sparkle(112, 44, 16, '#ffc83d'))
  if (i === 2) o.push(rect(30, 44, 90, 84, '#2a2f45', { rx: 14 }), path('M52 74 l-14 14 l14 14 M98 74 l14 14 l-14 14 M82 68 l-14 40', 'none', { stroke: '#8fd0ff', sw: 7 }))
  return o.join('')
}

function lessonView(l: number): string {
  const o: string[] = []
  // 左:AI 工具(對話與建立專案)
  const lp = pop(l, 0, 500)
  o.push(rect(0, 0, 400, 744 - 24, '#f6f7fd', { rx: 0 }))
  o.push(text('AI 助手', 28, 50, 24, { weight: 800, fill: '#6b72b0' }) + circle(120, 42, 9, '#7b6cf6', { op: 0.9 }))
  const msg = '幫我做一個咖啡店的一頁式網站'
  const shown = Math.floor(clamp(seg(l, 300, 1600)) * msg.length)
  o.push(rect(60, 78, 310, 108, '#e7e9ff', { rx: 24, op: clamp(seg(l, 200, 450)) }))
  o.push(text(msg.slice(0, 8).slice(0, Math.min(shown, 8)), 82, 124, 26, { fill: '#2f3350' }) + text(msg.slice(8, 16).slice(0, Math.max(0, shown - 8)), 82, 162, 26, { fill: '#2f3350' }))
  const ai = clamp(seg(l, 1900, 2200))
  o.push(rect(26, 214, 300, 64, '#fff', { rx: 24, stroke: '#e5e8f4', sw: 2, op: ai }) + text('好，先建立專案', 50, 255, 26, { fill: '#2f3350', op: ai }))
  const files = ['index.html', 'style.css', 'images/']
  files.forEach((f, i) => {
    const a = pop(l, 2400 + i * 480, 450)
    const done = clamp(seg(l, 2800 + i * 480, 3050 + i * 480))
    o.push(grp(rect(0, 0, 344, 62, '#fff', { rx: 16, stroke: '#e5e8f4', sw: 2 }) + path('M24 20 h16 l6 6 v18 h-22z', '#dfe4fb', { stroke: '#8f98d6', sw: 3 }) + text(f, 64, 41, 24, { weight: 600, fill: '#3a3f5c', font: "ui-monospace,Menlo,monospace" }) + grp(circle(0, 0, 15, '#3cc89a') + path('M-7 1 l5 6 l10 -12', 'none', { stroke: '#fff', sw: 4 }), { x: 310, y: 31, s: clamp(done), op: done }), { x: 28, y: 318 + i * 78 + (1 - clamp(a)) * 30, op: clamp(a) }))
  })
  o.push(rect(28, 590, 344, 18, '#e5e8f4', { rx: 9 }) + rect(28, 590, 344 * clamp(seg(l, 2400, 4300)), 18, '#7b6cf6', { rx: 9 }))
  // 右:做出來的網頁
  const pg: string[] = []
  const nav = pop(l, 2600, 450)
  const hero = pop(l, 3000, 560)
  pg.push(rect(0, 0, 400, 700, '#fffaf2', { rx: 18 }))
  pg.push(grp(rect(0, 0, 400, 56, '#fff', { rx: 18 }) + rect(0, 30, 400, 26, '#fff') + text('晨光咖啡', 24, 38, 24, { weight: 800, fill: '#7b4a22' }) + rect(250, 24, 36, 8, '#d9c3a6', { rx: 4 }) + rect(298, 24, 36, 8, '#d9c3a6', { rx: 4 }) + rect(346, 24, 30, 8, '#d9c3a6', { rx: 4 }), { op: clamp(nav) }))
  pg.push(grp(rect(16, 72, 368, 240, '#f4d9b6', { rx: 22 }) + circle(300, 190, 70, '#ffe9c4') + path('M268 170 h64 v34 q0 30 -32 30 q-32 0 -32 -30z', '#fff') + path('M332 178 q22 2 22 18 q0 16 -22 16', 'none', { stroke: '#fff', sw: 8 }) + text('一杯好咖啡', 40, 150, 40, { weight: 800, fill: '#6a3c18' }) + rect(40, 176, 150, 12, '#c79a63', { rx: 6 }) + rect(40, 198, 110, 12, '#d9b583', { rx: 6 }) + rect(40, 238, 124, 44, '#e0634f', { rx: 22 }) + text('來坐坐', 102, 269, 22, { anchor: 'middle', weight: 800, fill: '#fff' }), { op: clamp(hero), y: (1 - clamp(hero)) * 30 }))
  for (let i = 0; i < 3; i++) {
    const a = pop(l, 3700 + i * 260, 480)
    pg.push(grp(rect(0, 0, 112, 150, '#fff', { rx: 16, stroke: '#f0e2cc', sw: 2 }) + rect(10, 10, 92, 66, ['#f7c58f', '#e8a87c', '#cfe6c4'][i], { rx: 10 }) + rect(14, 92, 76, 10, '#d9c3a6', { rx: 5 }) + rect(14, 112, 52, 10, '#ecdcc4', { rx: 5 }), { x: 16 + i * 126, y: 340 + (1 - clamp(a)) * 40, op: clamp(a) }))
  }
  pg.push(grp(rect(16, 520, 368, 80, '#f4e6d0', { rx: 16 }) + rect(34, 540, 160, 12, '#d9c3a6', { rx: 6 }) + rect(34, 564, 110, 12, '#e5d3b8', { rx: 6 }), { op: clamp(seg(l, 4500, 4900)) }))
  o.push(grp(`<g clip-path="url(#clipPage)">${pg.join('')}</g>` + rect(0, 0, 400, 700, 'none', { rx: 18, stroke: '#e5e8f4', sw: 3 }), { x: 430, y: 12 }))
  return grp(o.join(''), { op: clamp(lp) })
}

export function courseScene(l: number): string {
  const o: string[] = []
  // 階梯
  const steps = [
    { x: 70, h: 100 },
    { x: 370, h: 190 },
    { x: 670, h: 280 },
  ]
  const base = 560
  steps.forEach((s, i) => {
    const a = outCubic(seg(l, 300 + i * 260, 900 + i * 260))
    const c = COURSES[i]
    const h = s.h * a
    o.push(rect(s.x, base - h, 270, h, c.col, { rx: 22 }) + rect(s.x, base - h, 270, 20 * a, '#ffffff', { rx: 22, op: 0.28 }) + (a > 0.7 ? text(c.label, s.x + 135, base - h + 66, 34, { anchor: 'middle', weight: 800, fill: '#fff', op: clamp((a - 0.7) / 0.3) }) : ''))
  })
  // 爬階梯的主角
  const px = track(l, [[1100, 205], [3000, 205], [3600, 505], [5600, 505], [6200, 805]])
  const stepTop = (i: number): number => base - steps[i].h - 52
  const py = track(l, [[1100, stepTop(0)], [3000, stepTop(0)], [3600, stepTop(1)], [5600, stepTop(1)], [6200, stepTop(2)]]) - Math.max(0, Math.sin(clamp(seg(l, 3000, 3600)) * Math.PI)) * 70 - Math.max(0, Math.sin(clamp(seg(l, 5600, 6200)) * Math.PI)) * 70
  const hp = pop(l, 900, 500)
  o.push(grp(circle(0, 0, 40, '#ffffff', { stroke: '#2a2f45', sw: 0 }) + `<g clip-path="url(#clipHero)">${circle(0, 0, 38, '#ffe9d6')}${person(LOOKS.hero, 0, 46, 0.4, 0.9, l)}</g>` + circle(0, 0, 38, 'none', { stroke: '#2a2f45', sw: 5 }), { x: px, y: py - 8, s: clamp(hp), op: clamp(hp) }))
  // 瀏覽器視窗
  const bp = pop(l, 0, 800)
  const by = 620
  const bw = 870
  const bh = 820
  const browser: string[] = []
  browser.push(`<g clip-path="url(#clipBrowser)">`)
  browser.push(rect(0, 0, bw, bh, '#fff'))
  browser.push(browserChrome(bw, 'evoleap.io', 10))
  const mapOut = clamp(seg(l, 2600, 3200))
  const lessonIn = clamp(seg(l, 2700, 3300))
  const area: string[] = []
  area.push(rect(0, 0, bw, bh - 76, '#fbfcff'))
  area.push(grp(courseMap(l), { x: 20 - mapOut * 140, op: 1 - mapOut }))
  area.push(grp(lessonView(l - 2700), { x: 20 + (1 - lessonIn) * 140, y: 6, op: lessonIn }))
  browser.push(grp(area.join(''), { y: 76 }))
  browser.push(`</g>` + rect(0, 0, bw, bh, 'none', { rx: 32, stroke: '#00000018', sw: 3 }))
  // 滑鼠:點第一張課程卡
  if (l > 1500 && l < 3000) {
    const k = track(l, [[1500, 0], [2200, 1]])
    browser.push(cursor(lerp(700, 330, k), lerp(480, 250, k), seg(l, 2200, 2400) * (1 - seg(l, 2400, 2700))))
  }
  o.push(`<rect x="70" y="${by + 14}" width="${bw}" height="${bh}" rx="32" fill="#2a2f45" opacity="0.16" filter="url(#blur18)" transform="translate(0 ${n2((1 - clamp(bp)) * 60)})"/>`)
  o.push(grp(browser.join(''), { x: 70, y: by + (1 - clamp(bp)) * 60, op: clamp(bp * 1.5) }))
  return o.join('')
}

// ====================================================== 6. 品牌收尾
export function brandScene(l: number): string {
  const o: string[] = []
  // 前一個畫面的瀏覽器往上縮走
  const away = inOutCubic(seg(l, 0, 800))
  if (away < 1) o.push(grp(courseScene(7600), { y: -away * 260, s: 1 - away * 0.4, op: 1 - away, ox: 540, oy: 700 }))
  // 標誌
  const lp = pop(l, 500, 800)
  const w = 700
  const h = (w * 48) / 164.78
  const svg = logoSvg.replace('<svg ', `<svg x="${n2((W - w) / 2)}" y="${n2(-h / 2)}" width="${w}" height="${n2(h)}" `)
  o.push(sparkles(540, 760, 12, 330, clamp(seg(l, 700, 2800)), l))
  o.push(grp(svg, { x: 0, y: 760 + (1 - clamp(lp)) * 40, s: clamp(lp) * 1, op: clamp(lp * 1.6), ox: 540, oy: 0 }))
  // 瀏覽器網址列
  const bp = pop(l, 1300, 700)
  const url = 'evoleap.io'
  const typed = Math.floor(clamp(seg(l, 1900, 2800)) * url.length)
  const enter = seg(l, 3100, 3500)
  const bar: string[] = []
  bar.push(rect(0, 0, 820, 120, '#fff', { rx: 30, stroke: '#e1e5f2', sw: 3 }))
  bar.push(circle(44, 36, 9, '#ff6b5b') + circle(72, 36, 9, '#ffc83d') + circle(100, 36, 9, '#3cc89a'))
  bar.push(rect(30, 54, 760, 50, '#f1f3fa', { rx: 25 }))
  bar.push(path('M64 77 v-7 a9 9 0 0 1 18 0 v7 M60 77 h26 v20 h-26z', 'none', { stroke: '#7c82a6', sw: 3.5 }))
  bar.push(text(url.slice(0, typed), 106, 91, 32, { weight: 700, fill: INK }))
  if (l > 1800 && l < 3300) bar.push(rect(106 + typed * 17.2 + 2, 62, 3, 34, '#4f5bd5', { op: Math.sin(l / 120) > 0 ? 1 : 0.15 }))
  if (enter > 0) bar.push(rect(30, 54, 760, 50, 'none', { rx: 25, stroke: '#4f5bd5', sw: 4, op: 1 - seg(l, 3500, 4300) }))
  o.push(grp(bar.join(''), { x: 130, y: 1030 + (1 - clamp(bp)) * 50, op: clamp(bp * 1.5) }))
  return o.join('')
}

export function sceneSvg(id: SceneId, l: number): string {
  switch (id) {
    case 'pain':
      return painScene(l)
    case 'ask':
      return askScene(l)
    case 'teacher':
    case 'nurse':
    case 'lawyer':
    case 'historian':
      return caseScene(id, l)
    case 'toolbox':
      return toolboxScene(l)
    case 'course':
      return courseScene(l)
    case 'brand':
      return brandScene(l)
  }
}

