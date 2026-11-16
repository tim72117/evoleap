// 演員 file-ai:「會操作檔案的 AI 工具」的情境動畫(用在第 0 課影片 1 開頭,取代純文字的章節卡)。
// 全部用 SVG 畫成插畫(資料夾視窗、檔案、AI 小圖示、終端機、對話框),所有動畫由 render 依時間算出:
// 不用 CSS 動畫、不用 Math.random;同樣的時間點一定畫出同樣的畫面。place 用 "full"(1920×1080 橫式)。
// 每一段都保留原本字卡的標題與副標,旁白字幕照舊,所以語音不用重錄。
//
// props:無
//
// 動作(任何一步都可以寫 ms 指定長度,動畫依比例放慢或加快):
//   { "scene": "four" }     這一課要做四件事:認識工具 → 安裝登入 → 練習資料夾 → 第一個檔案(也練習拒絕)
//   { "scene": "read" }     它能做的事 1/3 讀取檔案:AI 掃過資料夾、讀完一份會議記錄
//   { "scene": "write" }    它能做的事 2/3 建立與修改檔案:新增重點整理、改掉網頁上的文字
//   { "scene": "run" }      它能做的事 3/3 執行指令:開網頁、搬移檔案、刪除檔案
//   { "scene": "direct" }   和網頁聊天工具最大的差別:聊天只回文字,AI 工具直接改動檔案,動手前先問你
//   { "scene": "tools" }    常見的工具:Claude Code、Codex CLI、Gemini CLI、Cursor(選一個就好)
//
// 目標:window
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

export const SCENES = ['four', 'read', 'write', 'run', 'direct', 'tools'] as const
export type Scene = (typeof SCENES)[number]
export type FileAiStep = CommonStepFields & { scene?: Scene }
export interface FileAiState {
  scene: Scene | null
  prev: Scene | null
}
export type Target = 'window'

/** 各段預設長度(毫秒;約等於旁白長度,腳本通常自己寫 ms) */
export const T: Record<Scene, number> = { four: 18800, read: 11400, write: 9400, run: 8200, direct: 12400, tools: 19400 }
/** 換景時的交叉淡化(毫秒) */
export const FADE = 400

// ---------- 小工具 ----------
export const W = 1920
export const H = 1080
const n2 = (x: number) => Math.round(x * 100) / 100
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const seg = (l: number, a: number, b: number) => clamp((l - a) / (b - a))
const easeO = (t: number) => 1 - Math.pow(1 - t, 3)
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const outBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
/** 逐字出現 */
const typed = (s: string, p: number) => s.slice(0, Math.round(s.length * clamp(p)))

const INK = '#2b2f3a'
const SUB = '#6b7280'
const BLUE = '#3b82f6'
const GREEN = '#22b07d'
const ORANGE = '#ff8a3d'
const PURPLE = '#7c5cf0'
const RED = '#ef5b5b'
const FONT = "'PingFang TC','Noto Sans TC','Microsoft JhengHei',system-ui,sans-serif"

type TxtOpt = { w?: number; anchor?: 'start' | 'middle' | 'end'; op?: number; ls?: number; mono?: boolean }
const txt = (x: number, y: number, s: string, size: number, fill = INK, o: TxtOpt = {}) =>
  `<text x="${n2(x)}" y="${n2(y)}" font-size="${size}" font-weight="${o.w ?? 600}" fill="${fill}" text-anchor="${o.anchor ?? 'start'}"` +
  `${o.op !== undefined && o.op < 1 ? ` opacity="${n2(o.op)}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.mono ? ` font-family="ui-monospace,Menlo,monospace"` : ''}>${esc(s)}</text>`
const rr = (x: number, y: number, w: number, h: number, r: number, fill: string, extra = '') =>
  `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="${r}" fill="${fill}" ${extra}/>`
const g = (tx: number, ty: number, inner: string, o = 1, sc = 1) =>
  o <= 0.001 ? '' : `<g transform="translate(${n2(tx)} ${n2(ty)}) scale(${n2(sc)})" opacity="${n2(o)}">${inner}</g>`

