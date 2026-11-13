// ai-tools-reel 的四個「自己寫的工具」:都是 870×1000 的小視窗,畫面是時間(tl,毫秒)的純函式。
// 資料全是虛構的、匿名的。工具做的是「輔助整理」,不宣稱判斷的正確性。
import { ACCENT, circle, clamp, cursor, grp, hash, inOutCubic, INK, lerp, n2, outBack, outCubic, path, pop, rect, seg, SANS, sparkle, text, tint, track } from './util'

export const TOOL_W = 870
export const TOOL_H = 1000
export type ToolId = 'teacher' | 'nurse' | 'lawyer' | 'historian'
/** 每個工具實際運作的長度(毫秒);超過就停在最後一格 */
export const TOOL_MS = 6200

export function windowFrame(title: string, accent: string, inner: string): string {
  return (
    `<rect x="0" y="10" width="${TOOL_W}" height="${TOOL_H}" rx="30" fill="#2a2f45" opacity="0.14" filter="url(#blur18)"/>` +
    `<g clip-path="url(#clipWin)">` +
    rect(0, 0, TOOL_W, TOOL_H, '#fbfbfe') +
    rect(0, 0, TOOL_W, 76, tint(accent, 0.86)) +
    rect(0, 74, TOOL_W, 3, accent, { op: 0.5 }) +
    circle(40, 38, 9, '#ff6b5b') + circle(68, 38, 9, '#ffc83d') + circle(96, 38, 9, '#3cc89a') +
    text(title, TOOL_W / 2 + 40, 48, 28, { weight: 800, anchor: 'middle', fill: INK }) +
    inner +
    `</g>` +
    rect(0, 0, TOOL_W, TOOL_H, 'none', { rx: 30, stroke: '#00000012', sw: 2 })
  )
}

// ====================================================== 國文老師:作文批改輔助

const ESSAY = [
  '我的媽媽每天很早就起床，幫我準備早餐，然後送我去學校，然後又趕著去上班。',
  '有一次我生病了，媽媽因該要上班，卻請假在家照顧我，我覺得很感動。',
  '媽媽真的很辛苦，我要再接再勵，努力讀書，讓媽媽放心。',
]
const COLS = 22
const FS = 32
const LH = 52
const TX = 70

interface Mark {
  para: number
  word: string
  kind: 'typo' | 'dup'
  at: number
}
const MARKS: Mark[] = [
  { para: 0, word: '然後', kind: 'dup', at: 1500 },
  { para: 1, word: '因該', kind: 'typo', at: 2200 },
  { para: 2, word: '再接再勵', kind: 'typo', at: 2800 },
]

