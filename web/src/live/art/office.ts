// art/office:辦公室場景的背景與道具 SVG 字串(純函式,沒有狀態):房間(窗戶、城市、燈條、牆上螢幕)、窗光、桌面(含透視鍵盤)、前景葉子、散景光點。
// 座標是 1920×1080 舞台的 px。預設值等於 agent-office 的版面;別的場景傳 options 換掉桌面高度、鍵盤四邊形、id/class 前綴。
// 所有 id / class 都以 `${prefix}-` 開頭(預設 "ao"),同一頁有兩個場景時用不同前綴避免 SVG id 撞名。
import { kit } from '../kit'
import { f1 as f, onQuad, type Pt, type Quad } from './geometry'

/** 桌面的上緣(預設值) */
export const DEFAULT_DESK_Y = 772
/** 鍵盤四個角(桌上,透視;預設值) */
export const DEFAULT_KB: Quad = { tl: { x: 690, y: 800 }, tr: { x: 1036, y: 790 }, br: { x: 1068, y: 860 }, bl: { x: 700, y: 874 } }

/** 鍵盤平面上 (u, v) 的位置;kb 預設是 agent-office 的鍵盤 */
export const onKeyboard = (u: number, v: number, kb: Quad = DEFAULT_KB): Pt => onQuad(kb, u, v)

export interface OfficeOpts {
  /** id / class 前綴,預設 "ao" */
  prefix?: string
}
export interface RoomOpts extends OfficeOpts {
  /** 窗外城市的亂數種子 */
  seed?: number
}
export interface DeskOpts extends OfficeOpts {
  deskY?: number
  kb?: Quad
}

