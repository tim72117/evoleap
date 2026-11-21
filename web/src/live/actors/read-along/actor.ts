// 演員 read-along:跟著真人錄音一起讀(英文朗讀動畫)。畫面是一張餐桌:上方的天空有太陽和月亮,
// 桌上一次只放一個時段(午餐、晚餐、飲料)的餐點,圖片很大;念到食物時那樣東西蹦到桌上,小熊波波坐在桌邊跟著錄音張嘴。
// 換時段用「移動太陽和天空」轉場:午餐 → 晚餐時太陽往右邊落下、月亮從左邊升起,天空由藍變橘紅再變深藍,桌上的午餐滑出去、晚餐滑進來。
// 時間全部對齊原始錄音:每一步的 at 是這一步開始時錄音的秒數,字、圖、天空的時間也都寫錄音的秒數;
// 旁白語音在步驟開始後 150ms 開始播(舞台的 NARRATION_DELAY),所以畫面裡的錄音時間 = at + (local − 150) / 1000。
// 沒有狀態:畫面只看已經開始的步驟。所有動畫由 render 依時間算出(SPEC 第 1 節)。place 用 "full";橫式句子在天空右上、直式在最下面。
//
// props:
//   panels   時段:[{ "id": "lunch", "title": "Lunch", "icon": "sun" }, …](桌上的牌子寫哪個時段)
//   sky      天空的時間:[[秒, 0–1], …],0 是白天、0.5 是黃昏、1 是夜晚;太陽、月亮、天空顏色、星星都跟著它走,兩點之間平順過渡
//   peek     月亮探頭:[[秒, 0–1], …],1 時月亮出現在白天的天空旁邊(念到 night 時月亮先露個臉)
//   speech   錄音裡有聲音的區間(秒):[[1.58, 2.08], …](小熊的嘴巴照這個開合;沒寫就照字的時間)
//
// 動作:
//   { "read": "For lunch, I like soup,", "at": 9.5,
//     "words": [["For", 9.98], ["lunch,", 10.46], …],      這一句的每個字與開始念的秒數
//     "panel": "lunch",                                     這一句在講哪個時段(牌子)
//     "pics": [["soup", 12.78]],                            念到的時候蹦到桌上的圖:[圖示, 秒數]
//     "cues": [["sun", 5.99], ["moon", 8.57]],              這個秒數讓太陽或月亮跳一下、發亮
//     "leave": 19.2 }                                       到這個秒數,桌上到這一步為止的餐點滑出去(換時段)
//   一句的長度用 ms 指定(到下一句開始的錄音長度),pause 寫 0,時間才會和錄音對齊。
//
// 圖示:sun、moon、cup、soup、cheese-sandwich、chicken-sandwich、salad、fish、rice、water、lemonade、
//       sunset、cookie、eggs、bananas、apples、oranges、milk
// 目標:window、line、sky、sun、moon、table、pic:圖示
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import { bearSvg, faceSvg } from '../bobo/art'
import './actor.css'

type Word = [string, number]
type Pic = [string, number]
export type ReadStep = CommonStepFields & {
  read?: string
  at?: number
  words?: Word[]
  panel?: string
  pics?: Pic[]
  cues?: [string, number][]
  leave?: number
}
interface Panel {
  id: string
  title: string
  icon?: string
}
export interface ReadProps {
  panels?: Panel[]
  sky?: [number, number][]
  peek?: [number, number][]
  speech?: [number, number][]
}

/** 旁白在步驟開始後多久播(和 stage.ts 的 NARRATION_DELAY 一樣) */
export const LEAD = 150