export function teacherTool(tl: number): string {
  const accent = ACCENT.teacher
  const lines: { para: number; row: number; str: string; col0: number }[] = []
  let row = 0
  const paraY: number[] = []
  ESSAY.forEach((p, pi) => {
    paraY.push(row)
    for (let c = 0; c < p.length; c += COLS) lines.push({ para: pi, row: row++, str: p.slice(c, c + COLS), col0: c })
  })
  const yOf = (r: number, pi: number): number => 164 + r * LH + pi * 22
  const body: string[] = []
  // 作文卡
  body.push(rect(24, 96, 822, 454, '#fff', { rx: 20, stroke: '#e7e8f2', sw: 2 }))
  body.push(grp(`<path d="M0 -14 h28 l8 8 v26 h-36z" fill="#eef0fb" stroke="#b7bde3" stroke-width="3"/>` + rect(8, 0, 20, 4, '#b7bde3', { rx: 2 }) + rect(8, 9, 14, 4, '#b7bde3', { rx: 2 }), { x: 48, y: 120 }))
  body.push(text('貼上作文', 100, 132, 26, { fill: '#7c82a6', weight: 700 }))
  // 結構色條(依段落,掃過之後長出來)
  const structCols = ['#7aa7ff', '#6fd3b4', '#ffb86b']
  ESSAY.forEach((p, pi) => {
    const rows = Math.ceil(p.length / COLS)
    const g = pop(tl, 3000 + pi * 250, 420)
    const y0 = yOf(paraY[pi], pi) - 36
    body.push(grp(rect(34, y0, 10, rows * LH - 6, structCols[pi], { rx: 5 }) + circle(39, y0 - 4, 14 * 0, structCols[pi]), { op: clamp(g), oy: y0, ox: 39, s: 0.3 + 0.7 * clamp(g) }))
  })
  // 文字(貼上:逐行浮現)
  lines.forEach((ln, li) => {
    const a = seg(tl, 450 + li * 130, 700 + li * 130)
    const y = yOf(ln.row, ln.para)
    const dy = (1 - outCubic(a)) * 14
    // 重點標示(畫在字底下)
    const marksOnLine = MARKS.filter((m) => m.para === ln.para)
    for (const m of marksOnLine) {
      const idx = ESSAY[m.para].indexOf(m.word)
      const idxs = m.kind === 'dup' ? allIdx(ESSAY[m.para], m.word) : [idx]
      for (const ix of idxs) {
        const c0 = Math.max(ix, ln.col0)
        const c1 = Math.min(ix + m.word.length, ln.col0 + ln.str.length)
        if (c1 <= c0) continue
        const g = pop(tl, m.at + (m.kind === 'dup' ? 0 : 0), 380)
        const x0 = TX + (c0 - ln.col0) * FS
        const w = (c1 - c0) * FS
        if (m.kind === 'dup') body.push(grp(rect(x0 - 3, y - 32, w + 6, 44, '#ffe27a', { rx: 8 }), { op: clamp(g) * 0.95, ox: x0 + w / 2, oy: y - 10, s: 0.7 + 0.3 * clamp(g) }))
        else {
          let d = `M${x0} ${y + 10}`
          for (let k = 0; k < w / 10; k++) d += ` q5 ${k % 2 ? -7 : 7} 10 0`
          body.push(path(d, 'none', { stroke: '#ef4b4b', sw: 3.5, op: clamp(g) }))
          body.push(rect(x0 - 3, y - 32, w + 6, 44, '#ff4b4b', { rx: 8, op: 0.13 * clamp(g) }))
        }
      }
    }
    body.push(`<g opacity="${n2(a)}" transform="translate(0 ${n2(dy)})">${text(ln.str, TX, y, FS, { weight: 500, fill: '#2f3350', spacing: 0 })}</g>`)
  })
  // 掃描線
  const scan = seg(tl, 1300, 3200)
  if (scan > 0 && scan < 1) {
    const sy = 150 + scan * (ESSAY.length * 2 * LH + 40)
    body.push(rect(30, sy, 810, 5, accent, { op: 0.8, rx: 3 }) + rect(30, sy - 24, 810, 24, accent, { op: 0.09 }))
  }
  // 圖例晶片(依序累積數量)
  const chip = (x: number, label: string, n: number, col: string, a: number, shape: 'wave' | 'hl' | 'bar'): string => {
    const s = clamp(a)
    const ic = shape === 'wave' ? path('M-14 8 q4 -9 7 0 t7 0 t7 0 t7 0', 'none', { stroke: col, sw: 3.5 }) : shape === 'hl' ? rect(-14, -8, 28, 18, col, { rx: 5 }) : rect(-12, -10, 8, 22, col, { rx: 3 }) + rect(0, -10, 8, 22, '#9fe0c5', { rx: 3 })
    return grp(rect(0, 0, 232, 48, tint(col, 0.88), { rx: 24 }) + grp(ic, { x: 34, y: 24 }) + text(label, 62, 32, 24, { weight: 700, fill: INK }) + text(String(n), 206, 33, 26, { weight: 800, fill: col, anchor: 'middle' }), { x, y: 490, s: 0.6 + 0.4 * s, op: s, ox: 116, oy: 24 })
  }
  const typos = (tl >= 2200 ? 1 : 0) + (tl >= 2800 ? 1 : 0)
  const dups = tl >= 1500 ? 2 : 0
  body.push(chip(40, '錯別字', typos, '#ef4b4b', pop(tl, 2300, 400), 'wave'))
  body.push(chip(290, '重複詞', dups, '#e0a400', pop(tl, 1600, 400), 'hl'))
  body.push(chip(540, '段落', tl >= 3000 ? 3 : 0, '#3b9d84', pop(tl, 3100, 400), 'bar'))

  // 評分規準
  const rub = [
    { name: '立意取材', score: 4, col: '#7aa7ff' },
    { name: '結構組織', score: 4, col: '#6fd3b4' },
    { name: '遣詞造句', score: 3, col: '#ffb86b' },
    { name: '字詞正確', score: 3, col: '#ff8fa3' },
  ]
  body.push(rect(24, 556, 822, 360, '#fff', { rx: 20, stroke: '#e7e8f2', sw: 2 }))
  body.push(text('依評分規準整理', 52, 604, 26, { fill: '#7c82a6', weight: 700 }))
  rub.forEach((r, i) => {
    const y = 650 + i * 62
    const g = outCubic(seg(tl, 3900 + i * 320, 4700 + i * 320))
    body.push(text(r.name, 52, y + 26, 26, { weight: 700 }))
    body.push(rect(204, y + 4, 450, 28, '#eef0f8', { rx: 14 }))
    body.push(rect(204, y + 4, (450 * r.score) / 5 * g, 28, r.col, { rx: 14 }))
    for (let k = 1; k < 5; k++) body.push(rect(204 + (450 * k) / 5 - 1.5, y + 4, 3, 28, '#fff'))
    body.push(text(`${Math.round(r.score * g * 10) / 10 >= 1 ? Math.round(r.score * g) : 0}/5`, 700, y + 29, 28, { weight: 800, fill: INK, anchor: 'start' }))
  })
  const done = pop(tl, 5500, 500)
  body.push(grp(rect(52, 880 - 0, 0, 0, 'none'), {}))
  body.push(text('分數僅供參考，由老師決定', 52, 898, 22, { fill: '#8a8fb0', weight: 500, op: clamp(seg(tl, 5300, 5800)) }))
  body.push(grp(circle(0, 0, 34, '#3cc89a') + path('M-15 2 L-5 13 L16 -11', 'none', { stroke: '#fff', sw: 7 }), { x: 770, y: 880, s: done, op: clamp(done) }))
  if (done > 0) body.push(sparkle(806, 846, 14 * clamp(done), '#ffc83d', 1) + sparkle(740, 840, 9 * clamp(done), '#ff8fa3', 0.9))
  return windowFrame('作文批改小幫手', accent, body.join(''))
}
const allIdx = (s: string, w: string): number[] => {
  const r: number[] = []
  for (let i = s.indexOf(w); i >= 0; i = s.indexOf(w, i + 1)) r.push(i)
  return r
}

