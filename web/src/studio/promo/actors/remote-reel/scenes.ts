// remote-reel 的各段畫面:全是純函式(時間進來、SVG 字串出去),不用亂數、不讀時鐘。
// 辦公室電腦 = 左上的螢幕(藍),家裡的手機 = 手機外框(綠);兩邊是同一個 session,用虛線與移動的點連起來。
// 版面在直式 Reels 安全區內(x 70–940、y 250–1500)。畫面裡的專案、指令都是示意。
import { INK, MONO, SANS, clamp, cursor, esc, lerp, mix, n2, outBack, path2, seg, type SceneOut } from '../archify-reel/draw'
import { follow } from '../sessions-reel/scenes'

export { follow }

const CX = 505 // 安全區的中線
const BG = '#f4efe8'
const NIGHT = '#d8d2e6'
const ACCENT = '#c8643c'
const MUTED = '#6b6155'
const TERM = '#1d1b24'
const TEXT = '#e8e4dc'
const BLUE = '#5b8def'
const GREEN = '#3fbf78'
const RED = '#d6453d'

const txt = (x: number, y: number, s: string, size: number, fill = INK, o: { anchor?: string; weight?: number; font?: string; op?: number } = {}): string =>
  `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${o.anchor ?? 'start'}" font-family="${o.font ?? SANS}" font-size="${size}" font-weight="${o.weight ?? 600}" fill="${fill}" opacity="${n2(o.op ?? 1)}">${esc(s)}</text>`

/** 粗估字串寬度:全形字算一格,半形字算 0.58 格 */
const textW = (s: string, size: number): number => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 1 : 0.58), 0) * size

const pill = (cx: number, cy: number, label: string, fill: string, color: string, op = 1, fs = 30, sc = 1): string => {
  const w = textW(label, fs) + fs * 1.6
  const h = fs * 1.9
  return `<g opacity="${n2(op)}" transform="translate(${n2(cx)} ${n2(cy)}) scale(${n2(sc)})"><rect x="${n2(-w / 2)}" y="${n2(-h / 2)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(h / 2)}" fill="${fill}"/>${txt(0, fs * 0.36, label, fs, color, { anchor: 'middle', weight: 800 })}</g>`
}

const typed = (s: string, p: number): string => [...s].slice(0, Math.floor([...s].length * clamp(p))).join('')
const show = (l: number, a: number): number => seg(l, a, a + 300)
/** 規律閃爍(0.45~1) */
const pulse = (l: number, period = 700): number => 0.725 + 0.275 * Math.sin((l / period) * Math.PI * 2)

type Line = { s: string; c?: string; op?: number; p?: number }

/** 辦公室電腦的螢幕:標題列、至多 5 行文字、桌面底座;glow 是外框亮起的程度 */
function monitor(x: number, y: number, w: number, h: number, title: string, lines: Line[], o: { glow?: number; fs?: number; op?: number } = {}): string {
  const fs = o.fs ?? 30
  let s = `<g opacity="${n2(o.op ?? 1)}">`
  if (o.glow) s += `<rect x="${x - 9}" y="${y - 9}" width="${w + 18}" height="${h + 18}" rx="34" fill="none" stroke="${BLUE}" stroke-width="6" opacity="${n2(o.glow)}"/>`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="${TERM}"/>`
  s += `<circle cx="${x + 44}" cy="${y + 42}" r="12" fill="${BLUE}"/>${txt(x + 70, y + 52, title, 28, '#fff', { weight: 800 })}`
  s += `<line x1="${x}" y1="${y + 82}" x2="${x + w}" y2="${y + 82}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>`
  lines.slice(0, 5).forEach((ln, i) => {
    const op = ln.op ?? 1
    if (op <= 0) return
    const str = ln.p === undefined ? ln.s : typed(ln.s, ln.p)
    s += txt(x + 38, y + 136 + i * (fs * 1.9), str, fs, ln.c ?? TEXT, { op, font: MONO, weight: 500 })
  })
  // 底座
  s += `<rect x="${x + w / 2 - 14}" y="${y + h}" width="28" height="34" fill="#8a8497"/><rect x="${x + w / 2 - 90}" y="${y + h + 30}" width="180" height="14" rx="7" fill="#8a8497"/>`
  return s + '</g>'
}

/** 手機外框;回傳螢幕的位置(給裡面的內容用) */
function phone(x: number, y: number, w: number, h: number, op = 1): string {
  return `<g opacity="${n2(op)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${n2(w * 0.12)}" fill="#26232e"/><rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${h - 24}" rx="${n2(w * 0.1)}" fill="#fbfaf7"/><rect x="${n2(x + w / 2 - 44)}" y="${y + 22}" width="88" height="14" rx="7" fill="#26232e"/></g>`
}

