// trellis-reel 的各段畫面:純函式(時間進來、SVG 字串出去)。畫面是示意,數字只用 data.ts 裡查證過的。
import { INK, MONO, cube, SANS, clamp, esc, forkIcon, hash, inOutCubic, lerp, mix, n2, outBack, outCubic, repoIcon, seg, star, type SceneOut } from './draw'
import { FACTS, fmtK, total } from './data'
import { cellScreen, doneTl, timeline, type MeshSpec, type TlWin } from './mist'
import { CREDIT, REF_URL, SOURCE, N, VX, VY, VZ } from './bust'

const IND = '#4f46e5'
const TEAL = '#0d9488'
const AMBER = '#d97706'
const SLATE = '#64748b'
const CARD = '#ffffff'
const LINE = '#d6deea'

/** 「這一格」標示框指的那顆積木:臉頰附近、朝前的 128 格 */
const HL = (() => {
  let best = 0
  let bs = 1e9
  for (let n = 0; n < N; n++) {
    const sc = Math.abs(VX[n] - 6) * 1.5 + Math.abs(VY[n] - 22) * 1.5 - VZ[n] * 0.8
    if (sc < bs) {
      bs = sc
      best = n
    }
  }
  return best
})()
const shade = (c: string): [string, string, string] => [mix(c, '#ffffff', 0.25), mix(c, '#0f172a', 0.18), mix(c, '#0f172a', 0.35)]

const text = (x: number, y: number, s: string, size: number, fill = INK, o: { w?: number; anchor?: string; font?: string; op?: number } = {}): string =>
  `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${o.anchor ?? 'start'}" font-family="${o.font ?? SANS}" font-size="${size}" font-weight="${o.w ?? 700}" fill="${fill}" opacity="${n2(o.op ?? 1)}" style="font-variant-numeric:tabular-nums">${esc(s)}</text>`
const card = (x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; op?: number; dy?: number; rx?: number } = {}): string =>
  `<rect x="${n2(x)}" y="${n2(y + (o.dy ?? 0))}" width="${w}" height="${h}" rx="${o.rx ?? 32}" fill="${o.fill ?? CARD}" stroke="${o.stroke ?? LINE}" stroke-width="3" opacity="${n2(o.op ?? 1)}"/>`
const chip = (x: number, y: number, label: string, fill: string, fg: string, size = 30, op = 1): string => {
  const w = chipW(label, size)
  return `<g opacity="${n2(op)}"><rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${size + 28}" rx="${(size + 28) / 2}" fill="${fill}"/>${text(x + 22, y + size + 4, label, size, fg, { w: 700 })}</g>`
}
const chipW = (label: string, size = 30): number => Math.round([...label].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 1.02 : 0.62) * size, 0)) + 44

/** 示意的小模型:階梯狀的體素(i,j,k) */
const MODEL: [number, number, number][] = (() => {
  const v: [number, number, number][] = []
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v.push([i, j, 0])
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) v.push([i, j, 1])
  v.push([0, 0, 2])
  return v.sort((p, q) => p[0] + p[1] + p[2] * 0.01 - (q[0] + q[1] + q[2] * 0.01) || p[2] - q[2])
})()
/** reveal:0–1 逐顆長出;mode:'flat' 單色(只有形狀)、'pbr' 上材質 */
function model(ox: number, oy: number, s: number, reveal: number, tex: number, l: number): string {
  let out = ''
  const a = s * 0.866
  const b = s * 0.5
  const order = [...MODEL].sort((p, q) => p[2] - q[2] || p[0] + p[1] - (q[0] + q[1]))
  const idx = new Map(order.map((m, n) => [m.join(','), n]))
  for (const [i, j, k] of MODEL) {
    const n = idx.get([i, j, k].join(','))!
    const e = outBack(seg(reveal, (n / order.length) * 0.8, (n / order.length) * 0.8 + 0.2))
    if (e <= 0) continue
    const cx = ox + (i - j) * a
    const cy = oy + (i + j) * b - k * s + (1 - clamp(e)) * -60
    const h = hash(i * 7 + j * 3 + k * 11)
    const base = k === 2 ? '#f59e0b' : k === 1 ? '#6366f1' : mix('#0d9488', '#14b8a6', h)
    const shaded = (c: string, d: number): string => mix(c, '#0f172a', d)
    const grey = '#cbd5e1'
    const t = clamp(tex)
    const top = mix(grey, mix(base, '#ffffff', 0.25), t)
    const left = mix('#94a3b8', shaded(base, 0.18), t)
    const right = mix('#a8b4c6', shaded(base, 0.35), t)
    out += cube(cx, cy + Math.sin(l / 500 + i + j) * 3 * clamp(e), s, top, left, right, clamp(e))
  }
  return out
}