// ====================================================== 護理排班:檢查工具

type Shift = 'D' | 'E' | 'N' | 'R'
const STAFF: { name: string; col: string; row: Shift[] }[] = [
  { name: '小安', col: '#ff8fa3', row: [...'DDDRREEDDR'] as Shift[] },
  { name: '小林', col: '#6c8cff', row: [...'RNNNNNRRDD'] as Shift[] },
  { name: '小芸', col: '#ffb86b', row: [...'NRDDDRNNRD'] as Shift[] },
  { name: '小凱', col: '#5ed1b5', row: [...'DDRNNNRDDR'] as Shift[] },
  { name: '小萱', col: '#b39cff', row: [...'EERDDDRRNN'] as Shift[] },
]
const DAYS = 10
const GX = 150
const GW = 66
const GY = 150
const RH = 76

export function shiftIcon(k: Shift, s = 1): string {
  if (k === 'D') {
    const rays = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4
      return `<path d="M${n2(Math.cos(a) * 15)} ${n2(Math.sin(a) * 15)} L${n2(Math.cos(a) * 21)} ${n2(Math.sin(a) * 21)}" stroke="#f2a31b" stroke-width="3.5" stroke-linecap="round"/>`
    }).join('')
    return grp(circle(0, 0, 10, '#ffc83d') + rays, { s })
  }
  if (k === 'E') return grp(path('M-18 8 A18 18 0 0 1 18 8 Z', '#ff8a5c') + path('M-22 14 L22 14', 'none', { stroke: '#ff8a5c', sw: 4 }) + path('M0 -16 L0 -8 M-17 -9 L-12 -4 M17 -9 L12 -4', 'none', { stroke: '#ffb37a', sw: 3.5 }), { s })
  if (k === 'N') return grp(path('M6 -17 A18 18 0 1 0 17 8 A14 14 0 0 1 6 -17Z', '#5b6bd6') + sparkle(14, -10, 6, '#ffe28a'), { s })
  return grp(path('M-12 0 L12 0', 'none', { stroke: '#b4b9d0', sw: 5 }), { s })
}
const shiftBg: Record<Shift, string> = { D: '#fff3cf', E: '#ffe1d2', N: '#e3e7ff', R: '#f1f2f7' }