// ---------- 共用元件 ----------
/** 每段開頭的標題:小標籤 + 大標題 + 副標 */
function heading(l: number, eyebrow: string, title: string, sub: string): string {
  const a = easeO(seg(l, 0, 500))
  return g(
    140,
    (1 - a) * 18,
    rr(0, 70, 8 + eyebrow.length * 28 + 40, 52, 26, '#fff', 'stroke="#e5e0d6" stroke-width="2"') +
      txt(24, 106, eyebrow, 26, SUB, { w: 700 }) +
      txt(0, 215, title, 80, INK, { w: 800 }) +
      txt(0, 280, sub, 36, SUB, { w: 500 }),
    a,
  )
}

/** 背景:暖米色漸層加幾塊緩慢漂動的色塊 */
function backdrop(l: number): string {
  const d = (k: number, r: number) => n2(Math.sin(l / 1800 + k) * r)
  return (
    `<defs><linearGradient id="fa-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf6ec"/><stop offset="1" stop-color="#e6eff8"/></linearGradient>` +
    `<linearGradient id="fa-ai" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9b82ff"/><stop offset="1" stop-color="#5b8cff"/></linearGradient>` +
    `<filter id="fa-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#2b2f3a" flood-opacity=".14"/></filter></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#fa-bg)"/>` +
    `<circle cx="${n2(1700 + +d(0, 30))}" cy="${n2(160 + +d(1, 20))}" r="260" fill="#ffd9b8" opacity=".35"/>` +
    `<circle cx="${n2(180 + +d(2, 24))}" cy="${n2(980 + +d(3, 18))}" r="300" fill="#cfe0ff" opacity=".4"/>` +
    `<circle cx="${n2(1000 + +d(4, 40))}" cy="${n2(1180 + +d(5, 20))}" r="260" fill="#d6f2e4" opacity=".4"/>`
  )
}

/** AI 小圖示:紫藍漸層的圓角方塊、兩顆會眨的眼睛;talk 0~1 嘴巴的起伏 */
function bot(cx: number, cy: number, s: number, l: number, talk = 0): string {
  const blink = l % 3200 < 130 ? 0.1 : 1
  const mouth = 6 + 10 * talk * (0.5 + 0.5 * Math.sin(l / 90))
  return g(
    cx,
    cy + Math.sin(l / 700) * 6,
    `<line x1="0" y1="-118" x2="0" y2="-92" stroke="#7c5cf0" stroke-width="6" stroke-linecap="round"/><circle cx="0" cy="-124" r="10" fill="${ORANGE}"/>` +
      `<rect x="-96" y="-92" width="192" height="168" rx="52" fill="url(#fa-ai)" filter="url(#fa-sh)"/>` +
      `<rect x="-72" y="-66" width="144" height="100" rx="34" fill="#fff" opacity=".95"/>` +
      `<ellipse cx="-30" cy="-18" rx="13" ry="${n2(15 * blink)}" fill="${INK}"/><ellipse cx="30" cy="-18" rx="13" ry="${n2(15 * blink)}" fill="${INK}"/>` +
      `<rect x="-16" y="6" width="32" height="${n2(mouth)}" rx="${n2(mouth / 2)}" fill="${INK}" opacity=".7"/>` +
      `<circle cx="-110" cy="10" r="14" fill="#7c5cf0"/><circle cx="110" cy="10" r="14" fill="#7c5cf0"/>`,
    1,
    s,
  )
}

/** 小小的文件圖示(右上折角);以左上角為原點,寬 52 高 64 */
function doc(x: number, y: number, color: string, o = 1, sc = 1): string {
  return g(
    x,
    y,
    `<path d="M0 8 Q0 0 8 0 H34 L52 18 V56 Q52 64 44 64 H8 Q0 64 0 56 Z" fill="#fff" stroke="${color}" stroke-width="4"/>` +
      `<path d="M34 0 V18 H52" fill="#eef2ff" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>` +
      `<rect x="10" y="30" width="30" height="5" rx="2.5" fill="${color}" opacity=".55"/><rect x="10" y="42" width="22" height="5" rx="2.5" fill="${color}" opacity=".55"/>`,
    o,
    sc,
  )
}