// ---------- 圖示(200×200) ----------
export const ICONS: Record<string, string> = {
  sun:
    `<g transform="translate(100 100)">${[...Array(10)].map((_, i) => `<rect x="-7" y="-92" width="14" height="30" rx="7" fill="#ffb627" transform="rotate(${i * 36})"/>`).join('')}` +
    `<circle r="52" fill="#ffd24a"/><circle cx="-18" cy="-8" r="6" fill="#5a3b1c"/><circle cx="18" cy="-8" r="6" fill="#5a3b1c"/><path d="M-20 14 Q0 32 20 14" stroke="#5a3b1c" stroke-width="6" fill="none" stroke-linecap="round"/></g>`,
  moon:
    `<path d="M128 30 A72 72 0 1 0 170 140 A58 58 0 1 1 128 30 Z" fill="#ffe28a"/><circle cx="86" cy="96" r="6" fill="#6b5a2a"/><path d="M78 122 Q92 132 106 122" stroke="#6b5a2a" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<path transform="translate(160 52)" d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" fill="#fff6c9"/>`,
  cup: `<path d="M50 60 L150 60 L138 170 Q100 182 62 170 Z" fill="#8fd1f5"/><path d="M150 84 Q184 92 176 124 Q170 146 144 146" stroke="#8fd1f5" stroke-width="12" fill="none"/><rect x="44" y="50" width="112" height="16" rx="8" fill="#5fb4e6"/>`,
  soup:
    `<path d="M24 92 L176 92 Q170 168 100 172 Q30 168 24 92 Z" fill="#ff8a5b"/><ellipse cx="100" cy="92" rx="76" ry="16" fill="#ffc35a"/>` +
    `<circle cx="76" cy="90" r="7" fill="#7cc36b"/><circle cx="112" cy="94" r="6" fill="#ff6a3d"/><circle cx="130" cy="88" r="5" fill="#7cc36b"/>` +
    `<path d="M70 66 Q60 50 72 36 M100 62 Q90 44 102 28 M130 66 Q120 50 132 36" stroke="#d9e2e6" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<rect x="64" y="168" width="72" height="12" rx="6" fill="#e0703f"/>`,
  'cheese-sandwich':
    `<path d="M30 70 Q100 30 170 70 L170 92 L30 92 Z" fill="#e9b26a"/><path d="M26 92 L174 92 L162 112 L40 112 Z" fill="#ffd34d"/>` +
    `<circle cx="70" cy="100" r="5" fill="#f2b632"/><circle cx="120" cy="102" r="6" fill="#f2b632"/><path d="M60 112 L72 128 L84 112 Z" fill="#ffd34d"/>` +
    `<rect x="30" y="112" width="140" height="30" rx="12" fill="#e9b26a"/><rect x="30" y="112" width="140" height="8" fill="#f6d6a2"/>`,
  'chicken-sandwich':
    `<path d="M30 70 Q100 30 170 70 L170 90 L30 90 Z" fill="#e9b26a"/><path d="M24 90 Q60 104 100 92 Q140 104 176 90 L172 104 L28 104 Z" fill="#7cc36b"/>` +
    `<rect x="32" y="102" width="136" height="22" rx="10" fill="#c98b4a"/><path d="M40 110 L160 110" stroke="#a96f35" stroke-width="4" stroke-dasharray="10 8"/>` +
    `<rect x="30" y="124" width="140" height="28" rx="12" fill="#e9b26a"/>` +
    `<circle cx="78" cy="54" r="3" fill="#fff4dc"/><circle cx="104" cy="48" r="3" fill="#fff4dc"/><circle cx="128" cy="56" r="3" fill="#fff4dc"/>`,
  salad:
    `<path d="M22 98 L178 98 Q170 170 100 172 Q30 170 22 98 Z" fill="#a8d8f0"/>` +
    `<circle cx="62" cy="88" r="26" fill="#7cc36b"/><circle cx="98" cy="76" r="30" fill="#5fae4f"/><circle cx="138" cy="88" r="26" fill="#8fd16f"/>` +
    `<circle cx="80" cy="92" r="11" fill="#ff5a4a"/><circle cx="124" cy="80" r="10" fill="#ff5a4a"/><ellipse cx="104" cy="96" rx="14" ry="7" fill="#fff4b0"/>`,
  fish:
    `<path d="M30 100 Q90 40 150 100 Q90 160 30 100 Z" fill="#7fb7e8"/><path d="M146 100 L184 70 L178 100 L184 130 Z" fill="#5d9fd8"/>` +
    `<circle cx="64" cy="92" r="8" fill="#ffffff"/><circle cx="64" cy="92" r="4" fill="#24384f"/>` +
    `<path d="M92 76 Q102 100 92 124 M112 74 Q122 100 112 126" stroke="#5d9fd8" stroke-width="5" fill="none"/>`,
  rice:
    `<path d="M30 104 L170 104 Q164 172 100 174 Q36 172 30 104 Z" fill="#ffffff" stroke="#e5ddd0" stroke-width="5"/>` +
    `<path d="M34 106 Q100 30 166 106 Z" fill="#fbf7ee"/>` +
    [...Array(14)].map((_, i) => `<ellipse cx="${58 + (i % 7) * 14}" cy="${84 + Math.floor(i / 7) * 14 - Math.abs(3 - (i % 7)) * 3}" rx="5" ry="3" fill="#efe6d3" transform="rotate(${(i * 37) % 60} ${58 + (i % 7) * 14} ${84 + Math.floor(i / 7) * 14})"/>`).join('') +
    `<path d="M70 120 Q100 136 130 120" stroke="#3b7ccf" stroke-width="5" fill="none"/>`,
  water:
    `<path d="M58 40 L142 40 L130 176 L70 176 Z" fill="#dff3ff" stroke="#9ccbe8" stroke-width="6"/><path d="M64 84 L136 84 L130 170 L70 170 Z" fill="#8fd1f5"/>` +
    `<path d="M84 100 L84 150" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity=".7"/>`,
  lemonade:
    `<path d="M58 40 L142 40 L130 176 L70 176 Z" fill="#fff8d6" stroke="#e8d27a" stroke-width="6"/><path d="M64 80 L136 80 L130 170 L70 170 Z" fill="#ffe36b"/>` +
    `<circle cx="140" cy="44" r="26" fill="#ffd93b" stroke="#f2c21c" stroke-width="5"/><path d="M140 22 L140 66 M118 44 L162 44 M124 28 L156 60 M156 28 L124 60" stroke="#f2c21c" stroke-width="3"/>` +
    `<rect x="96" y="14" width="10" height="90" rx="5" fill="#ff7aa8" transform="rotate(14 100 60)"/>`,
  // 以下給孩子的版本(u8-foods-girl):黃昏的牌子、餅乾、蛋、香蕉、蘋果、橘子、牛奶
  sunset:
    `<path d="M20 130 L180 130" stroke="#ff9a52" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M48 124 A52 52 0 0 1 152 124 Z" fill="#ffb347"/>` +
    [...Array(5)].map((_, i) => `<rect x="-6" y="-92" width="12" height="24" rx="6" fill="#ff8a3d" transform="translate(100 124) rotate(${-72 + i * 36})"/>`).join('') +
    `<path d="M50 152 L150 152 M72 170 L128 170" stroke="#ffc58a" stroke-width="8" stroke-linecap="round"/>`,
  cookie:
    `<circle cx="100" cy="100" r="70" fill="#d9a05b"/><circle cx="100" cy="100" r="70" fill="none" stroke="#b97f3e" stroke-width="6"/>` +
    `<ellipse cx="74" cy="76" rx="10" ry="8" fill="#5a3418"/><ellipse cx="122" cy="70" rx="9" ry="7" fill="#5a3418"/><ellipse cx="128" cy="116" rx="11" ry="8" fill="#5a3418"/>` +
    `<ellipse cx="82" cy="124" rx="9" ry="7" fill="#5a3418"/><ellipse cx="102" cy="98" rx="7" ry="6" fill="#5a3418"/>`,
  eggs:
    `<ellipse cx="100" cy="130" rx="84" ry="34" fill="#ffffff" stroke="#e5ddd0" stroke-width="5"/>` +
    `<path d="M40 128 Q36 96 62 92 Q92 90 90 122 Q88 146 62 146 Q42 146 40 128 Z" fill="#fffdf6"/><circle cx="64" cy="118" r="17" fill="#ffc531"/>` +
    `<path d="M108 120 Q106 88 134 86 Q164 86 162 116 Q160 142 134 142 Q110 142 108 120 Z" fill="#fffdf6"/><circle cx="135" cy="113" r="17" fill="#ffc531"/>` +
    `<circle cx="58" cy="112" r="4" fill="#fff1b8"/><circle cx="129" cy="107" r="4" fill="#fff1b8"/>`,
  bananas:
    `<path d="M40 60 Q60 150 160 150 Q172 146 168 138 Q90 130 60 52 Z" fill="#ffd93b" stroke="#e8b81a" stroke-width="5" stroke-linejoin="round"/>` +
    `<path d="M56 50 Q96 132 172 120 Q180 112 172 106 Q108 104 74 44 Z" fill="#ffe25c" stroke="#e8b81a" stroke-width="5" stroke-linejoin="round"/>` +
    `<path d="M44 58 L66 42 L76 48 L56 64 Z" fill="#8a6a2a"/><circle cx="166" cy="144" r="5" fill="#5a4a1a"/><circle cx="172" cy="113" r="5" fill="#5a4a1a"/>`,
  apples:
    `<path d="M70 70 Q40 58 30 90 Q22 130 50 156 Q64 166 76 158 Q88 166 102 156 Q126 130 116 92 Q106 60 76 72 Z" fill="#ff5a4a"/>` +
    `<path d="M76 70 Q74 54 84 42" stroke="#7a4a1c" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M84 52 Q104 40 110 56 Q94 64 84 52 Z" fill="#6cc35a"/>` +
    `<path d="M134 86 Q110 78 104 104 Q98 138 120 158 Q132 166 142 160 Q152 166 162 158 Q182 136 176 106 Q168 80 140 88 Z" fill="#ff7a5c"/>` +
    `<path d="M140 88 Q138 74 146 64" stroke="#7a4a1c" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="48" cy="96" rx="8" ry="14" fill="#ffffff" opacity=".35"/><ellipse cx="120" cy="110" rx="6" ry="11" fill="#ffffff" opacity=".35"/>`,
  oranges:
    `<circle cx="72" cy="112" r="50" fill="#ff9f1c"/><circle cx="138" cy="122" r="42" fill="#ffae35"/>` +
    `<path d="M72 64 L72 54" stroke="#7a4a1c" stroke-width="6" stroke-linecap="round"/><path d="M74 58 Q92 42 104 56 Q88 68 74 58 Z" fill="#6cc35a"/>` +
    [...Array(6)].map((_, i) => `<circle cx="${52 + (i % 3) * 18}" cy="${100 + Math.floor(i / 3) * 22}" r="2.5" fill="#e07f00"/>`).join('') +
    `<ellipse cx="56" cy="92" rx="9" ry="13" fill="#ffffff" opacity=".3"/><ellipse cx="126" cy="106" rx="7" ry="10" fill="#ffffff" opacity=".3"/>`,
  milk:
    `<path d="M58 40 L142 40 L130 176 L70 176 Z" fill="#f4f8ff" stroke="#c9d6e8" stroke-width="6"/><path d="M63 70 L137 70 L130 170 L70 170 Z" fill="#ffffff"/>` +
    `<path d="M63 70 Q80 82 100 70 Q120 58 137 70" fill="#ffffff" stroke="#e2e9f4" stroke-width="4"/>` +
    `<path d="M84 96 L84 150" stroke="#dfe7f2" stroke-width="8" stroke-linecap="round"/>`,
}
const LABELS: Record<string, string> = {
  sun: 'lunchtime', moon: 'night', cup: 'drink', soup: 'soup', 'cheese-sandwich': 'cheese sandwich', 'chicken-sandwich': 'chicken sandwich',
  salad: 'salad', fish: 'fish', rice: 'rice', water: 'water', lemonade: 'lemonade',
  sunset: 'dinner', cookie: 'cookie', eggs: 'eggs', bananas: 'bananas', apples: 'apples', oranges: 'oranges', milk: 'milk',
}
const icon = (name: string) => `<svg viewBox="0 0 200 200" aria-hidden="true">${ICONS[name] ?? ''}</svg>`

