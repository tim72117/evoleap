// 演員 lt10-magic:兒童網頁課單元 3「JavaScript:讓網頁動起來」的機關積木(魔法積木)。
// 左邊是一頁卡通網頁(按鈕、會出現和藏起來的東西、貼著名字的數字盒子、骰子),右邊是「魔法積木」:
// 每一列說好「什麼時候」(點了哪個按鈕,或「如果盒子的數字是幾」)「就做什麼」(說一句話、顯示、隱藏、加數字、擲骰子、放煙火、換背景)。
// 下方的積木盒放著可以拿來用的積木,孩子把積木放進列裡的格子(snap),再按網頁上的按鈕(press)看結果。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
// 兒童版播放器(web/src/kids/KidsPlayer.tsx)播放;子腳本的 until 可以看下面列的狀態欄位。
//
// props(登場設定):
//   title    網頁標題(必要);emoji 標題前的圖案
//   note     標題下的一段文字(例如謎語的題目)
//   buttons  網頁上的按鈕:[{ "id": "hi", "text": "打招呼" }](必要,至少一個)
//   things   會出現和藏起來的東西:[{ "id": "answer", "name": "答案", "text": "長頸鹿 🦒", "shown": false }]
//            name 是積木上叫它的名字;shown 一開始有沒有顯示(預設 true)
//   box      貼著名字的數字盒子:{ "name": "跳了幾下", "value": 0 }
//   dice     骰子:{ "value": 1 }(一開始朝上的數字)
//   rules    一開始就有的魔法積木(一列一列):
//            { "id": "hi", "when": "hi", "do": [{ "say": "你好！" }] }            點了按鈕 hi 就做 do
//            { "id": "boom", "when": "box", "if": { "is": 10 }, "do": [{ "fireworks": true }] }
//                                                                                 盒子的數字變成 10 時就做 do(do 裡不能放 add)
//            do 可以是空陣列 [],畫成一個等著放積木的空格子。
//            do 裡的積木:{ "say": "你好！" }、{ "show": "<thing id>" }、{ "hide": "<thing id>" }、{ "toggle": "<thing id>" }(藏著就顯示,顯示就藏起來)、
//                        { "add": 1 }(負數是減)、{ "roll": [1, 6] }(擲出這個範圍的數字)、{ "fireworks": true }、
//                        { "paint": "粉紅" }(背景顏色:粉紅、黃色、藍色、綠色)
//   drawer   積木盒裡的積木:[{ "id": "show", "do": { "show": "answer" } }]
//
// 動作(依序操作;順序不對時載入就報錯並指出第幾步):
//   { "press": "hi" }                    按網頁上的按鈕:照魔法積木一塊一塊做;盒子的數字變了,再看「如果」那幾列。
//                                        沒有積木說好要做什麼時,畫面寫「什麼事都沒發生」。加 "tap": true 先用虛擬滑鼠點按鈕
//   { "snap": "show", "into": "card" }   把積木盒裡的積木放進某一列的格子(換掉格子裡原本的積木);加 "tap": true 先點積木盒裡的那塊
//   { "edit": "hi", "say": "早安" }      改某一列積木上的值:say、add、roll([最小, 最大])、paint 改「就做什麼」裡那一塊的值,
//                                        is 改「如果」的數字;一次改一個。加 "tap": true 先點那一列的格子
//   { "fill": 10 }                       把盒子裡的數字換成 10(重新整理後也從這個數字開始);加 "tap": true 先點盒子
//   { "reload": true }                   按重新整理:網頁回到一開始的樣子(盒子回到起始數字、東西照一開始顯示或藏起來、背景和泡泡清掉),
//                                        魔法積木不變;加 "tap": true 先點重新整理鈕
//   { "guess": 4 }                       在骰子旁貼一張「我猜 4」;下一次擲骰子後顯示猜中了沒(要有 dice)
//   { "check": "when:hi", "answer": "when:hi" }  回答題目:孩子選了 check,正確答案是 answer(都是下面的目標名稱);
//                                        答對變綠,答錯變紅搖一搖。{ "check": false } 把顏色拿掉
//
// 骰子不是真的亂數:第幾次擲、範圍是多少,就固定擲出同一個數字(畫面是時間的純函式);和上一次擲出的數字不會一樣。
//
// 狀態可以給子腳本的 until 用:presses(按了幾次按鈕)、said(說過的不同的話)、value(盒子裡的數字)、
//   appeared(東西從藏著變成顯示的次數)、vanished(從顯示變成藏著的次數)、hits(「如果」成立的次數)、
//   rolls(擲出來的數字)、snapped(放過的不同積木)、edits(改了幾次值)。
//
// 目標:window、page(網頁)、code(魔法積木整塊)、drawer(積木盒)、title、note、button:<id>、thing:<id>、
//       box(盒子)、boxname(盒子上的名字)、num(盒子裡的數字)、dice、guess(猜的紙條)、bubble(說的話;沒說話時量不到)、
//       reload(重新整理鈕)、rule:<id>(一整列)、when:<id>(什麼時候)、do:<id>(就做什麼的格子)、if:<id>(「如果」的數字)、
//       block:<id>(積木盒裡的積木)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type MagicKind = 'press' | 'snap' | 'edit' | 'fill' | 'reload' | 'guess' | 'check'
type Paint = '粉紅' | '黃色' | '藍色' | '綠色'
export type Effect =
  | { say: string }
  | { show: string }
  | { hide: string }
  | { toggle: string }
  | { add: number }
  | { roll: [number, number] }
  | { fireworks: true }
  | { paint: Paint }
