// 成長(growth)與儲存庫卡片(repos)兩段。數字只有終點是真的(GitHub API,2026-11-13);
// 中間的上升曲線與湧入的星星是示意,不代表任何真實的星數歷史。
import { INK, MONO, SANS, clamp, esc, forkIcon, hash, lerp, mix, n2, outBack, outCubic, repoIcon, seg, star, type SceneOut } from './draw'

export interface RepoFact {
  owner: string
  name: string
  stars: number
  forks: number
  license: string
  accent: string
  accent2: string
}
export const REPOS: RepoFact[] = [
  { owner: 'tt-a1i', name: 'archify', stars: 96093, forks: 6572, license: 'Apache-2.0', accent: '#2563eb', accent2: '#7c3aed' },
  { owner: 'cathrynlavery', name: 'diagram-design', stars: 66821, forks: 4449, license: 'MIT', accent: '#bf4520', accent2: '#e08a3c' },
]

export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US')

/** 示意的上升曲線:指數型,0–1 → 0–1 */
export const curve = (x: number, k = 3.2): number => (Math.exp(k * clamp(x)) - 1) / (Math.exp(k) - 1)

/** 計數器的值:前段慢、後段衝;p 到 0.88 時到終點 */
export function counter(p: number, final: number): number {
  return Math.round(final * curve(clamp(p / 0.88)))
}

function growthCard(i: number, p: number, ms: number): string {
  const r = REPOS[i]
  const x = 70
  const w = 870
  const h = 520
  const y = i === 0 ? 290 : 850
  const pc = seg(p, i * 0.07, 1) // 第二張晚一點出發
  const v = counter(pc, r.stars)
  const enter = outCubic(seg(p, i * 0.04, 0.1 + i * 0.04))
  // 曲線:卡片下半部的區域
  const cx0 = x + 40
  const cx1 = x + w - 40
  const cy0 = y + h - 40
  const cy1 = y + 270
  const N = 48
  const pts: string[] = []
  const lim = clamp(pc / 0.88)
  for (let k = 0; k <= N; k++) {
    const t = (k / N) * lim
    pts.push(`${n2(lerp(cx0, cx1, (k / N) * lim))},${n2(lerp(cy0, cy1, curve(t)))}`)
  }
  const tipX = lerp(cx0, cx1, lim)
  const tipY = lerp(cy0, cy1, curve(lim))
  const gid = `g${i}`
  let s = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r.accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${r.accent}" stop-opacity="0"/></linearGradient></defs>`
  s += `<g opacity="${n2(enter)}" transform="translate(0 ${n2((1 - enter) * 60)})">`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="36" fill="#ffffff" stroke="#d6deea" stroke-width="3"/>`
  // 月份刻度(只有刻度,沒有數字:不暗示中間的星數)
  for (let k = 0; k <= 7; k++) s += `<line x1="${n2(lerp(cx0, cx1, k / 7))}" y1="${cy0 + 8}" x2="${n2(lerp(cx0, cx1, k / 7))}" y2="${cy0 + 20}" stroke="#c3cddc" stroke-width="3"/>`
  s += `<line x1="${cx0}" y1="${cy0 + 8}" x2="${cx1}" y2="${cy0 + 8}" stroke="#c3cddc" stroke-width="3"/>`
  if (lim > 0.01) {
    s += `<polygon points="${cx0},${cy0} ${pts.join(' ')} ${n2(tipX)},${cy0}" fill="url(#${gid})"/>`
    s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${r.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`
    s += `<circle cx="${n2(tipX)}" cy="${n2(tipY)}" r="${n2(14 + Math.sin(ms / 140) * 2)}" fill="${r.accent}"/><circle cx="${n2(tipX)}" cy="${n2(tipY)}" r="30" fill="${r.accent}" opacity="0.18"/>`
  }
  // 湧入的星星:越晚越密,從曲線尖端往計數器飛
  const NS = 34
  const ix = x + 78
  const iy = y + 160
  for (let k = 0; k < NS; k++) {
    const start = 0.04 + Math.pow(k / NS, 1.7) * 0.86
    const q = seg(pc, start, start + 0.1)
    if (q <= 0 || q >= 1) continue
    const sx = lerp(cx0 + 120, cx1 - 60, hash(k * 7 + i * 101))
    const sy = lerp(cy0 - 20, cy1 + 20, hash(k * 13 + i * 57))
    const e = outCubic(q)
    const px = lerp(sx, ix, e) + Math.sin(q * 6 + k) * 20 * (1 - q)
    const py = lerp(sy, iy, e)
    s += star(px, py, lerp(26, 10, q) * (0.7 + hash(k + 3) * 0.6), '#f5b301', Math.sin(q * Math.PI), q * 3)
  }
  // 標題列
  s += repoIcon(x + 40, y + 36, 44, '#64748b')
  s += `<text x="${x + 100}" y="${y + 70}" font-family="${SANS}" font-size="38" font-weight="600" fill="#334155">${esc(r.owner)} / <tspan fill="${INK}" font-weight="800">${esc(r.name)}</tspan></text>`
  // 星星計數
  const pulse = 1 + 0.06 * Math.sin(Math.min(1, seg(p, 0.86, 1)) * Math.PI) * (pc > 0.9 ? 1 : 0)
  s += star(ix, iy + 10, 44 * pulse, '#f5b301')
  s += `<text x="${x + 150}" y="${y + 196}" font-family="${SANS}" font-size="112" font-weight="800" fill="${INK}" style="font-variant-numeric:tabular-nums">${fmt(v)}</text>`
  s += `</g>`
  return s
}