/** 資料夾圖示;以左上角為原點,寬 72 高 56 */
function folder(x: number, y: number, color = '#f6b94a', o = 1, sc = 1): string {
  return g(
    x,
    y,
    `<path d="M0 10 Q0 2 8 2 H26 L34 12 H64 Q72 12 72 20 V48 Q72 56 64 56 H8 Q0 56 0 48 Z" fill="${color}"/>` + `<rect x="0" y="20" width="72" height="36" rx="8" fill="#ffd27a" opacity=".9"/>`,
    o,
    sc,
  )
}

/** 視窗外框:白底圓角、上方三顆點與標題 */
function win(x: number, y: number, w: number, h: number, title: string, body: string, o = 1, sc = 1): string {
  return g(
    x,
    y,
    rr(0, 0, w, h, 26, '#fff', 'filter="url(#fa-sh)"') +
      rr(0, 0, w, 64, 26, '#f3f0ea') +
      rr(0, 38, w, 26, 0, '#f3f0ea') +
      `<circle cx="34" cy="32" r="9" fill="#ff6b6b"/><circle cx="64" cy="32" r="9" fill="#ffc94d"/><circle cx="94" cy="32" r="9" fill="#3ccf91"/>` +
      txt(w / 2, 42, title, 26, SUB, { anchor: 'middle', w: 600 }) +
      body,
    o,
    sc,
  )
}

type Row = { name: string; kind: 'doc' | 'dir' | 'sheet' | 'md' }
/** 資料夾視窗裡的一列檔案;p 是出場進度、hl 是被 AI 掃到的亮度 */
function row(x: number, y: number, w: number, r: Row, p: number, hl: number): string {
  const color = r.kind === 'sheet' ? GREEN : r.kind === 'md' ? ORANGE : BLUE
  const icon = r.kind === 'dir' ? folder(0, 0, '#f6b94a', 1, 0.78) : doc(0, 0, color, 1, 0.78)
  return g(
    x + (1 - easeO(p)) * 40,
    y,
    rr(0, 0, w, 84, 18, hl > 0.01 ? `rgba(59,130,246,${n2(0.12 * hl)})` : 'rgba(0,0,0,0)') + g(24, 16, icon) + txt(104, 54, r.name, 32, INK, { w: 600 }),
    easeO(p),
  )
}

const FILES: Row[] = [
  { name: '會議記錄.docx', kind: 'doc' },
  { name: '旅行照片', kind: 'dir' },
  { name: '家庭帳本.xlsx', kind: 'sheet' },
]

/** 對話泡泡(圓角框加小尾巴) */
function bubble(x: number, y: number, w: number, h: number, body: string, o = 1, fill = '#fff', tail: 'left' | 'right' = 'left'): string {
  const t = tail === 'left' ? `<path d="M30 ${h - 4} L-14 ${h + 26} L68 ${h - 4} Z" fill="${fill}"/>` : `<path d="M${w - 30} ${h - 4} L${w + 14} ${h + 26} L${w - 68} ${h - 4} Z" fill="${fill}"/>`
  return g(x, y, `<g filter="url(#fa-sh)">${rr(0, 0, w, h, 30, fill)}${t}</g>` + body, o)
}

/** 一條一條的文字線(表示內容),p 0~1 逐條畫出 */
function lines(x: number, y: number, widths: number[], p: number, color = '#c9d3e0', gap = 26): string {
  return widths
    .map((w, i) => {
      const k = clamp(p * widths.length - i)
      return k > 0.001 ? rr(x, y + i * gap, w * k, 10, 5, color) : ''
    })
    .join('')
}

// ---------- 六段 ----------
type Out = string

