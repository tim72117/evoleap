// 做什麼(assist):一團亂的想法與程式碼 → AI 程式助手(終端機)→ 整理成一張乾淨的圖。
// 原理(ir):想法 → 結構化的描述(JSON 一個欄位一個欄位長出來)→ 驗證(捏造的元件被擋下)→ 渲染成圖。
import { INK, MONO, SANS, clamp, esc, hash, lerp, line, n2, nodeBox, outBack, outCubic, seg, star, type SceneOut } from './draw'

// ---------- 終端機打字 ----------
export const PROMPT = 'use archify: diagram this codebase'
const typed = (s: string, p: number): string => s.slice(0, Math.floor(s.length * clamp(p)))
const caret = (l: number): boolean => Math.floor(l / 450) % 2 === 0

/** 簡單的乾淨小圖(右下角那張):節點依序長出 */
function cleanDiagram(x0: number, y0: number, p: number, dark = false): string {
  const nodes: [number, number, string][] = [
    [x0 + 150, y0 + 70, 'Web'],
    [x0 + 420, y0 + 70, 'API'],
    [x0 + 690, y0 + 70, 'DB'],
    [x0 + 420, y0 + 270, 'Queue'],
    [x0 + 690, y0 + 270, 'Worker'],
  ]
  const edges: [number, number][] = [[0, 1], [1, 2], [1, 3], [3, 4]]
  const stroke = dark ? '#475569' : '#94a3b8'
  let s = ''
  edges.forEach(([a, b], i) => {
    const A = nodes[a]
    const B = nodes[b]
    const dx = Math.sign(B[0] - A[0])
    const dy = Math.sign(B[1] - A[1])
    const pa: [number, number] = [A[0] + dx * 90, A[1] + dy * 40]
    const pb: [number, number] = [B[0] - dx * 94, B[1] - dy * 46]
    s += line(pa, pb, outCubic(seg(p, 0.25 + i * 0.16, 0.45 + i * 0.16)), stroke, 4)
  })
  nodes.forEach(([cx, cy, label], i) => {
    const e = outBack(seg(p, i * 0.14, 0.2 + i * 0.14))
    if (e <= 0) return
    s += nodeBox(cx, cy, 180, 80, label, { fill: i === 1 ? '#2563eb' : '#f1f5f9', stroke: i === 1 ? '#1d4ed8' : '#cbd5e1', text: i === 1 ? '#ffffff' : INK, fs: 30, op: clamp(e), sc: Math.max(0.01, e) })
  })
  return s
}