export function nurseTool(tl: number): string {
  const accent = ACCENT.nurse
  const apply = seg(tl, 4600, 5200) // 套用建議之後
  const applied = tl >= 4900
  const rows = STAFF.map((s) => s.row.slice())
  if (applied) {
    rows[1][3] = 'R'
    rows[1][6] = 'D'
  }
  const out: string[] = []
  // 標題列
  out.push(text('十月 · 第一週到第二週', 40, 108, 24, { fill: '#7c82a6', weight: 700 }))
  const lg = [
    ['D', '日'],
    ['E', '晚'],
    ['N', '夜'],
  ] as const
  lg.forEach(([k, label], i) => out.push(grp(shiftIcon(k as Shift, 0.8), { x: 520 + i * 100, y: 100 }) + text(label, 540 + i * 100, 108, 22, { fill: '#7c82a6', weight: 700 })))
  // 日期
  const days = '一二三四五六日一二三'
  for (let d = 0; d < DAYS; d++) {
    const x = GX + d * GW
    const gap = d === 6 && !applied
    out.push(text(String(d + 1), x + GW / 2, GY - 12, 26, { weight: 800, anchor: 'middle', fill: gap && tl > 2400 ? '#e07a00' : INK }))
    out.push(text('週' + days[d], x + GW / 2, GY + 8, 18, { weight: 500, anchor: 'middle', fill: '#9aa0bd' }))
  }
  // 人力缺口(欄)背景
  const gapP = pop(tl, 2400, 420)
  const gapGone = seg(tl, 5000, 5700)
  const gx = GX + 6 * GW
  if (gapP > 0) out.push(rect(gx + 2, GY + 18, GW - 4, STAFF.length * RH + 80, lerp(1, 0, 1) ? mixWarn(gapGone) : '#fff', { rx: 14, op: clamp(gapP) * (0.35 + 0.0) }))
  // 夜班連續:紅色長條
  const nightP = pop(tl, 1900, 420)
  const nightGone = seg(tl, 5000, 5600)
  const rowY = (i: number): number => GY + 30 + i * RH
  if (nightP > 0 && nightGone < 1) {
    const x0 = GX + 1 * GW
    const w = (applied ? 2 : 5) * GW
    out.push(rect(x0 + 1, rowY(1) - 4, 5 * GW - 2, RH - 6, 'none', { rx: 16, stroke: '#ef4b4b', sw: 5, op: clamp(nightP) * (1 - nightGone) }))
    out.push(rect(x0 + 1, rowY(1) - 4, 5 * GW - 2, RH - 6, '#ef4b4b', { rx: 16, op: 0.09 * clamp(nightP) * (1 - nightGone) }))
    void w
  }
  // 儲存格
  STAFF.forEach((s, i) => {
    const y = rowY(i)
    const a = pop(tl, 380 + i * 110, 420)
    out.push(grp(circle(48, y + RH / 2 - 4, 24, s.col) + text(s.name.slice(1), 48, y + RH / 2 + 5, 22, { anchor: 'middle', fill: '#fff', weight: 800 }) + text(s.name, 84, y + RH / 2 + 4, 22, { fill: INK, weight: 700 }), { op: clamp(a), x: (1 - clamp(a)) * -30 }))
    for (let d = 0; d < DAYS; d++) {
      const k = rows[i][d]
      const cx = GX + d * GW + GW / 2
      const cy = y + RH / 2 - 4
      const changed = applied && ((i === 1 && d === 3) || (i === 1 && d === 6))
      const pp = changed ? pop(tl, 4900, 520) : 1
      const cell = grp(rect(-27, -27, 54, 54, shiftBg[k], { rx: 14, stroke: changed ? '#3cc89a' : 'none', sw: 4 }) + shiftIcon(k), { x: cx, y: cy, s: changed ? 0.6 + 0.4 * pp : 1, op: clamp(a) })
      out.push(cell)
      if (changed && tl > 4900 && tl < 6000) out.push(circle(cx, cy, 36 + (tl - 4900) / 16, 'none', { stroke: '#3cc89a', sw: 4, op: clamp(1 - (tl - 4900) / 900) }))
    }
  })
  // 每日日班人數
  const cy0 = rowY(STAFF.length) + 8
  out.push(text('日班', 62, cy0 + 40, 22, { fill: '#7c82a6', weight: 700 }))
  for (let d = 0; d < DAYS; d++) {
    const n = rows.filter((r) => r[d] === 'D').length
    const bad = n === 0
    const a = clamp(seg(tl, 1000 + d * 60, 1300 + d * 60))
    const col = bad ? '#e07a00' : '#3cc89a'
    out.push(grp(circle(0, 0, 21, tint(col, 0.82)) + text(String(n), 0, 8, 22, { anchor: 'middle', weight: 800, fill: col }), { x: GX + d * GW + GW / 2, y: cy0 + 33, op: a, s: bad && tl > 2400 && !applied ? 1 + 0.1 * Math.sin(tl / 160) : 1 }))
  }
  // 提醒卡
  const cardY = 650
  const cardP = pop(tl, 3000, 520)
  out.push(grp(rect(24, 0, 822, 290, '#fff', { rx: 22, stroke: '#e7e8f2', sw: 2 }) + reminders(tl, applied, accent), { y: cardY + (1 - clamp(cardP)) * 60, op: clamp(cardP) }))
  // 滑鼠
  const cur = track(tl, [
    [3300, 0],
    [4400, 1],
  ])
  if (tl > 3200 && tl < 5500) out.push(cursor(lerp(560, 640, cur), lerp(980, 906, cur) - (tl > 4500 ? 0 : 0), seg(tl, 4400, 4650) * (1 - seg(tl, 4650, 4900))))
  void apply
  return windowFrame('排班檢查小工具', accent, out.join(''))
}
const mixWarn = (gone: number): string => (gone > 0.5 ? '#c9f4e4' : '#ffe0b8')

