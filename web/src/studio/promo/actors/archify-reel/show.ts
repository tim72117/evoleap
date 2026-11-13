// 效果:show(互動圖:節點長出、資料流光點、點節點展開、明暗主題、匯出圖片)、
// types(幾種圖型快速帶過:架構、流程、時序、生命週期)、style(Diagram Design 的編輯風格圖型快速切換)。
import { INK, MONO, SANS, SERIF, clamp, cursor, esc, hash, inOutCubic, lerp, line, mix, n2, nodeBox, outBack, outCubic, path2, seg, star, type SceneOut } from './draw'

// ---------- show:互動圖 ----------
const NODES: { id: string; x: number; y: number; label: string }[] = [
  { id: 'web', x: 505, y: 470, label: 'Browser' },
  { id: 'api', x: 505, y: 680, label: 'API' },
  { id: 'redis', x: 285, y: 900, label: 'Redis' },
  { id: 'pg', x: 725, y: 900, label: 'PostgreSQL' },
  { id: 'worker', x: 725, y: 1110, label: 'Worker' },
]
const EDGES: [string, string][] = [['web', 'api'], ['api', 'redis'], ['api', 'pg'], ['pg', 'worker']]
/** 資料流經過的路徑(快取沒命中:Browser → API → PostgreSQL) */
const FLOW: [string, string][] = [['web', 'api'], ['api', 'pg']]
const node = (id: string) => NODES.find((n) => n.id === id)!
const NW = 230
const NH = 88

/** 沿一條邊的端點(避開方塊) */
function edgePts(a: string, b: string): [[number, number], [number, number]] {
  const A = node(a)
  const B = node(b)
  const dx = B.x - A.x
  const dy = B.y - A.y
  if (Math.abs(dy) > Math.abs(dx) * 0.6) {
    const sy = Math.sign(dy)
    return [[A.x + dx * 0.12, A.y + sy * (NH / 2 + 4)], [B.x - dx * 0.12, B.y - sy * (NH / 2 + 12)]]
  }
  const sx = Math.sign(dx)
  return [[A.x + sx * (NW / 2 + 4), A.y], [B.x - sx * (NW / 2 + 12), B.y]]
}