/** 這一課要做四件事 */
function four(l: number): Out {
  const items = [
    { t: 3200, title: '認識工具', sub: '它能對你的檔案做什麼', color: BLUE },
    { t: 8200, title: '安裝並登入', sub: '從官方網站下載', color: PURPLE },
    { t: 11800, title: '練習資料夾', sub: '專門給它練習的地方', color: ORANGE },
    { t: 15200, title: '建立第一個檔案', sub: '也練習拒絕它', color: GREEN },
  ]
  const cw = 380
  const gap = 36
  const x0 = (W - (cw * 4 + gap * 3)) / 2
  let s = heading(l, '起步 · 第 0 課 · 影片 1', '會操作檔案的 AI 工具', '認識工具、安裝登入、準備練習資料夾，再讓 AI 建立第一個檔案')
  // 連線:依序亮起
  const prog = clamp((l - 3200) / (15200 - 3200))
  s += rr(x0 + cw / 2, 598, (cw + gap) * 3, 8, 4, '#d9d4c8') + rr(x0 + cw / 2, 598, (cw + gap) * 3 * easeIO(prog), 8, 4, '#7c5cf0')
  items.forEach((it, i) => {
    const p = outBack(seg(l, it.t - 500, it.t + 300))
    const on = p > 0.001
    const active = l >= it.t && (i === 3 || l < items[i + 1].t)
    const x = x0 + i * (cw + gap)
    const pulse = active ? 1 + 0.018 * Math.sin(l / 160) : 1
    let icon = ''
    if (i === 0) {
      // 放大鏡掃過一個文件
      const sx = Math.sin(l / 500) * 14
      icon = doc(-26, -36, BLUE, 1, 1.3) + `<g transform="translate(${n2(30 + sx)} 20)"><circle r="30" fill="none" stroke="${INK}" stroke-width="9"/><line x1="22" y1="22" x2="48" y2="48" stroke="${INK}" stroke-width="10" stroke-linecap="round"/></g>`
    } else if (i === 1) {
      const dy = Math.sin(l / 260) * 8
      icon = `<g transform="translate(0 ${n2(dy)})"><path d="M0 -50 V16 M-26 -10 L0 20 L26 -10" fill="none" stroke="${PURPLE}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></g><rect x="-52" y="40" width="104" height="14" rx="7" fill="${PURPLE}" opacity=".35"/>`
    } else if (i === 2) {
      icon = folder(-72, -52, '#f6b94a', 1, 2) + txt(0, 70, 'practice', 30, INK, { anchor: 'middle', mono: true, w: 700 })
    } else {
      const ok = seg(l, it.t + 600, it.t + 1000)
      const no = seg(l, it.t + 2400, it.t + 2800)
      icon =
        doc(-70, -50, GREEN, 1, 1.5) +
        (ok > 0 ? `<circle cx="44" cy="40" r="${n2(26 * easeO(ok))}" fill="${GREEN}"/><path d="M33 40 L42 49 L56 31" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="${n2(ok)}"/>` : '') +
        (no > 0 ? `<circle cx="-48" cy="46" r="${n2(26 * easeO(no))}" fill="${RED}"/><path d="M-58 36 L-38 56 M-38 36 L-58 56" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="${n2(no)}"/>` : '')
    }
    s += g(
      x + cw / 2,
      650,
      `<g transform="scale(${n2(pulse)})">` +
        rr(-cw / 2, -330, cw, 560, 38, '#fff', `filter="url(#fa-sh)" ${active ? `stroke="${it.color}" stroke-width="6"` : ''}`) +
        `<circle cx="0" cy="-262" r="38" fill="${it.color}"/>` +
        txt(0, -248, String(i + 1), 44, '#fff', { anchor: 'middle', w: 800 }) +
        `<g transform="translate(0 -90)">${icon}</g>` +
        txt(0, 100, it.title, 42, INK, { anchor: 'middle', w: 800 }) +
        txt(0, 156, it.sub, 28, SUB, { anchor: 'middle', w: 500 }) +
        `</g>`,
      on ? clamp(p) : 0,
      1,
    )
  })
  return s
}