function reminders(tl: number, applied: boolean, accent: string): string {
  const o: string[] = []
  const ok = tl >= 5300
  if (!ok) {
    // 兩條提醒
    o.push(grp(rect(0, 0, 780, 74, '#ffeaea', { rx: 16 }) + [0, 1, 2, 3, 4].map((i) => grp(shiftIcon('N', 0.7), { x: 56 + i * 34, y: 37 })).join('') + path('M250 37 h10', 'none', { stroke: '#ef4b4b', sw: 4 }) + text('小林  連續 5 天夜班', 292, 47, 26, { weight: 700, fill: '#c93a3a' }), { x: 54, y: 30 }))
    o.push(grp(rect(0, 0, 780, 74, '#fff0dc', { rx: 16 }) + grp(shiftIcon('D', 1.1), { x: 56, y: 37 }) + circle(86, 18, 15, '#ef8a1b') + text('!', 86, 25, 21, { anchor: 'middle', weight: 800, fill: '#fff' }) + text('第 7 天  沒有人上日班', 152, 47, 26, { weight: 700, fill: '#b8670a' }), { x: 54, y: 118 }))
    const b = pop(tl, 3600, 420)
    const press = tl > 4400 && tl < 4700 ? 0.92 : 1
    o.push(grp(rect(0, 0, 300, 62, accent, { rx: 31 }) + path('M34 31 l9 10 l17 -20', 'none', { stroke: '#fff', sw: 6 }) + text('套用建議調整', 170, 41, 26, { anchor: 'middle', weight: 800, fill: '#fff' }), { x: 54, y: 214, op: clamp(b), s: 0.8 * 0 + (0.85 + 0.15 * clamp(b)) * press, ox: 150, oy: 31 }))
    o.push(text('小林：第 4 天改休、第 7 天改日班', 380, 255, 22, { fill: '#7c82a6', weight: 500, op: clamp(b) }))
  } else {
    const g = pop(tl, 5300, 520)
    o.push(grp(circle(0, 0, 54, '#3cc89a') + path('M-22 2 L-8 18 L24 -16', 'none', { stroke: '#fff', sw: 10 }), { x: 130, y: 145, s: g, op: clamp(g) }))
    o.push(grp(rect(0, 0, 420, 58, '#e2f8ef', { rx: 16 }) + [0, 1, 2].map((i) => circle(34 + i * 0, 29, 0, '#fff')).join('') + text('夜班連續天數  正常', 40, 38, 26, { weight: 700, fill: '#238765' }), { x: 230, y: 68, op: clamp(g) }))
    o.push(grp(rect(0, 0, 420, 58, '#e2f8ef', { rx: 16 }) + text('每天都有日班', 40, 38, 26, { weight: 700, fill: '#238765' }), { x: 230, y: 144, op: clamp(seg(tl, 5500, 5900)) }))
    o.push(sparkle(700, 60, 18 * clamp(g), '#ffc83d') + sparkle(770, 200, 12 * clamp(g), '#ff8fa3') + sparkle(60, 40, 10 * clamp(g), '#6dd5c4'))
  }
  void applied
  return o.join('')
}

// ====================================================== 法務:合約版本比對

interface Clause {
  title: string
  old?: string[]
  nw?: string[]
  kind: 'same' | 'mod' | 'del' | 'add'
  hi?: [string, string]
}
const CLAUSES: Clause[] = [
  { title: '第一條  服務內容', old: ['乙方負責設計三款，', '並交付原始檔案。'], nw: ['乙方負責設計三款，', '並交付原始檔案。'], kind: 'same' },
  { title: '第二條  付款方式', old: ['簽約後 30 日內，', '一次付清全部款項。'], nw: ['簽約後 15 日內，', '分兩期支付款項。'], kind: 'mod', hi: ['30', '15'] },
  { title: '第三條  保密義務', old: ['雙方對合作內容', '負保密責任三年。'], kind: 'del' },
  { title: '第四條  交付期限', old: ['自簽約日起 60 日。'], nw: ['自簽約日起 45 日。'], kind: 'mod', hi: ['60', '45'] },
  { title: '第五條  逾期處理', nw: ['逾期每日按款項', '千分之一計算。'], kind: 'add' },
  { title: '第六條  管轄法院', old: ['以台北地方法院', '為第一審法院。'], nw: ['以台北地方法院', '為第一審法院。'], kind: 'same' },
]
const CK = { del: '#ef4b4b', add: '#2fb67f', mod: '#e0a400' } as const
const REVEAL = [0, 1700, 2300, 2900, 3500, 0]