export function assist(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let body = ''
  // 亂糟糟的想法與程式碼(往終端機收攏)
  const gather = outCubic(seg(p, 0.44, 0.64))
  const N = 15
  for (let i = 0; i < N; i++) {
    const r1 = hash(i * 11 + 1)
    const r2 = hash(i * 17 + 2)
    const r3 = hash(i * 23 + 3)
    const ang = r1 * Math.PI * 2
    const rad = 120 + r2 * 260
    const bx = 540 + Math.cos(ang) * rad * 1.05 + Math.sin(l / 700 + i) * 14
    const by = 470 + Math.sin(ang) * rad * 0.62 + Math.cos(l / 800 + i * 2) * 12
    const x = lerp(bx, 540, gather)
    const y = lerp(by, 770, gather)
    const appear = outBack(seg(p, i * 0.012, 0.1 + i * 0.012))
    const op = clamp(appear) * (1 - clamp(gather * 1.15))
    if (op <= 0.01) continue
    const sc = Math.max(0.01, appear) * (1 - gather * 0.7)
    const rot = (r3 - 0.5) * 50 + Math.sin(l / 500 + i) * 4
    if (i % 3 === 2) {
      // 想法氣泡
      const col = ['#fde68a', '#bfdbfe', '#fbcfe8', '#bbf7d0'][i % 4]
      body += `<g opacity="${n2(op)}" transform="translate(${n2(x)} ${n2(y)}) rotate(${n2(rot * 0.3)}) scale(${n2(sc)})"><ellipse cx="0" cy="0" rx="70" ry="48" fill="${col}"/><circle cx="-26" cy="70" r="9" fill="${col}"/><circle cx="-40" cy="88" r="5" fill="${col}"/><circle cx="-22" cy="0" r="6" fill="#64748b"/><circle cx="0" cy="0" r="6" fill="#64748b"/><circle cx="22" cy="0" r="6" fill="#64748b"/></g>`
    } else {
      // 程式碼片段
      const cols = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa']
      let lines = ''
      for (let k = 0; k < 4; k++) lines += `<rect x="${-72 + (k % 2) * 16}" y="${-40 + k * 24}" width="${50 + hash(i * 5 + k) * 90}" height="10" rx="5" fill="${cols[(i + k) % 5]}"/>`
      body += `<g opacity="${n2(op)}" transform="translate(${n2(x)} ${n2(y)}) rotate(${n2(rot)}) scale(${n2(sc)})"><rect x="-90" y="-58" width="180" height="116" rx="14" fill="#1e293b"/>${lines}</g>`
    }
  }
  // 終端機
  const tin = outCubic(seg(p, 0.1, 0.24))
  const tx = 120
  const ty = 690
  const tw = 840
  const th = 290
  const typeP = seg(p, 0.2, 0.42)
  const sent = p > 0.44
  const done = seg(p, 0.66, 0.74)
  body += `<g opacity="${n2(tin)}" transform="translate(0 ${n2((1 - tin) * 50)})">`
  body += `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="26" fill="#0f172a"/>`
  body += `<circle cx="${tx + 40}" cy="${ty + 38}" r="9" fill="#f87171"/><circle cx="${tx + 72}" cy="${ty + 38}" r="9" fill="#fbbf24"/><circle cx="${tx + 104}" cy="${ty + 38}" r="9" fill="#34d399"/>`
  body += `<text x="${tx + 40}" y="${ty + 130}" font-family="${MONO}" font-size="31" fill="#e2e8f0" xml:space="preserve"><tspan fill="#38bdf8">&gt; </tspan>${esc(typed(PROMPT, typeP))}${caret(l) && !sent ? '<tspan fill="#38bdf8">▌</tspan>' : ''}</text>`
  if (sent) {
    const dots = '.'.repeat(1 + (Math.floor(l / 250) % 3))
    body += `<text x="${tx + 40}" y="${ty + 190}" font-family="${MONO}" font-size="29" fill="#94a3b8" xml:space="preserve">${done < 1 ? 'working' + dots : '<tspan fill="#34d399">✓</tspan> diagram.html'}</text>`
    if (done < 1) body += `<rect x="${tx + 40}" y="${ty + 220}" width="${tw - 80}" height="10" rx="5" fill="#1e293b"/><rect x="${tx + 40}" y="${ty + 220}" width="${n2((tw - 80) * seg(p, 0.46, 0.7))}" height="10" rx="5" fill="#38bdf8"/>`
  }
  body += `</g>`
  // 乾淨的圖
  const pin = seg(p, 0.64, 1)
  if (pin > 0) {
    const e = outCubic(seg(p, 0.64, 0.74))
    const px = 100
    const py = 1030
    body += `<g opacity="${n2(e)}" transform="translate(0 ${n2((1 - e) * 40)})"><rect x="${px}" y="${py}" width="880" height="450" rx="30" fill="#ffffff" stroke="#d6deea" stroke-width="3"/>`
    body += cleanDiagram(px + 70, py + 60, seg(p, 0.7, 1))
    body += `</g>`
    // 完成時閃出幾顆星
    const sp = seg(p, 0.86, 1)
    if (sp > 0 && sp < 1) for (let k = 0; k < 6; k++) body += star(100 + 880 * hash(k + 9), 1030 + 450 * hash(k + 19), 14 * (1 - sp), '#f5b301', 1 - sp, sp * 5)
  }
  return { bg: '#eef3fb', body }
}