// ---------- 時間 ----------
/** 錄音時間(秒) */
export const audioTime = (step: ReadStep, local: number): number => (step.at ?? 0) + (local - LEAD) / 1000

/** 這個時間點小熊的嘴巴是不是開的 */
export function talking(t: number, speech: [number, number][] | undefined, words: Word[]): boolean {
  if (speech?.length) {
    const on = speech.some(([a, b]) => t >= a && t < b)
    return on && Math.floor(t * 7.5) % 2 === 0
  }
  return words.some(([, w], i) => t >= w && t < (words[i + 1]?.[1] ?? w + 0.6) - 0.1) && Math.floor(t * 7.5) % 2 === 0
}

/** 時間點的值:兩點之間平順過渡,第一點之前與最後一點之後維持不變 */
export function keysAt(keys: [number, number][] | undefined, t: number): number {
  if (!keys?.length) return 0
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1]
      const [b, vb] = keys[i]
      return kit.lerp(va, vb, kit.ease.inOutCubic(kit.clamp((t - a) / (b - a))))
    }
  }
  return keys[keys.length - 1][1]
}

// ---------- 天空 ----------
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const mix = (a: string, b: string, p: number): string => {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  return `rgb(${Math.round(r1 + (r2 - r1) * p)},${Math.round(g1 + (g2 - g1) * p)},${Math.round(b1 + (b2 - b1) * p)})`
}
/** 三段顏色之間的過渡:0 白天、0.5 黃昏、1 夜晚 */
const tone = (p: number, day: string, dusk: string, night: string): string => (p < 0.5 ? mix(day, dusk, p / 0.5) : mix(dusk, night, (p - 0.5) / 0.5))