export interface Rule {
  id: string
  /** 按鈕 id,或 "box"(盒子的數字變了) */
  when: string
  if?: { is: number }
  do: Effect[]
}
interface Button {
  id: string
  text: string
}
interface Thing {
  id: string
  name: string
  text: string
  shown?: boolean
}
interface Block {
  id: string
  do: Effect
}
interface MagicProps {
  title: string
  emoji?: string
  note?: string
  buttons: Button[]
  things?: Thing[]
  box?: { name: string; value?: number }
  dice?: { value?: number }
  rules?: Rule[]
  drawer?: Block[]
}
type MagicStep = CommonStepFields & {
  press?: string
  snap?: string
  into?: string
  edit?: string
  say?: string
  add?: number
  roll?: [number, number]
  paint?: Paint
  is?: number
  fill?: number
  reload?: true
  guess?: number
  check?: string | false
  answer?: string
  tap?: boolean
}
export interface MagicState {
  buttons: Button[]
  things: Thing[]
  drawer: Block[]
  boxName: string | null
  hasDice: boolean
  rules: Rule[]
  shown: Record<string, boolean>
  value: number
  start: number
  dice: number | null
  dice0: number | null
  guess: number | null
  /** 猜了之後擲過骰子了(顯示猜中了沒) */
  guessed: boolean
  bubble: string | null
  paint: Paint | null
  party: boolean
  /** 最近一次按按鈕時,什麼事都沒發生 */
  quiet: boolean
  /** 最近一次按按鈕時動到的積木列 */
  fired: string[]
  presses: number
  said: string[]
  appeared: number
  vanished: number
  hits: number
  rolls: number[]
  snapped: string[]
  edits: number
  verdict: { target: string; right: boolean } | null
}

const KINDS: readonly MagicKind[] = ['press', 'snap', 'edit', 'fill', 'reload', 'guess', 'check']
const PAINTS: Record<Paint, string> = { 粉紅: '#ffd1dc', 黃色: '#fff1a8', 藍色: '#cfe6ff', 綠色: '#d6f2c9' }
const EDIT_KEYS = ['say', 'add', 'roll', 'paint', 'is'] as const

/** 示範點擊:滑鼠 150ms 出發、移動 550ms,到了就點(和 kid-web、kid-mail 一樣) */
const TAP_AT = 750
const PUSH_MS = 350
const QUIET_MS = 1000
const SNAP_MS = 1100
const EDIT_MS = 1300
const FILL_MS = 900
const RELOAD_MS = 1000
const GUESS_MS = 700
const CHECK_MS = 1200

const effectKey = (e: Effect): string => Object.keys(e)[0]
const effectMs = (e: Effect): number => {
  const k = effectKey(e)
  return k === 'say' ? 1000 : k === 'add' ? 1000 : k === 'roll' ? 1800 : k === 'fireworks' ? 2200 : 800
}

/** 第 k 次擲骰子(從 0 算)、範圍 min–max 擲出的數字:固定的,不是真的亂數 */
export function rollValue(k: number, min: number, max: number): number {
  const r = kit.rand(`lt10-dice-${k}-${min}-${max}`)()
  return min + Math.floor(r * (max - min + 1))
}

function checkEffect(e: Effect, st: Pick<MagicState, 'things' | 'boxName' | 'hasDice'>, where: string): void {
  if (!e || typeof e !== 'object' || Object.keys(e).length !== 1) throw new Error(`${where}:每一塊積木只能寫一件事,例如 { "say": "你好！" }`)
  const k = effectKey(e)
  const v = (e as Record<string, unknown>)[k]
  const thing = (id: unknown) => {
    if (!st.things.some((x) => x.id === id)) throw new Error(`${where}:things 裡沒有「${String(id)}」`)
  }
  if (k === 'say') {
    if (typeof v !== 'string' || !v) throw new Error(`${where}:say 要寫一句話`)
  } else if (k === 'show' || k === 'hide' || k === 'toggle') thing(v)
  else if (k === 'add') {
    if (typeof v !== 'number' || !Number.isInteger(v) || v === 0) throw new Error(`${where}:add 要寫不是 0 的整數`)
    if (!st.boxName) throw new Error(`${where}:add 要先有 box(盒子)`)
  } else if (k === 'roll') {
    if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => Number.isInteger(n)) || v[0] >= v[1]) throw new Error(`${where}:roll 要寫 [最小, 最大],例如 [1, 6]`)
    if (!st.hasDice) throw new Error(`${where}:roll 要先有 dice(骰子)`)
  } else if (k === 'fireworks') {
    if (v !== true) throw new Error(`${where}:fireworks 要寫 true`)
  } else if (k === 'paint') {
    if (!(typeof v === 'string' && v in PAINTS)) throw new Error(`${where}:paint 只能是 ${Object.keys(PAINTS).join('、')}`)
  } else throw new Error(`${where}:不認得的積木「${k}」`)
}

function checkRule(r: Rule, st: MagicState): void {
  const where = `rules「${r.id}」`
  if (!r.id) throw new Error('rules:每一列都要有 id')
  if (r.when === 'box') {
    if (!st.boxName) throw new Error(`${where}:when 是 box 要先有 box(盒子)`)
    if (!r.if || !Number.isInteger(r.if.is)) throw new Error(`${where}:when 是 box 時要寫 if: { "is": 數字 }`)
  } else if (!st.buttons.some((b) => b.id === r.when)) throw new Error(`${where}:when 要是按鈕的 id 或 "box"`)
  if (!Array.isArray(r.do)) throw new Error(`${where}:do 要是陣列`)
  r.do.forEach((e) => {
    checkEffect(e, st, where)
    if (r.when === 'box' && effectKey(e) === 'add') throw new Error(`${where}:「如果」的列不能放加減數字的積木`)
  })
}