export function growth(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let body = ''
  // 背景:抽象的上升曲線(整頁,示意)
  const pts: string[] = []
  const lim = clamp(p * 1.05)
  for (let k = 0; k <= 60; k++) {
    const t = (k / 60) * lim
    pts.push(`${n2(lerp(-20, 1100, (k / 60) * lim))},${n2(lerp(1700, 230, curve(t, 3.6)))}`)
  }
  body += `<polyline points="${pts.join(' ')}" fill="none" stroke="#2563eb" stroke-opacity="0.10" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/>`
  body += growthCard(0, p, l) + growthCard(1, p, l)
  // 到終點時,兩張卡下方露出 fork 數
  const f = outBack(seg(p, 0.9, 1))
  if (f > 0) {
    for (let i = 0; i < 2; i++) {
      const r = REPOS[i]
      const y = i === 0 ? 290 : 850
      body += `<g opacity="${n2(clamp(f))}" transform="translate(0 ${n2((1 - clamp(f)) * 20)})">${forkIcon(612, y + 156, 44, '#64748b')}<text x="668" y="${y + 196}" font-family="${SANS}" font-size="52" font-weight="700" fill="#64748b" style="font-variant-numeric:tabular-nums">${fmt(r.forks)}</text></g>`
    }
  }
  return { bg: mix('#eef3fb', '#f7f9fd', p), body }
}

// ---------- 收尾:兩張儲存庫卡片並排 ----------
export function repos(l: number, D: number): SceneOut {
  const p = clamp(l / D)
  let body = ''
  for (let i = 0; i < 2; i++) {
    const r = REPOS[i]
    const x = i === 0 ? 70 : 520
    const w = 420
    const y = 390
    const h = 760
    const e = outBack(seg(p, 0.08 + i * 0.14, 0.45 + i * 0.14))
    const op = clamp(e)
    const float = Math.sin(l / 420 + i * 2) * 6
    body += `<g opacity="${n2(op)}" transform="translate(0 ${n2((1 - e) * 160 + float)})">`
    body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="36" fill="#ffffff" stroke="#d6deea" stroke-width="3"/>`
    body += `<rect x="${x}" y="${y}" width="${w}" height="14" rx="7" fill="${r.accent}"/>`
    body += repoIcon(x + 32, y + 52, 40, '#64748b')
    body += `<text x="${x + 84}" y="${y + 84}" font-family="${SANS}" font-size="26" font-weight="600" fill="#475569">${esc(r.owner)}</text>`
    body += `<text x="${x + 32}" y="${y + 160}" font-family="${SANS}" font-size="${i === 0 ? 56 : 40}" font-weight="800" fill="${INK}">${esc(r.name)}</text>`
    // 簡介(灰色骨架條)
    for (let k = 0; k < 4; k++) body += `<rect x="${x + 32}" y="${y + 210 + k * 34}" width="${[360, 330, 370, 220][k]}" height="14" rx="7" fill="#e2e8f0"/>`
    // 授權
    body += `<rect x="${x + 32}" y="${y + 372}" width="${r.license.length * 15 + 44}" height="44" rx="22" fill="none" stroke="#cbd5e1" stroke-width="3"/><text x="${x + 54}" y="${y + 402}" font-family="${SANS}" font-size="24" font-weight="600" fill="#475569">${esc(r.license)}</text>`
    // 星星與 fork
    const burst = seg(p, 0.5 + i * 0.1, 0.8 + i * 0.1)
    body += star(x + 64, y + 508, 40 * (1 + 0.25 * Math.sin(burst * Math.PI)), '#f5b301')
    body += `<text x="${x + 120}" y="${y + 534}" font-family="${SANS}" font-size="56" font-weight="800" fill="${INK}" style="font-variant-numeric:tabular-nums">${fmt(r.stars)}</text>`
    body += forkIcon(x + 40, y + 590, 44, '#64748b')
    body += `<text x="${x + 120}" y="${y + 626}" font-family="${SANS}" font-size="44" font-weight="700" fill="#64748b" style="font-variant-numeric:tabular-nums">${fmt(r.forks)}</text>`
    // 語言列
    body += `<rect x="${x + 32}" y="${y + 680}" width="${w - 64}" height="12" rx="6" fill="#e2e8f0"/><rect x="${x + 32}" y="${y + 680}" width="${Math.round((w - 64) * (i ? 0.62 : 0.78))}" height="12" rx="6" fill="${r.accent}"/><rect x="${x + 32 + Math.round((w - 64) * (i ? 0.62 : 0.78))}" y="${y + 680}" width="${Math.round((w - 64) * (i ? 0.2 : 0.14))}" height="12" fill="${r.accent2}"/>`
    body += `</g>`
    // 星星迸出
    if (burst > 0 && burst < 1) {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + i
        const d = outCubic(burst) * 120
        body += star(x + 64 + Math.cos(a) * d, y + 508 + (1 - e) * 160 + float + Math.sin(a) * d, 12 * (1 - burst), '#f5b301', 1 - burst, burst * 4)
      }
    }
  }
  void MONO
  return { bg: '#eef3fb', body }
}