// ---------- 背景:辦公室(整層會模糊) ----------
export function roomSvg(o: RoomOpts = {}): string {
  const k = o.prefix ?? 'ao'
  const r = kit.rand(o.seed ?? 2081)
  // 窗外的城市:淡淡的大樓(日光過曝)
  let city = ''
  let x = -120
  while (x < 800) {
    const w = 50 + r() * 90
    const h = 120 + r() * 260
    const tone = 0.22 + r() * 0.25
    city += `<rect x="${f(x)}" y="${f(720 - h)}" width="${f(w)}" height="${f(h)}" fill="#7f9fbf" opacity="${tone.toFixed(2)}"/>`
    for (let wy = 720 - h + 14; wy < 700; wy += 22)
      if (r() < 0.6) city += `<rect x="${f(x + 8)}" y="${f(wy)}" width="${f(w - 16)}" height="5" fill="#ffffff" opacity="${(0.25 + r() * 0.3).toFixed(2)}"/>`
    x += w + 6 + r() * 30
  }
  // 遠處的辦公桌與椅子
  let far = ''
  for (const d of [
    { x: 840, w: 300 },
    { x: 1190, w: 260 },
    { x: 1520, w: 320 },
  ]) {
    far +=
      `<rect x="${d.x}" y="676" width="${d.w}" height="14" rx="4" fill="#eef3f8"/>` +
      `<rect x="${d.x + 10}" y="690" width="${d.w - 20}" height="80" fill="#9fb2c6" opacity=".55"/>` +
      `<rect x="${d.x + d.w * 0.3}" y="590" width="${d.w * 0.34}" height="78" rx="6" fill="#1d2b3d"/>` +
      `<rect x="${d.x + d.w * 0.3 + 6}" y="596" width="${d.w * 0.34 - 12}" height="66" rx="3" fill="#5b8fc0" opacity=".85"/>` +
      `<path d="M${d.x + d.w * 0.18} 660 q30 -50 60 0 v60 h-60z" fill="#33414f" opacity=".75"/>`
  }
  return (
    `<svg class="${k}-roomsvg" viewBox="0 0 1920 1080" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="${k}-wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f0f8"/><stop offset=".55" stop-color="#cfdce9"/><stop offset="1" stop-color="#a9bdd2"/></linearGradient>` +
    `<linearGradient id="${k}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#eaf4ff"/><stop offset="1" stop-color="#c9def2"/></linearGradient>` +
    `<linearGradient id="${k}-ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8c8d9"/><stop offset="1" stop-color="#dbe5ef"/></linearGradient>` +
    `<radialGradient id="${k}-burst" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${k}-dim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b2a4a" stop-opacity="0"/><stop offset=".55" stop-color="#0b2a4a" stop-opacity=".08"/><stop offset="1" stop-color="#0b2a4a" stop-opacity=".35"/></linearGradient>` +
    `<linearGradient id="${k}-wd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1a2b"/><stop offset="1" stop-color="#16263b"/></linearGradient>` +
    `</defs>` +
    `<rect x="-100" y="-100" width="2120" height="1300" fill="url(#${k}-wall)"/>` +
    // 左邊的大片窗戶
    `<rect x="-100" y="40" width="880" height="700" fill="url(#${k}-sky)"/>` +
    city +
    `<ellipse cx="300" cy="300" rx="520" ry="380" fill="url(#${k}-burst)"/>` +
    `<g fill="#8396ab">${[60, 250, 440, 630].map((mx) => `<rect x="${mx}" y="40" width="16" height="700"/>`).join('')}<rect x="-100" y="318" width="880" height="10"/><rect x="760" y="20" width="44" height="760"/></g>` +
    `<g fill="#ffffff" opacity=".55">${[60, 250, 440, 630].map((mx) => `<rect x="${mx}" y="40" width="4" height="700"/>`).join('')}</g>` +
    // 天花板與燈條
    `<path d="M-100 -100 H2020 V70 C 1500 52 600 44 -100 52Z" fill="url(#${k}-ceil)"/>` +
    `<g fill="#ffffff">` +
    `<rect x="880" y="22" width="520" height="12" rx="6" opacity=".95"/><rect x="1500" y="26" width="420" height="10" rx="5" opacity=".9"/><rect x="300" y="12" width="420" height="10" rx="5" opacity=".7"/>` +
    `</g>` +
    `<g fill="url(#${k}-burst)" opacity=".7"><ellipse cx="1140" cy="34" rx="360" ry="46"/><ellipse cx="1710" cy="36" rx="300" ry="40"/></g>` +
    // 牆上的兩面螢幕(程式碼、圖表)
    `<g>` +
    `<rect x="1104" y="132" width="330" height="196" rx="8" fill="url(#${k}-wd)"/>` +
    `<g opacity=".9">${Array.from({ length: 9 }, (_, i) => `<rect x="${1124 + (i % 3) * 14}" y="${150 + i * 19}" width="${70 + ((i * 53) % 150)}" height="7" rx="3" fill="${['#62d2ff', '#ffd27a', '#b892ff', '#7fe0a8'][i % 4]}" opacity=".75"/>`).join('')}</g>` +
    `<rect x="1490" y="150" width="320" height="186" rx="8" fill="url(#${k}-wd)"/>` +
    `<polyline points="1510,300 1560,272 1600,284 1650,236 1700,248 1750,196 1790,210" fill="none" stroke="#62d2ff" stroke-width="5"/>` +
    `<g fill="#3d7bd9" opacity=".8">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${1512 + i * 42}" y="${316 - ((i * 37) % 70) - 20}" width="22" height="${((i * 37) % 70) + 20}"/>`).join('')}</g>` +
    `<rect x="1104" y="132" width="330" height="196" rx="8" fill="none" stroke="#8aa3bc" stroke-width="5"/><rect x="1490" y="150" width="320" height="186" rx="8" fill="none" stroke="#8aa3bc" stroke-width="5"/>` +
    `</g>` +
    // 盆栽(右後方)
    `<g opacity=".9"><rect x="1830" y="600" width="80" height="110" rx="10" fill="#e9edf2"/>` +
    `<g fill="#3f7a5a">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<ellipse cx="${1870 + Math.sin(i * 1.7) * 60}" cy="${560 - i * 22}" rx="22" ry="54" transform="rotate(${-40 + i * 12} ${1870 + Math.sin(i * 1.7) * 60} ${560 - i * 22})"/>`).join('')}</g></g>` +
    far +
    // 越往右越暗一點,讓前景的白色機器人跳出來
    `<rect x="-100" y="-100" width="2120" height="1300" fill="url(#${k}-dim)"/>` +
    `</svg>`
  )
}

export interface BokehDot {
  x: number
  y: number
  s: number
  seed: number
  tone: string
}
export interface BokehOpts {
  seed?: number
  count?: number
  /** 前幾顆在窗戶上(其餘在燈條附近) */
  onWindow?: number
}
/** 背景的散景光點(窗戶與燈條附近);固定種子,每次產生一樣 */
export function bokehDots(o: BokehOpts = {}): BokehDot[] {
  const r = kit.rand(o.seed ?? 5150)
  const nWin = o.onWindow ?? 9
  return Array.from({ length: o.count ?? 16 }, (_, i) => {
    const onWindow = i < nWin
    return {
      x: onWindow ? 20 + r() * 720 : 840 + r() * 1060,
      y: onWindow ? 80 + r() * 600 : 20 + r() * 220,
      s: 40 + r() * 90,
      seed: 300 + i * 11,
      tone: onWindow ? 'w' : i % 3 === 0 ? 'b' : 'w',
    }
  })
}

