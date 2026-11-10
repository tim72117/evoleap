// 演員 lt9-wear:兒童網頁課單元 2「CSS：幫網頁換衣服」的換裝名片。左邊是一張寵物名片網頁,右邊是「衣櫃」工具盤
// (色盤、字的大小、粗細、邊框與留白的滑桿、排法與對齊),點工具,名片上那一塊就換上新的樣子。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
// 兒童版播放器的子腳本可以不寫 interact.spots:hotspots 會把衣櫃裡每一個工具變成可以點的地方(點了念出改了哪一塊、改成什麼)。
//
// 部位(part):card(整張名片)、h1(標題)、img(圖片)、p(段落)、button(按鈕)、cards(一排小卡片,2.4 排排站用)
// 樣子(style 欄位與可用的值):
//   color   文字顏色:black white navy blue red orange yellow green purple pink cream lemon sky mint peach
//   bg      背景顏色:同上,另外有 none(透明,透出名片的背景)
//   size    字的大小:s(小)、m(中)、l(大)、xl(特大);圖片是圖的大小
//   bold    粗體:true / false
//   border  邊框:0(沒有)、1(細)、2(中)、3(粗)
//   pad     裡面留白:0–3(沒有、一點點、中等、很多)
//   margin  外面留白:0–3
//   dir     排法(card、cards 才有):column(上下排)、row(並排)
//   align   對齊(card、cards 才有):start(靠左)、center(置中)、end(靠右)
//
// props(登場設定):
//   title    網址列上的網站名稱
//   parts    名片上的部位,由上到下:[{ "id": "h1", "text": "小花" }, { "id": "img", "text": "🐱" }, …](card 不用列,一定有)
//   cards    cards 部位裡的小卡片:[{ "icon": "🐱", "name": "小花" }, …]
//   look     一開始的樣子:{ "h1": { "color": "yellow" }, "card": { "bg": "cream" } }(沒寫的用預設)
//   tools    衣櫃裡的工具,由上到下:[{ "part": "h1", "prop": "color", "label": "標題的文字顏色", "values": ["black", …] }]
//            label、values 可省略(用預設的說法與全部的值)
//   meter    看得清不清楚的小眼睛:寫部位(例如 "h1"),依它的文字顏色和背後的背景顏色顯示「看得清楚／看不清楚」
//   goals    任務:[{ "id": "g1", "label": "…", "part": "h1", "set": { "size": "xl" }, "min": { "pad": 2 }, "readable": true, "changed": true }]
//            set 要完全一樣、min 是數字至少多少、readable 看得清楚(true)或看不清楚(false)、changed 和一開始不一樣;寫了的條件都要成立
//   ordered  true 時任務一關一關來(過關遊戲):只檢查目前這一關,畫面只顯示目前這一關(排法任務附一張目標小圖)
//
// 動作:
//   { "pick": "h1" }                         選好要換衣服的那一塊:虛線框起來、上面標名字;"pick": false 取消;加 "tap": true 用虛擬滑鼠點那一塊
//   { "wear": "h1", "color": "red" }         幫那一塊換上新的樣子(可以一次寫好幾個欄位);顏色、大小、留白慢慢變過去,排法改變時東西滑到新位置。
//                                            加 "tap": true 用虛擬滑鼠點衣櫃裡對應的工具(第一個欄位的那個值,衣櫃裡要有這個工具)
//   { "outfit": { "card": { "bg": "sky" }, "h1": { … } }, "name": "海洋風" }
//                                            一次換一整套衣服(沒寫的部位保持原樣);name 顯示在名片左上角
//   { "reset": true }                        脫掉換過的衣服,變回一開始的樣子(props 的 look)
//   { "boxes": true }                        戴上(false 拿下)盒子眼鏡:每一塊都看得到盒子,綠色是裡面留白、橘色是外面留白;選好的那一塊標出名字
//   { "note": "把標題的文字顏色換成紅色" }   名片下方出現一句「我說：…」;"note": false 收起來
//
// 狀態(給子腳本的 until):achieved(完成的任務 id)、tried(試過的不同工具,"h1:color:red" 這樣的字串)、changes(換了幾次)
// 目標:window、page(網頁)、panel(衣櫃)、goals(任務)、meter、note、part:<部位>、row:<部位>:<欄位>、tool:<部位>:<欄位>:<值>、mini:<第幾張,從 0 開始>
import { kit } from '../../kit'
import { defineActor, type CommonStepFields, type Hotspot } from '../../types'
import './actor.css'