/** 讀取檔案 */
function read(l: number): Out {
  let s = heading(l, '它能做的事 · 1／3', '讀取檔案', '例如看看資料夾裡有哪些檔案、讀完一份會議記錄')
  const scan = seg(l, 2200, 5200)
  const idx = Math.min(2, Math.floor(scan * 3))
  const focusDoc = seg(l, 5600, 6200)
  let body = ''
  FILES.forEach((f, i) => {
    const hl = scan > 0 && scan < 1 ? (idx === i ? 1 : 0) : i === 0 ? focusDoc : 0
    body += row(30, 90 + i * 100, 640, f, seg(l, 300 + i * 260, 900 + i * 260), hl)
  })
  s += win(150, 400, 700, 460, '文件', body, easeO(seg(l, 200, 800)))
  // 資料流:文件 → AI
  if (l > 5600) {
    for (let k = 0; k < 5; k++) {
      const t = ((l - 5600) / 1400 + k / 5) % 1
      s += `<circle cx="${n2(870 + 330 * t)}" cy="${n2(520 + Math.sin(t * 6.28) * 18)}" r="9" fill="${BLUE}" opacity="${n2(Math.sin(t * Math.PI))}"/>`
    }
  }
  s += bot(1030, 600, 1.15, l, l > 6800 ? 1 : 0)
  const say = seg(l, 6800, 9800)
  s += bubble(1180, 380, 600, 290, txt(40, 70, '讀完了！重點是：', 34, INK, { w: 700 }) + lines(40, 110, [480, 420, 500, 360], say, '#b8c4d6', 36) + txt(40, 262, typed('✓ 下週三開會　✓ 三個待辦', say), 30, GREEN, { w: 700 }), easeO(seg(l, 6600, 7000)), '#fff', 'left')
  return s
}

/** 建立與修改檔案 */
function write(l: number): Out {
  let s = heading(l, '它能做的事 · 2／3', '建立與修改檔案', '例如把整理好的重點存成新檔案、修改網頁上的文字')
  let body = ''
  FILES.forEach((f, i) => {
    body += row(30, 90 + i * 100, 640, f, seg(l, 200 + i * 200, 800 + i * 200), 0)
  })
  const born = outBack(seg(l, 2600, 3300))
  if (born > 0.001) {
    body += g(30, 390, rr(0, 0, 640, 84, 18, 'rgba(255,138,61,.14)') + g(24, 16, doc(0, 0, ORANGE, 1, 0.78)) + txt(104, 54, '重點整理.md', 32, INK, { w: 700 }) + rr(520, 24, 96, 38, 19, ORANGE) + txt(568, 51, 'NEW', 22, '#fff', { anchor: 'middle', w: 800 }), clamp(born), 0.9 + 0.1 * clamp(born))
  }
  s += win(120, 400, 700, 560, '文件', body, easeO(seg(l, 100, 700)))
  // 新檔案的內容逐行寫出
  s += g(
    880,
    430,
    `<g filter="url(#fa-sh)">${rr(0, 0, 330, 220, 22, '#fff')}</g>` + txt(26, 52, '# 重點整理', 28, ORANGE, { mono: true, w: 800 }) + lines(26, 84, [250, 210, 260, 170], seg(l, 3300, 5200), '#f2c9a8', 34),
    easeO(seg(l, 3000, 3500)),
  )
  s += bot(960, 760, 0.9, l, l > 2600 && l < 5400 ? 1 : 0)
  // 右邊:網頁上的文字被改掉
  const swap = seg(l, 6200, 7000)
  const web =
    rr(0, 0, 560, 70, 0, '#f6f1e7') +
    rr(26, 22, 14, 14, 7, '#d9d4c8') +
    rr(60, 16, 400, 38, 19, '#fff') +
    rr(60, 120, 440, 150, 22, swap < 0.5 ? '#f3f0ea' : 'rgba(34,176,125,.14)') +
    txt(280, 220, '歡迎光臨', 68, swap < 0.5 ? INK : 'rgba(0,0,0,0)', { anchor: 'middle', w: 800 }) +
    txt(280, 220, '歡迎回家', 68, GREEN, { anchor: 'middle', w: 800, op: easeO(clamp((swap - 0.5) * 2)) }) +
    (swap > 0.05 && swap < 0.5 ? `<rect x="${n2(120 + 20 * swap)}" y="168" width="${n2(320 * seg(swap, 0.05, 0.5))}" height="8" rx="4" fill="${RED}"/>` : '') +
    lines(60, 320, [440, 380, 410], seg(l, 700, 1600), '#d6dde8', 34)
  s += g(1260, 430, `<g filter="url(#fa-sh)"><rect width="560" height="440" rx="26" fill="#fff"/></g><g clip-path="inset(0 round 26px)">${web}</g>`, easeO(seg(l, 5600, 6300)))
  s += txt(1540, 930, '修改網頁上的文字', 30, SUB, { anchor: 'middle', op: easeO(seg(l, 6000, 6600)) })
  return s
}