/** 房子:家裡 */
function house(cx: number, y: number, s = 1): string {
  return `<g transform="translate(${n2(cx)} ${n2(y)}) scale(${n2(s)})"><polygon points="-150,0 0,-110 150,0" fill="${ACCENT}"/><rect x="-120" y="0" width="240" height="150" rx="10" fill="#e9dccb"/><rect x="-28" y="46" width="56" height="104" rx="8" fill="#b9825a"/><rect x="62" y="30" width="44" height="44" rx="6" fill="#bfe1f5"/></g>`
}

/** 虛線上依時間移動的點(從 a 到 b) */
function flow(a: [number, number], b: [number, number], l: number, color: string, op = 1): string {
  let s = `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="${color}" stroke-width="4" stroke-dasharray="12 12" opacity="${n2(op * 0.6)}"/>`
  for (let k = 0; k < 3; k++) {
    const p = (l / 1400 + k / 3) % 1
    s += `<circle cx="${n2(lerp(a[0], b[0], p))}" cy="${n2(lerp(a[1], b[1], p))}" r="9" fill="${color}" opacity="${n2(op * (1 - Math.abs(p - 0.5) * 0.6))}"/>`
  }
  return s
}

/** 雲(連線的示意) */
const cloud = (cx: number, cy: number, op = 1): string =>
  `<g opacity="${n2(op)}" transform="translate(${n2(cx)} ${n2(cy)})"><circle cx="-34" cy="6" r="30" fill="#fff"/><circle cx="6" cy="-10" r="40" fill="#fff"/><circle cx="46" cy="8" r="28" fill="#fff"/><rect x="-60" y="6" width="128" height="30" rx="15" fill="#fff"/></g>`

const WORK: Line[] = [
  { s: '> 重構付款模組', c: '#fff' },
  { s: '✻ 執行中… 12 個檔案' },
]

// ---------- 各段 ----------
/** 開場:下班了,辦公室電腦上的 Claude Code 還在跑,你先回家 */
export function hook(l: number): SceneOut {
  let s = txt(CX, 400, '下班了，', 58, MUTED, { anchor: 'middle', weight: 800, op: seg(l, 0, 450) })
  s += txt(CX, 510, '電腦上的 Claude Code 還在跑', 56, ACCENT, { anchor: 'middle', weight: 800, op: seg(l, 250, 750) })
  const dots = '.'.repeat(Math.floor(l / 300) % 4)
  s += monitor(150, 620, 780, 440, '辦公室電腦', [
    { s: WORK[0].s, c: '#fff', p: seg(l, 300, 1100) },
    { s: `✻ 執行中${dots}`, op: show(l, 1100) },
    { s: '■'.repeat(Math.floor(lerp(0, 18, seg(l, 1200, 4200)))), c: BLUE, op: show(l, 1200) },
  ], { glow: pulse(l, 900) * 0.6 })
  s += pill(850, 580, '18:30', INK, '#fff', show(l, 800), 30)
  // 你背著包往右走,離開
  const walk = seg(l, 2000, 4000)
  const px = lerp(320, 860, walk)
  if (walk > 0) s += `<g opacity="${n2(1 - seg(l, 3300, 4100))}"><circle cx="${n2(px)}" cy="1330" r="52" fill="${ACCENT}"/>${txt(px, 1346, '你', 40, '#fff', { anchor: 'middle', weight: 800 })}<rect x="${n2(px - 78)}" y="1310" width="40" height="64" rx="12" fill="${INK}"/></g>`
  else s += `<g><circle cx="320" cy="1330" r="52" fill="${ACCENT}"/>${txt(320, 1346, '你', 40, '#fff', { anchor: 'middle', weight: 800 })}<rect x="242" y="1310" width="40" height="64" rx="12" fill="${INK}"/></g>`
  s += txt(CX, 1470, '你先回家了', 44, MUTED, { anchor: 'middle', op: seg(l, 2600, 3100) })
  return { bg: mix(BG, NIGHT, seg(l, 1200, 3600)), body: s }
}