const headline = (s: string, sub?: string, p = 1): string => {
  const e = outCubic(seg(p, 0, 0.12))
  return `<g opacity="${n2(e)}" transform="translate(0 ${n2((1 - e) * 24)})">${text(70, 372, s, 62, INK, { w: 800 })}${sub ? text(70, 430, sub, 32, SLATE, { w: 600 }) : ''}</g>`
}

// ---------- hook ----------
/** 開頭半身像的點雲動畫時間窗(佔整段的比例):粗疏的點 → 修位置 → 分裂變密(四階,位置調整與分裂重疊)→ 上貼圖色 → 平滑著色。全程是圓點,沒有方格 */
const HOOK_W: TlWin = { ap: [0.13, 0.21], sp: [[0.24, 0.31], [0.33, 0.4], [0.42, 0.49]], rf: [[0.17, 0.25], [0.28, 0.35], [0.37, 0.44], [0.46, 0.53]], col: [0.48, 0.6], sm: [0.58, 0.68] }
const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t
export function hook(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let b = ''
  b += text(70, 372, 'TRELLIS.2', 96, IND, { w: 800 })
  b += text(70, 436, '微軟開源・遊戲素材生成新工具', 38, SLATE, { w: 600 })
  const mv = inOutCubic(seg(p, 0.13, 0.22))
  // 輸出:GLB 卡(點雲動畫畫在這裡)
  const gc = outCubic(seg(p, 0.14, 0.22))
  b += `<g opacity="${n2(gc)}">${card(70, 830, 870, 500, { fill: '#f8fafc' })}`
  b += chip(780, 850, 'GLB', '#e0e7ff', '#3730a3', 30)
  b += text(96, 878, '示意', 24, '#b45309', { w: 700 })
  b += `</g>`
  b += text(70, 1362, CREDIT, 22, SLATE, { w: 600, op: clamp(seg(p, 0.12, 0.2)) })
  // 輸入:一張圖片(半身像的渲染圖)。一開始在中上方放大,點雲成形開始後縮到左上角
  const e1 = outBack(seg(p, 0.02, 0.08))
  const sc = lerpN(1, 220 / 480, mv)
  const ix = lerpN(300, 70, mv)
  const iy = lerpN(490, 480, mv)
  b += `<g opacity="${n2(clamp(e1))}" transform="translate(${n2(ix)} ${n2(iy + (1 - clamp(e1)) * 40)}) scale(${n2(sc)})">`
  b += `<rect x="-16" y="-16" width="512" height="562" rx="46" fill="none" stroke="${IND}" stroke-width="${n2(4 / sc)}" stroke-dasharray="18 14" opacity="${n2(1 - mv)}"/>`
  b += card(0, 0, 480, 530, { rx: 36 })
  b += `<clipPath id="tr-img"><rect x="20" y="20" width="440" height="440" rx="24"/></clipPath><image href="${REF_URL}" x="20" y="20" width="440" height="440" preserveAspectRatio="xMidYMid slice" clip-path="url(#tr-img)"/>`
  b += `<g opacity="${n2(1 - mv)}"><circle cx="240" cy="-16" r="28" fill="${IND}"/><path d="M240 -6 V-26 M229 -17 L240 -28 L251 -17" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  b += text(240, 508, '輸入：一張圖片', 36, INK, { anchor: 'middle', w: 800 }) + `</g></g>`
  b += `<g opacity="${n2(mv)}">${text(180, 770 + 8, 'IMAGE', 26, SLATE, { anchor: 'middle', font: MONO })}<path d="M180 788 V806" stroke="${IND}" stroke-width="8" stroke-linecap="round"/><polygon points="180,826 164,804 196,804" fill="${IND}"/></g>`
  const tt = outCubic(seg(p, 0.22, 0.3))
  b += `<g opacity="${n2(tt)}" transform="translate(${n2((1 - tt) * 30)} 0)">${text(330, 570, '一張圖進去', 52, INK, { w: 800 })}${text(330, 640, '帶材質的 3D 模型出來', 44, TEAL, { w: 800 })}${text(330, 695, '點雲逐漸成形，再變成網格（示意）', 28, SLATE, { w: 600 })}</g>`
  const spec: MeshSpec = {
    mode: 'hook',
    l,
    region: { x: 70, y: 470, w: 870, h: 930 },
    cx: lerpN(538, 505, mv),
    cy: lerpN(732, 1085, mv),
    S: lerpN(2.54, 3.6, mv),
    box: { x0: 0, x1: 0, y0: 0, y1: 0 },
    tl: timeline(p, HOOK_W),
  }
  // 秒數
  const e2 = outBack(seg(p, 0.66, 0.74))
  const sec = Math.round(lerp(0, 1, seg(p, 0.66, 0.7)) * 3)
  b += `<g opacity="${n2(clamp(e2))}" transform="translate(0 ${n2(380 + (1 - clamp(e2)) * 50)})">`
  b += card(70, 1000, 870, 300, { fill: '#eef2ff', stroke: '#c7d2fe' })
  b += text(120, 1130, `${sec}`, 150, IND, { w: 800 })
  b += text(190 + String(sec).length * 40, 1130, '秒', 56, IND)
  b += text(430, 1115, '到', 56, SLATE, { w: 600 })
  const sec2 = Math.round(lerp(3, 60, seg(p, 0.7, 0.82)))
  b += text(540, 1130, `${sec2}`, 150, TEAL, { w: 800 })
  b += text(540 + String(sec2).length * 85 + 20, 1130, '秒', 56, TEAL)
  b += text(120, 1245, 'H100・從一張圖到帶材質的 3D 網格', 36, SLATE, { w: 600 })
  b += `</g>`
  return { bg: '#eef3fb', body: b, mesh: spec }
}

// ---------- repo(GitHub 狀態) ----------
export function repo(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  const R = FACTS.repo
  const e = outBack(seg(p, 0.04, 0.24))
  let b = headline('GitHub 狀態', '抓取當下的數字', p)
  b += `<g opacity="${n2(clamp(e))}" transform="translate(0 ${n2((1 - clamp(e)) * 80)})">`
  b += card(70, 500, 870, 760)
  b += `<rect x="70" y="500" width="870" height="16" rx="8" fill="${IND}"/>`
  b += repoIcon(110, 556, 48, SLATE)
  b += `<text x="176" y="598" font-family="${SANS}" font-size="44" font-weight="600" fill="#334155">${R.owner} / <tspan fill="${INK}" font-weight="800">${R.name}</tspan></text>`
  const v = Math.round(R.stars * outCubic(seg(p, 0.2, 0.55)) / 100) * 100
  const pulse = 1 + 0.08 * Math.sin(seg(p, 0.55, 0.7) * Math.PI)
  b += star(150, 735, 56 * pulse, '#f5b301')
  b += text(235, 780, fmtK(v), 120, INK, { w: 800 })
  b += forkIcon(110, 850, 52, SLATE)
  b += text(185, 896, fmtK(R.forks * outCubic(seg(p, 0.3, 0.6))), 56, SLATE, { w: 700 })
  b += text(70 + 435, 896, 'forks', 36, SLATE, { w: 600, anchor: 'middle' })
  const c = outBack(seg(p, 0.55, 0.75))
  b += chip(110, 960, 'MIT 授權', '#dcfce7', '#166534', 32, clamp(c))
  b += chip(110 + chipW('MIT 授權', 32) + 20, 960, '4B 參數', '#e0e7ff', '#3730a3', 32, clamp(c))
  const d = outBack(seg(p, 0.65, 0.85))
  b += chip(110, 1060, 'HuggingFace 模型', '#fef3c7', '#92400e', 32, clamp(d))
  b += chip(110, 1160, 'Space 線上 demo', '#fce7f3', '#9d174d', 32, clamp(seg(p, 0.75, 0.92)))
  b += `</g>`
  b += text(70, 1340, '星數、fork 為抓取當下', 30, SLATE, { w: 500, op: clamp(seg(p, 0.5, 0.7)) })
  return { bg: '#eef3fb', body: b }
}

// ---------- io(能做什麼) ----------
export function io(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let b = headline('輸入一張圖', '輸出帶 PBR 材質的 3D 網格', p)
  const e1 = outCubic(seg(p, 0.04, 0.18))
  b += `<g opacity="${n2(e1)}">${card(70, 480, 870, 200, {})}`
  b += `<rect x="100" y="505" width="150" height="150" rx="16" fill="#dbeafe"/><circle cx="215" cy="545" r="16" fill="#fbbf24"/><polygon points="100,655 160,570 205,625 235,590 250,655" fill="#60a5fa"/>`
  b += text(290, 590, '一張圖片', 44, INK) + text(290, 640, 'image → 3D', 32, SLATE, { w: 500, font: MONO }) + `</g>`
  const ar = outCubic(seg(p, 0.16, 0.26))
  b += `<g opacity="${n2(ar)}"><path d="M505 700 V745" stroke="${IND}" stroke-width="10" stroke-linecap="round"/><polygon points="505,770 483,738 527,738" fill="${IND}"/></g>`
  const e2 = outCubic(seg(p, 0.22, 0.36))
  b += `<g opacity="${n2(e2)}">${card(70, 800, 870, 330, { fill: '#f8fafc' })}`
  b += model(305, 985, 44, seg(p, 0.28, 0.5), seg(p, 0.45, 0.62), l)
  // 四個 PBR 通道
  const cols = ['#0d9488', '#94a3b8', '#e2e8f0', '#6366f1']
  FACTS.pbr.forEach((nm, i) => {
    const y = 840 + i * 68
    const q = outBack(seg(p, 0.5 + i * 0.07, 0.62 + i * 0.07))
    b += `<g opacity="${n2(clamp(q))}"><circle cx="560" cy="${y + 26}" r="22" fill="${cols[i]}" stroke="#94a3b8" stroke-width="3"/>${text(600, y + 38, nm, 36, INK, { w: 700 })}</g>`
  })
  b += `</g>`
  // 匯出
  const q1 = outBack(seg(p, 0.72, 0.84))
  const q2 = outBack(seg(p, 0.8, 0.92))
  b += chip(70, 1190, 'GLB・WebP 貼圖 4096', '#e0e7ff', '#3730a3', 32, clamp(q1))
  b += chip(70, 1290, '預覽 MP4', '#fce7f3', '#9d174d', 32, clamp(q2))
  b += chip(70 + chipW('預覽 MP4', 32) + 20, 1290, '開放曲面・非流形', '#dcfce7', '#166534', 32, clamp(seg(p, 0.86, 0.96)))
  return { bg: '#eef3fb', body: b }
}

// ---------- speed(速度三檔) ----------
export function speed(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let b = headline('生成速度', 'H100・形狀 + 材質', p)
  const x0 = 70
  const maxW = 870
  const SH = '#4f46e5'
  const TX = '#14b8a6'
  FACTS.speed.forEach((s, i) => {
    const y = 520 + i * 270
    const tot = total(s)
    const g = outCubic(seg(p, 0.1 + i * 0.2, 0.34 + i * 0.2))
    const w = Math.max(40, (tot / 60) * maxW)
    b += text(x0, y, s.res, 54, INK, { w: 800 })
    b += text(x0 + 870, y, `約 ${Math.round(tot * g)} 秒`, 58, i === 2 ? TEAL : IND, { w: 800, anchor: 'end' })
    const bw = w * g
    const sw = bw * (s.shape / tot)
    b += `<rect x="${x0}" y="${y + 30}" width="${maxW}" height="64" rx="32" fill="#e2e8f0"/>`
    if (bw > 2) {
      b += `<rect x="${x0}" y="${y + 30}" width="${n2(Math.max(sw, 1))}" height="64" rx="32" fill="${SH}"/>`
      if (bw - sw > 4) b += `<rect x="${n2(x0 + sw - 32)}" y="${y + 30}" width="${n2(bw - sw + 32)}" height="64" rx="32" fill="${TX}"/><rect x="${x0}" y="${y + 30}" width="${n2(Math.max(sw, 1))}" height="64" rx="32" fill="${SH}"/>`
    }
    b += text(x0, y + 140, `${s.shape} + ${s.tex}`, 34, SLATE, { w: 600, op: clamp(g * 2 - 1) })
  })
  const lg = outCubic(seg(p, 0.7, 0.85))
  b += `<g opacity="${n2(lg)}"><circle cx="90" cy="1368" r="14" fill="${SH}"/>${text(116, 1380, '形狀', 32, SLATE, { w: 600 })}<circle cx="240" cy="1368" r="14" fill="${TX}"/>${text(266, 1380, '材質', 32, SLATE, { w: 600 })}${text(940, 1380, '官方實測', 30, SLATE, { w: 500, anchor: 'end' })}</g>`
  return { bg: '#eef3fb', body: b }
}

// ---------- voxel(O-Voxel:稀疏,只記有東西的格子;方格由粗到細) ----------
/** 半身像的「輸入的一張圖」縮圖、模型致謝與「示意」,畫在卡片角落。cardY/cardH 為卡片位置。 */
function bustNotes(cardY: number, cardH: number, p: number): string {
  const ty = cardY + 14
  const o0 = outCubic(seg(p, 0, 0.1))
  let o = `<g opacity="${n2(o0)}"><clipPath id="tr-ref"><rect x="822" y="${ty}" width="100" height="100" rx="14"/></clipPath>`
  o += `<image href="${REF_URL}" x="822" y="${ty}" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#tr-ref)"/><rect x="822" y="${ty}" width="100" height="100" rx="14" fill="none" stroke="#94a3b8" stroke-width="3"/>`
  o += text(872, ty + 124, '輸入的一張圖', 22, SLATE, { w: 600, anchor: 'middle' }) + `</g>`
  o += text(96, cardY + cardH - 14, CREDIT, 22, SLATE, { w: 600, op: o0 })
  o += text(924, cardY + cardH - 14, '示意', 22, '#b45309', { w: 700, anchor: 'end', op: o0 })
  return o
}
const VOX_W: TlWin = { ap: [0.2, 0.32], sp: [[0.36, 0.45], [0.47, 0.56], [0.58, 0.67]], rf: [[0.28, 0.38], [0.4, 0.5], [0.52, 0.61], [0.63, 0.72]], col: [0.62, 0.78], sm: [0.78, 0.95] }
export function voxel(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let b = headline('VAE 解碼', '還原成 O-Voxel 稀疏體素（示意）', p)
  b += card(70, 470, 870, 730, { fill: '#f8fafc' })
  b += bustNotes(470, 730, p)
  const spec: MeshSpec = {
    mode: 'voxel',
    l,
    region: { x: 70, y: 474, w: 870, h: 722 },
    cx: 505,
    cy: 888,
    S: 4.4,
    box: { x0: 0, x1: 0, y0: 0, y1: 0 },
    vx: { dots: outCubic(seg(p, 0.04, 0.16)), fade: seg(p, 0.2, 0.32), grow: seg(p, 0.2, 0.32) },
    tl: timeline(p, VOX_W),
  }
  const cap = (t: string, x0: number, x1: number, last = false): string => {
    const o = outCubic(seg(p, x0, x0 + 0.04)) * (last ? 1 : 1 - seg(p, x1 - 0.04, x1))
    return text(110, 530, t, 38, IND, { w: 800, op: o })
  }
  b += cap('展開成整個空間的格子', 0.04, 0.2) + cap('只記有東西的格子', 0.2, 0.36) + cap('由粗到細，還原形狀', 0.36, 0.62) + cap('貼上貼圖色', 0.62, 0.78) + cap('平滑著色成網格（示意）', 0.78, 2, true)
  const c1 = '稀疏體素'
  const c2 = '空的格子不記'
  b += chip(70, 1240, c1, '#e0e7ff', '#3730a3', 34, clamp(outBack(seg(p, 0.4, 0.5))))
  b += chip(70 + chipW(c1, 34) + 24, 1240, c2, '#f1f5f9', '#475569', 34, clamp(outBack(seg(p, 0.5, 0.6))))
  b += chip(70, 1330, '不經有損的等值面轉換', '#fef3c7', '#92400e', 34, clamp(outBack(seg(p, 0.6, 0.7))))
  return { bg: '#eef3fb', body: b, mesh: spec }
}