/** 執行指令 */
function run(l: number): Out {
  let s = heading(l, '它能做的事 · 3／3', '執行指令', '例如用瀏覽器打開網頁、搬移或刪除檔案')
  const cmds = [
    { t: 1000, text: '$ open index.html', done: 2400 },
    { t: 3600, text: '$ mv 照片.jpg 旅行照片/', done: 4800 },
    { t: 5600, text: '$ rm 舊檔案.txt', done: 6600 },
  ]
  let term = ''
  cmds.forEach((c, i) => {
    const p = seg(l, c.t, c.t + 900)
    term += txt(36, 130 + i * 90, typed(c.text, p), 34, '#e8ecf3', { mono: true, w: 600 })
    if (l >= c.done) term += txt(36, 130 + i * 90 + 36, '✓ 完成', 24, '#6ee7b7', { mono: true, w: 600 })
  })
  const caret = Math.floor(l / 450) % 2 === 0 ? '█' : ''
  term += txt(36, 130 + 3 * 90, '$ ' + caret, 34, '#e8ecf3', { mono: true })
  s += g(130, 420, `<g filter="url(#fa-sh)">${rr(0, 0, 780, 430, 26, '#1f2430')}</g>` + rr(0, 0, 780, 56, 26, '#2a3040') + rr(0, 30, 780, 26, 0, '#2a3040') + `<circle cx="34" cy="28" r="8" fill="#ff6b6b"/><circle cx="62" cy="28" r="8" fill="#ffc94d"/><circle cx="90" cy="28" r="8" fill="#3ccf91"/>` + `<g transform="translate(0 40)">${term}</g>`, easeO(seg(l, 100, 700)))
  // 右邊三格結果
  const tile = (i: number, t0: number, inner: string, label: string) =>
    g(
      960 + i * 290,
      440,
      `<g filter="url(#fa-sh)">${rr(0, 0, 260, 380, 28, '#fff')}</g>` + inner + txt(130, 340, label, 28, SUB, { anchor: 'middle' }),
      outBack(seg(l, t0, t0 + 500)) > 0.001 ? clamp(outBack(seg(l, t0, t0 + 500))) : 0,
    )
  // 1 開網頁:瀏覽器視窗展開
  const open = easeO(seg(l, 2400, 3200))
  s += tile(0, 2300, g(130, 150, rr(-90, -70, 180, 140, 14, '#f3f0ea') + rr(-90, -70, 180, 26, 14, '#e4dfd3') + `<circle cx="-72" cy="-57" r="5" fill="#ff6b6b"/><circle cx="-56" cy="-57" r="5" fill="#ffc94d"/>` + txt(0, 14, '歡迎回家', 28, GREEN, { anchor: 'middle', w: 800 }), 1, 0.3 + 0.7 * open), '打開網頁')
  // 2 搬移:檔案飛進資料夾
  const mv = easeIO(seg(l, 4800, 5600))
  s += tile(1, 4700, folder(94, 170, '#f6b94a', 1, 1.2) + doc(79 + 80 * mv - 80, 60 + 170 * mv - 20, BLUE, 1 - 0.7 * mv, 0.9), '搬移檔案')
  // 3 刪除:檔案淡出,垃圾桶
  const del = easeIO(seg(l, 6600, 7400))
  s += tile(2, 6500, doc(104, 80 + 110 * del, RED, 1 - del, 0.95) + `<g transform="translate(130 210)"><path d="M-36 -10 H36 L30 70 Q29 78 21 78 H-21 Q-29 78 -30 70 Z" fill="#c7ccd6"/><rect x="-44" y="-26" width="88" height="14" rx="7" fill="#aab1bf"/><rect x="-14" y="-38" width="28" height="12" rx="6" fill="#aab1bf"/></g>`, '刪除檔案')
  return s
}