/** 天空由上到下的兩個顏色與山丘的顏色 */
export function skyColors(p: number): { top: string; bottom: string; far: string; near: string } {
  return {
    top: tone(p, '#6ec1f0', '#6a5aa6', '#141b45'),
    bottom: tone(p, '#e0f5ff', '#ffb27a', '#4a5590'),
    far: tone(p, '#a8d97f', '#8f7a6a', '#2f4a45'),
    near: tone(p, '#86c65c', '#6f8b4f', '#233b2f'),
  }
}

/** 太陽、月亮在天空裡的位置(天空寬、高的比例):p=0 太陽在高處、月亮在地平線下;p=1 太陽落到地平線下、月亮升起。
 *  peek(0–1)讓月亮從原本的位置移到旁邊露臉。portrait 時改用窄畫面的位置 */
export function orbPos(p: number, peek: number, portrait: boolean): { sun: [number, number]; moon: [number, number] } {
  const sx0 = portrait ? 0.28 : 0.14
  const sx1 = portrait ? 0.74 : 0.74
  const mx = portrait ? 0.28 : 0.2
  const px = portrait ? 0.72 : 0.32
  const y = (q: number) => 0.42 + 1.06 * q ** 1.6
  const sun: [number, number] = [kit.lerp(sx0, sx1, p), y(p)]
  const arc: [number, number] = [mx, y(1 - p)]
  const peekAt: [number, number] = [px, 0.42]
  return { sun, moon: [kit.lerp(arc[0], peekAt[0], peek), kit.lerp(arc[1], peekAt[1], peek)] }
}