type WearKind = 'pick' | 'wear' | 'outfit' | 'reset' | 'boxes' | 'note'
type PartId = 'card' | 'h1' | 'img' | 'p' | 'button' | 'cards'
type Prop = 'color' | 'bg' | 'size' | 'bold' | 'border' | 'pad' | 'margin' | 'dir' | 'align'
type Size = 's' | 'm' | 'l' | 'xl'
type Level = 0 | 1 | 2 | 3
type Style = {
  color?: string
  bg?: string
  size?: Size
  bold?: boolean
  border?: Level
  pad?: Level
  margin?: Level
  dir?: 'column' | 'row'
  align?: 'start' | 'center' | 'end'
}
type Look = Partial<Record<PartId, Style>>
type WearStep = CommonStepFields &
  Style & {
    pick?: PartId | false
    wear?: PartId
    outfit?: Look
    name?: string
    reset?: boolean
    boxes?: boolean
    note?: string | false
    tap?: boolean
  }
interface Goal {
  id: string
  label: string
  part: PartId
  set?: Style
  min?: Partial<Record<'border' | 'pad' | 'margin', number>>
  readable?: boolean
  changed?: boolean
}
interface Tool {
  part: PartId
  prop: Prop
  label?: string
  values?: (string | number | boolean)[]
}
interface WearProps {
  title?: string
  parts?: { id: PartId; text?: string }[]
  cards?: { icon: string; name: string }[]
  look?: Look
  tools?: Tool[]
  meter?: PartId
  goals?: Goal[]
  ordered?: boolean
}
interface WearState {
  look: Record<string, Style>
  start: Record<string, Style>
  sel: PartId | null
  boxes: boolean
  note: string | null
  outfit: string | null
  achieved: string[]
  tried: string[]
  changes: number
  goals: Goal[]
  ordered: boolean
  meter: PartId | null
}
type WearTarget = 'window' | 'page' | 'panel' | 'goals' | 'meter' | 'note' | `part:${string}` | `row:${string}` | `tool:${string}` | `mini:${string}`

const KINDS: readonly WearKind[] = ['pick', 'wear', 'outfit', 'reset', 'boxes', 'note']
const PROPS: readonly Prop[] = ['color', 'bg', 'size', 'bold', 'border', 'pad', 'margin', 'dir', 'align']
const PART_IDS: readonly PartId[] = ['card', 'h1', 'img', 'p', 'button', 'cards']
const CONTAINERS: readonly PartId[] = ['card', 'cards']

const PART_NAME: Record<PartId, string> = { card: '名片', h1: '標題', img: '圖片', p: '段落', button: '按鈕', cards: '卡片' }
const PROP_NAME: Record<Prop, string> = {
  color: '文字顏色',
  bg: '背景顏色',
  size: '字的大小',
  bold: '粗細',
  border: '邊框',
  pad: '裡面留白',
  margin: '外面留白',
  dir: '排法',
  align: '對齊',
}

/** 色盤:名字 → [中文, 色碼] */
const COLORS: Record<string, [string, string]> = {
  black: ['黑色', '#2b2620'],
  white: ['白色', '#ffffff'],
  navy: ['深藍色', '#1f3a68'],
  blue: ['藍色', '#2f7fd8'],
  red: ['紅色', '#e0453a'],
  orange: ['橘色', '#f39a2b'],
  yellow: ['黃色', '#f7d33c'],
  green: ['綠色', '#2f9e4f'],
  purple: ['紫色', '#7e4fd0'],
  pink: ['粉紅色', '#ff9fb7'],
  cream: ['米色', '#fff4dc'],
  lemon: ['淺黃色', '#fff3a6'],
  sky: ['淺藍色', '#cfe8ff'],
  mint: ['淺綠色', '#d5f2dc'],
  peach: ['淺橘色', '#ffe3b3'],
}
const NONE = 'none'
const SIZES: readonly Size[] = ['s', 'm', 'l', 'xl']
const SIZE_NAME: Record<Size, string> = { s: '小', m: '中', l: '大', xl: '特大' }
const TEXT_PX: Record<Size, number> = { s: 24, m: 34, l: 54, xl: 80 }
const IMG_PX: Record<Size, number> = { s: 56, m: 90, l: 130, xl: 180 }
const BORDER_PX = [0, 3, 6, 12]
const PAD_PX = [0, 12, 28, 52]
const MARGIN_PX = [0, 12, 28, 52]
const LEVEL_NAME: Record<'border' | 'pad' | 'margin', string[]> = {
  border: ['沒有', '細', '中', '粗'],
  pad: ['沒有', '一點點', '中等', '很多'],
  margin: ['沒有', '一點點', '中等', '很多'],
}
const DIR_NAME = { column: '上下排', row: '並排' } as const
const ALIGN_NAME = { start: '靠左', center: '置中', end: '靠右' } as const