// ---------- 窗光 ----------
export function raysSvg(o: OfficeOpts = {}): string {
  const k = o.prefix ?? 'ao'
  return (
    `<svg class="${k}-rayssvg" viewBox="0 0 1920 1080" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="${k}-ray" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".6" stop-color="#e6f3ff" stop-opacity=".14"/><stop offset="1" stop-color="#e6f3ff" stop-opacity="0"/></linearGradient>` +
    `<filter id="${k}-rayblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="26"/></filter>` +
    `</defs>` +
    `<g filter="url(#${k}-rayblur)">` +
    `<polygon class="${k}-ray" points="80,40 330,40 1180,1080 620,1080" fill="url(#${k}-ray)"/>` +
    `<polygon class="${k}-ray" points="420,40 560,40 1460,1080 1140,1080" fill="url(#${k}-ray)"/>` +
    `<polygon class="${k}-ray" points="640,40 740,40 1700,1080 1480,1080" fill="url(#${k}-ray)" opacity=".7"/>` +
    `</g></svg>`
  )
}

// ---------- 桌面 ----------
export function deskSvg(o: DeskOpts = {}): string {
  const k = o.prefix ?? 'ao'
  const DESK_Y = o.deskY ?? DEFAULT_DESK_Y
  const KB = o.kb ?? DEFAULT_KB
  // 鍵盤的鍵:5 列 × 14 行,依透視內插
  let keys = ''
  const rows = 5
  const cols = 14
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      if (j === 4 && i > 3 && i < 10) {
        if (i === 4) {
          const a = onQuad(KB, 4.15 / cols, (j + 0.15) / rows)
          const b = onQuad(KB, 9.85 / cols, (j + 0.15) / rows)
          const c = onQuad(KB, 9.85 / cols, (j + 0.85) / rows)
          const d = onQuad(KB, 4.15 / cols, (j + 0.85) / rows)
          keys += `<polygon points="${f(a.x)},${f(a.y)} ${f(b.x)},${f(b.y)} ${f(c.x)},${f(c.y)} ${f(d.x)},${f(d.y)}"/>`
        }
        continue
      }
      const a = onQuad(KB, (i + 0.12) / cols, (j + 0.15) / rows)
      const b = onQuad(KB, (i + 0.88) / cols, (j + 0.15) / rows)
      const c = onQuad(KB, (i + 0.88) / cols, (j + 0.85) / rows)
      const d = onQuad(KB, (i + 0.12) / cols, (j + 0.85) / rows)
      keys += `<polygon points="${f(a.x)},${f(a.y)} ${f(b.x)},${f(b.y)} ${f(c.x)},${f(c.y)} ${f(d.x)},${f(d.y)}"/>`
    }
  const kb = `${KB.tl.x},${KB.tl.y} ${KB.tr.x},${KB.tr.y} ${KB.br.x},${KB.br.y} ${KB.bl.x},${KB.bl.y}`
  const kbSide = `${KB.bl.x},${KB.bl.y} ${KB.br.x},${KB.br.y} ${KB.br.x},${KB.br.y + 9} ${KB.bl.x},${KB.bl.y + 9}`
  return (
    `<svg class="${k}-desksvg" viewBox="0 0 1920 1080" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="${k}-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7fafd"/><stop offset=".25" stop-color="#e3eaf2"/><stop offset="1" stop-color="#b7c5d4"/></linearGradient>` +
    `<linearGradient id="${k}-refl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".85"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="${k}-metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9eef4"/><stop offset=".45" stop-color="#aab6c3"/><stop offset=".55" stop-color="#d7dee6"/><stop offset="1" stop-color="#7d8a98"/></linearGradient>` +
    `<linearGradient id="${k}-kb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset="1" stop-color="#c9d3de"/></linearGradient>` +
    `<radialGradient id="${k}-screenspill" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8fd8ff" stop-opacity=".55"/><stop offset="1" stop-color="#8fd8ff" stop-opacity="0"/></radialGradient>` +
    `<filter id="${k}-b4" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>` +
    `<filter id="${k}-b14" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>` +
    `</defs>` +
    `<rect x="-100" y="${DESK_Y}" width="2120" height="420" fill="url(#${k}-top)"/>` +
    `<rect x="-100" y="${DESK_Y - 2}" width="2120" height="5" fill="#ffffff" opacity=".9"/>` +
    // 窗戶倒映在亮面桌上
    `<polygon points="-100,${DESK_Y + 4} 780,${DESK_Y + 4} 560,1080 -100,1080" fill="url(#${k}-refl)" opacity=".55" filter="url(#${k}-b14)"/>` +
    // 螢幕的光灑在桌上
    `<ellipse cx="760" cy="${DESK_Y + 40}" rx="420" ry="60" fill="url(#${k}-screenspill)"/>` +
    // 螢幕支架
    `<ellipse cx="716" cy="${DESK_Y + 24}" rx="150" ry="22" fill="#2a3a4c" opacity=".35" filter="url(#${k}-b4)"/>` +
    `<path d="M682 640 L736 640 L748 ${DESK_Y + 16} L694 ${DESK_Y + 16}Z" fill="url(#${k}-metal)"/>` +
    `<ellipse cx="720" cy="${DESK_Y + 18}" rx="128" ry="17" fill="url(#${k}-metal)"/>` +
    `<ellipse cx="712" cy="${DESK_Y + 14}" rx="96" ry="7" fill="#ffffff" opacity=".6"/>` +
    // 鍵盤
    `<polygon points="${KB.tl.x + 18},${KB.tl.y + 30} ${KB.tr.x + 26},${KB.tr.y + 30} ${KB.br.x + 30},${KB.br.y + 24} ${KB.bl.x + 14},${KB.bl.y + 24}" fill="#24364a" opacity=".32" filter="url(#${k}-b4)"/>` +
    `<polygon points="${kbSide}" fill="#8e9cab"/>` +
    `<polygon points="${kb}" fill="url(#${k}-kb)" stroke="#ffffff" stroke-width="2"/>` +
    `<g fill="#fdfeff" stroke="#b4c1cf" stroke-width="1">${keys}</g>` +
    // 滑鼠
    `<ellipse cx="1148" cy="872" rx="40" ry="16" fill="#24364a" opacity=".3" filter="url(#${k}-b4)"/>` +
    `<path d="M1112 858 C 1112 838 1176 834 1182 852 C 1188 872 1124 882 1112 858Z" fill="#f4f7fb" stroke="#c3cfdb" stroke-width="2"/>` +
    `<path d="M1124 848 C 1140 842 1160 842 1170 848" stroke="#ffffff" stroke-width="3" fill="none"/>` +
    // 桌上的杯子與筆記本(左邊)
    `<polygon points="150,850 420,826 470,930 170,962" fill="#24364a" opacity=".22" filter="url(#${k}-b4)"/>` +
    `<polygon points="140,836 410,812 452,912 160,944" fill="#fbfcfd" stroke="#c9d3de" stroke-width="2"/>` +
    `<polygon points="140,836 410,812 414,820 144,844" fill="#3d6fae"/>` +
    `<g stroke="#b3c2d2" stroke-width="2">${[0, 1, 2, 3].map((i) => `<path d="M${180 + i * 6} ${862 + i * 18} L${400 + i * 8} ${842 + i * 18}"/>`).join('')}</g>` +
    `<ellipse cx="560" cy="886" rx="60" ry="16" fill="#24364a" opacity=".3" filter="url(#${k}-b4)"/>` +
    `<path d="M512 800 L606 800 L598 880 Q559 892 520 880Z" fill="#f1f4f8"/>` +
    `<path d="M512 800 L536 800 L530 884 Q524 883 520 880Z" fill="#ffffff"/>` +
    `<path d="M606 816 q32 4 26 30 q-6 22 -32 18" stroke="#e6ebf1" stroke-width="10" fill="none"/>` +
    `<ellipse cx="559" cy="800" rx="47" ry="10" fill="#6b4630"/><ellipse cx="559" cy="800" rx="47" ry="10" fill="none" stroke="#ffffff" stroke-width="3"/>` +
    `</svg>`
  )
}

// ---------- 前景:糊掉的葉子 ----------
export function foreSvg(o: OfficeOpts = {}): string {
  const k = o.prefix ?? 'ao'
  const leaf = (x: number, y: number, rx: number, ry: number, a: number, c: string): string =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" transform="rotate(${a} ${x} ${y})"/>`
  return (
    `<svg class="${k}-foresvg" viewBox="0 0 1920 1080" aria-hidden="true">` +
    leaf(40, 980, 70, 210, -28, '#1f4a35') +
    leaf(150, 1040, 60, 190, 18, '#2d6247') +
    leaf(-30, 860, 50, 170, -60, '#163a29') +
    leaf(220, 1090, 50, 160, 40, '#245a40') +
    `</svg>`
  )
}