export function show(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  // 主題:0.62–0.76 亮 → 暗
  const t = inOutCubic(seg(p, 0.62, 0.76))
  const C = {
    page: mix('#eef3fb', '#04070d', t),
    card: mix('#ffffff', '#0b1220', t),
    cardLine: mix('#d6deea', '#1f2b40', t),
    node: mix('#f1f5f9', '#172033', t),
    nodeLine: mix('#cbd5e1', '#3b4a63', t),
    text: mix('#14213d', '#e6edf7', t),
    edge: mix('#94a3b8', '#52627c', t),
    accent: mix('#2563eb', '#60a5fa', t),
    soft: mix('#e2e8f0', '#1b2740', t),
  }
  let body = ''
  const cx0 = 70
  const cy0 = 290
  const cw = 870
  const ch = 1010
  body += `<rect x="${cx0}" y="${cy0}" width="${cw}" height="${ch}" rx="36" fill="${C.card}" stroke="${C.cardLine}" stroke-width="3"/>`
  // 工具列:匯出按鈕與主題開關
  const bx = cx0 + 36
  const by = cy0 + 30
  const exportPress = seg(p, 0.8, 0.84)
  body += `<g><rect x="${bx}" y="${by}" width="176" height="64" rx="32" fill="${C.soft}"/><path d="M${bx + 34} ${by + 34} v-14 m-8 8 l8 -8 l8 8 M${bx + 24} ${by + 42} v8 h20 v-8" fill="none" stroke="${C.text}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><text x="${bx + 66}" y="${by + 42}" font-family="${SANS}" font-size="28" font-weight="600" fill="${C.text}">Export</text></g>`
  const tx = cx0 + cw - 36 - 118
  const knob = lerp(tx + 32, tx + 86, t)
  body += `<rect x="${tx}" y="${by}" width="118" height="64" rx="32" fill="${mix('#cbd5e1', '#2563eb', t)}"/>`
  // 太陽或月亮
  body += `<circle cx="${n2(knob)}" cy="${by + 32}" r="24" fill="#ffffff"/>`
  if (t < 0.5) body += `<circle cx="${n2(knob)}" cy="${by + 32}" r="10" fill="#f5b301"/>` + [0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<line x1="${n2(knob + Math.cos((k * Math.PI) / 4) * 14)}" y1="${n2(by + 32 + Math.sin((k * Math.PI) / 4) * 14)}" x2="${n2(knob + Math.cos((k * Math.PI) / 4) * 19)}" y2="${n2(by + 32 + Math.sin((k * Math.PI) / 4) * 19)}" stroke="#f5b301" stroke-width="3" stroke-linecap="round"/>`).join('')
  else body += `<path d="M${n2(knob - 6)} ${by + 20} a13 13 0 1 0 14 17 a11 11 0 0 1 -14 -17 z" fill="#475569"/>`
  // 連線
  EDGES.forEach(([a, b], i) => {
    const [pa, pb] = edgePts(a, b)
    body += line(pa, pb, outCubic(seg(p, 0.1 + i * 0.05, 0.2 + i * 0.05)), C.edge, 5)
  })
  // 資料流光點(沿路徑一格一格走,走兩趟)
  const fp = seg(p, 0.3, 0.5)
  if (fp > 0 && fp < 1) {
    for (let trip = 0; trip < 2; trip++) {
      const u = (fp * 1.6 - trip * 0.45 + 2) % 2
      void u
    }
    const lit = FLOW.length
    // 亮起的路徑
    FLOW.forEach(([a, b], i) => {
      const [pa, pb] = edgePts(a, b)
      const q = seg(fp, i / lit, (i + 1) / lit)
      body += line(pa, [lerp(pa[0], pb[0], q), lerp(pa[1], pb[1], q)], 1, '#f59e0b', 7, false)
    })
    for (let d = 0; d < 3; d++) {
      const q = clamp(fp * 1.25 - d * 0.1)
      if (q <= 0 || q >= 1) continue
      const i = Math.min(lit - 1, Math.floor(q * lit))
      const [pa, pb] = edgePts(FLOW[i][0], FLOW[i][1])
      const r = q * lit - i
      const x = lerp(pa[0], pb[0], r)
      const y = lerp(pa[1], pb[1], r)
      body += `<circle cx="${n2(x)}" cy="${n2(y)}" r="${14 - d * 3}" fill="#f59e0b" opacity="${n2(1 - d * 0.28)}"/><circle cx="${n2(x)}" cy="${n2(y)}" r="${26 - d * 4}" fill="#f59e0b" opacity="0.2"/>`
    }
  } else if (fp >= 1) {
    FLOW.forEach(([a, b]) => {
      const [pa, pb] = edgePts(a, b)
      body += line(pa, pb, 1, '#f59e0b', 7, true)
    })
    // 之後持續循環的小光點
    FLOW.forEach(([a, b], i) => {
      const [pa, pb] = edgePts(a, b)
      const r = ((l / 900 + i * 0.5) % 1)
      body += `<circle cx="${n2(lerp(pa[0], pb[0], r))}" cy="${n2(lerp(pa[1], pb[1], r))}" r="9" fill="#fbbf24"/>`
    })
  }
  // 節點
  const sel = seg(p, 0.52, 0.56) // 點到 API
  NODES.forEach((n, i) => {
    const e = outBack(seg(p, i * 0.05, 0.12 + i * 0.05))
    if (e <= 0) return
    const lit = n.id === 'api' ? sel : 0
    body += nodeBox(n.x, n.y, NW, NH, n.label, { fill: lit > 0 ? mix(C.node, '#2563eb', lit * 0.9) : C.node, stroke: lit > 0 ? '#2563eb' : C.nodeLine, text: lit > 0.5 ? '#ffffff' : C.text, fs: 32, op: clamp(e), sc: Math.max(0.01, e), sw: lit > 0 ? 5 : 3 })
  })
  // 展開細節卡(點 API 之後)
  const dp = outBack(seg(p, 0.56, 0.64)) * (1 - seg(p, 0.7, 0.76))
  if (dp > 0.01) {
    const px = cx0 + 36
    const py = 1010
    const pw = 440
    const ph = 250
    const e = clamp(dp)
    body += `<g opacity="${n2(e)}" transform="translate(${n2(px + pw / 2)} ${n2(py + ph / 2)}) scale(${n2(Math.max(0.01, dp))}) translate(${-(px + pw / 2)} ${-(py + ph / 2)})"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="26" fill="${C.card}" stroke="#2563eb" stroke-width="4"/><text x="${px + 32}" y="${py + 58}" font-family="${SANS}" font-size="34" font-weight="800" fill="${C.text}">API</text><text x="${px + 32}" y="${py + 104}" font-family="${MONO}" font-size="24" fill="${C.accent}">src/api/server.ts</text>`
    for (let k = 0; k < 3; k++) body += `<rect x="${px + 32}" y="${py + 134 + k * 30}" width="${[360, 300, 330][k]}" height="14" rx="7" fill="${C.soft}"/>`
    body += `</g>`
  }
  // 游標:點 API → 移到主題開關 → 點 Export 與 PNG
  const menuIn = outCubic(seg(p, 0.8, 0.86)) * (1 - seg(p, 0.92, 0.95))
  if (menuIn > 0.01) {
    const mx = bx
    const my = by + 76
    body += `<g opacity="${n2(menuIn)}"><rect x="${mx}" y="${my}" width="250" height="196" rx="20" fill="${C.card}" stroke="${C.cardLine}" stroke-width="3"/>`
    ;['PNG', 'WebP', 'JPG'].forEach((f, k) => {
      const hot = k === 0 && p > 0.88
      body += `<rect x="${mx + 12}" y="${my + 12 + k * 56}" width="226" height="48" rx="12" fill="${hot ? '#2563eb' : 'none'}"/><text x="${mx + 36}" y="${my + 46 + k * 56}" font-family="${SANS}" font-size="28" font-weight="600" fill="${hot ? '#ffffff' : C.text}">${f}</text>`
    })
    body += `</g>`
  }
  const cur = path2(p, [
    { at: 0.42, x: 860, y: 1180 },
    { at: 0.52, x: node('api').x + 40, y: node('api').y + 14 },
    { at: 0.7, x: node('api').x + 40, y: node('api').y + 14 },
    { at: 0.76, x: tx + 60, y: by + 40 },
    { at: 0.79, x: bx + 70, y: by + 40 },
    { at: 0.88, x: bx + 70, y: by + 88 + 30 },
  ])
  const press = seg(p, 0.52, 0.54) * (1 - seg(p, 0.54, 0.57)) + exportPress * (1 - seg(p, 0.84, 0.86)) + seg(p, 0.89, 0.9) * (1 - seg(p, 0.9, 0.92))
  if (p > 0.42 && p < 0.93) body += cursor(cur[0], cur[1], press, outCubic(seg(p, 0.42, 0.46)) * (1 - seg(p, 0.9, 0.93)))
  // 匯出:縮圖飛出 + 快門閃光
  const ep = seg(p, 0.9, 1)
  if (ep > 0) {
    const fly = outBack(seg(p, 0.9, 0.98))
    const sx = lerp(cx0 + 200, 430, fly)
    const sy = lerp(900, 1360, fly)
    const sw = lerp(870, 300, fly)
    const sh = lerp(1010, 170, fly)
    body += `<g opacity="${n2(clamp(fly * 1.4))}"><rect x="${n2(sx - sw / 2 + 110)}" y="${n2(sy - sh / 2)}" width="${n2(sw)}" height="${n2(sh)}" rx="14" fill="${C.card}" stroke="#2563eb" stroke-width="4"/>`
    // 縮圖上的迷你圖
    const k = sw / 870
    NODES.forEach((n) => {
      body += `<rect x="${n2(sx - sw / 2 + 110 + (n.x - cx0 - 70) * k * 0.9 + sw * 0.07)}" y="${n2(sy - sh / 2 + (n.y - cy0 - 100) * k * 0.82 + sh * 0.1)}" width="${n2(70 * k * 1.4)}" height="${n2(26 * k * 1.2)}" rx="4" fill="${C.node}" stroke="${C.nodeLine}" stroke-width="2"/>`
    })
    body += `<circle cx="${n2(sx + sw / 2 + 110)}" cy="${n2(sy - sh / 2)}" r="26" fill="#16a34a"/><path d="M${n2(sx + sw / 2 + 98)} ${n2(sy - sh / 2)} l9 10 l16 -18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`
    const flash = (1 - seg(p, 0.9, 0.94)) * seg(p, 0.9, 0.905)
    if (flash > 0) body += `<rect x="0" y="0" width="1080" height="1920" fill="#ffffff" opacity="${n2(flash * 0.8)}"/>`
  }
  return { bg: C.page, body }
}