// ---------- cell(凝聚完成後:選一格,這一格同時記著形狀與外觀) ----------
export function cell(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let b = headline('每一格都記著', '形狀與外觀在同一格', p)
  b += card(70, 470, 870, 560, { fill: '#f8fafc' })
  b += bustNotes(470, 560, p)
  const spec: MeshSpec = {
    mode: 'voxel',
    l,
    region: { x: 70, y: 474, w: 870, h: 552 },
    cx: 505,
    cy: 772,
    S: 3.3,
    box: { x0: 0, x1: 0, y0: 0, y1: 0 },
    // 接著 flow 的平滑著色結尾,放大看時還原成一格格的方塊
    tl: doneTl(1 - inOutCubic(seg(p, 0.02, 0.22))),
  }
  b += text(110, 530, '選一格來看', 38, IND, { w: 800, op: outCubic(seg(p, 0.08, 0.14)) })
  const [hx, hy] = cellScreen(spec, HL)
  const hi = outCubic(seg(p, 0.26, 0.32))
  let over = ''
  if (hi > 0) {
    const r = 17 + 3 * Math.sin(l / 260)
    over += `<g opacity="${n2(hi)}"><rect x="${n2(hx - r)}" y="${n2(hy - r)}" width="${n2(2 * r)}" height="${n2(2 * r)}" rx="5" fill="none" stroke="${IND}" stroke-width="5"/><path d="M${n2(hx)} ${n2(hy + r)} V1068" stroke="${IND}" stroke-width="4" stroke-dasharray="10 10" stroke-linecap="round"/></g>`
  }
  const rc = outBack(seg(p, 0.3, 0.42))
  b += `<g opacity="${n2(clamp(rc))}" transform="translate(0 ${n2((1 - clamp(rc)) * 60)})">${card(70, 1070, 870, 390, { fill: '#ffffff', stroke: '#c7d2fe' })}`
  b += text(110, 1135, '這一格同時記著', 38, INK, { w: 800 })
  const [t0, l0, r0] = shade('#f59e0b')
  b += cube(250, 1320, 78, t0, l0, r0)
  b += `<rect x="440" y="1165" width="${n2(chipW('形狀(幾何)', 32))}" height="60" rx="30" fill="#e0e7ff"/>${text(462, 1206, '形狀(幾何)', 32, '#3730a3', { w: 700 })}`
  const rows = [
    { t: '底色', c: '#f59e0b' },
    { t: '粗糙度', c: '#94a3b8' },
    { t: '金屬度', c: '#cbd5e1' },
    { t: '不透明度', c: '#6366f1' },
  ]
  rows.forEach((r, i) => {
    const q = outBack(seg(p, 0.4 + i * 0.045, 0.48 + i * 0.045))
    const y = 1270 + i * 46
    b += `<g opacity="${n2(clamp(q))}"><circle cx="466" cy="${y + 4}" r="17" fill="${r.c}" stroke="#94a3b8" stroke-width="3" ${i === 3 ? 'fill-opacity="0.5"' : ''}/>${text(500, y + 16, r.t, 34, INK, { w: 700 })}</g>`
  })
  b += `</g>`
  b += chip(70, 1500, '幾何 + PBR', '#e0e7ff', '#3730a3', 34, clamp(outBack(seg(p, 0.6, 0.72))))
  const x2 = 70 + chipW('幾何 + PBR', 34) + 24
  const sq = clamp(outBack(seg(p, 0.72, 0.84)))
  b += `<g opacity="${n2(sq)}"><rect x="${n2(x2)}" y="1500" width="${n2(chipW('等值面場', 34))}" height="62" rx="31" fill="#f1f5f9"/>${text(x2 + 22, 1542, '等值面場', 34, '#94a3b8', { w: 700 })}<line x1="${n2(x2 + 10)}" y1="1531" x2="${n2(x2 + chipW('等值面場', 34) - 10)}" y2="1531" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/></g>`
  return { bg: '#eef3fb', body: b, over, mesh: spec }
}