/** 套用一塊積木(按按鈕時一塊一塊做) */
function applyEffect(st: MagicState, e: Effect): MagicState {
  if ('say' in e) return { ...st, bubble: e.say, said: st.said.includes(e.say) ? st.said : [...st.said, e.say] }
  if ('show' in e || 'hide' in e || 'toggle' in e) {
    const id = 'show' in e ? e.show : 'hide' in e ? e.hide : e.toggle
    const was = !!st.shown[id]
    const now = 'show' in e ? true : 'hide' in e ? false : !was
    return { ...st, shown: { ...st.shown, [id]: now }, appeared: st.appeared + (!was && now ? 1 : 0), vanished: st.vanished + (was && !now ? 1 : 0) }
  }
  if ('add' in e) return { ...st, value: st.value + e.add }
  if ('roll' in e) {
    const [lo, hi] = e.roll
    let n = rollValue(st.rolls.length, lo, hi)
    // 示範時連兩次一樣的數字會讓孩子以為壞了:和上一次一樣就往後挪一格(仍然是固定的結果)
    if (n === st.dice) n = lo + ((n - lo + 1) % (hi - lo + 1))
    return { ...st, dice: n, rolls: [...st.rolls, n], guessed: st.guess !== null }
  }
  if ('fireworks' in e) return { ...st, party: true }
  return { ...st, paint: e.paint }
}

/** 按下按鈕之前先清掉上一次的泡泡、煙火 */
const startPress = (st: MagicState): MagicState => ({ ...st, bubble: null, party: false, quiet: false, fired: [], verdict: null })

/** 按一個按鈕會做哪些積木(依序),以及做完的狀態 */
function pressPlan(st: MagicState, id: string): { fx: { rule: string; e: Effect }[]; next: MagicState } {
  let s = startPress(st)
  const fx: { rule: string; e: Effect }[] = []
  const before = s.value
  for (const r of s.rules.filter((x) => x.when === id))
    for (const e of r.do) {
      fx.push({ rule: r.id, e })
      s = applyEffect(s, e)
    }
  if (s.value !== before) {
    for (const r of s.rules.filter((x) => x.when === 'box' && x.if && x.if.is === s.value)) {
      if (!r.do.length) continue
      for (const e of r.do) {
        fx.push({ rule: r.id, e })
        s = applyEffect(s, e)
      }
      s = { ...s, hits: s.hits + 1 }
    }
  }
  const fired = [...new Set(fx.map((x) => x.rule))]
  return { fx, next: { ...s, presses: s.presses + 1, fired, quiet: fx.length === 0 } }
}

type SegKind = 'tap' | 'push' | 'fx' | 'quiet' | 'act'
type Seg = { kind: SegKind; ms: number; fx?: number }
function segments(kind: MagicKind, s: MagicStep, prev: MagicState | undefined): Seg[] {
  const tap: Seg[] = s.tap ? [{ kind: 'tap', ms: TAP_AT }] : []
  if (kind === 'press') {
    const fx = prev && typeof s.press === 'string' && prev.buttons.some((b) => b.id === s.press) ? pressPlan(prev, s.press).fx : []
    return [...tap, { kind: 'push', ms: PUSH_MS }, ...(fx.length ? fx.map((x, i) => ({ kind: 'fx' as const, ms: effectMs(x.e), fx: i })) : [{ kind: 'quiet' as const, ms: QUIET_MS }])]
  }
  const ms = kind === 'snap' ? SNAP_MS : kind === 'edit' ? EDIT_MS : kind === 'fill' ? FILL_MS : kind === 'reload' ? RELOAD_MS : kind === 'guess' ? GUESS_MS : CHECK_MS
  return [...tap, { kind: 'act', ms }]
}
function segAt(list: Seg[], local: number): (Seg & { local: number; p: number; i: number }) | null {
  let t = 0
  for (let i = 0; i < list.length; i++) {
    const x = list[i]
    if (local < t + x.ms) return { ...x, local: local - t, p: kit.clamp((local - t) / x.ms), i }
    t += x.ms
  }
  return null
}

const TARGET_RE = /^(window|page|code|drawer|title|note|box|boxname|num|dice|guess|bubble|reload|(button|thing|rule|when|do|if|block):.+)$/