export function lawyerTool(tl: number): string {
  const accent = ACCENT.lawyer
  const out: string[] = []
  const slide = outCubic(seg(tl, 300, 1300))
  const colW = 388
  const RHt = 98
  const y0 = 150
  const xs = [24, 458]
  // 版本標籤
  out.push(grp(rect(0, 0, colW, 44, '#eceefb', { rx: 14 }) + text('舊版  v1', 28, 30, 24, { weight: 800, fill: '#6b72b0' }), { x: xs[0], y: 96, op: slide }))
  out.push(grp(rect(0, 0, colW, 44, '#e6f7ef', { rx: 14 }) + text('新版  v2', 28, 30, 24, { weight: 800, fill: '#238765' }), { x: xs[1], y: 96, op: slide }))
  const sides = [0, 1] as const
  sides.forEach((sd) => {
    const dx = (1 - slide) * (sd === 0 ? -160 : 160)
    const col: string[] = [rect(0, y0 - 6, colW, RHt * CLAUSES.length + 10, '#fff', { rx: 18, stroke: '#e7e8f2', sw: 2 })]
    CLAUSES.forEach((c, i) => {
      const y = y0 + i * RHt
      const lines = sd === 0 ? c.old : c.nw
      const g = clamp(seg(tl, REVEAL[i], REVEAL[i] + 450))
      const show = c.kind !== 'same' && REVEAL[i] > 0
      const hl = show ? pop(tl, REVEAL[i], 450) : 0
      if (c.kind === 'mod' && lines) col.push(rect(8, y, colW - 16, RHt - 8, '#fff4c9', { rx: 12, op: clamp(hl) }))
      if (c.kind === 'del') col.push(sd === 0 ? rect(8, y, colW - 16, RHt - 8, '#ffe0e0', { rx: 12, op: clamp(hl) }) : rect(8, y, colW - 16, RHt - 8, 'none', { rx: 12, stroke: '#f2b3b3', sw: 2.5, op: clamp(hl) * 0.9, extra: 'stroke-dasharray="8 8"' }))
      if (c.kind === 'add') col.push(sd === 1 ? rect(8, y, colW - 16, RHt - 8, '#dcf6ea', { rx: 12, op: clamp(hl) }) : rect(8, y, colW - 16, RHt - 8, 'none', { rx: 12, stroke: '#a8dec6', sw: 2.5, op: clamp(hl) * 0.9, extra: 'stroke-dasharray="8 8"' }))
      if (!lines) return
      col.push(text(c.title, 24, y + 32, 22, { weight: 800, fill: c.kind === 'del' && sd === 0 && hl > 0.3 ? '#c93a3a' : INK }))
      lines.forEach((ln, li) => {
        const ty = y + 62 + li * 28
        if (c.kind === 'mod' && c.hi) {
          const hiW = c.hi[sd]
          const at = ln.indexOf(hiW)
          if (at >= 0) {
            const x1 = 24 + at * 17.5 + (hiW.length > 0 ? 0 : 0)
            // 以等寬估算:數字約 12px、中文 22px;逐字計算
            const pre = widthOf(ln.slice(0, at), 22)
            const hw = widthOf(hiW, 22)
            col.push(text(ln.slice(0, at), 24, ty, 22, { fill: '#4b5070' }))
            col.push(rect(24 + pre - 3, ty - 22, hw + 6, 30, sd === 0 ? '#ffd7d7' : '#bfeedb', { rx: 6, op: clamp(hl) }))
            col.push(text(hiW, 24 + pre, ty, 22, { weight: 800, fill: sd === 0 ? '#c93a3a' : '#1d8a60' }))
            col.push(text(ln.slice(at + hiW.length), 24 + pre + hw, ty, 22, { fill: '#4b5070' }))
            void x1
            return
          }
        }
        col.push(text(ln, 24, ty, 22, { fill: c.kind === 'del' && hl > 0.3 ? '#c93a3a' : '#4b5070' }))
        if (c.kind === 'del' && hl > 0) col.push(rect(24, ty - 8, widthOf(ln, 22) * clamp(hl), 3, '#ef4b4b'))
        if (c.kind === 'mod' && !c.hi && hl > 0) col.push(rect(24, ty + 5, widthOf(ln, 22), 0, '#000'))
      })
      void g
    })
    out.push(grp(col.join(''), { x: xs[sd] + dx, y: 0, op: slide }))
  })
  // 中間的標記
  CLAUSES.forEach((c, i) => {
    if (c.kind === 'same' || !REVEAL[i]) return
    const p = pop(tl, REVEAL[i] + 80, 380)
    const col = CK[c.kind]
    const ic = c.kind === 'mod' ? path('M-8 6 L-8 8 L-4 8 L8 -4 L4 -8 L-8 4 Z', '#fff') : c.kind === 'del' ? path('M-8 0 L8 0', 'none', { stroke: '#fff', sw: 5 }) : path('M-8 0 L8 0 M0 -8 L0 8', 'none', { stroke: '#fff', sw: 5 })
    out.push(grp(circle(0, 0, 17, col) + ic, { x: 435, y: y0 + i * RHt + 44, s: clamp(p) }))
  })
  // 摘要
  const sumY = 770
  const sp = pop(tl, 4000, 520)
  const items: { k: keyof typeof CK; n: number; label: string }[] = [
    { k: 'mod', n: 2, label: '條款修改' },
    { k: 'del', n: 1, label: '條款刪除' },
    { k: 'add', n: 1, label: '條款新增' },
  ]
  items.forEach((it, i) => {
    const a = pop(tl, 4000 + i * 200, 520)
    const col = CK[it.k]
    const cnt = Math.round(it.n * outCubic(seg(tl, 4300 + i * 200, 5000 + i * 200)))
    const focus = i === 1 && tl > 5500 ? 1 + 0.06 * Math.sin((tl - 5500) / 140) : 1
    const ic = it.k === 'mod' ? path('M-12 14 L-12 8 L6 -10 L12 -4 L-6 14 Z', '#fff') : it.k === 'del' ? path('M-12 0 L12 0', 'none', { stroke: '#fff', sw: 7 }) : path('M-12 0 L12 0 M0 -12 L0 12', 'none', { stroke: '#fff', sw: 7 })
    out.push(
      grp(rect(0, 0, 262, 190, '#fff', { rx: 24, stroke: tint(col, 0.6), sw: 3 }) + grp(circle(0, 0, 28, col) + ic, { x: 131, y: 52 }) + text(String(cnt), 131, 140, 56, { weight: 800, anchor: 'middle', fill: col }) + text(it.label, 131, 176, 22, { weight: 700, anchor: 'middle', fill: '#6a6f8c' }), { x: 24 + i * 280, y: sumY + (1 - clamp(a)) * 70, op: clamp(a), s: focus, ox: 131, oy: 95 }),
    )
  })
  void sp
  out.push(text('只做整理比對，條文請自行確認', 24, 986, 20, { fill: '#8a8fb0', op: clamp(seg(tl, 5300, 5800)) }))
  // 游標點一下「條款刪除」
  if (tl > 5000 && tl < 6200) {
    const k = track(tl, [
      [5000, 0],
      [5500, 1],
    ])
    out.push(cursor(lerp(760, 440, k), lerp(980, 862, k), seg(tl, 5500, 5700) * (1 - seg(tl, 5700, 6000))))
  }
  return windowFrame('合約比對小工具', accent, out.join(''))
}
/** 估算文字寬度:CJK 與全形約 1 em、半形數字與空白約 0.56 em */
export function widthOf(s: string, size: number): number {
  let w = 0
  for (const ch of s) w += /[\u0000-ÿ]/.test(ch) ? size * 0.58 : size
  return w
}

