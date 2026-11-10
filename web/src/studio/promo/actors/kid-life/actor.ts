// 演員 kid-life:宣傳片「孩子的一天，交給小管家」的痛點開場(研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 直式三格交叉剪接:零用錢花光(撲滿)、3C 停不下來(平板)、早上找不到要帶的東西(書包);爸媽嘆氣;三格收成一點帶出轉折句。
// 另一位演員 kid-hub 用同一組三格位置演出被解決的版本(鏡像回呼),所以三格、安全區、中線、聚焦點都從共用錨點
//   ../../anchors 取(STRIPS、SAFE、MID_X、FOCUS、DESIGN;直式 1080×1920 的 px),只改那裡兩位演員就一起移動。
//   安全區避開 Facebook Reels 會蓋住的區域,三格、媽媽與泡泡、收合的點與轉折句都放在安全區內;背景照常鋪滿。
//   橫式(1920×1080)時整個 1080×1920 的版面等比例縮小、放在畫面中央一欄。
// 插畫是程式畫的 SVG,所有動畫由 render 依時間算出(SPEC 第 1 節);文字(格子裡的句子、泡泡、轉折句)都是真的 DOM。
// place 用 "full"。
//
// props:
//   kid    孩子的名字(選用,寫在書包的名牌上);預設 "小宇"
//   lit    一開始就亮著的格子 1–3(選用);line 是那一格一開始就顯示的句子(選用)。
//          舞台的第一步從 400ms 才開始,0–400ms 畫的是起始狀態;要讓影片第一個畫面(縮圖)就是亮的痛點畫面,
//          寫 props { "lit": 1, "line": "零用錢又花光了" },第一步再接 { "strip": 1, "instant": true } 播小動畫
//   bare   true 時不畫自己的背景(漸層、柔光光點、四角紅光),根元素透明,只畫前景(選用;場景 kid-day-scene 用)
//
// 動作(操作式;對不上狀態時載入就報錯;每一步都可以寫 ms,整段動畫依比例放慢或加快):
//   { "strip": 1, "line": "零用錢又花光了" }   甩鏡切到第 1(2、3)格:光帶帶著動態模糊掃過,那一格變亮並播放它的痛點小動畫,
//                                                其他格變暗(約 35% 亮度、微失焦);line(選用)用粗體大字彈入格子左上角。預設 900ms
//       1 撲滿:孩子把撲滿倒過來搖,只掉出一枚硬幣彈兩下,旁邊空錢包飄出一縷灰煙
//       2 平板:孩子的臉被平板的藍光照亮,牆上時鐘的指針飛快轉,一隻大人的手伸過來指著時鐘
//       3 書包:打開的書包裡課本、鉛筆、水壺一件件飛出,孩子慌張,牆上時鐘 7:45 閃紅
//       加 "instant": true 就不做甩鏡:那一格從第 0ms 起就是亮的、line 已經顯示(片頭第一格,第一個畫面與縮圖就是亮的),小動畫照常播
//   { "all": true }                            三格同時變亮、動畫節奏加快、輕微抖動(混亂感),三句 line 都留著。預設 1200ms
//   { "parent": "每天都在提醒、在吵。" }         媽媽從下方滑入、蓋在三格前面(三格變暗失焦);肩膀一沉、嘆一口氣,
//                                                台詞逐字出現在頭上的泡泡。已經在畫面上時再寫一次就是換一句話。預設 1800ms
//   { "collapse": "如果用一個小工具管起來？" }   媽媽退場,三格往中央收攏、縮成一個發光的點,點再擴散成柔光,
//                                                轉折句一個字一個字由模糊到清晰浮現。之後不能再 strip/all/parent。預設 2000ms
//   strip、all 會讓還在畫面上的媽媽退場。
//
// 狀態(init/apply):lit(目前亮的格:0 沒有、1–3、"all")、lines(三格的句子)、parent(媽媽的台詞,null 是不在)、
//   collapsed(已經收成一點)、turn(轉折句)
//
// 目標:window、strip:1、strip:2、strip:3、parent、turn
import { kit } from '../../../../live/kit'
import { defineActor, type ActorEvent, type CommonStepFields } from '../../../../live/types'
import { DESIGN, FOCUS, MID_X, SAFE, STRIP_RADIUS, STRIPS } from '../../anchors'
import './actor.css'

// ---------- 型別 ----------
export interface KidLifeProps {
  kid?: string
  /** 一開始就亮著的格子(1–3) */
  lit?: number
  /** 一開始就亮著的那一格的 line */
  line?: string
  /** 不畫自己的背景,只畫前景(場景用) */
  bare?: boolean
}
const KINDS = ['strip', 'all', 'parent', 'collapse'] as const
type Kind = (typeof KINDS)[number]
export type KidLifeStep = CommonStepFields & {
  strip?: number
  line?: string
  /** strip:不做甩鏡,從第 0ms 起就是亮的、line 已經顯示(片頭第一格、縮圖用) */
  instant?: boolean
  all?: boolean
  parent?: string
  collapse?: string
}
type Target = 'window' | 'strip:1' | 'strip:2' | 'strip:3' | 'parent' | 'turn'
type Lit = 0 | 1 | 2 | 3 | 'all'
export interface KidLifeState {
  lit: Lit
  lines: (string | null)[]
  parent: string | null
  collapsed: boolean
  turn: string | null
  temp: Record<string, never>
}

/** 各動作的自然長度(毫秒);腳本寫 ms 時動畫依比例縮放 */
export const NATURAL: Record<Kind, number> = { strip: 900, all: 1200, parent: 1800, collapse: 2000 }

// ---------- 版面(直式 1080×1920 的設計座標) ----------
const FW = DESIGN.w
const FH = DESIGN.h
const STRIP_Y = STRIPS.map((r) => r.y)
const STRIP_H = STRIPS[0].h
/** 收成一點的位置(聚焦點在安全區的中線上;三格本來就在這條中線上,只需要往 y 收) */
const CENTER_Y = FOCUS.y
/** 格子寬 870 相對於插畫設計寬 1000 的比例(line 的字級跟著縮) */
const STRIP_SCALE = 0.87
/** 'all' 之後動畫加快的倍數(多出來的部分) */
const TEMPO = 0.6

// ---------- 狀態 ----------
function apply(st: KidLifeState, kind: Kind, s: KidLifeStep): KidLifeState {
  if (st.collapsed) throw new Error(`${kind}:三格已經收成一點了(collapse 之後不能再演)`)
  switch (kind) {
    case 'strip': {
      const n = s.strip
      if (n !== 1 && n !== 2 && n !== 3) throw new Error('strip 要寫 1、2 或 3')
      if (s.line != null && typeof s.line !== 'string') throw new Error('strip 的 line 要是字串')
      if (s.instant != null && typeof s.instant !== 'boolean') throw new Error('strip 的 instant 要寫 true 或 false')
      const lines = [...st.lines]
      if (s.line) lines[n - 1] = s.line
      return { ...st, lit: n, lines, parent: null }
    }
    case 'all':
      if (s.all !== true) throw new Error('all 要寫 true')
      return { ...st, lit: 'all', parent: null }
    case 'parent':
      if (typeof s.parent !== 'string' || !s.parent.trim()) throw new Error('parent 要寫台詞(字串)')
      return { ...st, parent: s.parent }
    case 'collapse':
      if (typeof s.collapse !== 'string' || !s.collapse.trim()) throw new Error('collapse 要寫轉折句(字串)')
      return { ...st, collapsed: true, turn: s.collapse, parent: null }
  }
}

const kindIn = (kind: string, step: object): Kind | null =>
  (KINDS as readonly string[]).includes(kind) ? (kind as Kind) : kind === 'show' || kind === 'hide' || kind === 'props' ? (KINDS.find((k) => k in step) ?? null) : null

// ---------- 小工具 ----------
const f = (n: number): string => (Math.round(n * 10) / 10).toString()
const P01 = kit.clamp
/** 0→1→0 的小山丘 */
const hill = (p: number): number => Math.sin(Math.PI * P01(p))

// ---------- 配色 ----------
const SKIN = '#f8d5b9'
const SKIN_SH = '#ecb999'
const HAIR = '#3a2a26'
const INK = '#2e2430'
const SHIRT = '#ffc857'
const SHIRT_SH = '#f0ad3c'
const SHORTS = '#34507e'
const SHOE = '#ef6461'
const ADULT = '#f1c7a3'

// ---------- 孩子 ----------
type KidMood = 'sad' | 'stare' | 'panic'