/** 它會直接改動你電腦上的檔案 */
function direct(l: number): Out {
  let s = heading(l, '和網頁聊天工具最大的差別', '它會直接改動你電腦上的檔案', '所以它動手前會先問你，我們也會準備一個專用的練習資料夾')
  // 左:網頁聊天工具,只有文字
  const a = easeO(seg(l, 500, 1100))
  s += g(
    130,
    420,
    `<g filter="url(#fa-sh)">${rr(0, 0, 780, 520, 30, '#fff')}</g>` + txt(40, 64, '網頁上的聊天工具', 32, SUB, { w: 700 }) +
      rr(40, 100, 480, 90, 28, '#eef2f8') + txt(70, 156, '幫我整理這份記錄', 30, INK, { w: 500 }) +
      g(240, 220, rr(0, 0, 500, 130, 28, '#e9e4ff') + lines(30, 36, [380, 320, 400], seg(l, 1800, 3400), '#b9aef0', 30)) +
      txt(390, 440, '只回文字，檔案要你自己動手', 30, RED, { anchor: 'middle', w: 700, op: easeO(seg(l, 3600, 4200)) }) +
      (seg(l, 3600, 4200) > 0 ? `<path d="M330 400 L450 400" stroke="${RED}" stroke-width="0"/>` : ''),
    a,
  )
  // 右:AI 工具直接動檔案
  const b = easeO(seg(l, 4300, 5000))
  const touch = seg(l, 5200, 6800)
  const ask = outBack(seg(l, 7000, 7600))
  const choice = seg(l, 9400, 9800)
  let right = `<g filter="url(#fa-sh)">${rr(0, 0, 780, 520, 30, '#fff')}</g>` + txt(40, 64, '會操作檔案的 AI 工具', 32, BLUE, { w: 700 })
  right += rr(40, 100, 330, 330, 26, 'rgba(255,138,61,.12)', `stroke="${ORANGE}" stroke-width="4" stroke-dasharray="14 10"`) + folder(70, 126, '#f6b94a', 1, 1.1) + txt(160, 170, 'practice', 30, INK, { mono: true, w: 700 })
  right += g(72, 230, doc(0, 0, BLUE, 1, 0.9) + txt(66, 44, 'notes.txt', 26, INK, { mono: true, w: 600 }), 1)
  right += g(72, 310, doc(0, 0, ORANGE, easeO(seg(l, 5200, 5800)), 0.9) + txt(66, 44, 'new.md', 26, INK, { mono: true, w: 600, op: easeO(seg(l, 5200, 5800)) }))
  right += `<path d="M560 300 Q470 ${n2(300 - 40 * Math.sin(touch * 3.14))} 330 ${n2(340)}" fill="none" stroke="${PURPLE}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${n2(300 * easeO(touch))} 400" opacity="${n2(touch > 0 ? 0.7 : 0)}"/>`
  s += g(1010, 420, right, b)
  s += g(0, 0, bot(1650, 690, 0.75, l, touch > 0 && touch < 1 ? 1 : 0), b)
  // 動手前先問你
  if (ask > 0.001) {
    const hot = choice > 0 ? 1 : 0
    s += g(
      1380,
      180,
      `<g filter="url(#fa-sh)">${rr(0, 0, 440, 240, 28, '#fff', `stroke="${ORANGE}" stroke-width="5"`)}</g>` +
        txt(220, 70, '要建立 new.md 嗎？', 34, INK, { anchor: 'middle', w: 800 }) +
        txt(220, 112, '動手前先問你', 24, SUB, { anchor: 'middle', w: 500 }) +
        rr(30, 148, 180, 64, 22, hot ? GREEN : '#e8f7f0') + txt(120, 192, '允許', 30, hot ? '#fff' : GREEN, { anchor: 'middle', w: 800 }) +
        rr(230, 148, 180, 64, 22, '#fdecec') + txt(320, 192, '拒絕', 30, RED, { anchor: 'middle', w: 800 }),
      clamp(ask),
      0.9 + 0.1 * clamp(ask),
    )
  }
  return s
}