const SUN_RAYS = [...Array(12)].map((_, i) => `<rect x="-6" y="-96" width="12" height="30" rx="6" fill="#ffb627" transform="rotate(${i * 30})"/>`).join('')
const SUN_SVG =
  `<svg viewBox="0 0 200 200" aria-hidden="true"><g transform="translate(100 100)"><g class="ra-rays">${SUN_RAYS}</g><circle r="56" fill="#ffd24a"/>` +
  `<circle cx="-19" cy="-9" r="6.5" fill="#5a3b1c"/><circle cx="19" cy="-9" r="6.5" fill="#5a3b1c"/><path d="M-22 14 Q0 34 22 14" stroke="#5a3b1c" stroke-width="6.5" fill="none" stroke-linecap="round"/>` +
  `<ellipse cx="-36" cy="12" rx="9" ry="5.5" fill="#ff9a62" opacity=".6"/><ellipse cx="36" cy="12" rx="9" ry="5.5" fill="#ff9a62" opacity=".6"/></g></svg>`
const MOON_SVG = `<svg viewBox="0 0 200 200" aria-hidden="true">${ICONS.moon}</svg>`

const STARS = (() => {
  const r = kit.rand(11)
  return [...Array(30)].map(() => ({ x: 4 + r() * 92, y: 3 + r() * 62, s: 0.5 + r() * 1.1, ph: r() * 6.28 }))
})()
const CLOUDS = [
  { y: 14, s: 1.0, speed: 55, off: 20 },
  { y: 36, s: 0.75, speed: 80, off: 70 },
  { y: 8, s: 0.6, speed: 95, off: 110 },
]
const cloudSvg = `<svg viewBox="-110 -60 220 110" aria-hidden="true"><ellipse cx="0" cy="12" rx="90" ry="32" fill="#fff"/><circle cx="-38" cy="-8" r="38" fill="#fff"/><circle cx="24" cy="-20" r="46" fill="#fff"/></svg>`