const DEFAULT_LOOK: Record<PartId, Style> = {
  card: { color: 'black', bg: 'cream', border: 2, pad: 2, margin: 0, dir: 'column', align: 'center' },
  h1: { color: 'black', bg: NONE, size: 'l', bold: true, border: 0, pad: 1, margin: 0 },
  img: { bg: 'peach', size: 'l', border: 2, pad: 1, margin: 0 },
  p: { color: 'black', bg: NONE, size: 'm', bold: false, border: 0, pad: 1, margin: 0 },
  button: { color: 'black', bg: 'pink', size: 'm', bold: true, border: 2, pad: 2, margin: 0 },
  cards: { bg: NONE, border: 0, pad: 0, margin: 0, dir: 'column', align: 'start' },
}
const DEFAULT_PARTS: { id: PartId; text?: string }[] = [
  { id: 'h1', text: '小花' },
  { id: 'img', text: '🐱' },
  { id: 'p', text: '我是一隻愛睡午覺的橘貓。' },
  { id: 'button', text: '摸摸我' },
]
const DEFAULT_CARDS = [
  { icon: '🐱', name: '小花' },
  { icon: '🐶', name: '阿福' },
  { icon: '🐰', name: '咪咪' },
]

const isPart = (x: unknown): x is PartId => typeof x === 'string' && (PART_IDS as readonly string[]).includes(x)

/** 一個欄位可以用的值 */
function valuesOf(prop: Prop): (string | number | boolean)[] {
  if (prop === 'color') return Object.keys(COLORS)
  if (prop === 'bg') return [...Object.keys(COLORS), NONE]
  if (prop === 'size') return [...SIZES]
  if (prop === 'bold') return [false, true]
  if (prop === 'dir') return ['column', 'row']
  if (prop === 'align') return ['start', 'center', 'end']
  return [0, 1, 2, 3]
}
function checkValue(prop: Prop, v: unknown, where: string) {
  if (!valuesOf(prop).includes(v as never)) throw new Error(`${where}:${prop} 不能是「${String(v)}」,可以用 ${valuesOf(prop).join('、')}`)
}
function checkStyle(st: Style, where: string, part: PartId) {
  for (const k of Object.keys(st)) {
    if (!(PROPS as readonly string[]).includes(k)) throw new Error(`${where}:不認得的樣子「${k}」`)
    const prop = k as Prop
    if ((prop === 'dir' || prop === 'align') && !CONTAINERS.includes(part)) throw new Error(`${where}:${PART_NAME[part]}不能改排法或對齊(只有 card、cards 可以)`)
    checkValue(prop, (st as Record<string, unknown>)[k], where)
  }
}
/** 步驟裡寫的樣子欄位 */
function styleOfStep(s: WearStep): Style {
  const out: Record<string, unknown> = {}
  for (const k of PROPS) if (k in s && (s as Record<string, unknown>)[k] !== undefined) out[k] = (s as Record<string, unknown>)[k]
  return out as Style
}

function valueName(prop: Prop, v: unknown): string {
  if (prop === 'color' || prop === 'bg') return v === NONE ? '透明' : (COLORS[v as string]?.[0] ?? String(v))
  if (prop === 'size') return SIZE_NAME[v as Size]
  if (prop === 'bold') return v ? '粗體' : '一般'
  if (prop === 'dir') return DIR_NAME[v as 'row']
  if (prop === 'align') return ALIGN_NAME[v as 'start']
  return LEVEL_NAME[prop as 'pad'][v as number]
}
/** 換了一個樣子要念的話 */
function sayChange(part: PartId, prop: Prop, v: unknown): string {
  const P = PART_NAME[part]
  if (prop === 'color') return `${P}的文字顏色換成${valueName(prop, v)}。`
  if (prop === 'bg') return v === NONE ? `${P}的背景顏色拿掉了。` : `${P}的背景顏色換成${valueName(prop, v)}。`
  if (prop === 'size') return `${P}的字的大小換成${valueName(prop, v)}。`
  if (prop === 'bold') return v ? `${P}的字變成粗體。` : `${P}的字變回一般粗細。`
  if (prop === 'border') return v === 0 ? `${P}的邊框拿掉了。` : `${P}的邊框換成${valueName(prop, v)}的。`
  if (prop === 'pad' || prop === 'margin') return `${P}的${PROP_NAME[prop]}換成${valueName(prop, v)}。`
  if (prop === 'dir') return `${P}改成${valueName(prop, v)}。`
  return `${P}改成${valueName(prop, v)}。`
}

// ── 看得清不清楚:WCAG 對比 ──
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
/** 這一塊背後真正看到的背景顏色(自己透明就看名片的) */
function backOf(look: Record<string, Style>, part: PartId): string {
  const own = look[part]?.bg
  if (own && own !== NONE) return own
  const card = look.card?.bg
  return card && card !== NONE ? card : 'white'
}
function readable(look: Record<string, Style>, part: PartId): boolean {
  const fg = COLORS[look[part]?.color ?? 'black']?.[1] ?? '#2b2620'
  const bg = COLORS[backOf(look, part)]?.[1] ?? '#ffffff'
  return contrast(fg, bg) >= 3
}