// ---------- 原理:結構化描述 → 驗證 → 渲染 ----------
export const JSON_LINES: string[] = [
  '{',
  '  "type": "architecture",',
  '  "nodes": [',
  '    { "id": "web" },',
  '    { "id": "api" },',
  '    { "id": "db" }',
  '  ],',
  '  "edges": [',
  '    { "from": "web", "to": "api" },',
  '    { "from": "api", "to": "cache" }',
  '  ]',
  '}',
]
/** 被擋下的那一行(捏造的元件 cache) */
export const BAD_LINE = 9
const FIXED = '    { "from": "api", "to": "db" }'

interface Tok {
  t: string
  c: string
}
export function tokens(line: string): Tok[] {
  const out: Tok[] = []
  const re = /("[^"]*")|([{}[\]:,])|(\s+)/g
  let last = 0
  let m: RegExpExecArray | null
  const push = (t: string, c: string): void => {
    if (t) out.push({ t, c })
  }
  while ((m = re.exec(line))) {
    push(line.slice(last, m.index), '#e2e8f0')
    if (m[1]) {
      const after = line.slice(m.index + m[1].length).trimStart()
      push(m[1], after.startsWith(':') ? '#7dd3fc' : '#86efac')
    } else push(m[0], m[2] ? '#94a3b8' : '#e2e8f0')
    last = m.index + m[0].length
  }
  push(line.slice(last), '#e2e8f0')
  return out
}
/** 只露出前 n 個字元的彩色行 */
export function clipTokens(line: string, n: number): string {
  let left = n
  let s = ''
  for (const k of tokens(line)) {
    if (left <= 0) break
    const part = k.t.slice(0, left)
    left -= part.length
    s += `<tspan fill="${k.c}">${esc(part)}</tspan>`
  }
  return s
}