function kidFace(mood: KidMood, blink: boolean, lx: number, ly: number, open: number): string {
  const sw = `stroke="${INK}" stroke-width="4.5" stroke-linecap="round" fill="none"`
  const eye = (x: number): string => {
    if (blink) return `<path d="M${x - 10} 8 Q${x} 15 ${x + 10} 8" ${sw}/>`
    if (mood === 'stare')
      return `<ellipse cx="${x}" cy="6" rx="12.5" ry="14.5" fill="#fff"/><circle cx="${f(x + lx)}" cy="${f(6 + ly)}" r="8.5" fill="${INK}"/>` +
        `<rect x="${f(x + lx - 5)}" y="${f(ly)}" width="7" height="4" rx="1" fill="#8fe8ff"/><rect x="${f(x + lx + 1)}" y="${f(ly + 7)}" width="3" height="3" fill="#8fe8ff"/>`
    const ex = x + lx * 0.4
    const ey = 6 + ly * 0.4
    const r = mood === 'panic' ? 1.12 : 1
    return `<ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${f(9.5 * r)}" ry="${f(12.5 * r)}" fill="${INK}"/><circle cx="${f(ex + 3.5)}" cy="${f(ey - 4.5)}" r="3.8" fill="#fff"/><circle cx="${f(ex - 3)}" cy="${f(ey + 5)}" r="1.8" fill="#fff"/>`
  }
  let brows = ''
  let mouth = ''
  if (mood === 'sad') {
    brows = `<path d="M-34 -12 L-13 -21" ${sw}/><path d="M13 -21 L34 -12" ${sw}/>`
    mouth = `<path d="M-11 36 Q0 28 11 36" ${sw}/>`
  } else if (mood === 'stare') {
    brows = `<path d="M-34 -19 Q-23 -22 -12 -19" ${sw}/><path d="M12 -19 Q23 -22 34 -19" ${sw}/>`
    mouth = `<ellipse cx="0" cy="34" rx="5.5" ry="${f(5 + open * 2)}" fill="#8c3b32"/>`
  } else {
    brows = `<path d="M-35 -20 Q-24 -30 -12 -24" ${sw}/><path d="M12 -24 Q24 -30 35 -20" ${sw}/>`
    mouth = `<ellipse cx="0" cy="35" rx="11" ry="${f(8 + open * 7)}" fill="#8c3b32"/><ellipse cx="0" cy="${f(39 + open * 4)}" rx="6" ry="${f(2.5 + open * 2)}" fill="#e2777a"/>`
  }
  const blush = `<ellipse cx="-36" cy="24" rx="9.5" ry="5.5" fill="#f49a8a" opacity=".75"/><ellipse cx="36" cy="24" rx="9.5" ry="5.5" fill="#f49a8a" opacity=".75"/>`
  return blush + brows + eye(-22) + eye(22) + mouth
}

interface KidPose {
  x: number
  y: number
  sc: number
  mood: KidMood
  blink: boolean
  lx?: number
  ly?: number
  open?: number
  headDx?: number
  headDy?: number
  headRot?: number
  tuft?: number
  bodyDx?: number
  knee?: number
  sitting?: boolean
  /** 手臂(孩子的區域座標),畫在身體前面 */
  arms: string
  /** 臉上的藍光(0–1)與漸層 id */
  glow?: number
  glowId?: string
  /** 畫在最上層的東西(區域座標) */
  extra?: string
}