// ---------- types:四種圖型 ----------
function miniCard(x: number, y: number, w: number, h: number, e: number): string {
  return `<g opacity="${n2(clamp(e))}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="#ffffff" stroke="#d6deea" stroke-width="3"/><circle cx="${x + 36}" cy="${y + 34}" r="8" fill="#f87171"/><circle cx="${x + 64}" cy="${y + 34}" r="8" fill="#fbbf24"/><circle cx="${x + 92}" cy="${y + 34}" r="8" fill="#34d399"/></g>`
}
export function types(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let body = ''
  const W2 = 420
  const H2 = 520
  const pos: [number, number][] = [[70, 300], [520, 300], [70, 860], [520, 860]]
  const blue = '#2563eb'
  const gray = '#94a3b8'
  const fill = '#f1f5f9'
  for (let i = 0; i < 4; i++) {
    const [x, y] = pos[i]
    const q = seg(p, i * 0.2, i * 0.2 + 0.5)
    const e = outBack(seg(p, i * 0.2, i * 0.2 + 0.2))
    if (e <= 0) continue
    body += `<g transform="translate(0 ${n2((1 - clamp(e)) * 80)})">` + miniCard(x, y, W2, H2, e)
    const cx = x + W2 / 2
    const oy = y + 90
    if (i === 0) {
      // 架構:三層方塊 + 連線
      const L: [number, number, number, string][] = [[cx, oy + 80, 200, 'Web'], [cx - 100, oy + 230, 170, 'API'], [cx + 100, oy + 230, 170, 'Auth'], [cx, oy + 380, 220, 'Database']]
      ;[[0, 1], [0, 2], [1, 3], [2, 3]].forEach(([a, b], k) => {
        body += line([L[a][0], L[a][1] + 34], [L[b][0], L[b][1] - 40], outCubic(seg(q, 0.4 + k * 0.1, 0.7 + k * 0.1)), gray, 4)
      })
      L.forEach(([lx, ly, lw, lb], k) => {
        const s = outBack(seg(q, k * 0.1, 0.3 + k * 0.1))
        if (s > 0) body += nodeBox(lx, ly, lw, 68, lb, { fill: k === 0 ? blue : fill, stroke: k === 0 ? blue : '#cbd5e1', text: k === 0 ? '#fff' : INK, fs: 26, op: clamp(s), sc: Math.max(0.01, s), sw: 3 })
      })
    } else if (i === 1) {
      // 流程:開始 → 判斷 → 兩條分支
      const a = outBack(seg(q, 0, 0.25))
      if (a > 0) body += `<rect x="${cx - 80}" y="${oy + 20}" width="160" height="60" rx="30" fill="${blue}" opacity="${n2(clamp(a))}"/><text x="${cx}" y="${oy + 60}" text-anchor="middle" font-family="${SANS}" font-size="26" font-weight="600" fill="#fff" opacity="${n2(clamp(a))}">Start</text>`
      body += line([cx, oy + 80], [cx, oy + 150], outCubic(seg(q, 0.2, 0.4)), gray, 4)
      const d = outBack(seg(q, 0.3, 0.55))
      if (d > 0) body += `<polygon points="${cx},${oy + 150} ${cx + 100},${oy + 220} ${cx},${oy + 290} ${cx - 100},${oy + 220}" fill="#fef3c7" stroke="#f59e0b" stroke-width="3" opacity="${n2(clamp(d))}"/><text x="${cx}" y="${oy + 229}" text-anchor="middle" font-family="${SANS}" font-size="26" font-weight="700" fill="#92400e" opacity="${n2(clamp(d))}">OK?</text>`
      body += line([cx - 100, oy + 220], [cx - 130, oy + 340], outCubic(seg(q, 0.55, 0.75)), gray, 4) + line([cx + 100, oy + 220], [cx + 130, oy + 340], outCubic(seg(q, 0.6, 0.8)), gray, 4)
      ;[[cx - 130, 'Fix', '#fee2e2', '#ef4444'], [cx + 130, 'Ship', '#dcfce7', '#16a34a']].forEach(([bx, lb, f, s2], k) => {
        const s = outBack(seg(q, 0.7 + k * 0.05, 0.95))
        if (s > 0) body += nodeBox(bx as number, oy + 380, 150, 64, lb as string, { fill: f as string, stroke: s2 as string, text: INK, fs: 26, op: clamp(s), sc: Math.max(0.01, s) })
      })
    } else if (i === 2) {
      // 時序:三條生命線與訊息
      const xs = [cx - 130, cx, cx + 130]
      xs.forEach((lx, k) => {
        const s = outBack(seg(q, k * 0.08, 0.25 + k * 0.08))
        if (s > 0) body += `<rect x="${lx - 58}" y="${oy + 10}" width="116" height="54" rx="12" fill="${k === 1 ? blue : fill}" stroke="${k === 1 ? blue : '#cbd5e1'}" stroke-width="3" opacity="${n2(clamp(s))}"/><text x="${lx}" y="${oy + 46}" text-anchor="middle" font-family="${SANS}" font-size="22" font-weight="600" fill="${k === 1 ? '#fff' : INK}" opacity="${n2(clamp(s))}">${['Web', 'API', 'DB'][k]}</text>`
        body += `<line x1="${lx}" y1="${oy + 64}" x2="${lx}" y2="${n2(lerp(oy + 64, oy + 420, outCubic(seg(q, 0.1, 0.4))))}" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="8 8"/>`
      })
      ;[[0, 1, 130, false], [1, 2, 210, false], [2, 1, 290, true], [1, 0, 370, true]].forEach(([a, b, dy, back], k) => {
        const pp = outCubic(seg(q, 0.35 + k * 0.14, 0.5 + k * 0.14))
        body += line([xs[a as number], oy + (dy as number)], [xs[b as number], oy + (dy as number)], pp, back ? gray : blue, 4)
      })
    } else {
      // 生命週期:三個狀態,重試迴圈
      const S: [number, number, string, string][] = [[cx - 120, oy + 90, 'queued', '#dbeafe'], [cx + 120, oy + 90, 'running', '#fef3c7'], [cx + 120, oy + 270, 'done', '#dcfce7'], [cx - 120, oy + 270, 'retry', '#fee2e2']]
      ;[[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([a, b], k) => {
        const A = S[a]
        const B = S[b]
        const dx = Math.sign(B[0] - A[0]) * 66
        const dy = Math.sign(B[1] - A[1]) * 38
        const [ax, ay, bx2, by2] = k === 0 ? [A[0] + 80, A[1], B[0] - 84, B[1]] : k === 2 ? [A[0] - 82, A[1], B[0] + 84, B[1]] : [A[0] + (dx ? dx : 0), A[1] + dy, B[0] - (dx ? dx : 0), B[1] - dy]
        body += line([ax, ay], [bx2, by2], outCubic(seg(q, 0.25 + k * 0.15, 0.45 + k * 0.15)), k === 3 ? '#ef4444' : gray, 4)
      })
      S.forEach(([sx, sy, lb, f], k) => {
        const s = outBack(seg(q, k * 0.12, 0.3 + k * 0.12))
        if (s > 0) body += nodeBox(sx, sy, 150, 66, lb, { fill: f, stroke: '#cbd5e1', text: INK, fs: 26, op: clamp(s), sc: Math.max(0.01, s) })
      })
      // 光點繞圈
      const r = ((l / 1400) % 1) * 4
      const ci = Math.floor(r)
      const A = S[ci % 4]
      const B = S[(ci + 1) % 4]
      if (q > 0.7) body += `<circle cx="${n2(lerp(A[0], B[0], r - ci))}" cy="${n2(lerp(A[1], B[1], r - ci))}" r="10" fill="#f59e0b"/>`
    }
    body += `</g>`
  }
  void esc
  void hash
  return { bg: '#eef3fb', body }
}

// ---------- style:Diagram Design 的編輯風格(紙色、細線、不用陰影、一個重點色) ----------
const PAPER = '#f6f1e7'
const EINK = '#1c1917'
const ACC = '#bf4520'
export const STYLE_TYPES = ['Architecture', 'Flowchart', 'Sequence', 'Quadrant', 'Timeline', 'Bar chart'] as const

function editorial(kind: number, q: number, x: number, y: number, w: number, h: number): string {
  let s = ''
  const hair = (x1: number, y1: number, x2: number, y2: number, p: number, col = EINK, sw = 2): string => (p <= 0 ? '' : `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(lerp(x1, x2, p))}" y2="${n2(lerp(y1, y2, p))}" stroke="${col}" stroke-width="${sw}"/>`)
  const box = (bx: number, by: number, bw: number, bh: number, label: string, p: number, acc = false): string =>
    p <= 0 ? '' : `<g opacity="${n2(clamp(p * 1.5))}"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${acc ? ACC : 'none'}" stroke="${acc ? ACC : EINK}" stroke-width="2"/><text x="${bx + bw / 2}" y="${by + bh / 2 + 7}" text-anchor="middle" font-family="${MONO}" font-size="20" letter-spacing="1" fill="${acc ? PAPER : EINK}">${label}</text></g>`
  if (kind === 0) {
    const cols = [x + 60, x + w / 2 - 80, x + w - 220]
    const top = y + 70
    ;['EDGE', 'CORE', 'DATA'].forEach((lb, i) => {
      s += box(cols[i], top, 160, 70, lb, outCubic(seg(q, i * 0.12, 0.25 + i * 0.12)), i === 1)
      s += box(cols[i], top + 230, 160, 70, ['CDN', 'API', 'STORE'][i], outCubic(seg(q, 0.3 + i * 0.1, 0.5 + i * 0.1)))
      s += hair(cols[i] + 80, top + 70, cols[i] + 80, top + 230, outCubic(seg(q, 0.5 + i * 0.08, 0.7 + i * 0.08)))
    })
    s += hair(cols[0] + 160, top + 35, cols[1], top + 35, outCubic(seg(q, 0.45, 0.6))) + hair(cols[1] + 160, top + 35, cols[2], top + 35, outCubic(seg(q, 0.55, 0.7)))
  } else if (kind === 1) {
    const cx = x + w / 2
    s += box(cx - 90, y + 60, 180, 60, 'START', outCubic(seg(q, 0, 0.2)))
    s += hair(cx, y + 120, cx, y + 180, outCubic(seg(q, 0.2, 0.35)))
    const d = outCubic(seg(q, 0.3, 0.5))
    if (d > 0) s += `<polygon points="${cx},${y + 180} ${cx + 110},${y + 250} ${cx},${y + 320} ${cx - 110},${y + 250}" fill="none" stroke="${EINK}" stroke-width="2" opacity="${n2(d)}"/><text x="${cx}" y="${y + 257}" text-anchor="middle" font-family="${MONO}" font-size="20" fill="${EINK}" opacity="${n2(d)}">VALID?</text>`
    s += hair(cx - 110, y + 250, cx - 200, y + 380, outCubic(seg(q, 0.5, 0.7))) + hair(cx + 110, y + 250, cx + 200, y + 380, outCubic(seg(q, 0.55, 0.75)))
    s += box(cx - 290, y + 380, 180, 60, 'REVISE', outCubic(seg(q, 0.7, 0.9))) + box(cx + 110, y + 380, 180, 60, 'SHIP', outCubic(seg(q, 0.75, 0.95)), true)
  } else if (kind === 2) {
    const xs = [x + 120, x + w / 2, x + w - 120]
    xs.forEach((lx, i) => {
      s += box(lx - 70, y + 50, 140, 54, ['USER', 'APP', 'STORE'][i], outCubic(seg(q, i * 0.08, 0.2 + i * 0.08)), i === 1)
      s += hair(lx, y + 104, lx, y + 104 + 400, outCubic(seg(q, 0.15, 0.4)), '#8a8178', 1)
    })
    ;[[0, 1, 170], [1, 2, 250], [2, 1, 330], [1, 0, 410]].forEach(([a, b, dy], k) => {
      s += hair(xs[a], y + dy, xs[b], y + dy, outCubic(seg(q, 0.4 + k * 0.12, 0.55 + k * 0.12)), k === 1 ? ACC : EINK, 2)
    })
  } else if (kind === 3) {
    s += hair(x + 60, y + h / 2, x + w - 60, y + h / 2, outCubic(seg(q, 0, 0.3))) + hair(x + w / 2, y + 60, x + w / 2, y + h - 60, outCubic(seg(q, 0.05, 0.35)))
    for (let i = 0; i < 9; i++) {
      const e = outBack(seg(q, 0.3 + i * 0.06, 0.45 + i * 0.06))
      if (e <= 0) continue
      const acc = i === 2
      s += `<circle cx="${n2(x + 120 + hash(i + 40) * (w - 240))}" cy="${n2(y + 100 + hash(i + 90) * (h - 240))}" r="${n2((acc ? 16 : 10) * Math.max(0.01, e))}" fill="${acc ? ACC : 'none'}" stroke="${acc ? ACC : EINK}" stroke-width="2"/>`
    }
  } else if (kind === 4) {
    const cy = y + h / 2
    s += hair(x + 50, cy, x + w - 50, cy, outCubic(seg(q, 0, 0.35)), EINK, 3)
    for (let i = 0; i < 6; i++) {
      const px = x + 110 + i * ((w - 220) / 5)
      const e = outCubic(seg(q, 0.25 + i * 0.1, 0.4 + i * 0.1))
      const up = i % 2 === 0
      s += hair(px, cy, px, cy + (up ? -120 : 120), e, i === 3 ? ACC : EINK, 2)
      if (e > 0) s += `<circle cx="${px}" cy="${cy}" r="9" fill="${i === 3 ? ACC : PAPER}" stroke="${i === 3 ? ACC : EINK}" stroke-width="2"/><rect x="${px - 50}" y="${up ? cy - 190 : cy + 130}" width="100" height="10" fill="${EINK}" opacity="${n2(e * 0.5)}"/><rect x="${px - 36}" y="${up ? cy - 168 : cy + 152}" width="72" height="8" fill="${EINK}" opacity="${n2(e * 0.25)}"/>`
    }
  } else {
    const base = y + h - 80
    s += hair(x + 60, base, x + w - 60, base, outCubic(seg(q, 0, 0.2)))
    const vals = [0.35, 0.55, 0.4, 0.85, 0.6, 0.7]
    vals.forEach((_v, i) => {
      const bh = vals[i] * (h - 220) * outCubic(seg(q, 0.15 + i * 0.1, 0.4 + i * 0.1))
      s += `<rect x="${n2(x + 90 + i * ((w - 180) / 6))}" y="${n2(base - bh)}" width="${n2((w - 180) / 6 - 28)}" height="${n2(bh)}" fill="${i === 3 ? ACC : 'none'}" stroke="${i === 3 ? ACC : EINK}" stroke-width="2"/>`
    })
  }
  return s
}

export function style(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let body = ''
  const x = 70
  const y = 300
  const w = 870
  const h = 800
  const n = STYLE_TYPES.length
  const idx = Math.min(n - 1, Math.floor(p * n))
  const q = (p * n) % 1
  const local = p >= 1 ? 1 : seg(q, 0, 0.7)
  const enter = outCubic(seg(p, 0, 0.05))
  body += `<g opacity="${n2(enter)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}" stroke="${EINK}" stroke-width="2"/>`
  body += `<line x1="${x + 40}" y1="${y + 76}" x2="${x + w - 40}" y2="${y + 76}" stroke="${EINK}" stroke-width="1"/>`
  body += `<text x="${x + 40}" y="${y + 56}" font-family="${SERIF}" font-style="italic" font-size="32" fill="${EINK}">${STYLE_TYPES[idx]}</text><text x="${x + w - 40}" y="${y + 56}" text-anchor="end" font-family="${MONO}" font-size="20" fill="${ACC}">&lt;svg&gt;</text>`
  body += editorial(idx, local, x, y + 80, w, h - 80)
  // 換頁的細線掃過
  const sweep = idx > 0 || p > 0 ? seg(q, 0, 0.12) : 1
  if (p > 0.02 && sweep < 1) body += `<rect x="${n2(lerp(x, x + w, sweep))}" y="${y}" width="4" height="${h}" fill="${ACC}"/>`
  body += `</g>`
  // 下方:很多圖型的縮圖牆,目前這一種亮起
  const cols = 8
  const rows = 3
  const tw = 96
  const gap = 14
  const gx = x + (w - (cols * tw + (cols - 1) * gap)) / 2
  const gy = 1160
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c
      const e = outCubic(seg(p, (k / (rows * cols)) * 0.5, (k / (rows * cols)) * 0.5 + 0.1))
      const on = k % n === idx && k < n
      const tx = gx + c * (tw + gap)
      const ty = gy + r * (tw * 0.7 + gap)
      const kind = k % 6
      let g = ''
      if (kind === 0) g = `<rect x="${tx + 18}" y="${ty + 14}" width="26" height="14" fill="none" stroke="${EINK}" stroke-width="1.5"/><rect x="${tx + 52}" y="${ty + 14}" width="26" height="14" fill="none" stroke="${EINK}" stroke-width="1.5"/><rect x="${tx + 35}" y="${ty + 38}" width="26" height="14" fill="none" stroke="${EINK}" stroke-width="1.5"/>`
      else if (kind === 1) g = `<circle cx="${tx + 48}" cy="${ty + 16}" r="7" fill="none" stroke="${EINK}" stroke-width="1.5"/><polygon points="${tx + 48},${ty + 26} ${tx + 64},${ty + 38} ${tx + 48},${ty + 50} ${tx + 32},${ty + 38}" fill="none" stroke="${EINK}" stroke-width="1.5"/>`
      else if (kind === 2) g = `<line x1="${tx + 24}" y1="${ty + 10}" x2="${tx + 24}" y2="${ty + 56}" stroke="${EINK}"/><line x1="${tx + 72}" y1="${ty + 10}" x2="${tx + 72}" y2="${ty + 56}" stroke="${EINK}"/><line x1="${tx + 24}" y1="${ty + 26}" x2="${tx + 72}" y2="${ty + 26}" stroke="${EINK}" stroke-width="1.5"/><line x1="${tx + 72}" y1="${ty + 42}" x2="${tx + 24}" y2="${ty + 42}" stroke="${EINK}" stroke-width="1.5"/>`
      else if (kind === 3) g = `<line x1="${tx + 48}" y1="${ty + 8}" x2="${tx + 48}" y2="${ty + 58}" stroke="${EINK}"/><line x1="${tx + 20}" y1="${ty + 33}" x2="${tx + 76}" y2="${ty + 33}" stroke="${EINK}"/><circle cx="${tx + 34}" cy="${ty + 20}" r="4" fill="${EINK}"/><circle cx="${tx + 62}" cy="${ty + 46}" r="4" fill="${EINK}"/>`
      else if (kind === 4) g = `<line x1="${tx + 14}" y1="${ty + 33}" x2="${tx + 82}" y2="${ty + 33}" stroke="${EINK}"/><circle cx="${tx + 30}" cy="${ty + 33}" r="4" fill="${EINK}"/><circle cx="${tx + 52}" cy="${ty + 33}" r="4" fill="${EINK}"/><circle cx="${tx + 70}" cy="${ty + 33}" r="4" fill="${EINK}"/>`
      else g = `<rect x="${tx + 20}" y="${ty + 34}" width="12" height="22" fill="none" stroke="${EINK}" stroke-width="1.5"/><rect x="${tx + 42}" y="${ty + 16}" width="12" height="40" fill="none" stroke="${EINK}" stroke-width="1.5"/><rect x="${tx + 64}" y="${ty + 26}" width="12" height="30" fill="none" stroke="${EINK}" stroke-width="1.5"/>`
      body += `<g opacity="${n2(e)}"><rect x="${tx}" y="${ty}" width="${tw}" height="${n2(tw * 0.7)}" fill="${on ? '#f0d8cc' : PAPER}" stroke="${on ? ACC : EINK}" stroke-width="${on ? 3 : 1}"/>${g}</g>`
    }
  }
  void star
  return { bg: '#e9e2d3', body }
}