export function ir(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let body = ''
  // 三步驟列:描述 → 驗證 → 渲染
  const step = p < 0.44 ? 0 : p < 0.76 ? 1 : 2
  const cxs = [210, 540, 870]
  body += `<line x1="210" y1="318" x2="870" y2="318" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round"/><line x1="210" y1="318" x2="${n2(lerp(210, 870, 0.5 * seg(p, 0.42, 0.5) + 0.5 * seg(p, 0.74, 0.82)))}" y2="318" stroke="#2563eb" stroke-width="6" stroke-linecap="round"/>`
  const icons = ['{ }', '✓', '▦']
  for (let i = 0; i < 3; i++) {
    const on = i <= step
    const col = i === 1 && p >= 0.58 && p < 0.7 ? '#e5484d' : on ? '#2563eb' : '#cbd5e1'
    const pop = 1 + (i === step ? 0.1 * Math.sin(l / 160) : 0)
    body += `<g transform="translate(${cxs[i]} 318) scale(${n2(pop)})"><circle r="46" fill="${on ? col : '#ffffff'}" stroke="${col}" stroke-width="6"/><text y="13" text-anchor="middle" font-family="${MONO}" font-size="34" font-weight="700" fill="${on ? '#ffffff' : '#94a3b8'}">${icons[i]}</text></g>`
  }
  // JSON 編輯器
  const ex = 100
  const ey = 410
  const ew = 880
  const eh = 640
  const lh = 48
  body += `<rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" rx="28" fill="#0f172a"/>`
  const fixed = p >= 0.72
  const scan = seg(p, 0.46, 0.6)
  const tagIn = outBack(seg(p, 0.58, 0.64))
  JSON_LINES.forEach((src, i) => {
    const y = ey + 64 + i * lh
    const line = i === BAD_LINE && fixed ? FIXED : src
    const start = (i / JSON_LINES.length) * 0.4
    const q = seg(p, start, start + 0.055)
    const isBad = i === BAD_LINE
    // 色塊:壞行紅、修好後綠
    if (isBad && p >= 0.58) {
      const col = fixed ? '#16a34a' : '#e5484d'
      body += `<rect x="${ex + 14}" y="${y - 34}" width="${ew - 28}" height="${lh - 2}" rx="10" fill="${col}" opacity="${fixed ? n2(0.22 * (1 - seg(p, 0.86, 0.96) * 0.5)) : n2(0.28 + 0.1 * Math.sin(l / 90))}"/>`
    }
    if (q > 0) body += `<text x="${ex + 36}" y="${y}" font-family="${MONO}" font-size="30" xml:space="preserve">${clipTokens(line, Math.ceil(line.length * q))}</text>`
    // 掃描線
    if (scan > 0 && scan < 1) {
      const sy = ey + 40 + scan * (JSON_LINES.length * lh)
      if (Math.abs(sy - (y - 12)) < lh / 2) body += `<rect x="${ex + 14}" y="${y - 34}" width="${ew - 28}" height="${lh - 2}" rx="10" fill="#38bdf8" opacity="0.16"/>`
    }
  })
  if (scan > 0 && scan < 1) body += `<rect x="${ex + 14}" y="${n2(ey + 36 + scan * (JSON_LINES.length * lh))}" width="${ew - 28}" height="4" rx="2" fill="#38bdf8"/>`
  // 驗證結果標籤
  if (tagIn > 0) {
    const by = ey + 64 + BAD_LINE * lh
    const col = fixed ? '#16a34a' : '#e5484d'
    const label = fixed ? '✓ valid' : '✗ unknown node'
    const wTag = fixed ? 150 : 250
    body += `<g opacity="${n2(clamp(tagIn))}" transform="translate(${n2(ex + ew - 30 - wTag)} ${n2(by + 44 - 8 * (1 - clamp(tagIn)))})"><rect width="${wTag}" height="46" rx="23" fill="${col}"/><text x="${wTag / 2}" y="31" text-anchor="middle" font-family="${MONO}" font-size="24" font-weight="700" fill="#ffffff">${label}</text></g>`
  }
  // 渲染結果
  const rin = seg(p, 0.76, 1)
  const ry = 1100
  body += `<g opacity="${n2(0.35 + 0.65 * outCubic(seg(p, 0.7, 0.8)))}"><rect x="100" y="${ry}" width="880" height="380" rx="28" fill="#ffffff" stroke="#d6deea" stroke-width="3"/>`
  if (rin > 0) {
    const nodes: [number, number, string][] = [[240, ry + 190, 'web'], [540, ry + 190, 'api'], [840, ry + 190, 'db']]
    for (let i = 0; i < 2; i++) body += line_(nodes[i], nodes[i + 1], outCubic(seg(rin, 0.3 + i * 0.25, 0.55 + i * 0.25)))
    nodes.forEach(([cx, cy, label], i) => {
      const e = outBack(seg(rin, i * 0.18, 0.3 + i * 0.18))
      if (e > 0) body += nodeBox(cx, cy, 190, 84, label, { fill: i === 1 ? '#2563eb' : '#f1f5f9', stroke: i === 1 ? '#1d4ed8' : '#cbd5e1', text: i === 1 ? '#ffffff' : INK, fs: 32, op: clamp(e), sc: Math.max(0.01, e), font: MONO })
    })
  } else {
    body += `<text x="540" y="${ry + 205}" text-anchor="middle" font-family="${SANS}" font-size="30" fill="#cbd5e1">···</text>`
  }
  body += `</g>`
  // 箭頭:編輯器 → 結果
  if (p > 0.7) body += `<polygon points="540,1074 516,1052 564,1052" fill="#2563eb" opacity="${n2(outCubic(seg(p, 0.7, 0.78)))}"/>`
  return { bg: '#eef3fb', body }
}
function line_(a: [number, number, string], b: [number, number, string], p: number): string {
  return line([a[0] + 95, a[1]], [b[0] - 100, b[1]], p, '#94a3b8', 4)
}