function arm(pts: [number, number][]): string {
  const d = 'M ' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ')
  const [sx, sy] = pts[0]
  const [nx, ny] = pts[1]
  const [hx, hy] = pts[pts.length - 1]
  return (
    `<path d="${d}" stroke="${SKIN}" stroke-width="19" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
    `<path d="M ${f(sx)} ${f(sy)} L ${f(sx + (nx - sx) * 0.38)} ${f(sy + (ny - sy) * 0.38)}" stroke="${SHIRT}" stroke-width="28" stroke-linecap="round"/>` +
    `<circle cx="${f(hx)}" cy="${f(hy)}" r="13.5" fill="${SKIN}"/>`
  )
}

function kid(p: KidPose): string {
  const k = p.knee ?? 0
  const legs = p.sitting
    ? `<ellipse cx="0" cy="190" rx="88" ry="30" fill="${SHORTS}"/>` +
      `<path d="M-80 198 C-46 226 46 226 80 198" stroke="${SKIN}" stroke-width="24" stroke-linecap="round" fill="none"/>` +
      `<ellipse cx="-70" cy="214" rx="20" ry="11" fill="${SHOE}"/><ellipse cx="70" cy="214" rx="20" ry="11" fill="${SHOE}"/>`
    : `<rect x="${f(-38 + k)}" y="198" width="22" height="50" rx="10" fill="${SKIN}"/><rect x="${f(16 - k)}" y="198" width="22" height="50" rx="10" fill="${SKIN}"/>` +
      `<ellipse cx="${f(-28 + k)}" cy="252" rx="23" ry="11.5" fill="${SHOE}"/><ellipse cx="${f(28 - k)}" cy="252" rx="23" ry="11.5" fill="${SHOE}"/>` +
      `<path d="M-50 158 L50 158 L54 212 L6 212 L0 196 L-6 212 L-54 212 Z" fill="${SHORTS}"/>`
  const torso =
    `<path d="M-50 66 C-50 52 -32 46 0 46 C32 46 50 52 50 66 L54 162 C54 170 46 172 40 172 L-40 172 C-46 172 -54 170 -54 162 Z" fill="${SHIRT}"/>` +
    `<path d="M-54 150 L54 150 L54 162 C54 170 46 172 40 172 L-40 172 C-46 172 -54 170 -54 162 Z" fill="${SHIRT_SH}"/>` +
    `<path d="M0 92 L5 104 L18 104 L8 112 L12 125 L0 117 L-12 125 L-8 112 L-18 104 L-5 104Z" fill="#f28c4b"/>` +
    `<rect x="-11" y="38" width="22" height="16" rx="6" fill="${SKIN_SH}"/>`
  const glow = p.glow && p.glowId ? `<circle r="58" fill="url(#${p.glowId})" opacity="${f(p.glow)}"/>` : ''
  const head =
    `<g transform="translate(${f(p.headDx ?? 0)} ${f(p.headDy ?? 0)}) rotate(${f(p.headRot ?? 0)} 0 40)">` +
    `<ellipse cx="-56" cy="8" rx="11" ry="14" fill="${SKIN_SH}"/><ellipse cx="56" cy="8" rx="11" ry="14" fill="${SKIN_SH}"/>` +
    `<circle r="58" fill="${SKIN}"/>` +
    glow +
    `<path d="M-61 2 C-68 -50 -30 -79 2 -77 C38 -77 69 -52 61 2 C57 -18 46 -31 30 -35 C21 -22 4 -18 -11 -27 C-23 -16 -41 -9 -61 2 Z" fill="${HAIR}"/>` +
    `<g transform="rotate(${f(p.tuft ?? 0)} 4 -74)"><path d="M2 -74 C-6 -100 20 -110 27 -95 C16 -98 9 -89 2 -74Z" fill="${HAIR}"/></g>` +
    kidFace(p.mood, p.blink, p.lx ?? 0, p.ly ?? 0, p.open ?? 0) +
    `</g>`
  return (
    `<g transform="translate(${f(p.x + (p.bodyDx ?? 0))} ${f(p.y)}) scale(${p.sc})">` +
    `<ellipse cx="0" cy="${p.sitting ? 226 : 262}" rx="${p.sitting ? 120 : 70}" ry="12" fill="#0b1328" opacity=".18"/>` +
    legs + torso + p.arms + head + (p.extra ?? '') +
    `</g>`
  )
}

const blinkAt = (ms: number, seed: number, period = 2900): boolean => (ms + seed) % period < 130

// ---------- 三格共用:場景放大 ----------
// 每格的場景以 (ZOOM_X, ZOOM_Y) 為中心放大 ZOOM 倍(鏡頭推近);下面各格的座標都是放大前的座標,
// 換算:放大後 x = 500 + (x − 500) × 1.35、y = 440 + (y − 440) × 1.35。主角放在放大後 x ≈ 640–680(中間偏右),
// 左上角(放大後 x < 600、y < 130)留給 line 大字。
const ZOOM = 1.35
const ZOOM_X = 500
const ZOOM_Y = 440
const zoomWrap = (inner: string): string => `<g transform="translate(${ZOOM_X} ${ZOOM_Y}) scale(${ZOOM}) translate(${-ZOOM_X} ${-ZOOM_Y})">${inner}</g>`

// ---------- 第 1 格:撲滿 ----------
function scene1Static(uid: string): string {
  return (
    `<defs><linearGradient id="${uid}w1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbd9ee"/><stop offset="1" stop-color="#a8bcda"/></linearGradient></defs>` +
    `<rect width="1000" height="470" fill="url(#${uid}w1)"/>` +
    // 牆上的畫(右上)與層架(左邊、靠近孩子)
    `<rect x="742" y="150" width="92" height="70" rx="9" fill="#f4efe6"/><rect x="750" y="158" width="76" height="54" rx="5" fill="#9cc5e8"/>` +
    `<circle cx="808" cy="173" r="8" fill="#ffd36e"/><path d="M750 212 L778 184 L798 202 L812 190 L826 202 L826 212 Z" fill="#6aa684"/>` +
    `<rect x="250" y="330" width="200" height="11" rx="5.5" fill="#8a6a55"/>` +
    `<rect x="266" y="290" width="17" height="40" rx="3" fill="#e76f51"/><rect x="286" y="298" width="14" height="32" rx="3" fill="#2a9d8f"/><rect x="303" y="293" width="18" height="37" rx="3" fill="#e9c46a"/>` +
    `<path d="M404 330 C399 312 405 302 416 302 C427 302 433 312 428 330 Z" fill="#d98b6b"/><path d="M416 302 C408 284 413 272 422 267 C420 282 425 291 416 302Z" fill="#5f9e6e"/>` +
    `<rect y="430" width="1000" height="40" fill="#8fa3c4"/><rect y="428" width="1000" height="5" fill="#7d92b6"/>`
  )
}

function piggy(cx: number, cy: number, rot: number, sc = 1): string {
  return (
    `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(rot)}) scale(${sc})">` +
    `<rect x="-38" y="28" width="16" height="22" rx="6" fill="#e98aa6"/><rect x="22" y="28" width="16" height="22" rx="6" fill="#e98aa6"/>` +
    `<ellipse rx="60" ry="45" fill="#f5a3bb"/><ellipse cx="-8" cy="-14" rx="34" ry="14" fill="#fbc6d5" opacity=".7"/>` +
    `<path d="M-30 -38 L-22 -62 L-6 -42 Z" fill="#e98aa6"/>` +
    `<ellipse cx="60" cy="4" rx="13" ry="16" fill="#ef93ad"/><circle cx="57" cy="0" r="2.8" fill="#b4566f"/><circle cx="57" cy="9" r="2.8" fill="#b4566f"/>` +
    `<circle cx="34" cy="-12" r="5" fill="${INK}"/>` +
    `<rect x="-14" y="-46" width="28" height="7" rx="3.5" fill="#b4566f"/>` +
    `<path d="M-60 0 C-74 -4 -76 12 -66 14" stroke="#e98aa6" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `</g>`
  )
}

/** A:這一格的動畫時鐘;life:眨眼、呼吸等小動作的時鐘('all' 時跑得比較快) */
function scene1(A: number, life: number): string {
  const sc = 0.9
  const kx = 604
  const ky = 219
  // 撲滿捧在胸前倒過來(0–160ms),之後一陣陣地搖
  const flip = kit.lerp(0, 165, kit.ease.outBack(P01(A / 160)))
  const env = A < 100 ? 0 : A < 900 ? P01((A - 100) / 80) : 0.35 + 0.65 * kit.pulse(A - 900, 1200)
  const sx = Math.sin(A / 38) * 15 * env
  const srot = Math.sin(A / 32) * 12 * env
  const pigX = kx + sx
  const pigY = ky + 76 * sc
  const hx = sx / sc
  const hands = `<g transform="translate(${kx} ${ky}) scale(${sc})">` + arm([[-48, 64], [-80, 104], [hx - 60, 78]]) + arm([[48, 64], [80, 104], [hx + 60, 78]]) + `</g>`
  // 硬幣:200ms 從投幣口掉出,落地彈兩下,滾一點點停住(畫在孩子前面)
  let coin = ''
  if (A >= 200) {
    const floorY = 444
    const fromX = pigX + 8
    const fromY = pigY + 40
    let cx = fromX
    let cy = fromY
    let squash = 1
    if (A < 400) {
      const q = (A - 200) / 200
      cy = kit.lerp(fromY, floorY, q * q)
      cx = kit.lerp(fromX, kx + 10, q)
    } else if (A < 600) {
      const q = (A - 400) / 200
      cy = floorY - 60 * 4 * q * (1 - q)
      cx = kit.lerp(kx + 10, kx + 40, q)
      squash = q < 0.12 ? 0.7 : 1
    } else if (A < 730) {
      const q = (A - 600) / 130
      cy = floorY - 18 * 4 * q * (1 - q)
      cx = kit.lerp(kx + 40, kx + 52, q)
      squash = q < 0.15 ? 0.8 : 1
    } else {
      cx = kit.lerp(kx + 52, kx + 62, kit.ease.outCubic(P01((A - 730) / 300)))
      cy = floorY
    }
    const spinX = A < 730 ? Math.abs(Math.cos(A / 45)) * 0.75 + 0.25 : 1
    coin += `<ellipse cx="${f(cx)}" cy="${floorY + 13}" rx="${f(15 * (1 - (floorY - cy) / 300))}" ry="3.5" fill="#0b1328" opacity=".22"/>`
    coin +=
      `<g transform="translate(${f(cx)} ${f(cy)}) scale(${f(spinX)} ${f(squash)})">` +
      `<circle r="14" fill="#f6c142"/><circle r="9.5" fill="none" stroke="#e09f1f" stroke-width="3"/><rect x="-2" y="-6" width="4" height="12" rx="2" fill="#e09f1f"/></g>`
    const sp = P01((A - 400) / 240)
    if (sp > 0 && sp < 1)
      coin += `<g stroke="#fff3c4" stroke-width="4" stroke-linecap="round" opacity="${f(1 - sp)}">${[-30, -90, -150]
        .map((a) => {
          const r = 20 + sp * 18
          const ra = (a * Math.PI) / 180
          return `<path d="M${f(kx + 10 + Math.cos(ra) * r)} ${f(floorY + Math.sin(ra) * r)} L${f(kx + 10 + Math.cos(ra) * (r + 11))} ${f(floorY + Math.sin(ra) * (r + 11))}"/>`
        })
        .join('')}</g>`
  }
  // 空錢包與灰煙(右下)
  const wallet =
    `<g transform="translate(-89 10)">` +
    `<ellipse cx="870" cy="432" rx="80" ry="9" fill="#0b1328" opacity=".18"/>` +
    `<path d="M806 384 L934 384 C940 384 942 388 940 394 L928 430 L812 430 L800 394 C798 388 800 384 806 384 Z" fill="#8b5a3c"/>` +
    `<rect x="812" y="390" width="116" height="16" rx="5" fill="#4d3022"/>` +
    `<path d="M802 404 L938 404 L930 430 L810 430 Z" fill="#a8704a"/><circle cx="870" cy="416" r="6" fill="#d9b26f"/></g>`
  let smoke = ''
  for (let j = 0; j < 3; j++) {
    const q = ((A + j * 480 + 2000) % 1440) / 1440
    const op = Math.sin(Math.PI * q) * 0.75
    const y = 394 - q * 120
    const x = 773 + j * 8 + Math.sin(q * 6 + j) * 12
    const s = 0.55 + q * 0.75
    smoke += `<path transform="translate(${f(x)} ${f(y)}) scale(${f(s)})" d="M0 0 C-16 -12 14 -24 0 -36 C-12 -46 10 -56 2 -64" stroke="#b9c1cf" stroke-width="9" stroke-linecap="round" fill="none" opacity="${f(op)}"/>`
  }
  const k = kid({
    x: kx, y: ky, sc, mood: 'sad', blink: blinkAt(life, 0), lx: sx * 0.1, ly: 6, headRot: 3 + srot * 0.12,
    tuft: Math.sin(A / 38) * 10 * env, headDy: 3 + Math.sin(life / 650) * 1.5, arms: '',
  })
  return wallet + smoke + k + piggy(pigX, pigY, flip + srot, 0.85) + hands + coin
}

// ---------- 第 2 格:平板 ----------
function scene2Static(uid: string): string {
  return (
    `<defs><linearGradient id="${uid}w2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3c62"/><stop offset="1" stop-color="#1b2745"/></linearGradient>` +
    `<radialGradient id="${uid}fg" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#7fdcff" stop-opacity=".95"/><stop offset=".7" stop-color="#4fb4ff" stop-opacity=".25"/><stop offset="1" stop-color="#4fb4ff" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${uid}beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#8fe3ff" stop-opacity=".55"/><stop offset="1" stop-color="#8fe3ff" stop-opacity="0"/></linearGradient></defs>` +
    `<rect width="1000" height="470" fill="url(#${uid}w2)"/>` +
    // 夜晚的窗(左邊、靠近孩子)
    `<g transform="translate(166 49)">` +
    `<rect x="96" y="176" width="176" height="150" rx="14" fill="#3b4f7a"/><rect x="108" y="188" width="152" height="126" rx="8" fill="#101a33"/>` +
    `<path d="M184 188 L184 314 M108 251 L260 251" stroke="#3b4f7a" stroke-width="6"/>` +
    `<circle cx="226" cy="220" r="18" fill="#f3e7b8"/><circle cx="234" cy="214" r="16" fill="#101a33"/>` +
    `<circle cx="132" cy="210" r="2.5" fill="#dfe6ff"/><circle cx="160" cy="276" r="2" fill="#dfe6ff"/><circle cx="236" cy="290" r="2.5" fill="#dfe6ff"/></g>` +
    `<rect y="432" width="1000" height="38" fill="#141d36"/><ellipse cx="589" cy="448" rx="260" ry="20" fill="#283559"/>`
  )
}