/** 常見的工具 */
function tools(l: number): Out {
  let s = heading(l, '選一個就好', '常見的工具', 'Claude Code · OpenAI Codex CLI · Gemini CLI · Cursor 的 Agent 模式')
  const list = [
    { name: 'Claude Code', sub: 'Anthropic', t: 2400, color: ORANGE },
    { name: 'OpenAI Codex CLI', sub: 'OpenAI', t: 5200, color: GREEN },
    { name: 'Gemini CLI', sub: 'Google', t: 7600, color: BLUE },
    { name: 'Cursor', sub: 'Agent 模式', t: 9600, color: PURPLE },
  ]
  const cw = 380
  const gap = 36
  const x0 = (W - (cw * 4 + gap * 3)) / 2
  list.forEach((it, i) => {
    const p = outBack(seg(l, it.t, it.t + 600))
    const x = x0 + i * (cw + gap)
    s += g(
      x + cw / 2,
      700,
      rr(-cw / 2, -190, cw, 380, 36, '#fff', 'filter="url(#fa-sh)"') + `<rect x="${-cw / 2 + 40}" y="-140" width="${cw - 80}" height="120" rx="24" fill="${it.color}" opacity=".14"/>` +
        txt(0, -60, '>_', 64, it.color, { anchor: 'middle', mono: true, w: 800 }) +
        txt(0, 50, it.name, it.name.length > 12 ? 34 : 42, INK, { anchor: 'middle', w: 800 }) +
        txt(0, 100, it.sub, 28, SUB, { anchor: 'middle', w: 500 }) +
        rr(-70, 130, 140, 36, 18, it.color, 'opacity=".9"') + txt(0, 156, 'AI Agent', 22, '#fff', { anchor: 'middle', w: 700 }),
      clamp(p),
      0.85 + 0.15 * clamp(p),
    )
  })
  const note = easeO(seg(l, 12600, 13400))
  s += g(W / 2, 960, rr(-520, -46, 1040, 92, 46, '#fff', 'filter="url(#fa-sh)"') + txt(0, 14, '本課示範其中一個，其他工具的操作大同小異', 34, INK, { anchor: 'middle', w: 700 }), note, 0.96 + 0.04 * note)
  return s
}

export const DRAW: Record<Scene, (l: number) => Out> = { four, read, write, run, direct, tools }

export function apply(st: FileAiState, kind: 'scene', s: FileAiStep): FileAiState {
  void kind
  if (!s.scene || !(SCENES as readonly string[]).includes(s.scene)) throw new Error(`scene 要寫 ${SCENES.join('、')} 其中之一`)
  return { scene: s.scene, prev: st.scene }
}

/** 某一刻整張畫面的 SVG(純函式:同樣的輸入一定同樣的字串) */
export function frameSvg(st: FileAiState, l: number): string {
  if (!st.scene) return ''
  const body = (sc: Scene, t: number) => backdrop(t) + DRAW[sc](t)
  const f = clamp(l / FADE)
  if (st.prev && f < 1) return `<g opacity="${n2(1 - f)}">${body(st.prev, 1000000)}</g><g opacity="${n2(f)}">${body(st.scene, l)}</g>`
  return body(st.scene, l)
}

const actor = defineActor<'scene', FileAiStep, object, FileAiState, Target>({
  name: 'file-ai',
  kinds: ['scene'],
  fixedSize: true,
  init() {
    return { scene: null, prev: null }
  },
  apply,
  duration(_kind, step) {
    return T[(step.scene ?? 'four') as Scene] ?? 8000
  },
  autoFocus() {
    return undefined
  },
  mount(root) {
    root.classList.add('A-file-ai')
    root.innerHTML = `<svg class="fa-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" font-family="${FONT}" xmlns="http://www.w3.org/2000/svg"></svg>`
    const svg = root.querySelector<SVGSVGElement>('.fa-svg')!
    let last = ''
    return {
      render(frame, ms) {
        const view = frame.view
        if (!view) return
        const ev = view.ev
        const running = ev && ev.kind !== 'hide'
        // 動畫依比例放慢或加快:把這一步的實際長度換算成預設長度
        const sc = view.state.scene
        const base = sc ? T[sc] : 1000
        const l = running ? (ev!.local / Math.max(1, ev!.dur)) * base : 100000 + ms
        const html = frameSvg(view.state, l)
        if (html !== last) {
          last = html
          svg.innerHTML = html
        }
      },
      target() {
        return root
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