function goalMet(st: WearState, g: Goal): boolean {
  const cur = st.look[g.part]
  if (!cur) return false
  if (g.set) for (const [k, v] of Object.entries(g.set)) if ((cur as Record<string, unknown>)[k] !== v) return false
  if (g.min) for (const [k, v] of Object.entries(g.min)) if (((cur as Record<string, unknown>)[k] as number) < (v as number)) return false
  if (g.readable !== undefined && readable(st.look, g.part) !== g.readable) return false
  if (g.changed && JSON.stringify(cur) === JSON.stringify(st.start[g.part])) return false
  return true
}
/** 換完樣子之後檢查任務:一關一關來時只看目前這一關 */
function score(st: WearState): WearState {
  const open = st.goals.filter((g) => !st.achieved.includes(g.id))
  const check = st.ordered ? open.slice(0, 1) : open
  const fresh = check.filter((g) => goalMet(st, g)).map((g) => g.id)
  return fresh.length ? { ...st, achieved: [...st.achieved, ...fresh] } : st
}

const clone = (look: Record<string, Style>): Record<string, Style> => Object.fromEntries(Object.entries(look).map(([k, v]) => [k, { ...v }]))
const firstProp = (s: WearStep): Prop | undefined => PROPS.find((k) => k in s && (s as Record<string, unknown>)[k] !== undefined)
const toolKey = (part: string, prop: string, v: unknown) => `${part}:${prop}:${String(v)}`

const PICK_MS = 800
const WEAR_MS = 1100
const OUTFIT_MS = 1700
const RESET_MS = 1300
const BOXES_MS = 900
const NOTE_MS = 700
/** 示範點擊:滑鼠 150ms 出發、移動 550ms,到了就點 */
const TAP_AT = 750

function partsOf(props: WearProps): { id: PartId; text?: string }[] {
  return props.parts ?? DEFAULT_PARTS
}

function toolHtml(t: Tool, label: string): string {
  const vals = t.values ?? valuesOf(t.prop)
  const opt = (v: unknown, inner: string, cls = '', style = '') => `<span class="lw-opt ${cls}" data-key="${kit.esc(toolKey(t.part, t.prop, v))}"${style ? ` style="${style}"` : ''}>${inner}</span>`
  let body = ''
  if (t.prop === 'color' || t.prop === 'bg') {
    body = `<div class="lw-swatches">${vals.map((v) => opt(v, `<i style="background:${v === NONE ? 'repeating-linear-gradient(45deg,#fff 0 8px,#e8e2d6 8px 16px)' : COLORS[v as string]?.[1]}"></i><em>${valueName(t.prop, v)}</em>`, 'lw-sw')).join('')}</div>`
  } else if (t.prop === 'size') {
    body = `<div class="lw-btns">${vals.map((v) => opt(v, `<b style="font-size:${[22, 30, 40, 52][SIZES.indexOf(v as Size)]}px">字</b><em>${SIZE_NAME[v as Size]}</em>`, 'lw-bt')).join('')}</div>`
  } else if (t.prop === 'bold') {
    body = `<div class="lw-btns">${vals.map((v) => opt(v, `<b style="font-weight:${v ? 900 : 400}">字</b><em>${v ? '粗體' : '一般'}</em>`, 'lw-bt')).join('')}</div>`
  } else if (t.prop === 'dir' || t.prop === 'align') {
    const icon = (v: unknown) => {
      const dir = t.prop === 'dir' ? (v as string) : 'column'
      const align = t.prop === 'align' ? (v as string) : 'start'
      return `<span class="lw-ico" style="flex-direction:${dir};${dir === 'row' ? 'justify-content' : 'align-items'}:${align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center'}"><i></i><i></i><i></i></span>`
    }
    body = `<div class="lw-btns">${vals.map((v) => opt(v, `${icon(v)}<em>${valueName(t.prop, v)}</em>`, 'lw-bt lw-lay')).join('')}</div>`
  } else {
    // 滑桿:四個刻度,點刻度移動把手
    body = `<div class="lw-slider"><span class="lw-track"></span><span class="lw-fill"></span>${vals.map((v, i) => opt(v, `<i></i><em>${valueName(t.prop, v)}</em>`, 'lw-notch', `left:${vals.length > 1 ? ((i / (vals.length - 1)) * 100).toFixed(3) : 0}%`)).join('')}<span class="lw-knob"></span></div>`
  }
  return `<div class="lw-row" data-row="${t.part}:${t.prop}"><p class="lw-row-label">${kit.esc(label)}</p>${body}</div>`
}

/** 排法任務的目標小圖 */
function miniGoal(set: Style | undefined): string {
  if (!set || (!set.dir && !set.align)) return ''
  const dir = set.dir ?? 'column'
  const a = set.align ?? 'start'
  const flex = a === 'start' ? 'flex-start' : a === 'end' ? 'flex-end' : 'center'
  return `<span class="lw-goal-pic" style="flex-direction:${dir};${dir === 'row' ? 'justify-content' : 'align-items'}:${flex}"><i></i><i></i><i></i></span>`
}