function clockFace(cx: number, cy: number, r: number, hourDeg: number, minDeg: number, trail: number): string {
  let ticks = ''
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const r1 = r * (i % 3 === 0 ? 0.74 : 0.8)
    ticks += `<path d="M${f(cx + Math.sin(a) * r1)} ${f(cy - Math.cos(a) * r1)} L${f(cx + Math.sin(a) * r * 0.88)} ${f(cy - Math.cos(a) * r * 0.88)}" stroke="#56627a" stroke-width="${i % 3 === 0 ? 5 : 3}" stroke-linecap="round"/>`
  }
  // 分針的殘影:一片淡淡的扇形
  const a0 = ((minDeg - 70 * trail) * Math.PI) / 180
  const a1 = (minDeg * Math.PI) / 180
  const rr = r * 0.78
  const fan = trail > 0.05 ? `<path d="M${cx} ${cy} L${f(cx + Math.sin(a0) * rr)} ${f(cy - Math.cos(a0) * rr)} A${f(rr)} ${f(rr)} 0 0 1 ${f(cx + Math.sin(a1) * rr)} ${f(cy - Math.cos(a1) * rr)} Z" fill="#ff6b6b" opacity="${f(0.22 * trail)}"/>` : ''
  return (
    `<circle cx="${cx}" cy="${cy + 6}" r="${r + 6}" fill="#0b1328" opacity=".25"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="#c9d3e6"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#f7f9fd"/>` +
    ticks + fan +
    `<path d="M${cx} ${cy} L${cx} ${f(cy - r * 0.45)}" stroke="${INK}" stroke-width="7" stroke-linecap="round" transform="rotate(${f(hourDeg)} ${cx} ${cy})"/>` +
    `<path d="M${cx} ${cy} L${cx} ${f(cy - r * 0.72)}" stroke="#e5484d" stroke-width="5" stroke-linecap="round" transform="rotate(${f(minDeg)} ${cx} ${cy})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="6" fill="${INK}"/>`
  )
}

function scene2(A: number, life: number, uid: string): string {
  const sc = 0.9
  const kx = 589
  const ky = 240
  // 時鐘(右上):分針一圈 600ms,時針一圈 8 秒;一開始就在轉
  const minDeg = 40 + (A / 600) * 360
  const hourDeg = 200 + (A / 8000) * 360
  const clock = clockFace(774, 203, 64, hourDeg, minDeg, P01(A / 200))
  // 豆袋椅
  const by = ky + 136
  const bag = `<path d="M${kx - 150} ${by + 104} C${kx - 170} ${by + 24} ${kx - 110} ${by - 6} ${kx} ${by} C${kx + 110} ${by - 6} ${kx + 170} ${by + 24} ${kx + 150} ${by + 104} Z" fill="#4c3f78"/><path d="M${kx - 120} ${by + 24} C${kx - 60} ${by + 10} ${kx + 60} ${by + 10} ${kx + 120} ${by + 24}" stroke="#5e5094" stroke-width="8" fill="none" stroke-linecap="round"/>`
  // 平板(背面朝鏡頭,螢幕的光往上打在臉上)
  const flick = 0.75 + 0.25 * (0.5 + 0.5 * kit.noise(life / 140, 5))
  const tap = Math.sin(life / 85) * 2
  const tablet =
    `<path d="M-58 -10 L58 -10 L44 -92 L-44 -92 Z" fill="url(#${uid}beam)" opacity="${f(0.8 * flick)}"/>` +
    `<g transform="rotate(-6 0 110)"><rect x="-66" y="66" width="132" height="92" rx="12" fill="#2d3654"/><rect x="-66" y="66" width="132" height="8" rx="4" fill="#8fe3ff" opacity="${f(flick)}"/><circle cx="0" cy="112" r="7" fill="#3f4a6d"/></g>`
  const arms = arm([[-48, 64], [-74, 112], [-60 + tap * 0.5, 104]]) + arm([[48, 64], [74, 112], [60, 102 + tap]])
  // 遊戲的小亮片從平板飄上來
  let sparks = ''
  const colors = ['#ff7eb6', '#ffd36e', '#7fe3ff', '#9b8cff']
  for (let j = 0; j < 5; j++) {
    const q = ((A + j * 220) % 1100) / 1100
    const r = kit.rand(j * 31 + 3)
    const x0 = (r() - 0.5) * 120
    const x = x0 + Math.sin(q * 5 + j) * 18
    const y = 64 - q * 120
    sparks += `<rect x="${f(x - 5)}" y="${f(y - 5)}" width="10" height="10" rx="2" fill="${colors[j % 4]}" opacity="${f(Math.sin(Math.PI * q) * 0.9)}" transform="rotate(${f(q * 180)} ${f(x)} ${f(y)})"/>`
  }
  const k = kid({
    x: kx, y: ky, sc, mood: 'stare', blink: blinkAt(life, 1700, 5200), lx: 0, ly: 4, open: kit.pulse(life, 1800) * 0.5,
    headDy: 2 + Math.sin(life / 900) * 1.2, headRot: 3, tuft: Math.sin(life / 700) * 3, sitting: true,
    glow: 0.55 + 0.35 * flick, glowId: `${uid}fg`, arms: tablet + arms, extra: sparks,
  })
  // 大人的手:從右下伸進來指著時鐘(120–400ms),之後一下一下戳
  let hand = ''
  if (A >= 120) {
    const slide = (1 - kit.ease.outBack(P01((A - 120) / 280))) * 300
    const poke = A > 420 ? Math.max(0, Math.sin(((A - 420) / 480) * Math.PI * 2)) * 14 : 0
    hand =
      `<g transform="translate(${f(900 + slide * 0.7)} ${f(330 + slide * 0.7)}) rotate(45) translate(${f(-poke)} 0)">` +
      `<rect x="10" y="-30" width="300" height="60" rx="26" fill="#8fa3c8"/><rect x="4" y="-32" width="30" height="64" rx="14" fill="#7a8fb6"/>` +
      `<ellipse cx="-24" cy="2" rx="38" ry="30" fill="${ADULT}"/>` +
      `<rect x="-128" y="-10" width="96" height="20" rx="10" fill="${ADULT}"/>` +
      `<path d="M-40 22 C-52 30 -62 26 -60 16" stroke="#dca983" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M-30 -24 C-44 -40 -24 -50 -12 -30" fill="${ADULT}"/>` +
      `<rect x="-124" y="-7" width="14" height="13" rx="5" fill="#f7dcc4"/>` +
      `</g>`
  }
  return bag + k + clock + hand
}

// ---------- 第 3 格:書包 ----------
function scene3Static(uid: string): string {
  return (
    `<defs><linearGradient id="${uid}w3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6e1f1"/><stop offset="1" stop-color="#b3c4df"/></linearGradient></defs>` +
    `<rect width="1000" height="470" fill="url(#${uid}w3)"/>` +
    // 清晨的窗(偏冷的天光),在孩子右後方
    `<rect x="760" y="232" width="104" height="104" rx="10" fill="#f4efe6"/><rect x="769" y="241" width="86" height="86" rx="5" fill="#cfe3f6"/>` +
    `<path d="M812 241 L812 327 M769 284 L855 284" stroke="#f4efe6" stroke-width="5"/>` +
    `<rect y="430" width="1000" height="40" fill="#94a7c6"/><rect y="428" width="1000" height="5" fill="#8296b9"/>`
  )
}