const actor = defineActor<'read', ReadStep, ReadProps>({
  name: 'read-along',
  kinds: ['read'],

  duration(_kind, step) {
    if (typeof step.read !== 'string') throw new Error('read 要寫這一句的文字')
    if (typeof step.at !== 'number') throw new Error('read 要寫 at(這一步開始時錄音的秒數)')
    for (const [name] of step.pics ?? []) if (!ICONS[name]) throw new Error(`沒有圖示「${name}」(可用:${Object.keys(ICONS).join('、')})`)
    for (const [who] of step.cues ?? []) if (who !== 'sun' && who !== 'moon') throw new Error(`cues 只能是 sun 或 moon,不能是「${who}」`)
    const words = step.words ?? []
    const last = words.length ? words[words.length - 1][1] - step.at : 2
    return Math.max(1000, Math.round(last * 1000 + 1200))
  },

  mount(root, props) {
    const panels = new Map((props.panels ?? []).map((p) => [p.id, p]))
    root.classList.add('A-read-along')
    root.innerHTML =
      `<div class="ra-sky"><div class="ra-stars">${STARS.map((s, i) => `<i data-i="${i}" style="left:${s.x.toFixed(1)}%;top:${s.y.toFixed(1)}%;--s:${s.s.toFixed(2)}"></i>`).join('')}</div>` +
      CLOUDS.map((c, i) => `<div class="ra-cloud" data-i="${i}" style="top:${c.y}%;--s:${c.s}">${cloudSvg}</div>`).join('') +
      `<div class="ra-orb ra-sun">${SUN_SVG}</div><div class="ra-orb ra-moon">${MOON_SVG}</div>` +
      `<svg class="ra-hills" viewBox="0 0 1920 300" preserveAspectRatio="none" aria-hidden="true"><path class="ra-far" d="M0 150 C220 60 420 70 640 140 C860 210 1080 90 1320 100 C1560 110 1740 170 1920 120 L1920 300 L0 300 Z"/><path class="ra-near" d="M0 200 C260 130 520 150 760 190 C1000 230 1240 150 1500 170 C1700 186 1820 214 1920 180 L1920 300 L0 300 Z"/></svg></div>` +
      `<div class="ra-table"><div class="ra-cloth"></div><div class="ra-sign" hidden><span class="ra-sicon"></span><span class="ra-stitle" lang="en"></span></div>` +
      `<div class="ra-plate"></div><div class="ra-bear"><svg viewBox="-170 -480 340 500" aria-hidden="true"><g class="ra-bearg">${bearSvg()}</g></svg></div></div>` +
      `<div class="ra-night"></div><div class="ra-line" lang="en"></div>`
    const q = <E extends Element>(sel: string) => root.querySelector<E>(sel)!
    const line = q<HTMLElement>('.ra-line')
    const sky = q<HTMLElement>('.ra-sky')
    const hills = [q<SVGPathElement>('.ra-far'), q<SVGPathElement>('.ra-near')]
    const sun = q<HTMLElement>('.ra-sun')
    const moon = q<HTMLElement>('.ra-moon')
    const rays = q<SVGGElement>('.ra-rays')
    const stars = [...root.querySelectorAll<HTMLElement>('.ra-stars i')]
    const clouds = [...root.querySelectorAll<HTMLElement>('.ra-cloud')]
    const plate = q<HTMLElement>('.ra-plate')
    const sign = q<HTMLElement>('.ra-sign')
    const night = q<HTMLElement>('.ra-night')
    const table = q<HTMLElement>('.ra-table')
    const face = q<SVGGElement>('.ra-bear .bb-face')
    const head = q<SVGGElement>('.ra-bear .bb-head')
    const bearG = q<SVGGElement>('.ra-bearg')
    root.querySelector<HTMLElement>('.ra-bear')!.style.setProperty('--bb-fur', '#b97c4c')

    return {
      render(frame, ms) {
        const evs = frame.events.filter((e) => e.kind === 'read')
        const cur = evs[evs.length - 1]
        const step = (cur?.step ?? {}) as ReadStep
        const t = cur ? audioTime(step, cur.local) : -1
        const words = step.words ?? []
        const portrait = (root.clientWidth || 1920) < (root.clientHeight || 1080)

        // 句子:念過的字變深、正在念的字畫上螢光筆、還沒念的字淡淡的
        let curIdx = -1
        words.forEach(([, w], i) => {
          if (t >= w) curIdx = i
        })
        const html = words.length
          ? words
              .map(([w, at], i) => {
                const state = i < curIdx ? 'done' : i === curIdx ? 'now' : 'next'
                const pop = i === curIdx ? kit.ease.outBack(kit.clamp((t - at) / 0.25)) : 1
                return `<span class="ra-w ${state}" style="--pop:${pop.toFixed(3)}">${kit.esc(w)}</span>`
              })
              .join(' ')
          : kit.esc(step.read ?? '')
        kit.setIf(line, 'html', html)
        kit.css(line, kit.enter(kit.progress(cur?.local ?? 0, 0, 350), { dist: '0.5em' }))

        // 天空:太陽、月亮、顏色、星星、雲都跟著 p(0 白天 → 1 夜晚)走
        const p = keysAt(props.sky, t)
        const peek = keysAt(props.peek, t)
        const col = skyColors(p)
        kit.setIf(sky, 'background', `linear-gradient(180deg, ${col.top}, ${col.bottom})`)
        hills[0].setAttribute('fill', col.far)
        hills[1].setAttribute('fill', col.near)
        const pos = orbPos(p, peek, portrait)
        const cues = evs.flatMap((e) => (e.step as ReadStep).cues ?? [])
        const bump = (who: string): number => {
          const at = cues.filter(([c, a]) => c === who && t >= a).map(([, a]) => a)
          if (!at.length) return 0
          return Math.sin(kit.clamp((t - at[at.length - 1]) / 1.0) * Math.PI)
        }
        for (const [el, [x, y], who] of [[sun, pos.sun, 'sun'], [moon, pos.moon, 'moon']] as const) {
          const b = bump(who)
          kit.css(el, {
            left: `${(x * 100).toFixed(2)}%`,
            top: `${(y * 100).toFixed(2)}%`,
            transform: `translate(-50%, -50%) scale(${(1 + b * 0.2).toFixed(3)}) rotate(${(who === 'moon' ? 6 * Math.sin(ms / 1500) : 0).toFixed(2)}deg)`,
            filter: b > 0.01 ? `drop-shadow(0 0 ${(b * 28).toFixed(1)}px ${who === 'sun' ? 'rgba(255,200,40,.95)' : 'rgba(255,240,170,.95)'})` : 'none',
          })
        }
        rays.setAttribute('transform', `rotate(${((ms / 90) % 360).toFixed(2)})`)
        const starOn = kit.clamp((p - 0.55) / 0.35)
        stars.forEach((s, i) => kit.setIf(s, 'opacity', (starOn * (0.55 + 0.45 * Math.sin(ms / 450 + STARS[i].ph))).toFixed(2)))
        const cloudOn = kit.clamp(1 - p * 1.6)
        clouds.forEach((c, i) => {
          const d = CLOUDS[i]
          kit.css(c, { left: `${(((ms / d.speed + d.off * 8) % 1400) / 10 - 20).toFixed(2)}%`, opacity: cloudOn.toFixed(2) })
        })
        kit.setIf(night, 'opacity', (Math.max(0, p - 0.3) * 0.45).toFixed(3))

        // 牌子:這一句講哪個時段
        const named = [...evs].reverse().find((e) => (e.step as ReadStep).panel)
        const meal = named ? panels.get((named.step as ReadStep).panel!) : undefined
        sign.hidden = !meal
        if (meal && named) {
          kit.setIf(root.querySelector<HTMLElement>('.ra-stitle')!, 'text', meal.title)
          kit.setIf(root.querySelector<HTMLElement>('.ra-sicon')!, 'html', meal.icon ? icon(meal.icon) : '')
          kit.css(sign, kit.enter(kit.progress(named.local, 0, 450), { dist: '0.8em', scale: 0.9 }))
        }

        // 桌上的餐點:念到才蹦出來;換時段(leave)時滑出去;正在念的那一個發亮
        const items: string[] = []
        evs.forEach((e, i) => {
          const s = e.step as ReadStep
          const next = evs.slice(i).find((x) => (x.step as ReadStep).leave != null)
          const leave = next ? ((next.step as ReadStep).leave as number) : Infinity
          const out = kit.ease.inCubic(kit.clamp((t - leave) / 0.9))
          if (out >= 1) return
          for (const [name, at] of s.pics ?? []) {
            if (t < at) continue
            const pop = kit.ease.outBack(kit.clamp((t - at) / 0.5))
            const glow = e === cur && t - at < 1.8
            const tf = `translateY(${(out * 60).toFixed(1)}px) scale(${(pop * (1 - out * 0.35)).toFixed(3)}) rotate(${((1 - pop) * -14).toFixed(1)}deg)`
            items.push(`<figure class="ra-pic${glow ? ' glow' : ''}" data-pic="${name}" style="transform:${tf};opacity:${(1 - out).toFixed(2)}">${icon(name)}<figcaption lang="en">${kit.esc(LABELS[name] ?? name)}</figcaption></figure>`)
          }
        })
        kit.setIf(plate, 'html', items.join(''))

        // 小熊跟著錄音張嘴、輕輕晃
        const open = cur ? talking(t, props.speech, words) : false
        kit.setIf(face, 'html', faceSvg(open ? 'calm' : 'happy', { blink: (ms + 300) % 3600 < 140, talk: open, film: 0, foam: 0, lick: 0, chew: 0 }))
        bearG.setAttribute('transform', `rotate(${(2.5 * Math.sin(ms / 900)).toFixed(2)})`)
        head.setAttribute('transform', `translate(0 -330) rotate(${(3 * Math.sin(ms / 1300)).toFixed(2)})`)
        void table
      },

      target(name) {
        if (name === 'window') return root
        if (name === 'line') return line
        if (name === 'sky') return sky
        if (name === 'sun') return sun
        if (name === 'moon') return moon
        if (name === 'table') return table
        if (name.startsWith('pic:')) return root.querySelector<HTMLElement>(`[data-pic="${CSS.escape(name.slice(4))}"]`)
        return null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