/** 痛點:跑到一半卡在等你允許,你人在家,只能等明天進公司 */
export function pain(l: number): SceneOut {
  let s = txt(CX, 320, '跑到一半，卡住了', 58, INK, { anchor: 'middle', weight: 800, op: seg(l, 0, 450) })
  const ask = show(l, 900)
  s += monitor(150, 400, 780, 470, '辦公室電腦', [
    { s: '> npm test', c: '#fff' },
    { s: '12 通過 · 1 失敗' },
    { s: '要允許執行 npm run fix 嗎？', c: '#f3a468', op: ask },
  ], { glow: ask * pulse(l, 600) * 0.8 })
  if (ask > 0) {
    s += pill(380, 780, '允許', GREEN, '#fff', ask * pulse(l, 600), 28)
    s += pill(560, 780, '拒絕', '#4a4656', '#fff', ask, 28)
  }
  s += pill(CX, 960, '在等你按下去…', RED, '#fff', show(l, 1500), 34)
  // 你在家
  const h = outBack(seg(l, 1900, 2500))
  if (h > 0) s += house(300, 1130, 0.85 * h)
  s += `<g opacity="${n2(show(l, 2200))}"><circle cx="300" cy="1300" r="44" fill="${ACCENT}"/>${txt(300, 1314, '你', 36, '#fff', { anchor: 'middle', weight: 800 })}</g>`
  const t = outBack(seg(l, 2700, 3200))
  if (t > 0) s += `<g transform="translate(670 1190) scale(${n2(t)})"><rect x="-230" y="-70" width="460" height="140" rx="40" fill="#fff" stroke="#e0d6c8" stroke-width="3"/>${txt(0, -8, '跑完了嗎？卡在哪？', 36, INK, { anchor: 'middle', weight: 800 })}${txt(0, 44, '只能明天進公司才知道', 32, MUTED, { anchor: 'middle' })}</g>`
  return { bg: BG, body: s }
}

/** 轉折:辦公室電腦上的 session,在家用手機接著操作(同一個 session,不是新開一個) */
export function link(l: number): SceneOut {
  let s = txt(CX, 330, '遠端使用 session', 62, ACCENT, { anchor: 'middle', weight: 800, op: seg(l, 0, 450) })
  s += pill(CX, 420, '辦公室電腦', BLUE, '#fff', show(l, 300), 28)
  s += monitor(235, 470, 540, 270, 'session', [{ s: WORK[0].s, c: '#fff' }, { s: '✻ 執行中…', op: 1 }], { glow: 0.5, fs: 26 })
  const a = seg(l, 1100, 1700)
  s += cloud(CX, 880, a)
  if (a > 0) {
    s += flow([CX, 786], [CX, 850], l, BLUE, a)
    s += flow([CX, 915], [CX, 955], l, GREEN, a)
  }
  const p = outBack(seg(l, 1400, 2000))
  if (p > 0) {
    s += `<g transform="translate(${CX} 1190) scale(${n2(p)}) translate(${-CX} -1190)">${phone(365, 960, 280, 460)}`
    s += txt(CX, 1045, 'session', 26, INK, { anchor: 'middle', weight: 800 })
    s += `<rect x="388" y="1070" width="234" height="1" fill="#e0d6c8"/>`
    s += txt(392, 1130, WORK[0].s, 22, INK, { font: MONO, weight: 600 })
    s += txt(392, 1180, '✻ 執行中…', 22, MUTED, { font: MONO })
    s += '</g>'
  }
  s += pill(CX + 285, 910, '同一個 session', ACCENT, '#fff', show(l, 2400), 30)
  s += pill(CX - 290, 1440, '家裡的手機', GREEN, '#fff', show(l, 2000), 28)
  return { bg: BG, body: s }
}