// ---------- flow(壓縮 VAE → 從迷霧三段凝聚) ----------
export function flow(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let b = headline('從迷霧凝聚', 'flow matching:整體一起一步步修正', p)
  const ph = { pack: 0, scatter: 1, e1: seg(p, 0.16, 0.4), e2: seg(p, 0.4, 0.66), e3: seg(p, 0.66, 0.88), sm: 0 }
  b += card(70, 460, 870, 620, { fill: '#f8fafc' })
  const glow = ph.scatter * (1 - ph.e2)
  b += `<defs><radialGradient id="tr-mist"><stop offset="0" stop-color="#a5b4fc" stop-opacity="0.55"/><stop offset="1" stop-color="#a5b4fc" stop-opacity="0"/></radialGradient></defs><ellipse cx="505" cy="775" rx="440" ry="255" fill="url(#tr-mist)" opacity="${n2(glow * 0.9)}"/>`
  b += bustNotes(460, 620, p)
  const spec: MeshSpec = { mode: 'flow', l, region: { x: 70, y: 464, w: 870, h: 612 }, cx: 505, cy: 800, S: 3.7, box: { x0: 150, x1: 860, y0: 570, y1: 1000 }, ph }
  const cap = (t: string, x0: number, x1: number, last = false): string => {
    const o = outCubic(seg(p, x0, x0 + 0.03)) * (last ? 1 : 1 - seg(p, x1 - 0.03, x1))
    return text(110, 522, t, 38, IND, { w: 800, op: o })
  }
  b += cap('起點：一團雜訊', 0.02, 0.16) + cap('① 結構:粗輪廓', 0.16, 0.4) + cap('② 形狀:補上細節', 0.4, 0.66) + cap('③ 貼圖:依形狀上材質', 0.66, 2, true)
  // 這一切都在「壓縮後的潛在空間」裡進行(縮小十六倍)
  const lt = clamp(outBack(seg(p, 0.02, 0.1)))
  b += chip(96, 890, '16 倍下採樣', '#ffedd5', '#9a3412', 20, lt)
  b += chip(96, 936, '在壓縮後的潛在空間生成', '#e0e7ff', '#3730a3', 20, lt)
  // 第三段:只生成材質(底色、粗糙度、金屬度、不透明度)
  const pbr = ['底色', '粗糙度', '金屬度', '不透明度']
  let x = 110
  pbr.forEach((t, i) => {
    const q = clamp(outBack(seg(p, 0.68 + i * 0.03, 0.76 + i * 0.03)))
    const cols = ['#f59e0b', '#94a3b8', '#cbd5e1', '#6366f1']
    b += `<g opacity="${n2(q)}"><circle cx="${x + 14}" cy="1022" r="14" fill="${cols[i]}" stroke="#94a3b8" stroke-width="2.5"/>${text(x + 38, 1034, t, 30, INK, { w: 700 })}</g>`
    x += 38 + t.length * 32 + 26
  })
  // 三段由粗到細
  FACTS.stages.forEach((s, i) => {
    const y = 1110 + i * 130
    const e = [ph.e1, ph.e2, ph.e3][i]
    const on = e > 0 && e < 1
    const q = outBack(seg(p, 0.08 + i * 0.03, 0.18 + i * 0.03))
    b += `<g opacity="${n2(clamp(q))}" transform="translate(${n2((1 - clamp(q)) * -60)} 0)">`
    b += card(70, y, 870, 108, { fill: '#ffffff', stroke: on ? IND : LINE, rx: 28 })
    b += `<circle cx="122" cy="${y + 54}" r="28" fill="${e >= 1 ? TEAL : on ? IND : '#cbd5e1'}"/>${text(122, y + 66, String(i + 1), 34, '#ffffff', { w: 800, anchor: 'middle' })}`
    b += text(172, y + 52, s.name, 40, INK, { w: 800 })
    b += text(172, y + 92, s.res, 28, SLATE, { w: 600, font: /^\d/.test(s.res) ? MONO : SANS })
    b += `<rect x="470" y="${y + 36}" width="300" height="18" rx="9" fill="#e2e8f0"/><rect x="470" y="${y + 36}" width="${n2(Math.max(0, 300 * e))}" height="18" rx="9" fill="${e >= 1 ? TEAL : IND}"/>`
    b += text(470, y + 88, '雜訊 → 清晰', 24, SLATE, { w: 600 })
    b += text(910, y + 68, '1.3B', 40, IND, { w: 800, anchor: 'end' })
    b += `</g>`
  })
  b += chip(70, 1520, '整體 4B 參數', '#e0e7ff', '#3730a3', 34, clamp(outBack(seg(p, 0.86, 0.97))))
  return { bg: '#eef3fb', body: b, mesh: spec }
}