type Fly = { to: [number, number]; arc: number; spin: number; end: number }
type Item = { draw: string; a: Fly; b: Fly }
// a:第一次從書包飛出;b:'all' 時從地上再飛一次
const ITEMS: Item[] = [
  {
    draw: `<rect x="-34" y="-44" width="68" height="88" rx="6" fill="#e76f51"/><rect x="-34" y="-44" width="12" height="88" rx="4" fill="#c4563c"/><rect x="-14" y="-28" width="38" height="10" rx="3" fill="#f6d1c4"/>`,
    a: { to: [226, 404], arc: 140, spin: -380, end: -20 },
    b: { to: [500, 406], arc: 150, spin: 340, end: 15 },
  },
  {
    draw: `<rect x="-62" y="-9" width="104" height="18" rx="3" fill="#ffcf4a"/><path d="M42 -9 L66 0 L42 9 Z" fill="#f4d6a6"/><path d="M58 -3 L66 0 L58 3Z" fill="${INK}"/><rect x="-70" y="-9" width="12" height="18" rx="3" fill="#f28aa0"/>`,
    a: { to: [516, 428], arc: 150, spin: 560, end: 12 },
    b: { to: [246, 428], arc: 130, spin: -420, end: -8 },
  },
  {
    draw: `<rect x="-20" y="-50" width="40" height="96" rx="16" fill="#3fb8a9"/><rect x="-14" y="-62" width="28" height="16" rx="5" fill="#2b7f78"/><rect x="-20" y="-14" width="40" height="22" fill="#e8fbf8" opacity=".6"/>`,
    a: { to: [292, 396], arc: 120, spin: 290, end: -80 },
    b: { to: [460, 398], arc: 150, spin: -270, end: 80 },
  },
  {
    draw: `<rect x="-30" y="-40" width="60" height="80" rx="6" fill="#6c8cf0"/><rect x="-22" y="-30" width="44" height="6" rx="3" fill="#dfe6ff"/><rect x="-22" y="-18" width="30" height="6" rx="3" fill="#dfe6ff"/>`,
    a: { to: [548, 412], arc: 140, spin: -430, end: 70 },
    b: { to: [214, 414], arc: 130, spin: 380, end: -30 },
  },
]
const BAG_X = 396
const ITEM_FROM: [number, number] = [BAG_X, 300]
const ITEM_FLY = 420
const itemStart = (i: number): number => 80 + i * 110
const AGAIN_FLY = 380
const againStart = (i: number): number => 40 + i * 90

/** again:'all' 開始後的時鐘(沒有 'all' 是 null),地上的東西再飛一次 */
function scene3(A: number, life: number, name: string, again: number | null): string {
  // 時鐘 7:45 閃紅(右上,放大後約 y 48–142)
  const on = Math.floor(A / 360) % 2 === 0
  const clock =
    `<rect x="704" y="158" width="150" height="70" rx="17" fill="#0b1328" opacity=".2"/>` +
    `<rect x="688" y="138" width="174" height="98" rx="26" fill="#ff4f5e" opacity="${on ? 0.45 : 0.08}"/>` +
    `<rect x="700" y="150" width="150" height="70" rx="17" fill="#1e2538"/>` +
    `<text x="775" y="200" text-anchor="middle" font-size="46" font-weight="800" font-family="-apple-system, 'Segoe UI', Arial, sans-serif" fill="${on ? '#ff5a68' : '#7a3340'}">7:45</text>`
  // 書包:每飛出一件就跳一下
  let hop = 0
  for (let i = 0; i < ITEMS.length; i++) hop += hill((A - itemStart(i)) / 180)
  if (A > 700) hop += 0.4 * hill((A % 800) / 240)
  const by = 440
  const bag =
    `<ellipse cx="${BAG_X}" cy="${by}" rx="${f(100 - hop * 6)}" ry="10" fill="#0b1328" opacity=".2"/>` +
    `<g transform="translate(${BAG_X} ${f(by - hop * 10)}) scale(${f(1 + hop * 0.04)} ${f(1 - hop * 0.06)})">` +
    `<path d="M-88 -128 C-120 -150 -112 -196 -70 -196 L70 -196 C112 -196 120 -150 88 -128 Z" fill="#3d68bf"/>` +
    `<rect x="-92" y="-140" width="184" height="140" rx="40" fill="#4f7fd8"/>` +
    `<ellipse cx="0" cy="-138" rx="80" ry="18" fill="#1f2f58"/>` +
    `<rect x="-62" y="-82" width="124" height="66" rx="22" fill="#3f6cc4"/><rect x="-44" y="-70" width="88" height="30" rx="8" fill="#fffaf0"/>` +
    `<text x="0" y="-48" text-anchor="middle" font-size="22" font-weight="800" fill="#34507e">${kit.esc(name)}</text>` +
    `<rect x="-6" y="-22" width="12" height="12" rx="3" fill="#ffc857"/>` +
    `</g>`
  const flyAt = (from: [number, number], fl: Fly, rot0: number, q: number): { x: number; y: number; rot: number; p: number } => {
    const p = P01(q)
    return {
      x: kit.lerp(from[0], fl.to[0], p),
      y: kit.lerp(from[1], fl.to[1], p) - fl.arc * 4 * p * (1 - p),
      rot: q >= 1 ? fl.end : kit.lerp(rot0, rot0 + fl.spin, p),
      p,
    }
  }
  let items = ''
  ITEMS.forEach((it, i) => {
    const q1 = (A - itemStart(i)) / ITEM_FLY
    if (q1 <= 0) return
    let pos = flyAt(ITEM_FROM, it.a, 0, q1)
    let settleAt = itemStart(i) + ITEM_FLY
    let clockT = A
    const q2 = again != null ? (again - againStart(i)) / AGAIN_FLY : 0
    if (q1 >= 1 && again != null && q2 > 0) {
      pos = flyAt(it.a.to, it.b, it.a.end, q2)
      settleAt = againStart(i) + AGAIN_FLY
      clockT = again
    }
    const settle = pos.p >= 1 ? kit.shake(clockT, settleAt, 220, 4, 2) : 0
    items += `<ellipse cx="${f(pos.x)}" cy="440" rx="${f(28 * (0.6 + 0.4 * (1 - (440 - pos.y) / 300)))}" ry="5" fill="#0b1328" opacity="${f(0.18 * P01(1 - (430 - pos.y) / 300))}"/>`
    items += `<g transform="translate(${f(pos.x)} ${f(pos.y + settle)}) rotate(${f(pos.rot)}) scale(.9)">${it.draw}</g>`
  })
  // 孩子:雙手捧著臉,膝蓋發抖,汗滴往外甩
  const sc = 0.9
  const jit = kit.noise(life / 45, 9) * 4
  const open = 0.6 + 0.4 * Math.abs(Math.sin(life / 110))
  const arms = arm([[-48, 64], [-86, 28], [-50, 18]]) + arm([[48, 64], [86, 28], [50, 18]])
  let sweat = ''
  for (let j = 0; j < 2; j++) {
    const q = ((A + j * 330) % 660) / 660
    const side = j === 0 ? -1 : 1
    const x = side * (60 + q * 46)
    const y = -36 - q * 30 + q * q * 70
    sweat += `<path transform="translate(${f(x)} ${f(y)}) rotate(${side * 30})" d="M0 -12 C-7 0 -7 8 0 8 C7 8 7 0 0 -12Z" fill="#8cc7ef" opacity="${f(1 - q)}"/>`
  }
  // 頭上的驚嚇線
  const pz = kit.pulse(A, 440)
  const marks =
    `<g stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity="${f(0.5 + pz * 0.5)}">` +
    [[-30, -96, -40, -118], [0, -104, 0, -130], [30, -96, 40, -118]].map(([a, b, c, d]) => `<path d="M${a} ${f(b - pz * 4)} L${c} ${f(d - pz * 6)}"/>`).join('') +
    `</g>`
  const k = kid({
    x: 633, y: 219, sc, mood: 'panic', blink: false, lx: -8, ly: 0, open, bodyDx: jit,
    headRot: Math.sin(life / 70) * 3, headDy: Math.sin(life / 140) * 1.5, tuft: Math.sin(life / 50) * 12, knee: Math.sin(life / 60) * 3,
    arms, extra: sweat + marks,
  })
  return clock + bag + items + k
}

// ---------- 媽媽 ----------
const PARENT_STATIC_BACK =
  `<path d="M24 1160 C24 870 126 724 350 724 C574 724 676 870 676 1160 Z" fill="#d9826f"/>` +
  `<path d="M266 728 L350 880 L434 728 C410 722 290 722 266 728 Z" fill="#f4e8d8"/>` +
  `<path d="M266 728 L326 1160 M434 728 L374 1160" stroke="#bd6a59" stroke-width="7" fill="none"/>` +
  `<path d="M120 1160 C132 1000 150 920 190 860" stroke="#c4705f" stroke-width="7" fill="none" stroke-linecap="round"/>` +
  `<path d="M580 1160 C568 1000 550 920 510 860" stroke="#c4705f" stroke-width="7" fill="none" stroke-linecap="round"/>` +
  `<circle cx="314" cy="960" r="9" fill="#f4e8d8"/><circle cx="318" cy="1050" r="9" fill="#f4e8d8"/>`