/** 手機上操作:看到同一個對話,按允許,辦公室電腦立刻繼續做 */
export function phoneUse(l: number): SceneOut {
  const X = 235
  const Y = 300
  const W = 540
  const H = 900
  let s = phone(X, Y, W, H)
  const bubble = (y: number, label: string, op: number, fill = '#ece6dc', color = INK): string => {
    const w = Math.min(W - 80, textW(label, 28) + 44)
    return `<g opacity="${n2(op)}"><rect x="${X + 36}" y="${y}" width="${n2(w)}" height="64" rx="22" fill="${fill}"/>${txt(X + 58, y + 42, label, 28, color, { weight: 700 })}</g>`
  }
  s += txt(X + 40, Y + 90, 'price-utils', 32, INK, { weight: 800 })
  s += `<circle cx="${X + W - 48}" cy="${Y + 78}" r="11" fill="${GREEN}" opacity="${n2(pulse(l, 1200))}"/>${txt(X + W - 72, Y + 88, '連線中', 22, MUTED, { anchor: 'end' })}`
  s += `<line x1="${X + 24}" y1="${Y + 120}" x2="${X + W - 24}" y2="${Y + 120}" stroke="#e0d6c8" stroke-width="2"/>`
  s += bubble(Y + 160, '測試跑完了', show(l, 300))
  s += bubble(Y + 238, '12 通過，1 失敗', show(l, 650))
  const card = show(l, 1300)
  const allowed = l >= 3350
  if (card > 0) {
    const cy = Y + 340
    s += `<g opacity="${n2(card)}"><rect x="${X + 30}" y="${cy}" width="${W - 60}" height="330" rx="28" fill="#fff" stroke="${allowed ? GREEN : '#e0b46a'}" stroke-width="4"/>`
    s += txt(X + 62, cy + 62, allowed ? '已允許' : '要允許執行嗎？', 34, allowed ? GREEN : INK, { weight: 800 })
    s += `<rect x="${X + 62}" y="${cy + 94}" width="${W - 124}" height="64" rx="14" fill="${TERM}"/>${txt(X + 84, cy + 136, 'npm run fix', 28, TEXT, { font: MONO, weight: 500 })}`
    if (!allowed) {
      const down = l >= 3100 && l < 3350
      s += `<g transform="translate(0 ${down ? 4 : 0})"><rect x="${X + 62}" y="${cy + 196}" width="190" height="76" rx="38" fill="${GREEN}"/>${txt(X + 157, cy + 246, '允許', 32, '#fff', { anchor: 'middle', weight: 800 })}</g>`
      s += `<rect x="${X + 280}" y="${cy + 196}" width="190" height="76" rx="38" fill="#e8e2d6"/>${txt(X + 375, cy + 246, '拒絕', 32, MUTED, { anchor: 'middle', weight: 800 })}`
    } else s += txt(X + 62, cy + 262, '✓', 54, GREEN, { weight: 800 })
    s += '</g>'
  }
  s += bubble(Y + 710, '已修正，全部通過 ✓', show(l, 4400), '#d9f0e3', '#1f6b43')
  // 手指(游標)移向「允許」按下
  const [cx, cy] = path2(l, [{ at: 0, x: X + 420, y: Y + 840 }, { at: 1900, x: X + 420, y: Y + 840 }, { at: 3000, x: X + 150, y: Y + 636 }, { at: 3500, x: X + 150, y: Y + 640 }, { at: 4300, x: X + 330, y: Y + 800 }])
  s += cursor(cx, cy, l >= 3100 && l < 3350 ? 1 : 0, seg(l, 1700, 2000) * (1 - seg(l, 3900, 4300)))
  // 辦公室電腦:按下允許後立刻動起來
  s += pill(180, 1330, '辦公室電腦', BLUE, '#fff', show(l, 500), 26)
  s += monitor(300, 1250, 540, 200, '', [
    { s: '$ npm run fix', c: '#fff', op: l >= 3450 ? 1 : 0, p: seg(l, 3450, 3900) },
    { s: '✓ 13 通過', c: '#7fe0a6', op: show(l, 4300) },
  ], { glow: l >= 3400 ? 0.6 : 0, fs: 26 })
  return { bg: BG, body: s }
}

/** 好處:手機看進度、手機按允許、程式與檔案留在原本那台電腦 */
export function benefits(l: number): SceneOut {
  let s = txt(CX, 330, '不用進公司，也不用開電腦', 54, INK, { anchor: 'middle', weight: 800, op: seg(l, 0, 450) })
  const rows: { y: number; t: string; sub: string; color: string; icon: string }[] = [
    { y: 420, t: '手機看進度', sub: '通勤、出門都能掌握', color: GREEN, icon: 'phone' },
    { y: 760, t: '手機按允許', sub: '要你決定的，一按就繼續', color: ACCENT, icon: 'check' },
    { y: 1100, t: '留在原本那台電腦', sub: '程式與檔案不用搬走', color: BLUE, icon: 'desk' },
  ]
  rows.forEach((r, i) => {
    const a = outBack(seg(l, 500 + i * 650, 1100 + i * 650))
    if (a <= 0) return
    let g = `<g transform="translate(${CX} ${r.y + 140}) scale(${n2(a)}) translate(${-CX} ${-(r.y + 140)})">`
    g += `<rect x="115" y="${r.y}" width="780" height="280" rx="40" fill="#fff" stroke="#e0d6c8" stroke-width="3"/>`
    g += `<circle cx="245" cy="${r.y + 140}" r="82" fill="${r.color}" opacity="0.16"/>`
    const cx = 245
    const cy = r.y + 140
    if (r.icon === 'phone') g += `<rect x="${cx - 30}" y="${cy - 54}" width="60" height="108" rx="12" fill="${r.color}"/><rect x="${cx - 22}" y="${cy - 40}" width="44" height="72" rx="4" fill="#fff"/>`
    if (r.icon === 'check') g += `<circle cx="${cx}" cy="${cy}" r="52" fill="${r.color}"/><polyline points="${cx - 24},${cy + 2} ${cx - 6},${cy + 20} ${cx + 26},${cy - 18}" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`
    if (r.icon === 'desk') g += `<rect x="${cx - 56}" y="${cy - 46}" width="112" height="74" rx="10" fill="${r.color}"/><rect x="${cx - 8}" y="${cy + 28}" width="16" height="22" fill="${r.color}"/><rect x="${cx - 38}" y="${cy + 48}" width="76" height="10" rx="5" fill="${r.color}"/>`
    g += txt(355, r.y + 130, r.t, 52, INK, { weight: 800 })
    g += txt(355, r.y + 206, r.sub, 34, MUTED)
    s += g + '</g>'
  })
  return { bg: BG, body: s }
}