// ---------- limits(門檻與限制) ----------
export function limits(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let b = headline('門檻不低', '先看清楚再下載', p)
  const items: { t: string; s: string }[] = [
    { t: 'Linux', s: '目前只在 Linux 測試' },
    { t: '≥ 24GB', s: 'NVIDIA GPU・A100、H100 驗證' },
    { t: 'CUDA 12.4', s: 'PyTorch 2.6・相依套件多' },
    { t: '安裝繁瑣', s: 'GLB 預設不透明,alpha 要自己接' },
  ]
  items.forEach((it, i) => {
    const y = 490 + i * 215
    const e = outBack(seg(p, 0.1 + i * 0.15, 0.28 + i * 0.15))
    b += `<g opacity="${n2(clamp(e))}" transform="translate(${n2((1 - clamp(e)) * 90)} 0)">${card(70, y, 870, 185, { fill: '#fffbeb', stroke: '#fde68a' })}`
    b += `<rect x="70" y="${y}" width="16" height="185" rx="8" fill="${AMBER}"/>`
    b += text(120, y + 92, it.t, 56, '#92400e', { w: 800 })
    b += text(120, y + 150, it.s, 32, '#a16207', { w: 600 })
    b += `</g>`
  })
  const q = outCubic(seg(p, 0.75, 0.92))
  b += `<g opacity="${n2(q)}"><rect x="70" y="1360" width="870" height="110" rx="30" fill="none" stroke="#94a3b8" stroke-width="4" stroke-dasharray="14 12"/>${text(505, 1430, '品質評比:官方沒給數字', 40, SLATE, { w: 700, anchor: 'middle' })}</g>`
  return { bg: '#eef3fb', body: b }
}