const PARENT_NECK = `<rect x="306" y="590" width="88" height="150" rx="36" fill="${SKIN_SH}"/>`
const PARENT_HEAD_BACK =
  `<circle cx="350" cy="206" r="80" fill="${HAIR}"/><rect x="300" y="268" width="100" height="18" rx="9" fill="#e9a23b"/>` +
  `<ellipse cx="203" cy="452" rx="22" ry="32" fill="${SKIN_SH}"/><ellipse cx="497" cy="452" rx="22" ry="32" fill="${SKIN_SH}"/>` +
  `<circle cx="204" cy="498" r="8" fill="#e9c46a"/><circle cx="496" cy="498" r="8" fill="#e9c46a"/>` +
  `<ellipse cx="350" cy="440" rx="148" ry="162" fill="${SKIN}"/>`
const PARENT_HAIR =
  `<path d="M196 430 C184 302 258 266 350 266 C442 266 516 302 504 430 C494 362 452 330 402 328 C372 356 300 370 196 430 Z" fill="${HAIR}"/>` +
  `<path d="M232 344 C210 392 226 428 210 470" stroke="${HAIR}" stroke-width="7" fill="none" stroke-linecap="round"/>`

function parentFace(blink: boolean, mouth: 'shut' | 'talk' | 'sigh', open: number): string {
  const sw = (w: number, c = INK) => `stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"`
  const eye = (x: number) =>
    blink
      ? `<path d="M${x - 20} 458 Q${x} 466 ${x + 20} 458" ${sw(5)}/>`
      : `<path d="M${x - 17} 456 Q${x} 476 ${x + 17} 456 Z" fill="${INK}"/><path d="M${x - 22} 454 Q${x} 446 ${x + 22} 454" ${sw(5.5)}/>`
  const bags = `<path d="M278 482 Q295 490 312 482" ${sw(3.5, '#d9a68c')}/><path d="M388 482 Q405 490 422 482" ${sw(3.5, '#d9a68c')}/>`
  const brows = `<path d="M262 424 L322 410" ${sw(7, HAIR)}/><path d="M378 410 L438 424" ${sw(7, HAIR)}/>`
  const nose = `<path d="M352 478 Q340 512 354 518" ${sw(4.5, '#d9a68c')}/>`
  const m =
    mouth === 'sigh'
      ? `<ellipse cx="352" cy="562" rx="13" ry="16" fill="#8c3b32"/>`
      : mouth === 'talk'
      ? `<ellipse cx="350" cy="560" rx="20" ry="${f(4 + open * 9)}" fill="#8c3b32"/>`
      : `<path d="M322 562 Q350 550 378 562" ${sw(5.5)}/>`
  const blush = `<ellipse cx="262" cy="520" rx="20" ry="10" fill="#f2a28e" opacity=".45"/><ellipse cx="438" cy="520" rx="20" ry="10" fill="#f2a28e" opacity=".45"/>`
  return blush + brows + eye(295) + eye(405) + bags + nose + m
}

// ---------- 演員 ----------
type Ev = ActorEvent<KidLifeStep, string>

/** 'all' 進行中的時段(到下一個 strip 或收合結束為止) */
function allSegments(events: Ev[]): [number, number][] {
  const segs: [number, number][] = []
  let from: number | null = null
  for (const e of events) {
    const kd = kindIn(e.kind, e.step)
    if (kd === 'all' && from == null) from = e.start
    else if (kd === 'strip' && from != null) segs.push([from, e.start]), (from = null)
    else if (kd === 'collapse' && from != null) segs.push([from, e.start + e.dur]), (from = null)
  }
  if (from != null) segs.push([from, Infinity])
  return segs
}
/** [from, to] 之間有多少時間落在 'all' 的時段裡 */
const allOverlap = (segs: [number, number][], from: number, to: number): number =>
  segs.reduce((n, [a, b]) => n + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0)
/** 動作的時鐘:動作進行中依 ms 比例換算成自然長度的時間,結束後照實際時間走 */
const evClock = (start: number, dur: number, nat: number, ms: number): number => {
  const loc = ms - start
  return loc < dur ? (loc * nat) / dur : nat + (loc - dur)
}

/** 第 i 格的動畫時鐘(毫秒):從那一格最近一次被 strip(或 all)點亮起算;動作中依 ms 比例換算;'all' 期間加快 */
function panelClock(i: number, events: Ev[], segs: [number, number][], ms: number): number | null {
  let start: number | null = null
  let dur = 1
  let nat = 1
  for (const e of events) {
    const kd = kindIn(e.kind, e.step)
    if (kd === 'strip' && e.step.strip === i) (start = e.start), (dur = e.dur), (nat = NATURAL.strip)
    else if (kd === 'all' && start == null) (start = e.start), (dur = e.dur), (nat = NATURAL.all)
  }
  if (start == null) return null
  return evClock(start, dur, nat, ms) + TEMPO * allOverlap(segs, start, ms)
}

/** line 的字級:一行放得下(寬約 560px),字多就縮小,最小 48px;英數字算半個字寬 */
export const lineFont = (text: string): number => {
  const w = kit.graphemes(text).reduce((n, c) => n + (/^[\x20-\x7e]$/.test(c) ? 0.55 : 1), 0)
  return Math.round(kit.clamp(560 / Math.max(1, w), 48, 64))
}
/** 轉折句分兩行:在「工具」之後斷行;沒有「工具」就照原句 */
export const turnLines = (text: string): string => {
  const i = text.indexOf('工具')
  if (i < 0 || text.includes('\n')) return text
  const head = text.slice(0, i + 2)
  const tail = text.slice(i + 2)
  return tail.trim() ? `${head}\n${tail}` : text
}

type Look = { b: number; bl: number }
const lookOf = (s: KidLifeState, i: number): Look =>
  s.parent ? { b: 0.3, bl: 7 } : s.lit === 'all' || s.lit === i ? { b: 1, bl: 0 } : { b: 0.35, bl: 3.5 }

let mounted = 0