const actor = defineActor<MagicKind, MagicStep, MagicProps, MagicState, string>({
  name: 'lt10-magic',
  kinds: KINDS,

  hotspots(st) {
    // 沒寫 interact.spots 時的預設:點網頁上的按鈕
    return st.buttons.map((b) => ({ target: `button:${b.id}`, label: b.text, step: { press: b.id } }))
  },

  init(props) {
    if (!props.title) throw new Error('title 要寫網頁標題')
    if (!Array.isArray(props.buttons) || !props.buttons.length) throw new Error('buttons 至少要有一個按鈕')
    const things = props.things ?? []
    const st: MagicState = {
      buttons: props.buttons,
      things,
      drawer: props.drawer ?? [],
      boxName: props.box?.name ?? null,
      hasDice: !!props.dice,
      rules: props.rules ?? [],
      shown: Object.fromEntries(things.map((x) => [x.id, x.shown !== false])),
      value: props.box?.value ?? 0,
      start: props.box?.value ?? 0,
      dice: props.dice ? (props.dice.value ?? 1) : null,
      dice0: props.dice ? (props.dice.value ?? 1) : null,
      guess: null,
      guessed: false,
      bubble: null,
      paint: null,
      party: false,
      quiet: false,
      fired: [],
      presses: 0,
      said: [],
      appeared: 0,
      vanished: 0,
      hits: 0,
      rolls: [],
      snapped: [],
      edits: 0,
      verdict: null,
    }
    const ids = new Set<string>()
    for (const b of st.buttons) {
      if (!b.id || !b.text) throw new Error('buttons:每個按鈕都要有 id 和 text')
      if (ids.has(`b:${b.id}`)) throw new Error(`buttons:id「${b.id}」重複了`)
      ids.add(`b:${b.id}`)
    }
    for (const t of things) if (!t.id || !t.name || !t.text) throw new Error('things:每一個都要有 id、name、text')
    for (const r of st.rules) {
      if (ids.has(`r:${r.id}`)) throw new Error(`rules:id「${r.id}」重複了`)
      ids.add(`r:${r.id}`)
      checkRule(r, st)
    }
    for (const b of st.drawer) {
      if (!b.id) throw new Error('drawer:每一塊積木都要有 id')
      checkEffect(b.do, st, `drawer「${b.id}」`)
    }
    return st
  },

  apply(st, kind, s) {
    if (kind === 'press') {
      if (!st.buttons.some((b) => b.id === s.press)) throw new Error(`press:網頁上沒有按鈕「${String(s.press)}」`)
      return pressPlan(st, s.press!).next
    }
    const clear = { verdict: null, quiet: false, fired: [] }
    if (kind === 'snap') {
      const block = st.drawer.find((b) => b.id === s.snap)
      if (!block) throw new Error(`snap:積木盒裡沒有「${String(s.snap)}」`)
      const rule = st.rules.find((r) => r.id === s.into)
      if (!rule) throw new Error(`snap:into 要寫積木列的 id(沒有「${String(s.into)}」)`)
      const next: Rule = { ...rule, do: [block.do] }
      checkRule(next, st)
      return { ...st, ...clear, rules: st.rules.map((r) => (r.id === rule.id ? next : r)), snapped: st.snapped.includes(block.id) ? st.snapped : [...st.snapped, block.id] }
    }
    if (kind === 'edit') {
      const rule = st.rules.find((r) => r.id === s.edit)
      if (!rule) throw new Error(`edit:沒有積木列「${String(s.edit)}」`)
      const keys = EDIT_KEYS.filter((k) => k in s)
      if (keys.length !== 1) throw new Error(`edit:一次改一個值(${EDIT_KEYS.join('、')} 選一個)`)
      const k = keys[0]
      let next: Rule
      if (k === 'is') {
        if (!rule.if) throw new Error(`edit:「${rule.id}」不是「如果」的列,不能改 is`)
        if (!Number.isInteger(s.is)) throw new Error('edit:is 要寫整數')
        next = { ...rule, if: { is: s.is! } }
      } else {
        const i = rule.do.findIndex((e) => effectKey(e) === k)
        if (i < 0) throw new Error(`edit:「${rule.id}」的格子裡沒有 ${k} 的積木`)
        next = { ...rule, do: rule.do.map((e, j) => (j === i ? ({ [k]: s[k] } as Effect) : e)) }
      }
      checkRule(next, st)
      return { ...st, ...clear, rules: st.rules.map((r) => (r.id === rule.id ? next : r)), edits: st.edits + 1 }
    }
    if (kind === 'fill') {
      if (!st.boxName) throw new Error('fill:要先有 box(盒子)')
      if (!Number.isInteger(s.fill)) throw new Error('fill 要寫整數')
      return { ...st, ...clear, value: s.fill!, start: s.fill!, party: false }
    }
    if (kind === 'reload') {
      return {
        ...st,
        ...clear,
        shown: Object.fromEntries(st.things.map((x) => [x.id, x.shown !== false])),
        value: st.start,
        dice: st.dice0,
        guess: null,
        guessed: false,
        bubble: null,
        paint: null,
        party: false,
      }
    }
    if (kind === 'guess') {
      if (!st.hasDice) throw new Error('guess:要先有 dice(骰子)')
      if (!Number.isInteger(s.guess)) throw new Error('guess 要寫整數')
      return { ...st, ...clear, guess: s.guess!, guessed: false }
    }
    if (s.check === false) return { ...st, verdict: null }
    if (typeof s.check !== 'string' || typeof s.answer !== 'string') throw new Error('check 和 answer 都要寫目標名稱,例如 { "check": "when:hi", "answer": "when:hi" }')
    for (const t of [s.check, s.answer]) if (!TARGET_RE.test(t)) throw new Error(`check/answer:「${t}」不是這個演員的目標`)
    return { ...st, verdict: { target: s.check, right: s.check === s.answer } }
  },

  duration(kind, step, _props, prev) {
    return segments(kind, step, prev).reduce((n, x) => n + x.ms, 0)
  },

  cursor(kind, step) {
    if (!step.tap) return null
    const to: Partial<Record<MagicKind, string | undefined>> = {
      press: step.press ? `button:${step.press}` : undefined,
      snap: step.snap ? `block:${step.snap}` : undefined,
      edit: step.edit ? `do:${step.edit}` : undefined,
      fill: 'box',
      reload: 'reload',
    }
    const target = to[kind]
    return target ? { moves: [{ at: 150, target }], clickAt: TAP_AT } : null
  },

  mount(root, props) {
    root.classList.add('A-lt10-magic')
    const things = props.things ?? []
    root.innerHTML = `
      <div class="mg-side mg-web">
        <p class="mg-label">🌐 網頁</p>
        <div class="mg-win">
          <div class="mg-bar">
            <span class="mg-lights"><i></i><i></i><i></i></span>
            <span class="mg-reload">↻</span>
            <span class="mg-tab">${kit.esc(props.title)}</span>
          </div>
          <div class="mg-page">
            <h1 class="mg-title">${props.emoji ? `${kit.esc(props.emoji)} ` : ''}${kit.esc(props.title)}</h1>
            ${props.note ? `<p class="mg-note">${kit.esc(props.note)}</p>` : ''}
            ${things.map((x) => `<div class="mg-thing" data-id="${kit.esc(x.id)}"><span class="mg-thing-text">${kit.esc(x.text)}</span><span class="mg-thing-hid">🙈 ${kit.esc(x.name)}藏起來了</span></div>`).join('')}
            <div class="mg-row">
              ${props.box ? `<div class="mg-box"><span class="mg-boxname">${kit.esc(props.box.name)}</span><b class="mg-num"></b></div>` : ''}
              ${props.dice ? `<div class="mg-dicewrap"><div class="mg-dice"><b></b></div><span class="mg-guess"></span><span class="mg-luck"></span></div>` : ''}
            </div>
            <div class="mg-btns">${props.buttons.map((b) => `<span class="mg-btn" data-id="${kit.esc(b.id)}">${kit.esc(b.text)}</span>`).join('')}</div>
            <div class="mg-bubble"></div>
            <p class="mg-quiet">🤔 ……什麼事都沒發生</p>
            <div class="mg-fire">${[0, 1, 2].map(() => `<span class="mg-burst">${Array.from({ length: 10 }, () => '<i></i>').join('')}<em>🎆</em></span>`).join('')}</div>
          </div>
        </div>
      </div>
      <div class="mg-side mg-code">
        <p class="mg-label">✨ 魔法積木</p>
        <div class="mg-rules"></div>
        <div class="mg-drawer"><p class="mg-drawer-head">🧺 積木盒</p><div class="mg-blocks"></div></div>
      </div>
      <span class="mg-flyer"></span>
      <span class="mg-plus"></span>`
    const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)
    const page = $('.mg-page')!
    const title = $('.mg-title')!
    const note = $('.mg-note')
    const code = $('.mg-code')!
    const rulesBox = $('.mg-rules')!
    const drawer = $('.mg-drawer')!
    const blocksBox = $('.mg-blocks')!
    const reloadBtn = $('.mg-reload')!
    const box = $('.mg-box')
    const boxname = $('.mg-boxname')
    const num = $('.mg-num')
    const dice = $('.mg-dice')
    const diceNum = $('.mg-dice b')
    const guessEl = $('.mg-guess')
    const luck = $('.mg-luck')
    const bubble = $('.mg-bubble')!
    const quiet = $('.mg-quiet')!
    const plus = $('.mg-plus')!
    const bursts = [...root.querySelectorAll<HTMLElement>('.mg-burst')]
    const flyer = $('.mg-flyer')!
    const btns = new Map(props.buttons.map((b) => [b.id, $(`.mg-btn[data-id="${CSS.escape(b.id)}"]`)!]))
    const thingEls = new Map(things.map((t) => [t.id, $(`.mg-thing[data-id="${CSS.escape(t.id)}"]`)!]))
    const isTall = kit.tallWatch(root)
    let rulesHtml = ''
    let blocksHtml = ''

    const thingName = (id: string) => things.find((x) => x.id === id)?.name ?? id
    const btnText = (id: string) => props.buttons.find((b) => b.id === id)?.text ?? id
    const chip = (e: Effect): string => {
      if ('say' in e) return `💬 說「${kit.esc(e.say)}」`
      if ('show' in e) return `👀 顯示「${kit.esc(thingName(e.show))}」`
      if ('hide' in e) return `🙈 隱藏「${kit.esc(thingName(e.hide))}」`
      if ('toggle' in e) return `🔁 顯示⇄隱藏「${kit.esc(thingName(e.toggle))}」`
      if ('add' in e) return `${e.add > 0 ? '➕' : '➖'} 盒子「${kit.esc(props.box?.name ?? '')}」${e.add > 0 ? '加' : '減'} <b>${Math.abs(e.add)}</b>`
      if ('roll' in e) return `🎲 擲出 <b>${e.roll[0]}</b> 到 <b>${e.roll[1]}</b> 的數字`
      if ('fireworks' in e) return '🎆 放煙火'
      return `🎨 背景變<i class="mg-swatch" style="background:${PAINTS[e.paint]}"></i>${kit.esc(e.paint)}`
    }
    const ruleHtml = (r: Rule): string => {
      const when =
        r.when === 'box'
          ? `<small>如果</small>盒子「${kit.esc(props.box?.name ?? '')}」是 <b class="mg-is" data-id="${kit.esc(r.id)}">${r.if?.is ?? ''}</b>`
          : `<small>點了</small>🖱️「${kit.esc(btnText(r.when))}」`
      const does = r.do.length ? r.do.map((e) => `<span class="mg-chip" data-k="${effectKey(e)}">${chip(e)}</span>`).join('') : '<span class="mg-slot">放一塊積木</span>'
      return `<div class="mg-rule" data-id="${kit.esc(r.id)}" data-box="${r.when === 'box'}"><span class="mg-when" data-id="${kit.esc(r.id)}">${when}</span><span class="mg-arrow">➜ 就</span><span class="mg-do" data-id="${kit.esc(r.id)}">${does}</span></div>`
    }
    /** 元素在 root 裡的位置(舞台會縮放,用 root 的實際寬度換算回演員座標) */
    const posIn = (el: Element | null): { x: number; y: number } | null => {
      if (!el) return null
      const rr = root.getBoundingClientRect()
      const k = root.offsetWidth ? rr.width / root.offsetWidth : 1
      const r = el.getBoundingClientRect()
      if (!r.width && !r.height) return null
      return { x: (r.left + r.width / 2 - rr.left) / (k || 1), y: (r.top + r.height / 2 - rr.top) / (k || 1) }
    }

    const targetOf = (name: string): HTMLElement | null => {
      if (name === 'window') return root
      if (name === 'page') return page
      if (name === 'code') return code
      if (name === 'drawer') return drawer.dataset.show === 'false' ? null : drawer
      if (name === 'title') return title
      if (name === 'note') return note
      if (name === 'box') return box
      if (name === 'boxname') return boxname
      if (name === 'num') return num
      if (name === 'dice') return dice
      if (name === 'guess') return guessEl?.dataset.show === 'true' ? guessEl : null
      if (name === 'bubble') return bubble.dataset.show === 'true' ? bubble : null
      if (name === 'reload') return reloadBtn
      const m = /^(button|thing|rule|when|do|if|block):(.+)$/.exec(name)
      if (!m) return null
      const id = CSS.escape(m[2])
      if (m[1] === 'button') return btns.get(m[2]) ?? null
      if (m[1] === 'thing') return thingEls.get(m[2]) ?? null
      if (m[1] === 'rule') return rulesBox.querySelector<HTMLElement>(`.mg-rule[data-id="${id}"]`)
      if (m[1] === 'when') return rulesBox.querySelector<HTMLElement>(`.mg-when[data-id="${id}"]`)
      if (m[1] === 'do') return rulesBox.querySelector<HTMLElement>(`.mg-do[data-id="${id}"]`)
      if (m[1] === 'if') return rulesBox.querySelector<HTMLElement>(`.mg-is[data-id="${id}"]`)
      return blocksBox.querySelector<HTMLElement>(`.mg-block[data-id="${id}"]`)
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const tall = isTall()
        if (root.dataset.tall !== String(tall)) root.dataset.tall = String(tall)
        const ev = view.ev && KINDS.includes(view.ev.kind as MagicKind) ? view.ev : null
        const kind = ev?.kind as MagicKind | undefined
        const step = (ev?.step ?? {}) as MagicStep
        const from = view.prev
        const to = view.ev?.kind === 'hide' ? view.prev : view.state
        const seg = ev && kind ? segAt(segments(kind, step, from), ev.local) : null

        // ── 這一格要畫的網頁狀態:按按鈕時從按之前開始,一塊一塊做到目前這一塊 ──
        let shown: MagicState = to
        let cur: { rule: string; e: Effect } | null = null
        let curP = 1
        let pressFx: { rule: string; e: Effect }[] = []
        if (kind === 'press' && seg) {
          pressFx = pressPlan(from, step.press!).fx
          let s = seg.kind === 'tap' ? from : startPress(from)
          const upto = seg.kind === 'fx' ? seg.fx! : seg.kind === 'quiet' ? pressFx.length : 0
          for (let i = 0; i < upto; i++) s = applyEffect(s, pressFx[i].e)
          if (seg.kind === 'fx') {
            cur = pressFx[seg.fx!]
            curP = seg.p
            // 說話、顯示、骰子這些一開始就畫成做完的樣子,再用動畫帶出來;加數字等數字飛到盒子才變
            const k = effectKey(cur.e)
            if (k !== 'add' || seg.p >= 0.65) s = applyEffect(s, cur.e)
          }
          if (seg.kind === 'quiet') s = { ...s, quiet: true }
          shown = { ...s, rules: to.rules }
        } else if (seg && seg.kind === 'tap') shown = from
        else if (kind === 'reload' && seg && seg.p < 0.4) shown = from
        else if (kind === 'fill' && seg && seg.p < 0.5) shown = from

        // ── 魔法積木:列有改才重畫 ──
        const ruleSrc = kind === 'snap' && seg && (seg.kind === 'tap' || seg.p < 0.8) ? from.rules : to.rules
        const html = ruleSrc.map(ruleHtml).join('')
        if (html !== rulesHtml) {
          rulesBox.innerHTML = html
          rulesHtml = html
        }
        const bhtml = to.drawer.map((b) => `<span class="mg-block" data-id="${kit.esc(b.id)}" data-k="${effectKey(b.do)}">${chip(b.do)}</span>`).join('')
        if (bhtml !== blocksHtml) {
          blocksBox.innerHTML = bhtml
          blocksHtml = bhtml
        }
        drawer.dataset.show = to.drawer.length ? 'true' : 'false'
        rulesBox.dataset.empty = to.rules.length ? 'false' : 'true'
        // 按按鈕時,這一次動到的列亮起來;正在做的那一塊跳一下
        const pushing = kind === 'press' && seg && seg.kind !== 'tap'
        for (const row of rulesBox.querySelectorAll<HTMLElement>('.mg-rule')) {
          const id = row.dataset.id!
          let on = ''
          if (pushing) {
            const curI = seg!.kind === 'fx' ? seg!.fx! : seg!.kind === 'quiet' ? pressFx.length : -1
            const done = pressFx.slice(0, Math.max(0, curI + 1)).some((x) => x.rule === id)
            const rule = to.rules.find((r) => r.id === id)
            if (cur?.rule === id) on = 'now'
            else if (done) on = 'done'
            else if (seg!.kind === 'push' && rule?.when === step.press) on = 'now'
          } else if (!ev && to.fired.includes(id)) on = 'done'
          row.dataset.fired = on
          const chipEl = row.querySelector<HTMLElement>('.mg-do .mg-chip')
          if (chipEl) {
            const bounce = cur?.rule === id ? Math.sin(Math.min(1, curP * 2.5) * Math.PI) * 0.12 : 0
            kit.css(chipEl, { transform: bounce ? `scale(${(1 + bounce).toFixed(3)})` : 'none' })
          }
          // 改值:舊的縮小、新的跳出來,格子變黃
          const editing = kind === 'edit' && seg?.kind === 'act' && step.edit === id
          row.dataset.edit = editing ? 'true' : 'false'
          const target = editing ? (('is' in step ? row.querySelector<HTMLElement>('.mg-is') : row.querySelector<HTMLElement>('.mg-do'))) : null
          if (target) {
            const p = seg!.p
            const sc = p < 0.3 ? 1 - p : p < 0.6 ? 0.7 + kit.ease.outBack(kit.progress(p, 0.3, 0.3)) * 0.45 : 1.15 - kit.progress(p, 0.6, 0.4) * 0.15
            kit.css(target, { transform: `scale(${sc.toFixed(3)})` })
          }
          // 放積木:格子在積木飛到時亮一下
          const snapping = kind === 'snap' && seg?.kind === 'act' && step.into === id
          row.dataset.snap = snapping && seg!.p >= 0.8 ? 'true' : snapping ? 'wait' : 'false'
        }
        for (const el of blocksBox.querySelectorAll<HTMLElement>('.mg-block')) {
          el.dataset.on = kind === 'snap' && step.snap === el.dataset.id && seg && (seg.kind === 'tap' || seg.p < 0.8) ? 'true' : 'false'
        }
        // 飛過去的積木
        if (kind === 'snap' && seg?.kind === 'act' && seg.p < 0.85) {
          const a = posIn(blocksBox.querySelector(`.mg-block[data-id="${CSS.escape(step.snap!)}"]`))
          const b = posIn(rulesBox.querySelector(`.mg-do[data-id="${CSS.escape(step.into!)}"]`))
          const block = to.drawer.find((x) => x.id === step.snap)
          if (a && b && block) {
            const q = kit.ease.inOutCubic(kit.clamp(seg.p / 0.8))
            const hop = Math.sin(q * Math.PI) * 80
            flyer.dataset.show = 'true'
            flyer.dataset.k = effectKey(block.do)
            kit.setIf(flyer, 'html', chip(block.do))
            kit.css(flyer, { left: `${kit.lerp(a.x, b.x, q).toFixed(1)}px`, top: `${(kit.lerp(a.y, b.y, q) - hop).toFixed(1)}px` })
          } else flyer.dataset.show = 'false'
        } else flyer.dataset.show = 'false'

        // ── 網頁 ──
        kit.css(page, { background: shown.paint ? PAINTS[shown.paint] : '#fffaf0' })
        const painting = cur && 'paint' in cur.e ? curP : 1
        kit.css(page, { boxShadow: painting < 1 ? `inset 0 0 0 ${Math.round((1 - painting) * 30)}px rgba(255,255,255,0.8)` : 'none' })
        for (const [id, el] of btns) {
          const pressing = kind === 'press' && step.press === id && seg && (seg.kind === 'push' || (seg.kind === 'tap' && seg.local > TAP_AT - 80))
          kit.css(el, { transform: pressing ? 'translateY(6px)' : 'none' })
          el.dataset.shadow = pressing ? 'off' : 'on'
        }
        for (const [id, el] of thingEls) {
          const vis = !!shown.shown[id]
          el.dataset.shown = String(vis)
          const anim = cur && ('show' in cur.e || 'hide' in cur.e || 'toggle' in cur.e) ? curP : 1
          const touched = cur && (('show' in cur.e && cur.e.show === id) || ('hide' in cur.e && cur.e.hide === id) || ('toggle' in cur.e && cur.e.toggle === id))
          const sc = touched && vis ? 0.6 + kit.ease.outBack(kit.clamp(anim / 0.6)) * 0.4 : 1
          kit.css(el, { transform: `scale(${sc.toFixed(3)})`, opacity: touched && !vis ? (0.4 + kit.clamp(anim / 0.5) * 0.6).toFixed(2) : '1' })
        }
        // 盒子:數字飛進去後換數字、跳一下
        if (num) {
          kit.setIf(num, 'text', String(shown.value))
          const adding = cur && 'add' in cur.e ? curP : -1
          const bump = adding >= 0.65 ? Math.sin(kit.progress(adding, 0.65, 0.35) * Math.PI) * 0.25 : kind === 'fill' && seg?.kind === 'act' && seg.p >= 0.5 ? Math.sin(kit.progress(seg.p, 0.5, 0.5) * Math.PI) * 0.25 : 0
          kit.css(num, { transform: `scale(${(1 + bump).toFixed(3)})` })
        }
        if (cur && 'add' in cur.e && curP < 0.65 && box) {
          const a = posIn(btns.get(step.press!) ?? null)
          const b = posIn(box)
          if (a && b) {
            const q = kit.ease.inOutCubic(curP / 0.65)
            plus.dataset.show = 'true'
            plus.dataset.neg = String(cur.e.add < 0)
            kit.setIf(plus, 'text', `${cur.e.add > 0 ? '+' : '−'}${Math.abs(cur.e.add)}`)
            kit.css(plus, { left: `${kit.lerp(a.x, b.x, q).toFixed(1)}px`, top: `${(kit.lerp(a.y, b.y, q) - Math.sin(q * Math.PI) * 120).toFixed(1)}px` })
          } else plus.dataset.show = 'false'
        } else plus.dataset.show = 'false'
        // 骰子:轉的時候數字一直換、整顆轉圈,最後停下來
        if (dice && diceNum) {
          const rolling = cur && 'roll' in cur.e ? curP : -1
          let face = shown.dice ?? 1
          let rot = 0
          if (rolling >= 0 && rolling < 0.8) {
            const [lo, hi] = (cur!.e as { roll: [number, number] }).roll
            const tick = Math.floor((rolling * effectMs(cur!.e)) / 90)
            face = lo + Math.floor(kit.rand(`lt10-spin-${shown.rolls.length}-${tick}`)() * (hi - lo + 1))
            rot = (1 - kit.ease.outCubic(rolling / 0.8)) * 720
          }
          kit.setIf(diceNum, 'text', String(face))
          dice.dataset.big = String(face >= 10)
          dice.dataset.landed = rolling >= 0.8 ? 'true' : 'false'
          kit.css(dice, { transform: `rotate(${rot.toFixed(1)}deg)` })
          const settled = !(rolling >= 0 && rolling < 0.8)
          if (guessEl) {
            guessEl.dataset.show = shown.guess !== null ? 'true' : 'false'
            kit.setIf(guessEl, 'text', shown.guess !== null ? `我猜 ${shown.guess}` : '')
          }
          if (luck) {
            const show = shown.guess !== null && shown.guessed && settled
            luck.dataset.show = String(show)
            luck.dataset.hit = String(show && shown.dice === shown.guess)
            kit.setIf(luck, 'text', show ? (shown.dice === shown.guess ? '🎉 猜中了！' : `是 ${shown.dice}，沒猜中`) : '')
          }
        }
        // 說的話:泡泡跳出來
        const saying = cur && 'say' in cur.e ? curP : 1
        bubble.dataset.show = shown.bubble ? 'true' : 'false'
        kit.setIf(bubble, 'text', shown.bubble ?? '')
        kit.css(bubble, { transform: `translateX(-50%) scale(${(shown.bubble ? 0.3 + kit.ease.outBack(kit.clamp(saying / 0.5)) * 0.7 : 1).toFixed(3)})` })
        quiet.dataset.show = shown.quiet ? 'true' : 'false'
        // 煙火:三朵依序炸開,做完留下小煙火
        const fireP = cur && 'fireworks' in cur.e ? curP : shown.party ? 1 : -1
        bursts.forEach((el, bi) => {
          const p = fireP < 0 ? -1 : kit.clamp((fireP - bi * 0.18) / 0.55)
          el.dataset.show = p >= 0 && fireP >= bi * 0.18 ? 'true' : 'false'
          const dots = el.querySelectorAll<HTMLElement>('i')
          dots.forEach((d, di) => {
            const ang = (di / dots.length) * Math.PI * 2
            const r = kit.ease.outCubic(p) * 120
            kit.css(d, { transform: `translate(${(Math.cos(ang) * r).toFixed(1)}px, ${(Math.sin(ang) * r).toFixed(1)}px)`, opacity: (p >= 1 ? 0 : 1 - p * 0.6).toFixed(2) })
          })
          kit.css(el.querySelector('em')!, { opacity: p >= 0.5 ? '1' : '0', transform: `scale(${(p >= 0.5 ? 0.6 + kit.clamp((p - 0.5) * 2) * 0.4 : 0.6).toFixed(2)})` })
        })
        // 重新整理:按鈕轉一圈,網頁閃一下
        const rp = kind === 'reload' && seg?.kind === 'act' ? seg.p : -1
        kit.css(reloadBtn, { transform: `rotate(${rp >= 0 ? Math.round(rp * 360) : 0}deg)` })
        kit.css(title, { opacity: rp >= 0.3 && rp < 0.5 ? '0.3' : '1' })

        // ── 回答題目:選的那一塊變綠或變紅,答錯搖一搖 ──
        for (const el of root.querySelectorAll<HTMLElement>('[data-verdict]')) {
          el.removeAttribute('data-verdict')
          el.style.translate = ''
        }
        const v = to.verdict
        if (v) {
          const el = targetOf(v.target)
          if (el) {
            el.dataset.verdict = v.right ? 'right' : 'wrong'
            const sp = kind === 'check' && !v.right && seg ? seg.p : 1
            const shake = !v.right && sp < 1 ? Math.sin(sp * Math.PI * 6) * (1 - sp) * 14 : 0
            el.style.translate = `${shake.toFixed(2)}px 0`
          }
        }
      },

      target: targetOf,
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