const actor = defineActor<WearKind, WearStep, WearProps, WearState, WearTarget>({
  name: 'lt9-wear',
  kinds: KINDS,

  hotspots(st, props) {
    // 衣櫃裡的每一個工具都可以點:點了換上那個樣子,念出改了哪一塊、改成什麼;完成任務或看不清楚時多說一句
    return (props.tools ?? []).flatMap((t) =>
      (t.values ?? valuesOf(t.prop)).map((v): Hotspot<WearStep> => {
        const step = { wear: t.part, [t.prop]: v } as WearStep
        let narration = sayChange(t.part, t.prop, v)
        try {
          const next = actor.apply!(st, 'wear', step)
          const fresh = next.achieved.filter((id) => !st.achieved.includes(id))
          if (st.meter && (t.prop === 'color' || t.prop === 'bg')) {
            const was = readable(st.look, st.meter)
            const now = readable(next.look, st.meter)
            if (!now) narration += '哎呀，字和背景太像了，看不清楚！'
            else if (!was) narration += '看得清楚了！'
          }
          for (const id of fresh) {
            const g = st.goals.find((x) => x.id === id)
            if (g) narration += `任務完成：${g.label}！`
          }
        } catch {
          // 不合法的工具:照樣交給舞台,載入時會顯示錯誤
        }
        return { target: `tool:${toolKey(t.part, t.prop, v)}`, label: `${t.label ?? `${PART_NAME[t.part]}的${PROP_NAME[t.prop]}`}:${valueName(t.prop, v)}`, step: { ...step, narration } }
      }),
    )
  },

  init(props) {
    const parts = partsOf(props)
    const ids = new Set<PartId>(['card'])
    for (const p of parts) {
      if (!isPart(p.id) || p.id === 'card') throw new Error(`parts:不認得的部位「${String(p.id)}」,可以用 h1、img、p、button、cards`)
      if (ids.has(p.id)) throw new Error(`parts:${p.id} 只能有一個`)
      ids.add(p.id)
    }
    const look: Record<string, Style> = {}
    for (const id of ids) {
      const extra = props.look?.[id] ?? {}
      checkStyle(extra, `look.${id}`, id)
      look[id] = { ...DEFAULT_LOOK[id], ...extra }
    }
    for (const k of Object.keys(props.look ?? {})) if (!ids.has(k as PartId)) throw new Error(`look:名片上沒有「${k}」`)
    for (const t of props.tools ?? []) {
      if (!ids.has(t.part)) throw new Error(`tools:名片上沒有「${t.part}」`)
      if (!PROPS.includes(t.prop)) throw new Error(`tools:不認得的欄位「${t.prop}」`)
      if ((t.prop === 'dir' || t.prop === 'align') && !CONTAINERS.includes(t.part)) throw new Error(`tools:${t.part} 不能改排法或對齊`)
      for (const v of t.values ?? []) checkValue(t.prop, v, `tools ${t.part}:${t.prop}`)
    }
    const goals = props.goals ?? []
    for (const g of goals) {
      if (!g.id || !g.label) throw new Error('goals:每個任務要有 id 和 label')
      if (!ids.has(g.part)) throw new Error(`goals ${g.id}:名片上沒有「${g.part}」`)
      if (g.set) checkStyle(g.set, `goals ${g.id}`, g.part)
    }
    if (props.meter !== undefined && !ids.has(props.meter)) throw new Error(`meter:名片上沒有「${props.meter}」`)
    return {
      look,
      start: clone(look),
      sel: null,
      boxes: false,
      note: null,
      outfit: null,
      achieved: [],
      tried: [],
      changes: 0,
      goals,
      ordered: !!props.ordered,
      meter: props.meter ?? null,
    }
  },

  apply(st, kind, s) {
    if (kind === 'pick') {
      if (s.pick === false) return { ...st, sel: null }
      if (!isPart(s.pick) || !st.look[s.pick]) throw new Error(`pick:名片上沒有「${String(s.pick)}」`)
      return { ...st, sel: s.pick }
    }
    if (kind === 'boxes') return { ...st, boxes: s.boxes !== false }
    if (kind === 'note') {
      if (s.note !== false && (typeof s.note !== 'string' || !s.note)) throw new Error('note 要寫一句話,或 false 收起來')
      return { ...st, note: s.note === false ? null : s.note }
    }
    if (kind === 'reset') return { ...st, look: clone(st.start), outfit: null, changes: st.changes + 1 }
    if (kind === 'outfit') {
      if (!s.outfit || typeof s.outfit !== 'object') throw new Error('outfit 要寫每一塊的樣子,例如 { "card": { "bg": "sky" } }')
      const look = clone(st.look)
      for (const [k, v] of Object.entries(s.outfit)) {
        if (!isPart(k) || !look[k]) throw new Error(`outfit:名片上沒有「${k}」`)
        checkStyle(v ?? {}, `outfit.${k}`, k)
        look[k] = { ...look[k], ...v }
      }
      return score({ ...st, look, outfit: s.name ?? null, changes: st.changes + 1 })
    }
    // wear
    if (!isPart(s.wear) || !st.look[s.wear]) throw new Error(`wear:名片上沒有「${String(s.wear)}」`)
    const style = styleOfStep(s)
    if (!Object.keys(style).length) throw new Error('wear 要寫換成什麼樣子,例如 { "wear": "h1", "color": "red" }')
    checkStyle(style, 'wear', s.wear)
    const look = clone(st.look)
    look[s.wear] = { ...look[s.wear], ...style }
    // 試過的工具:只算真的換了樣子的(點到原本就是這個值的不算)
    const was = st.look[s.wear] as Record<string, unknown>
    const keys = Object.entries(style).filter(([k, v]) => was[k] !== v).map(([k, v]) => toolKey(s.wear!, k, v))
    const tried = [...st.tried, ...keys.filter((k) => !st.tried.includes(k))]
    return score({ ...st, look, tried, changes: st.changes + 1 })
  },

  duration(kind, step) {
    const tap = step.tap ? TAP_AT : 0
    if (kind === 'pick') return tap + PICK_MS
    if (kind === 'wear') return tap + WEAR_MS
    if (kind === 'outfit') return OUTFIT_MS
    if (kind === 'reset') return RESET_MS
    if (kind === 'boxes') return BOXES_MS
    return NOTE_MS
  },

  cursor(kind, step) {
    if (!step.tap) return null
    if (kind === 'pick' && isPart(step.pick)) return { moves: [{ at: 150, target: `part:${step.pick}` }], clickAt: TAP_AT }
    if (kind === 'wear' && isPart(step.wear)) {
      const prop = firstProp(step)
      if (prop) return { moves: [{ at: 150, target: `tool:${toolKey(step.wear, prop, (step as Record<string, unknown>)[prop])}` }], clickAt: TAP_AT }
    }
    return null
  },

  mount(root, props) {
    const parts = partsOf(props)
    const cards = props.cards ?? DEFAULT_CARDS
    const tools = props.tools ?? []
    const goals = props.goals ?? []
    root.classList.add('A-lt9-wear')
    const partHtml = (p: { id: PartId; text?: string }) => {
      const t = kit.esc(p.text ?? '')
      let inner = ''
      if (p.id === 'cards') inner = cards.map((c, i) => `<span class="lw-mini" data-i="${i}"><b>${kit.esc(c.icon)}</b><em>${kit.esc(c.name)}</em></span>`).join('')
      else inner = t
      return `<div class="lw-m" data-part="${p.id}"><div class="lw-b"><div class="lw-c">${inner}</div></div><span class="lw-tag">${PART_NAME[p.id]}</span><span class="lw-lab lw-lab-m">外面留白</span><span class="lw-lab lw-lab-p">裡面留白</span></div>`
    }
    root.innerHTML = `
      <div class="lw-scene">
        <div class="lw-pane lw-page-pane">
          <div class="lw-bar"><span class="lw-lights"><i></i><i></i><i></i></span><span class="lw-url">${kit.esc(props.title ?? '我的寵物名片')}</span></div>
          <div class="lw-page">
            <div class="lw-m" data-part="card"><div class="lw-b"><div class="lw-c">${parts.map(partHtml).join('')}</div></div><span class="lw-tag">${PART_NAME.card}</span><span class="lw-lab lw-lab-m">外面留白</span><span class="lw-lab lw-lab-p">裡面留白</span></div>
          </div>
          <span class="lw-badge"></span>
          <span class="lw-meter"></span>
          <p class="lw-note"></p>
        </div>
        <div class="lw-pane lw-panel">
          <p class="lw-panel-title">👗 衣櫃</p>
          ${tools.map((t) => toolHtml(t, t.label ?? `${PART_NAME[t.part]}的${PROP_NAME[t.prop]}`)).join('')}
          <div class="lw-goals"></div>
        </div>
      </div>`
    const scene = root.querySelector<HTMLElement>('.lw-scene')!
    const pagePane = root.querySelector<HTMLElement>('.lw-page-pane')!
    const panel = root.querySelector<HTMLElement>('.lw-panel')!
    const badge = root.querySelector<HTMLElement>('.lw-badge')!
    const meter = root.querySelector<HTMLElement>('.lw-meter')!
    const note = root.querySelector<HTMLElement>('.lw-note')!
    const goalBox = root.querySelector<HTMLElement>('.lw-goals')!
    if (!tools.length) panel.classList.add('lw-empty')
    const isTall = kit.tallWatch(root)
    const ids: PartId[] = ['card', ...parts.map((p) => p.id)]
    const els = new Map(
      ids.map((id) => {
        const m = root.querySelector<HTMLElement>(`.lw-m[data-part="${id}"]`)!
        return [id, { m, b: m.querySelector<HTMLElement>(':scope > .lw-b')!, c: m.querySelector<HTMLElement>(':scope > .lw-b > .lw-c')!, tag: m.querySelector<HTMLElement>(':scope > .lw-tag')!, labM: m.querySelector<HTMLElement>(':scope > .lw-lab-m')!, labP: m.querySelector<HTMLElement>(':scope > .lw-lab-p')! }]
      }),
    )
    const minis = [...root.querySelectorAll<HTMLElement>('.lw-mini')]
    const opts = new Map([...root.querySelectorAll<HTMLElement>('.lw-opt')].map((el) => [el.dataset.key!, el]))
    const rows = new Map([...root.querySelectorAll<HTMLElement>('.lw-row')].map((el) => [el.dataset.row!, el]))

    const hex = (name: string | undefined, fallback: string) => (name && name !== NONE ? (COLORS[name]?.[1] ?? fallback) : 'transparent')
    const mix = (a: string, b: string, p: number) => (p <= 0 ? a : p >= 1 ? b : `color-mix(in srgb, ${b} ${(p * 100).toFixed(1)}%, ${a})`)
    const flexOf = (a: string | undefined) => (a === 'end' ? 'flex-end' : a === 'center' ? 'center' : 'flex-start')
    const setLayout = (c: HTMLElement, s: Style) => {
      const dir = s.dir ?? 'column'
      c.style.flexDirection = dir
      c.style.alignItems = dir === 'row' ? 'center' : flexOf(s.align)
      c.style.justifyContent = dir === 'row' ? flexOf(s.align) : 'flex-start'
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as WearKind) ? view.ev : null
        const from = view.prev
        const to = view.ev?.kind === 'hide' ? view.prev : view.state
        const step = ev ? (ev.step as WearStep) : null
        const start = step?.tap ? TAP_AT : 0
        const p = ev ? kit.ease.inOutCubic(kit.progress(ev.local, start, ev.dur - start)) : 1
        root.dataset.tall = isTall() ? '1' : '0'

        // 盒子眼鏡
        const bp = ev?.kind === 'boxes' ? p : 1
        const boxes = kit.lerp(from.boxes ? 1 : 0, to.boxes ? 1 : 0, bp)
        scene.style.setProperty('--bx', boxes.toFixed(3))

        // 每一塊的樣子:數字內插、顏色混合
        const looksChange = ev && (ev.kind === 'wear' || ev.kind === 'outfit' || ev.kind === 'reset')
        const lp = looksChange ? p : 1
        for (const id of ids) {
          const e = els.get(id)!
          const a = from.look[id] ?? to.look[id]
          const b = to.look[id]
          const fg = mix(hex(a.color, '#2b2620'), hex(b.color, '#2b2620'), lp)
          const bgA = hex(a.bg, '#fff')
          const bgB = hex(b.bg, '#fff')
          const bg = mix(bgA, bgB, lp)
          const px = (tbl: number[], k: 'border' | 'pad' | 'margin') => kit.lerp(tbl[a[k] ?? 0], tbl[b[k] ?? 0], lp)
          const sizeTbl = id === 'img' ? IMG_PX : TEXT_PX
          const size = kit.lerp(sizeTbl[a.size ?? 'm'], sizeTbl[b.size ?? 'm'], lp)
          const weight = kit.lerp(a.bold ? 900 : 400, b.bold ? 900 : 400, lp)
          kit.css(e.m, {
            padding: `${px(MARGIN_PX, 'margin').toFixed(1)}px`,
            background: `color-mix(in srgb, #ffb36b ${(boxes * 70).toFixed(1)}%, transparent)`,
          })
          kit.css(e.b, {
            borderWidth: `${px(BORDER_PX, 'border').toFixed(1)}px`,
            padding: `${px(PAD_PX, 'pad').toFixed(1)}px`,
            background: boxes > 0 ? `color-mix(in srgb, #7dd88f ${(boxes * 75).toFixed(1)}%, ${bg === 'transparent' ? '#ffffff' : bg})` : bg,
          })
          kit.css(e.c, {
            color: fg,
            background: boxes > 0 ? `color-mix(in srgb, ${bg === 'transparent' ? '#ffffff' : bg} ${(boxes * 100).toFixed(1)}%, transparent)` : 'transparent',
          })
          if (id !== 'card' && id !== 'cards') kit.css(e.c, { fontSize: `${size.toFixed(1)}px`, fontWeight: `${Math.round(weight / 100) * 100}` })
          if (CONTAINERS.includes(id)) setLayout(e.c, b)
          // 選好的那一塊:虛線框、名字
          const selA = from.sel === id ? 1 : 0
          const selB = to.sel === id ? 1 : 0
          const sel = kit.lerp(selA, selB, ev?.kind === 'pick' ? p : 1)
          e.m.style.setProperty('--sel', sel.toFixed(3))
          e.labM.style.opacity = (sel * boxes).toFixed(3)
          e.labP.style.opacity = (sel * boxes).toFixed(3)
        }

        // 排法改變:東西從舊位置滑到新位置(先量新舊兩種排法的位置,再用 translate 補差)
        for (const id of CONTAINERS) {
          const e = els.get(id)
          if (!e) continue
          const kids = id === 'cards' ? minis : [...e.c.children].filter((x): x is HTMLElement => x instanceof HTMLElement)
          const a = from.look[id]
          const b = to.look[id]
          const moving = looksChange && lp < 1 && a && b && (a.dir !== b.dir || a.align !== b.align)
          if (!moving) {
            for (const k of kids) k.style.translate = ''
            continue
          }
          for (const k of kids) k.style.translate = ''
          setLayout(e.c, a)
          const old = kids.map((k) => [k.offsetLeft, k.offsetTop])
          setLayout(e.c, b)
          kids.forEach((k, i) => {
            const dx = (old[i][0] - k.offsetLeft) * (1 - lp)
            const dy = (old[i][1] - k.offsetTop) * (1 - lp)
            k.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`
          })
        }

        // 衣櫃:目前的值亮起來;正在換的那個工具跳一下;滑桿把手滑過去
        const shown = lp < 0.5 ? from : to
        for (const t of tools) {
          const a = (from.look[t.part] as Record<string, unknown>)[t.prop]
          const b = (to.look[t.part] as Record<string, unknown>)[t.prop]
          const cur = (shown.look[t.part] as Record<string, unknown>)[t.prop]
          const vals = t.values ?? valuesOf(t.prop)
          for (const v of vals) {
            const el = opts.get(toolKey(t.part, t.prop, v))
            if (!el) continue
            el.dataset.on = cur === v ? '1' : '0'
            const bump = looksChange && b === v && a !== v ? Math.sin(lp * Math.PI) * 0.18 : 0
            el.style.scale = (1 + bump).toFixed(3)
          }
          if (t.prop === 'border' || t.prop === 'pad' || t.prop === 'margin') {
            const row = rows.get(`${t.part}:${t.prop}`)
            const ia = vals.indexOf(a as never)
            const ib = vals.indexOf(b as never)
            const pos = vals.length > 1 ? kit.lerp(Math.max(ia, 0), Math.max(ib, 0), lp) / (vals.length - 1) : 0
            row?.style.setProperty('--k', pos.toFixed(4))
          }
        }

        // 一整套衣服的名字
        const oName = (ev?.kind === 'outfit' || ev?.kind === 'reset') && p < 0.5 ? from.outfit : to.outfit
        kit.setIf(badge, 'text', oName ? `👕 ${oName}` : '')
        badge.style.opacity = oName ? '1' : '0'

        // 看得清不清楚
        if (to.meter) {
          const ok = readable(shown.look, to.meter)
          kit.setIf(meter, 'html', ok ? '👀 看得清楚' : '😵 看不清楚')
          meter.dataset.ok = ok ? '1' : '0'
        } else meter.style.display = 'none'

        // 我說:一句話
        const np = ev?.kind === 'note' ? p : 1
        const nText = ev?.kind === 'note' && !to.note ? from.note : to.note
        kit.setIf(note, 'text', nText ? `💬 我說：${nText}` : '')
        const nOn = kit.lerp(from.note ? 1 : 0, to.note ? 1 : 0, np)
        kit.css(note, { opacity: nOn.toFixed(3), transform: `translateY(${((1 - nOn) * 30).toFixed(1)}px)` })

        // 任務
        if (goals.length) {
          const done = to.achieved
          const fresh = ev && done.length > from.achieved.length ? Math.sin(Math.min(1, ev.p * 1.2) * Math.PI) : 0
          let html = ''
          if (to.ordered) {
            const next = goals.find((g) => !done.includes(g.id))
            const dots = goals.map((g) => `<i data-on="${done.includes(g.id) ? 1 : 0}"></i>`).join('')
            html = next
              ? `<p class="lw-goal-head">🏁 第 ${goals.indexOf(next) + 1} / ${goals.length} 關</p><div class="lw-level">${miniGoal(next.set)}<span>${kit.esc(next.label)}</span></div><p class="lw-dots">${dots}</p>`
              : `<p class="lw-goal-head">🎉 全部過關！</p><p class="lw-dots">${dots}</p>`
          } else {
            html = `<p class="lw-goal-head">任務</p>${goals.map((g) => `<p class="lw-goal" data-on="${done.includes(g.id) ? 1 : 0}">${done.includes(g.id) ? '⭐' : '☆'} ${kit.esc(g.label)}</p>`).join('')}`
          }
          kit.setIf(goalBox, 'html', html)
          goalBox.style.setProperty('--pop', fresh.toFixed(3))
        } else goalBox.style.display = 'none'
      },

      target(name) {
        if (name === 'window') return root
        if (name === 'page') return pagePane
        if (name === 'panel') return panel
        if (name === 'goals') return goalBox
        if (name === 'meter') return meter
        if (name === 'note') return note
        const m = /^(part|row|tool|mini):(.+)$/.exec(name)
        if (!m) return null
        if (m[1] === 'part') return isPart(m[2]) ? (els.get(m[2])?.m ?? null) : null
        if (m[1] === 'row') return rows.get(m[2]) ?? null
        if (m[1] === 'tool') return opts.get(m[2]) ?? null
        return minis[Number(m[2])] ?? null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