const actor = defineActor<Kind, KidLifeStep, KidLifeProps, KidLifeState, Target>({
  name: 'kid-life',
  kinds: KINDS,

  init(props) {
    if (props.kid != null && typeof props.kid !== 'string') throw new Error('kid 要是字串(孩子的名字)')
    const lit = props.lit ?? 0
    if (lit !== 0 && lit !== 1 && lit !== 2 && lit !== 3) throw new Error('lit 要寫 1、2 或 3')
    if (props.line != null && (typeof props.line !== 'string' || !lit)) throw new Error('line 要是字串,而且要搭配 lit')
    if (props.bare != null && typeof props.bare !== 'boolean') throw new Error('bare 要寫 true 或 false')
    const lines: (string | null)[] = [null, null, null]
    if (lit && props.line) lines[lit - 1] = props.line
    return { lit, lines, parent: null, collapsed: false, turn: null, temp: {} }
  },
  apply,
  duration(kind) {
    return NATURAL[kind]
  },

  mount(root, props) {
    const uid = `kl${++mounted}`
    const name = props.kid || '小宇'
    const bare = props.bare === true
    root.classList.add('A-kid-life')
    if (bare) root.classList.add('bare')
    // 共用錨點 → CSS 變數(設計座標的數字,CSS 裡乘上 --s)
    const anchor: Record<string, number> = {
      '--strip-x': STRIPS[0].x, '--strip-w': STRIPS[0].w, '--strip-h': STRIP_H, '--strip-r': STRIP_RADIUS,
      '--mid-x': MID_X, '--focus-y': FOCUS.y, '--safe-w': SAFE.w, '--safe-bottom': SAFE.y + SAFE.h,
    }
    for (const [k, v] of Object.entries(anchor)) root.style.setProperty(k, String(v))
    const bokeh = Array.from({ length: 16 }, (_, j) => {
      const r = kit.rand(`kl-bokeh-${j}`)
      return { x: r() * 100, y: r() * 100, size: 70 + r() * 190, red: j % 5 === 2, a: 0.25 + r() * 0.35, period: 2600 + r() * 3000, ph: r() * 4000 }
    })
    const statics = [scene1Static(uid), scene2Static(uid), scene3Static(uid)]
    root.innerHTML =
      (bare
        ? ''
        : `<div class="kl-bokeh">${bokeh.map((b) => `<i class="${b.red ? 'red' : ''}" style="width:calc(${f(b.size)}px * var(--s));height:calc(${f(b.size)}px * var(--s))"></i>`).join('')}</div>` +
          `<div class="kl-tension"></div>`) +
      `<div class="kl-frame">` +
      STRIP_Y.map(
        (y, i) =>
          `<div class="kl-strip" data-i="${i + 1}" style="top:calc(${y}px * var(--s))"><div class="kl-inner">` +
          `<svg class="kl-art" viewBox="0 0 1000 470" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
          `<defs><filter id="${uid}mb${i}" x="-10%" y="0" width="120%" height="100%"><feGaussianBlur stdDeviation="0 0"/></filter></defs>` +
          `<g class="kl-scene">${zoomWrap(`${statics[i]}<g class="kl-dyn"></g>`)}</g></svg>` +
          `<div class="kl-scrim"></div><div class="kl-line"></div><div class="kl-whip"></div><div class="kl-ring"></div></div></div>`,
      ).join('') +
      `<div class="kl-glow"></div><div class="kl-dot"></div>` +
      `<div class="kl-parent"><svg viewBox="0 0 700 1160" aria-hidden="true"><g class="kl-pbody">${PARENT_STATIC_BACK}${PARENT_NECK}</g>` +
      `<g class="kl-phead">${PARENT_HEAD_BACK}${PARENT_HAIR}<g class="kl-pface"></g></g><g class="kl-puff"></g></svg></div>` +
      `<div class="kl-bubble"><span class="kl-said"></span><span class="kl-unsaid"></span></div>` +
      `<div class="kl-turn"></div>` +
      `</div>`

    const $ = <E extends Element = HTMLElement>(s: string): E => root.querySelector<E>(s)!
    const bokehEls = [...root.querySelectorAll<HTMLElement>('.kl-bokeh i')]
    const tension = root.querySelector<HTMLElement>('.kl-tension')
    const strips = [...root.querySelectorAll<HTMLElement>('.kl-strip')]
    const inners = strips.map((s) => s.querySelector<HTMLElement>('.kl-inner')!)
    const rings = strips.map((s) => s.querySelector<HTMLElement>('.kl-ring')!)
    const arts = strips.map((s) => s.querySelector<SVGSVGElement>('.kl-art')!)
    const scenes = strips.map((s) => s.querySelector<SVGGElement>('.kl-scene')!)
    const dyns = strips.map((s) => s.querySelector<SVGGElement>('.kl-dyn')!)
    const blurs = strips.map((s) => s.querySelector<SVGElement>('feGaussianBlur')!)
    const lineEls = strips.map((s) => s.querySelector<HTMLElement>('.kl-line')!)
    const whips = strips.map((s) => s.querySelector<HTMLElement>('.kl-whip')!)
    const glow = $('.kl-glow')
    const dot = $('.kl-dot')
    const parentEl = $('.kl-parent')
    const pbody = $<SVGGElement>('.kl-pbody')
    const phead = $<SVGGElement>('.kl-phead')
    const pface = $<SVGGElement>('.kl-pface')
    const puff = $<SVGGElement>('.kl-puff')
    const bubble = $('.kl-bubble')
    const said = $('.kl-said')
    const unsaid = $('.kl-unsaid')
    const turnEl = $('.kl-turn')

    // 版面:依根元素的實際大小把 1080×1920 的設計座標等比例縮放、置中(大小改變時才重算)
    let sizeKey = ''
    let sc = 1
    const setSize = (w: number, h: number): void => {
      if (!(w > 0 && h > 0)) return
      const key = `${w}x${h}`
      if (key === sizeKey) return
      sizeKey = key
      sc = Math.min(w / FW, h / FH)
      root.style.setProperty('--s', sc.toFixed(5))
      root.style.setProperty('--ox', `${((w - FW * sc) / 2).toFixed(2)}px`)
      root.style.setProperty('--oy', `${((h - FH * sc) / 2).toFixed(2)}px`)
    }
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(([e]) => {
        if (!root.isConnected) return ro.disconnect()
        setSize(e.contentRect.width, e.contentRect.height)
      })
      ro.observe(root)
    }

    return {
      render(frame, ms) {
        if (!sizeKey) setSize(root.offsetWidth, root.offsetHeight)
        const view = frame.view
        if (!view) return
        const events = frame.events as Ev[]
        const ev = view.ev
        const kind = ev ? kindIn(ev.kind, ev.step) : null
        const nat = kind ? NATURAL[kind] : 0
        const k = kind && ev && ev.dur > 0 ? nat / ev.dur : 1
        const l = (ev?.local ?? 0) * k
        const step = (ev?.step ?? {}) as KidLifeStep
        const st = ev?.kind === 'hide' ? view.prev : view.state
        const prev = view.prev
        const P = (a: number, d: number): number => kit.progress(l, a, d)
        const E = (a: number, d: number): number => kit.ease.inOutCubic(P(a, d))

        // ---- 背景:柔焦光點慢慢飄、冷色裡帶一點紅的緊張感 ----
        bokehEls.forEach((el, j) => {
          const b = bokeh[j]
          const x = b.x + kit.noise(ms / 6500 + j * 1.7, j + 1) * 7
          const y = b.y + kit.noise(ms / 8000 + j * 2.3, j + 41) * 6
          const op = b.a * (0.55 + 0.45 * kit.pulse(ms + b.ph, b.period))
          kit.css(el, { left: `${f(x)}%`, top: `${f(y)}%`, opacity: op.toFixed(3) })
        })
        const tensOf = (s: KidLifeState): number => (s.collapsed ? 0 : s.lit === 'all' && !s.parent ? 1 : 0.55)
        const tp = kind === 'collapse' ? E(300, 1100) : kind ? E(0, 500) : 1
        const tens = kit.lerp(tensOf(prev), tensOf(st), tp) * (0.85 + 0.15 * kit.pulse(ms, 2600))
        if (tension) kit.css(tension, { opacity: tens.toFixed(3) })

        // ---- 三格 ----
        const segs = allSegments(events)
        // 小動作(眨眼、呼吸、抖動)的時鐘:'all' 期間跟著加快
        const life = ms + TEMPO * allOverlap(segs, -Infinity, ms)
        // 'all' 開始後的時鐘(書包那格的東西再飛一次)
        let again: number | null = null
        for (const e of events) if (kindIn(e.kind, e.step) === 'all') again = evClock(e.start, e.dur, NATURAL.all, ms)
        const collapsing = kind === 'collapse'
        strips.forEach((el, idx) => {
          const i = idx + 1
          if (st.collapsed && !collapsing) {
            kit.css(el, { visibility: 'hidden' })
            return
          }
          const A = panelClock(i, events, segs, ms) ?? 0
          // 亮度與失焦:從上一個狀態漸變到這一個
          const L0 = lookOf(prev, i)
          let b: number
          let bl: number
          let tx = 0
          let ty = 0
          let scale = 1
          let rot = 0
          let radius = STRIP_RADIUS
          let op = 1
          if (collapsing) {
            const br = E(100, 350)
            b = kit.lerp(L0.b, 1, br)
            bl = kit.lerp(L0.bl, 0, br)
            const c = kit.ease.inCubic(P(450, 700))
            ty = (CENTER_Y - (STRIP_Y[idx] + STRIP_H / 2)) * c
            scale = kit.lerp(1, 0.02, c)
            radius = kit.lerp(STRIP_RADIUS, STRIP_H / 2, c)
            b += c * 1.4
            bl += c * 6
            op = 1 - P(1050, 120)
          } else {
            const L1 = lookOf(st, i)
            const d = kind === 'strip' ? 200 : kind === 'parent' ? 500 : 300
            const q = kind === 'strip' && step.instant ? 1 : kind ? kit.ease.outCubic(P(0, d)) : 1
            b = kit.lerp(L0.b, L1.b, q)
            bl = kit.lerp(L0.bl, L1.bl, q)
          }
          // 'all':同時亮起時依序彈一下,之後一直輕微抖動
          const shakeOf = (s: KidLifeState): number => (s.lit === 'all' && !s.parent && !s.collapsed ? 1 : 0)
          const amp = kind === 'all' ? P(0, 400) : kind ? kit.lerp(shakeOf(prev), shakeOf(st), P(0, 400)) : shakeOf(st)
          if (amp > 0) {
            tx += kit.noise(ms / 42, i * 13) * 7 * amp
            ty += kit.noise(ms / 47, i * 29) * 5 * amp
            rot += kit.noise(ms / 60, i * 7) * 0.5 * amp
          }
          if (kind === 'all') scale *= 1 + 0.035 * hill((l - idx * 90) / 260)
          const ring = st.lit === i || st.lit === 'all' ? 0.18 + 0.22 * kit.pulse(ms, 1600) : 0
          // 陰影放在外框、濾鏡放在內層(同一個元素同時有 box-shadow 與 filter 時,縮放後會畫出殘影)
          const rad = `${(radius * sc).toFixed(2)}px`
          kit.css(el, {
            visibility: op > 0 ? 'visible' : 'hidden',
            opacity: op.toFixed(3),
            transform: `translate(${(tx * sc).toFixed(2)}px, ${(ty * sc).toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
            borderRadius: rad,
            boxShadow: `0 ${f(24 * sc)}px ${f(70 * sc)}px rgba(4, 8, 22, ${(0.5 * Math.min(1, b)).toFixed(3)})`,
          })
          kit.css(inners[idx], { borderRadius: rad, filter: `brightness(${b.toFixed(3)}) blur(${(bl * sc).toFixed(2)}px) saturate(${f(0.6 + 0.4 * Math.min(1, b))})` })
          kit.css(rings[idx], { borderRadius: rad, boxShadow: `inset 0 0 0 ${f(3 * sc)}px rgba(255, 110, 110, ${ring.toFixed(3)})` })

          // 甩鏡:光帶掃過、內容帶著橫向動態模糊滑進來(固定 220ms,不跟著 ms 縮放)
          const whipOn = kind === 'strip' && step.strip === i && !step.instant
          const real = ev?.local ?? 0
          const wp = whipOn ? kit.progress(real, 0, 220) : 1
          const mb = whipOn ? (1 - kit.ease.outCubic(wp)) * 46 : 0
          blurs[idx].setAttribute('stdDeviation', `${mb.toFixed(1)} 0`)
          if (mb > 0.5) scenes[idx].setAttribute('filter', `url(#${uid}mb${idx})`)
          else scenes[idx].removeAttribute('filter')
          kit.css(arts[idx], { transform: `translateX(${(whipOn ? (1 - kit.ease.outCubic(wp)) * 16 : 0).toFixed(2)}%)` })
          const band = whipOn ? kit.ease.inOutQuad(kit.progress(real, 0, 240)) : 1
          kit.css(whips[idx], { opacity: (whipOn ? hill(band) : 0).toFixed(3), transform: `translateX(${kit.lerp(-120, 260, band).toFixed(1)}%)` })

          // 小動畫
          const html = idx === 0 ? scene1(A, life) : idx === 1 ? scene2(A, life, uid) : scene3(A, life, name, again)
          kit.setIf(dyns[idx], 'html', html)

          // 句子:彈入
          const text = st.lines[idx] ?? ''
          kit.setIf(lineEls[idx], 'text', text)
          kit.setIf(lineEls[idx], 'fontSize', `calc(${(lineFont(text) * STRIP_SCALE).toFixed(1)}px * var(--s))`)
          const pop = whipOn && step.line ? kit.progress(real, 120, 280) : 1
          kit.css(lineEls[idx], {
            opacity: (text ? P01(pop * 2.5) : 0).toFixed(3),
            transform: `translateY(${((1 - kit.ease.outCubic(pop)) * 24 * sc).toFixed(2)}px) scale(${kit.lerp(0.6, 1, kit.ease.outBack(pop)).toFixed(4)})`,
          })
        })

        // ---- 收成一點、擴散成柔光、轉折句 ----
        const turn = st.turn ?? ''
        if (collapsing || st.collapsed) {
          const dp = collapsing ? P(1000, 220) : 1
          const dotOut = collapsing ? P(1350, 300) : 1
          kit.css(dot, { opacity: (P01(dp * 3) * (1 - dotOut)).toFixed(3), transform: `translate(-50%, -50%) scale(${kit.ease.outBack(dp).toFixed(4)})` })
          const g = collapsing ? E(1150, 650) : 1
          const breathe = 0.92 + 0.08 * kit.pulse(ms, 3200)
          kit.css(glow, { opacity: (0.8 * g * (collapsing ? 1 : breathe)).toFixed(3), transform: `translate(-50%, -50%) scale(${kit.lerp(0.04, 1, g).toFixed(4)})` })
          const chars = kit.richChars(turnLines(turn))
          kit.setIf(turnEl, 'html', chars.map((c) => (c.br ? '<br>' : `<span class="${c.em ? 'em' : ''}">${kit.esc(c.ch)}</span>`)).join(''))
          const n = chars.length || 1
          const gap = Math.min(70, 650 / n)
          ;[...turnEl.querySelectorAll<HTMLElement>('span')].forEach((s, j) => kit.css(s, kit.blurIn(collapsing ? P(1250 + j * gap, 500) : 1, { blur: 14 })))
          turnEl.style.visibility = 'visible'
        } else {
          kit.css(dot, { opacity: '0', transform: 'translate(-50%, -50%) scale(0)' })
          kit.css(glow, { opacity: '0', transform: 'translate(-50%, -50%) scale(0.04)' })
          kit.setIf(turnEl, 'html', '')
          turnEl.style.visibility = 'hidden'
        }

        // ---- 媽媽 ----
        let pp = 0
        if (kind === 'parent' && !prev.parent) pp = kit.ease.outCubic(P(0, 550))
        else if (st.parent) pp = 1
        else if (prev.parent && (kind === 'collapse' || kind === 'strip' || kind === 'all')) pp = 1 - kit.ease.inCubic(P(0, 450))
        const ptext = st.parent ?? prev.parent ?? ''
        if (pp <= 0 || !ptext) {
          kit.css(parentEl, { visibility: 'hidden' })
          kit.css(bubble, { visibility: 'hidden' })
        } else {
          const talking = kind === 'parent'
          kit.css(parentEl, { visibility: 'visible', transform: `translateY(${((1 - pp) * 105).toFixed(2)}%)` })
          // 嘆氣:肩膀一沉(500–900ms)、吐出一縷氣(550–1500ms)
          const slump = talking && !prev.parent ? E(500, 400) : 1
          const breath = Math.sin(ms / 900) * 3
          pbody.setAttribute('transform', `translate(0 ${f(slump * 16 + breath)})`)
          phead.setAttribute('transform', `translate(${f(-slump * 4)} ${f(slump * 26 + breath * 1.2)}) rotate(${f(-slump * 4)} 350 600)`)
          const g = kit.graphemes(ptext)
          const typeDur = Math.max(300, Math.min(950, g.length * 75))
          const nTyped = talking ? Math.floor(g.length * P(650, typeDur)) : g.length
          const sighing = talking && l >= 550 && l < 820
          const speaking = talking && nTyped > 0 && nTyped < g.length
          const mouth = sighing ? 'sigh' : speaking ? 'talk' : 'shut'
          kit.setIf(pface, 'html', parentFace(blinkAt(ms, 400, 3100) && !sighing, mouth, Math.abs(Math.sin(l / 70))))
          const pq = talking ? P(550, 950) : 1
          if (pq > 0 && pq < 1) {
            const x = 380 + pq * 150
            const y = 560 - pq * 120
            kit.setIf(puff, 'html', `<g transform="translate(${f(x)} ${f(y)}) scale(${f(0.6 + pq * 0.9)})" opacity="${f(hill(pq) * 0.85)}"><circle r="20" fill="#eef2f8"/><circle cx="24" cy="-10" r="15" fill="#eef2f8"/><circle cx="42" cy="4" r="11" fill="#eef2f8"/><path d="M-24 12 C-40 20 -40 36 -24 38" stroke="#eef2f8" stroke-width="7" fill="none" stroke-linecap="round"/></g>`)
          } else kit.setIf(puff, 'html', '')
          // 泡泡:全文先排好(大小不跳),還沒說到的字透明
          kit.setIf(said, 'text', g.slice(0, nTyped).join(''))
          kit.setIf(unsaid, 'text', g.slice(nTyped).join(''))
          const bq = talking && !prev.parent ? P(550, 260) : talking && prev.parent && prev.parent !== st.parent ? P(0, 260) : 1
          const bOut = pp < 1 && !talking ? pp : 1
          kit.css(bubble, {
            visibility: 'visible',
            opacity: (P01(bq * 2) * bOut).toFixed(3),
            transform: `translate(-50%, -100%) translateY(${((1 - pp) * 300 * sc).toFixed(2)}px) scale(${kit.lerp(0.7, 1, kit.ease.outBack(bq)).toFixed(4)})`,
          })
        }
      },

      target(name) {
        if (name === 'window') return root
        if (name === 'parent') return parentEl
        if (name === 'turn') return turnEl
        const m = /^strip:([123])$/.exec(name)
        if (m) return strips[Number(m[1]) - 1]
        return null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 live/types.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