// ====================================================== 研究者:史料時間軸

interface Card {
  year: number
  body: string
  mark: string
  kind: 'place' | 'person'
}
const CARDS: Card[] = [
  { year: 1923, body: '大水沖毀舊橋，渡口停擺', mark: '渡口', kind: 'place' },
  { year: 1902, body: '寧安碼頭啟用，米船開始靠岸', mark: '碼頭', kind: 'place' },
  { year: 1946, body: '陳先生重開學堂，招收學生', mark: '陳先生', kind: 'person' },
  { year: 1911, body: '林掌櫃發起成立米行公會', mark: '林掌櫃', kind: 'person' },
  { year: 1958, body: '舊碼頭改建，成為鎮上公園', mark: '碼頭', kind: 'place' },
  { year: 1931, body: '新橋落成，市集移到橋頭', mark: '橋頭', kind: 'place' },
]
const SCATTER: [number, number, number][] = [
  [60, 150, -7],
  [250, 250, 6],
  [40, 390, 4],
  [270, 480, -5],
  [60, 640, 7],
  [250, 740, -4],
]
const CW = 560
const CH = 104

export function historianTool(tl: number): string {
  const accent = ACCENT.historian
  const out: string[] = []
  const order = [...CARDS].sort((a, b) => a.year - b.year)
  const lineX = 120
  const t0 = 2300
  // 時間軸的線(隨排列畫出)
  const lineP = outCubic(seg(tl, t0, t0 + 1800))
  out.push(rect(lineX - 3, 120, 6, 720 * lineP, '#e6d3a8', { rx: 3 }))
  const btnP = pop(tl, 1000, 450)
  const pressed = tl > 1900 && tl < 2250
  CARDS.forEach((c, i) => {
    const fi = order.indexOf(c)
    const [sx, sy, sr] = SCATTER[i]
    const drop = pop(tl, 400 + i * 130, 560)
    const fly = inOutCubic(seg(tl, t0 + fi * 230, t0 + fi * 230 + 820))
    const fx = 190
    const fy = 120 + fi * 124
    const x = lerp(sx, fx, fly)
    const y = lerp(sy, fy, fly) + (1 - clamp(drop)) * -80 + Math.sin(fly * Math.PI) * -26
    const rot = lerp(sr, 0, fly)
    const col = c.kind === 'place' ? '#2fb67f' : '#4f7bff'
    const marked = pop(tl, 4500 + fi * 150, 420)
    const yearTxt = text(String(c.year), 28, 62, 40, { weight: 800, fill: INK })
    const bodyTxt = text(c.body, 150, 60, 25, { weight: 500, fill: '#4b5070' })
    const at = c.body.indexOf(c.mark)
    const mx = 150 + widthOf(c.body.slice(0, at), 25)
    const mw = widthOf(c.mark, 25)
    const hl = clamp(marked) > 0 ? rect(mx - 2, 38, mw + 4, 28, tint(col, 0.78), { rx: 8, op: clamp(marked) }) + rect(mx, 70, mw * clamp(marked), 4, col, { rx: 2 }) : ''
    const tag = grp(circle(0, 0, 18, col) + (c.kind === 'place' ? path('M0 10 Q-10 -2 -10 -6 A10 10 0 0 1 10 -6 Q10 -2 0 10Z', '#fff') + circle(0, -6, 3.5, col) : circle(0, -6, 6, '#fff') + path('M-9 11 Q0 -3 9 11Z', '#fff')), { x: CW - 40, y: CH / 2, s: clamp(marked), op: clamp(marked) })
    const card = grp(rect(0, 0, CW, CH, '#fff', { rx: 18, stroke: '#ecdfbd', sw: 3 }) + rect(0, 0, 14, CH, '#f2a31b', { rx: 7 }) + rect(10, 0, 8, CH, '#fff') + rect(0, 0, 14, CH, tint('#f2a31b', 0.2), { rx: 7, op: 0 }) + hl + yearTxt + bodyTxt + tag, { x, y, rot, op: clamp(drop), ox: CW / 2, oy: CH / 2, s: lerp(1, 1, fly) })
    // 時間軸上的圓點
    const dotP = clamp(fly)
    out.push(card)
    out.push(circle(lineX, fy + CH / 2, 11 * dotP, '#f2a31b', { stroke: '#fff', sw: 4 }))
  })
  // 按鈕
  const btnY = 900
  out.push(
    grp(rect(0, 0, 330, 66, accent, { rx: 33 }) + path('M34 24 h22 M34 33 h16 M34 42 h22', 'none', { stroke: '#fff', sw: 4.5 }) + path('M70 22 v22 m-7 -7 l7 8 l7 -8', 'none', { stroke: '#fff', sw: 4.5 }) + text('依年代排列', 190, 44, 27, { anchor: 'middle', weight: 800, fill: '#fff' }), {
      x: 270,
      y: btnY,
      op: clamp(btnP) * (1 - seg(tl, 2500, 3000) * 0.0),
      s: (0.85 + 0.15 * clamp(btnP)) * (pressed ? 0.94 : 1),
      ox: 165,
      oy: 33,
    }),
  )
  if (tl > 1300 && tl < 2700) {
    const k = track(tl, [
      [1300, 0],
      [1900, 1],
    ])
    out.push(cursor(lerp(560, 400, k), lerp(980, 930, k), seg(tl, 1900, 2100) * (1 - seg(tl, 2100, 2400))))
  }
  // 圖例
  const lgA = clamp(seg(tl, 4400, 4900))
  out.push(grp(circle(0, 0, 9, '#4f7bff') + text('人物', 16, 7, 20, { fill: '#7c82a6', weight: 700 }) + circle(90, 0, 9, '#2fb67f') + text('地點', 106, 7, 20, { fill: '#7c82a6', weight: 700 }), { x: 600, y: 990, op: lgA }))
  out.push(text('卡片是虛構的地方志資料', 40, 986, 20, { fill: '#a39a7e', op: clamp(seg(tl, 5200, 5700)) }))
  void outBack
  void hash
  void SANS
  return windowFrame('史料整理小工具', accent, out.join(''))
}

export const TOOLS: Record<ToolId, (tl: number) => string> = { teacher: teacherTool, nurse: nurseTool, lawyer: lawyerTool, historian: historianTool }