// ---------- outro ----------
export function outro(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let b = ''
  const cards = [
    { x: 70, accent: IND, org: 'github.com', name: 'TRELLIS.2', sub: `microsoft / TRELLIS.2`, tag: 'MIT・程式碼' },
    { x: 520, accent: '#d97706', org: 'huggingface.co', name: 'TRELLIS.2-4B', sub: 'microsoft / TRELLIS.2-4B', tag: '權重・Space demo' },
  ]
  cards.forEach((c, i) => {
    const w = 420
    const y = 460
    const h = 640
    const e = outBack(seg(p, 0.08 + i * 0.14, 0.45 + i * 0.14))
    const float = Math.sin(l / 420 + i * 2) * 6
    b += `<g opacity="${n2(clamp(e))}" transform="translate(0 ${n2((1 - e) * 160 + float)})">`
    b += card(c.x, y, w, h)
    b += `<rect x="${c.x}" y="${y}" width="${w}" height="14" rx="7" fill="${c.accent}"/>`
    b += repoIcon(c.x + 32, y + 52, 40, SLATE)
    b += text(c.x + 84, y + 84, c.org, 28, '#475569', { w: 600 })
    b += text(c.x + 32, y + 200, c.name, i === 0 ? 62 : 38, INK, { w: 800 })
    b += text(c.x + 32, y + 270, c.sub, 26, SLATE, { w: 600 })
    for (let k = 0; k < 3; k++) b += `<rect x="${c.x + 32}" y="${y + 320 + k * 34}" width="${[350, 300, 220][k]}" height="14" rx="7" fill="#e2e8f0"/>`
    b += chip(c.x + 32, y + 470, c.tag, i === 0 ? '#dcfce7' : '#fef3c7', i === 0 ? '#166534' : '#92400e', 26)
    if (i === 0) b += star(c.x + 60, y + 580, 32 * (1 + 0.2 * Math.sin(seg(p, 0.5, 0.8) * Math.PI)), '#f5b301') + text(c.x + 112, y + 598, fmtK(FACTS.repo.stars), 44, INK, { w: 800 })
    b += `</g>`
  })
  b += text(70, 1370, CREDIT, 22, SLATE, { w: 600, op: clamp(seg(p, 0.6, 0.8)) })
  b += text(70, 1402, SOURCE, 19, SLATE, { w: 500, font: MONO, op: clamp(seg(p, 0.6, 0.8)) })
  b += text(540, 1260, '抓取當下約 13.2k 星', 30, SLATE, { w: 500, anchor: 'middle', op: clamp(seg(p, 0.6, 0.8)) })
  return { bg: '#eef3fb', body: b }
}
