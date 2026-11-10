// 演員 lt11-helper:兒童網頁課單元 4「請 AI 幫忙做」的 AI 小幫手(模擬,不接真的 AI)。
// 畫面:中間是「小幫手做的網頁」,右邊是小幫手(機器人)和對話,下面是卡片盤(名詞卡、句子卡);
// 左邊可以放一張紙:目標圖(goal,做出來要比對的樣子)或草圖(sketch,先畫再拆成幾句話)。
// 孩子點卡片就是跟小幫手說那句話;小幫手照卡片上寫好的做法改網頁(卡片的 ops),說不清楚的卡片只會反問或做錯。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5);兒童版播放器見 web/src/kids/KidsPlayer.tsx。
//
// props(登場設定):
//   page      一開始的網頁 { "bg": "#fff", "parts": [部分…] };預設空白網頁
//             部分:{ "id": "h1", "kind": "h1|h2|p|img|ul|ol|button|link|game", "text": "…",
//                    "emoji": "🐱"(img)、"items": ["…"](ul/ol)、"button": "…" 與 "results": ["🍎","🍌"](game),
//                    外觀:"color"(字的顏色)、"bg"(背景顏色)、"size": "s|m|l|xl"、"bold": true、"align": "left|center" }
//   cards     卡片盤上的卡片:[{ "id": "c1", "text": "把[[標題]]改成紅色", "tag": "要什麼",
//                    "ops": [改網頁的做法…], "reply": "小幫手的回答", "mood": "happy|puzzled", "star": "任務 id" }]
//             text 裡的 [[…]] 是重點字(名詞)。ops 見下面的 make;沒有 ops 的卡片小幫手只回答(通常是反問)
//   goal      目標圖(和 page 同格式);有寫就在左邊的紙上畫出來,並在狀態的 ok 記下網頁上哪些部分已經和目標一樣
//   paper     左邊的紙:"goal"(有 goal 時的預設)、"sketch"(草圖)、"none"
//   sketch    草圖一開始的格子 [{ "id": "b1", "kind": "h1", "label": "標題：恐龍小站", "say": "最上面放大標題「恐龍小站」", "part": {部分} }]
//   templates 草圖範本(紙上方的按鈕):[{ "id": "pet", "name": "寵物名片", "emoji": "🐶", "boxes": [格子…] }]
//   palette   true:紙上方放「標題、圖片、段落、清單、按鈕」五個畫筆,點了就在草圖上多畫一格
//   compose   true:卡片盤左邊有「你要說的話」和「送出」:點卡片先放進句子裡(pick),按送出才說(send)
//   starsOf   右上角有幾顆星星的空位(任務數);不寫就不顯示星星
//
// 動作(依序操作;對不上狀態時載入就報錯並指出第幾步):
//   { "ask": "c1" }                 說出這張卡片的話,小幫手照卡片做(想一想 → 一項一項改網頁 → 回答);加 "tap": true 先點卡片
//   { "pick": "c1" }                把卡片放進「你要說的話」(compose),已經在裡面就拿出來;{ "unpick": "c1" } 拿出來;{ "clear": true } 全部拿出來
//   { "send": true }                送出「你要說的話」裡的卡片,小幫手照這些卡片做;加 "tap": true 先點送出。裡面沒有卡片時小幫手提醒先點卡片
//                                   (ask、send 照卡片做時,對不上網頁的做法直接略過,例如還沒有標題就要改標題;make 對不上會報錯)
//   { "send": "幫我做網頁" }        直接說一句話(不經過卡片),小幫手先不回答,接著用 make 或 reply
//   { "make": [做法…], "reply": "…", "mood": "happy", "star": "id" }  小幫手改網頁,做法依序:
//        { "add": {部分}, "after": "h1" | null }   加一個部分(after 不寫加在最後、null 加在最前面;寫成陣列時放在第一個已經在網頁上的部分後面);
//                                                 id 已經有了就整個換掉(after 不寫時留在原位)
//        { "set": "h1", "color": "#e53935", … }    改一個部分的字或外觀(text、emoji、items、color、bg、size、bold、align、button);"set": "page" 改網頁背景
//        { "remove": "btn" }                      拿掉一個部分
//        { "move": "list", "after": "h1" | null } 把一個部分搬到某個部分後面(null 搬到最前面)
//   { "reply": "你說的是哪一個呀？", "mood": "puzzled" }  小幫手只回答,不改網頁
//   { "deal": [卡片…] }             換一盤新的卡片(你要說的話會清空)
//   { "mark": "h1" }                在網頁上圈出「這裡不一樣」(紅圈,記在 marks);加 "same": true 是「這裡一樣」(綠勾,不算進 marks);
//                                   { "mark": false } 把圈圈都拿掉
//   { "compare": true }             在目標圖上一格一格打勾(一樣 ✓、還不一樣 ✗);{ "compare": false } 收起來
//   { "check": "part:h1", "answer": "part:h1" }  回答題目(check、answer 都是下面的目標名稱):答對變綠,答錯變紅搖一搖;{ "check": false } 拿掉顏色
//   { "sketch": "pet" }             草圖換成範本的格子;{ "sketch": "blank" } 換一張空白的紙。加 "tap": true 先點範本按鈕
//   { "draw": "h1" }                在草圖最下面畫一格(h1、img、p、ul、button、game);也可以寫完整的格子 { "draw": {格子} }。加 "tap": true 先點畫筆
//   { "split": true }               把草圖拆成幾句話:每一格變成一張句子卡(第 1 句、第 2 句…),換掉卡片盤
//   { "press": "game" }             按網頁上的按鈕(小遊戲換下一個結果);加 "tap": true 示範點擊
//   { "cheer": true }               彩帶和星星(作品完成)
//
// 狀態可以給子腳本的 until 用:stars(拿到的星星)、ok(和目標一樣的部分,"page" 是網頁背景)、marks(圈出的不一樣)、
//   sketch(草圖的格子)、built(網頁上有的部分 id)、asked(說過的卡片)、sent(說了幾次)、pressed(按了幾次按鈕)。
//
// 目標:window、helper(小幫手)、chat(對話)、page(做出來的網頁)、part:<id>(網頁上的部分)、paper(左邊的紙)、
//       goal:<id>(目標圖上的部分)、box:<id>(草圖的格子)、tray(卡片盤)、card:<id>、compose(你要說的話)、send(送出鈕)、
//       tpl:<id>(範本按鈕)、tool:<kind>(畫筆)、stars
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type Kind = 'ask' | 'pick' | 'unpick' | 'clear' | 'send' | 'make' | 'reply' | 'deal' | 'mark' | 'compare' | 'check' | 'sketch' | 'draw' | 'split' | 'press' | 'cheer'
type PartKind = 'h1' | 'h2' | 'p' | 'img' | 'ul' | 'ol' | 'button' | 'link' | 'game'
type Mood = 'idle' | 'happy' | 'puzzled'
export interface Part {
  id: string
  kind: PartKind
  text?: string
  emoji?: string
  items?: string[]
  button?: string
  results?: string[]
  color?: string
  bg?: string
  size?: 's' | 'm' | 'l' | 'xl'
  bold?: boolean
  align?: 'left' | 'center'
}
export interface PageSpec {
  bg?: string
  parts: Part[]
}
type Op =
  | { add: Part; after?: string | string[] | null }
  | ({ set: string } & Partial<Omit<Part, 'id' | 'kind'>>)
  | { remove: string }
  | { move: string; after?: string | null }
export interface Card {
  id: string
  text: string
  tag?: string
  ops?: Op[]
  reply?: string
  mood?: Mood
  star?: string
}
export interface Box {
  id: string
  kind: PartKind
  label: string
  say?: string
  part?: Part
}
interface Template {
  id: string
  name: string
  emoji?: string
  boxes: Box[]
}
type Step = CommonStepFields & {
  ask?: string
  pick?: string
  unpick?: string
  clear?: true
  send?: true | string
  make?: Op[]
  reply?: string
  mood?: Mood
  star?: string
  deal?: Card[]
  mark?: string | false
  same?: boolean
  compare?: boolean
  check?: string | false
  answer?: string
  sketch?: string
  draw?: PartKind | Box
  split?: true
  press?: string
  cheer?: true
  tap?: boolean
}
interface Props {
  page?: PageSpec
  cards?: Card[]
  goal?: PageSpec
  paper?: 'goal' | 'sketch' | 'none'
  sketch?: Box[]
  templates?: Template[]
  palette?: boolean
  compose?: boolean
  starsOf?: number
}
type Msg = { from: 'me' | 'bot'; text: string; mood?: Mood }
export interface HelperState {
  page: PageSpec
  goal: PageSpec | null
  cards: Card[]
  draft: string[]
  chat: Msg[]
  mood: Mood
  stars: string[]
  ok: string[]
  built: string[]
  marks: string[]
  sames: string[]
  compare: boolean
  sketch: Box[]
  /** 草圖拆成句子了沒(格子上標第幾句) */
  split: boolean
  asked: string[]
  sent: number
  presses: Record<string, number>
  pressed: number
  verdict: { target: string; right: boolean } | null
  cheer: boolean
  /** 草圖範本(登場設定的 templates;apply 拿不到 props,所以放在狀態裡) */
  templates: Template[]
}

const KINDS: readonly Kind[] = ['ask', 'pick', 'unpick', 'clear', 'send', 'make', 'reply', 'deal', 'mark', 'compare', 'check', 'sketch', 'draw', 'split', 'press', 'cheer']
const PART_KINDS: readonly PartKind[] = ['h1', 'h2', 'p', 'img', 'ul', 'ol', 'button', 'link', 'game']
const STYLE_KEYS = ['text', 'emoji', 'items', 'button', 'results', 'color', 'bg', 'size', 'bold', 'align'] as const
const MATCH_KEYS = ['kind', 'text', 'emoji', 'items', 'button', 'color', 'bg', 'size', 'bold', 'align'] as const
/** 畫筆:名稱、一開始的字、拆成句子時怎麼說 */
const PEN: Record<PartKind, { name: string; icon: string; text: string }> = {
  h1: { name: '標題', icon: '🔤', text: '我的網站' },
  h2: { name: '小標題', icon: '🔡', text: '小標題' },
  p: { name: '段落', icon: '📝', text: '這裡寫一段介紹。' },
  img: { name: '圖片', icon: '🖼️', text: '' },
  ul: { name: '清單', icon: '📋', text: '' },
  ol: { name: '編號清單', icon: '🔢', text: '' },
  button: { name: '按鈕', icon: '🔘', text: '按我' },
  link: { name: '連結', icon: '🔗', text: '去另一頁' },
  game: { name: '小遊戲', icon: '🎲', text: '小遊戲' },
}
const PALETTE: PartKind[] = ['h1', 'img', 'p', 'ul', 'button']

const TAP_AT = 750
const SAY_MS = 800
const THINK_MS = 1100
const OP_MS = 700
const REPLY_CPS = 12
const isPartKind = (x: unknown): x is PartKind => typeof x === 'string' && (PART_KINDS as readonly string[]).includes(x)

// ── 網頁的做法 ──

function checkPart(p: Part, where: string): void {
  if (!p || typeof p.id !== 'string' || !p.id) throw new Error(`${where}:每個部分都要有 id`)
  if (!isPartKind(p.kind)) throw new Error(`${where}:部分「${p.id}」的 kind 要是 ${PART_KINDS.join('、')}`)
}
function checkPage(page: PageSpec | undefined, where: string): PageSpec {
  const pg = page ?? { parts: [] }
  if (!Array.isArray(pg.parts)) throw new Error(`${where}:parts 要是陣列`)
  const ids = new Set<string>()
  for (const p of pg.parts) {
    checkPart(p, where)
    if (ids.has(p.id)) throw new Error(`${where}:部分 id「${p.id}」重複了`)
    ids.add(p.id)
  }
  return pg
}
function applyOp(page: PageSpec, op: Op): PageSpec {
  const parts = page.parts
  const at = (id: string) => parts.findIndex((x) => x.id === id)
  const insert = (list: Part[], part: Part, after0: string | string[] | null | undefined): Part[] => {
    if (after0 === undefined) return [...list, part]
    // after 寫成陣列:放在第一個已經在網頁上的部分後面,都還沒有就放最上面
    const after = Array.isArray(after0) ? (after0.find((id) => list.some((x) => x.id === id)) ?? null) : after0
    if (after === null) return [part, ...list]
    const i = list.findIndex((x) => x.id === after)
    if (i < 0) throw new Error(`做法:after 的「${after}」不在網頁上`)
    return [...list.slice(0, i + 1), part, ...list.slice(i + 1)]
  }
  if ('add' in op) {
    checkPart(op.add, 'add')
    const i = at(op.add.id)
    if (i >= 0 && op.after === undefined) return { ...page, parts: parts.map((x, j) => (j === i ? { ...op.add } : x)) }
    return { ...page, parts: insert(parts.filter((x) => x.id !== op.add.id), { ...op.add }, op.after) }
  }
  if ('set' in op) {
    const patch: Partial<Part> = {}
    for (const k of STYLE_KEYS) if (k in op) (patch as Record<string, unknown>)[k] = (op as Record<string, unknown>)[k]
    if (op.set === 'page') return { ...page, bg: patch.bg ?? page.bg }
    const i = at(op.set)
    if (i < 0) throw new Error(`做法:set 的「${op.set}」不在網頁上`)
    return { ...page, parts: parts.map((x, j) => (j === i ? { ...x, ...patch } : x)) }
  }
  if ('remove' in op) {
    if (at(op.remove) < 0) throw new Error(`做法:remove 的「${op.remove}」不在網頁上`)
    return { ...page, parts: parts.filter((x) => x.id !== op.remove) }
  }
  if ('move' in op) {
    const i = at(op.move)
    if (i < 0) throw new Error(`做法:move 的「${op.move}」不在網頁上`)
    return { ...page, parts: insert(parts.filter((x) => x.id !== op.move), parts[i], op.after) }
  }
  throw new Error('做法要是 add、set、remove 或 move')
}
const opTarget = (op: Op): string => ('add' in op ? op.add.id : 'set' in op ? op.set : 'remove' in op ? op.remove : op.move)
/** loose:孩子點卡片時,對不上網頁的做法(例如還沒有標題就要改標題)直接略過,不報錯 */
const applyOps = (page: PageSpec, ops: Op[], loose = false): PageSpec =>
  ops.reduce((pg, op) => {
    if (!loose) return applyOp(pg, op)
    try {
      return applyOp(pg, op)
    } catch {
      return pg
    }
  }, page)

const same = (a: unknown, b: unknown): boolean => (Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a ?? []) === JSON.stringify(b ?? []) : a === b)
/** 網頁上哪些部分和目標一樣:欄位都一樣,而且排在目標裡前面的部分(網頁上有的話)都在它上面 */
function okOf(page: PageSpec, goal: PageSpec | null): string[] {
  if (!goal) return []
  const out: string[] = []
  if (goal.bg && same(page.bg, goal.bg)) out.push('page')
  const pos = new Map(page.parts.map((x, i) => [x.id, i]))
  goal.parts.forEach((g, gi) => {
    const i = pos.get(g.id)
    if (i === undefined) return
    const p = page.parts[i]
    if (!MATCH_KEYS.every((k) => g[k] === undefined || same(p[k], g[k]))) return
    const before = goal.parts.slice(0, gi).every((x) => (pos.get(x.id) ?? -1) < i)
    if (before) out.push(g.id)
  })
  return out
}
const finish = (st: HelperState): HelperState => ({ ...st, ok: okOf(st.page, st.goal), built: st.page.parts.map((x) => x.id) })

/** 草圖的格子 → 網頁的部分(格子沒寫 part 就用畫筆的預設) */
function partOfBox(b: Box): Part {
  if (b.part) return b.part
  const pen = PEN[b.kind]
  const base: Part = { id: b.id, kind: b.kind, text: pen.text }
  if (b.kind === 'img') return { ...base, text: undefined, emoji: '🖼️' }
  if (b.kind === 'ul' || b.kind === 'ol') return { ...base, text: undefined, items: ['第一項', '第二項', '第三項'] }
  if (b.kind === 'game') return { ...base, button: '按我', results: ['🎲'] }
  return base
}
const sayOfBox = (b: Box, i: number, n: number): string =>
  b.say ?? `${i === 0 ? '最上面' : i === n - 1 ? '最下面' : '接著'}放一個[[${PEN[b.kind].name}]]`

// ── 小幫手怎麼回答 ──

type Response = { me: string | null; ops: Op[]; reply: string | null; mood: Mood; stars: string[]; cards: string[]; loose?: boolean }
function cardById(st: HelperState, id: unknown, kind: string): Card {
  const c = st.cards.find((x) => x.id === id)
  if (!c) throw new Error(`${kind}:卡片盤上沒有「${String(id)}」`)
  return c
}
/** 這張卡的做法套在網頁上:回傳套完的網頁,以及有沒有至少一項真的做到(對不上網頁的做法略過) */
function tryCard(page: PageSpec, c: Card): { page: PageSpec; did: boolean } {
  let did = false
  for (const op of c.ops ?? []) {
    try {
      page = applyOp(page, op)
      did = true
    } catch {
      // 對不上網頁(例如還沒有標題就要改標題):略過
    }
  }
  return { page, did }
}

/**
 * 照卡片回答:做法接在一起;都沒有做法也沒有回答時,小幫手說聽不懂。
 * 卡片有做法、但在當時的網頁上一項都對不上(例如還沒有標題就要改標題)時,這張卡沒有做到:不給星星;
 * 點的卡片都沒做到任何改變,小幫手說找不到要改的地方,不說「做好了」。
 */
function respond(cards: Card[], page: PageSpec): Pick<Response, 'ops' | 'reply' | 'mood' | 'stars'> {
  const ops = cards.flatMap((c) => c.ops ?? [])
  let pg = page
  const didOf = cards.map((c) => {
    const r = tryCard(pg, c)
    pg = r.page
    return r.did
  })
  const missed = ops.length > 0 && cards.every((c, i) => !c.ops?.length || !didOf[i])
  const stars = cards.flatMap((c, i) => (c.star && (!c.ops?.length || didOf[i]) ? [c.star] : []))
  if (missed) {
    // 腳本預先寫好的困惑回覆(故意示範說錯的卡)照用,其他的換成「找不到」
    const own = cards.flatMap((c) => (c.mood === 'puzzled' && c.reply ? [c.reply] : []))
    return { ops, reply: own.length ? own.join(' ') : '網頁上還找不到要改的地方，先請我把它做出來，再來改吧！', mood: 'puzzled', stars }
  }
  const replies = cards.flatMap((c) => (c.reply ? [c.reply] : []))
  const puzzled = cards.some((c) => c.mood === 'puzzled') || !ops.length
  const reply = replies.length ? replies.join(' ') : ops.length ? '好了！我照你說的做好了。' : '嗯……我聽不太懂，可以說清楚一點嗎？'
  return { ops, reply, mood: puzzled && !cards.some((c) => c.mood === 'happy') ? 'puzzled' : 'happy', stars }
}
const joinCards = (cards: Card[]): string => cards.map((c) => c.text).join('，')
/** 這一步小幫手要說、要做的事(apply 和 render 共用,過場時才能一項一項畫出來) */
function responseOf(st: HelperState, kind: Kind, s: Step): Response | null {
  if (kind === 'ask') {
    const c = cardById(st, s.ask, 'ask')
    return { me: c.text, ...respond([c], st.page), cards: [c.id], loose: true }
  }
  if (kind === 'send') {
    if (typeof s.send === 'string') {
      if (!s.send) throw new Error('send 要寫一句話,或 true')
      return { me: s.send, ops: [], reply: null, mood: st.mood, stars: [], cards: [] }
    }
    if (!st.draft.length) return { me: null, ops: [], reply: '先點卡片，拼出你要說的話吧！', mood: 'puzzled', stars: [], cards: [] }
    const cards = st.draft.map((id) => cardById(st, id, 'send'))
    return { me: joinCards(cards), ...respond(cards, st.page), cards: cards.map((c) => c.id), loose: true }
  }
  if (kind === 'make') {
    if (!Array.isArray(s.make)) throw new Error('make 要寫做法的陣列')
    return { me: null, ops: s.make, reply: s.reply ?? '好了！', mood: s.mood ?? 'happy', stars: s.star ? [s.star] : [], cards: [] }
  }
  if (kind === 'reply') {
    if (typeof s.reply !== 'string' || !s.reply) throw new Error('reply 要寫小幫手說的話')
    return { me: null, ops: [], reply: s.reply, mood: s.mood ?? 'happy', stars: s.star ? [s.star] : [], cards: [] }
  }
  return null
}

/** 一個動作拆成幾段:滑鼠點、我說話、想一想、一項一項改、小幫手回答;render 依這個知道演到哪 */
type SegKind = 'tap' | 'say' | 'think' | 'op' | 'reply' | 'act'
type Seg = { kind: SegKind; ms: number; i?: number }
function segments(kind: Kind, s: Step, prev: HelperState | undefined): Seg[] {
  const tap: Seg[] = s.tap ? [{ kind: 'tap', ms: TAP_AT }] : []
  if (kind === 'ask' || kind === 'send' || kind === 'make' || kind === 'reply') {
    let r: Response | null = null
    try {
      r = prev ? responseOf(prev, kind, s) : null
    } catch {
      r = null
    }
    if (!r) return [{ kind: 'act', ms: 600 }]
    const out: Seg[] = [...(kind === 'ask' || kind === 'send' ? tap : [])]
    if (r.me !== null) out.push({ kind: 'say', ms: SAY_MS })
    if (r.reply !== null || r.ops.length) out.push({ kind: 'think', ms: kind === 'reply' ? 700 : THINK_MS })
    r.ops.forEach((_, i) => out.push({ kind: 'op', ms: OP_MS, i }))
    if (r.reply) out.push({ kind: 'reply', ms: kit.typeDuration(r.reply, REPLY_CPS) + 500 })
    return out
  }
  switch (kind) {
    case 'pick':
    case 'unpick':
      return [...tap, { kind: 'act', ms: 500 }]
    case 'clear':
      return [{ kind: 'act', ms: 500 }]
    case 'deal':
      return [{ kind: 'act', ms: 400 + (s.deal?.length ?? 0) * 120 }]
    case 'mark':
      return [{ kind: 'act', ms: 900 }]
    case 'compare':
      return [{ kind: 'act', ms: s.compare ? 400 + (prev?.goal?.parts.length ?? 3) * 250 : 400 }]
    case 'check':
      return [{ kind: 'act', ms: 1200 }]
    case 'sketch':
      return [...tap, { kind: 'act', ms: 500 + 300 * 4 }]
    case 'draw':
      return [...tap, { kind: 'act', ms: 800 }]
    case 'split':
      return [{ kind: 'act', ms: 400 + (prev?.sketch.length ?? 3) * 450 }]
    case 'press':
      return [...tap, { kind: 'act', ms: 900 }]
    case 'cheer':
      return [{ kind: 'act', ms: 2000 }]
    default:
      return [{ kind: 'act', ms: 500 }]
  }
}
function segAt(list: Seg[], local: number): (Seg & { local: number; p: number }) | null {
  let t = 0
  for (const x of list) {
    if (local < t + x.ms) return { ...x, local: local - t, p: kit.clamp((local - t) / x.ms) }
    t += x.ms
  }
  return null
}

/** 草圖的動作:換範本、畫一格、拆成句子(範本放在狀態裡,apply 拿不到 props) */
function sketchApply(st: HelperState, kind: Kind, s: Step): HelperState | null {
  if (kind === 'sketch') {
    if (s.sketch === 'blank') return { ...st, sketch: [], split: false }
    const t = st.templates.find((x) => x.id === s.sketch)
    if (!t) throw new Error(`sketch:templates 裡沒有「${String(s.sketch)}」`)
    return { ...st, sketch: t.boxes, split: false }
  }
  if (kind === 'draw') {
    const n = st.sketch.length + 1
    const box: Box | undefined = typeof s.draw === 'string' ? (isPartKind(s.draw) ? { id: `b${n}`, kind: s.draw, label: PEN[s.draw].name } : undefined) : s.draw
    if (!box || !box.id || !isPartKind(box.kind)) throw new Error(`draw 要是 ${PART_KINDS.join('、')},或完整的格子 { id, kind, label }`)
    if (st.sketch.some((x) => x.id === box.id)) throw new Error(`draw:格子 id「${box.id}」已經有了`)
    return { ...st, sketch: [...st.sketch, box], split: false }
  }
  if (kind === 'split') {
    if (!st.sketch.length) throw new Error('split:草圖上還沒有格子')
    const n = st.sketch.length
    // 每一句加的部分放在「草圖上前面那幾格」裡、已經做好的最後一格後面;前面都還沒做就放最上面
    const cards: Card[] = st.sketch.map((b, i) => ({ id: b.id, text: sayOfBox(b, i, n), ops: [{ add: partOfBox(b), after: st.sketch.slice(0, i).map((x) => x.id).reverse() }] }))
    return { ...st, cards, draft: [], split: true }
  }
  return null
}

const actor = defineActor<Kind, Step, Props, HelperState, string>({
  name: 'lt11-helper',
  kinds: KINDS,

  hotspots(st, props) {
    // 沒寫 interact.spots 時的預設:點卡片就說出這張卡片(compose 時是放進句子裡)
    return st.cards.map((c) => ({ target: `card:${c.id}`, label: c.text.replace(/\[\[|\]\]/g, ''), step: props.compose ? { pick: c.id } : { ask: c.id } }))
  },

  init(props) {
    const page = checkPage(props.page, 'page')
    const goal = props.goal ? checkPage(props.goal, 'goal') : null
    const cards = props.cards ?? []
    const ids = new Set<string>()
    for (const c of cards) {
      if (!c.id || typeof c.text !== 'string') throw new Error('cards:每張卡片都要有 id 和 text')
      if (ids.has(c.id)) throw new Error(`cards:id「${c.id}」重複了`)
      ids.add(c.id)
    }
    for (const t of props.templates ?? []) if (!t.id || !Array.isArray(t.boxes)) throw new Error('templates:每個範本都要有 id 和 boxes')
    const sketch = props.sketch ?? []
    for (const b of sketch) if (!b.id || !isPartKind(b.kind)) throw new Error('sketch:每一格都要有 id 和 kind')
    return finish({
      page, goal, cards, draft: [], chat: [], mood: 'idle', stars: [], ok: [], built: [], marks: [], sames: [], compare: false,
      sketch, split: false, asked: [], sent: 0, presses: {}, pressed: 0, verdict: null, cheer: false, templates: props.templates ?? [],
    })
  },

  apply(st0, kind, s) {
    const st: HelperState = { ...st0, verdict: null, cheer: false }
    const drawn = sketchApply(st, kind, s)
    if (drawn) return finish(drawn)
    const r = responseOf(st, kind, s)
    if (r) {
      const chat = [...st.chat]
      if (r.me !== null) chat.push({ from: 'me', text: r.me })
      if (r.reply) chat.push({ from: 'bot', text: r.reply, mood: r.mood })
      const stars = [...st.stars, ...r.stars.filter((x) => !st.stars.includes(x))]
      const asked = [...st.asked, ...r.cards.filter((x) => !st.asked.includes(x))]
      return finish({
        ...st,
        page: applyOps(st.page, r.ops, r.loose),
        chat,
        mood: r.reply ? r.mood : st.mood,
        stars,
        asked,
        draft: kind === 'send' && s.send === true ? [] : st.draft,
        sent: st.sent + (r.me !== null ? 1 : 0),
      })
    }
    switch (kind) {
      case 'pick': {
        cardById(st, s.pick, 'pick')
        // 再點一次已經放進去的卡片,就拿出來
        if (st.draft.includes(s.pick!)) return { ...st, draft: st.draft.filter((x) => x !== s.pick) }
        return { ...st, draft: [...st.draft, s.pick!] }
      }
      case 'unpick':
        if (!st.draft.includes(s.unpick!)) throw new Error(`unpick:「${s.unpick}」不在你要說的話裡`)
        return { ...st, draft: st.draft.filter((x) => x !== s.unpick) }
      case 'clear':
        return { ...st, draft: [] }
      case 'deal': {
        if (!Array.isArray(s.deal)) throw new Error('deal 要寫卡片的陣列')
        for (const c of s.deal) if (!c.id || typeof c.text !== 'string') throw new Error('deal:每張卡片都要有 id 和 text')
        return { ...st, cards: s.deal, draft: [], split: false }
      }
      case 'mark': {
        if (s.mark === false) return { ...st, marks: [], sames: [] }
        if (!st.page.parts.some((x) => x.id === s.mark)) throw new Error(`mark:網頁上沒有「${String(s.mark)}」`)
        const id = s.mark as string
        if (s.same) return { ...st, sames: st.sames.includes(id) ? st.sames : [...st.sames, id] }
        return { ...st, marks: st.marks.includes(id) ? st.marks : [...st.marks, id] }
      }
      case 'compare':
        if (s.compare && !st.goal) throw new Error('compare:沒有目標圖(props.goal)')
        return { ...st, compare: !!s.compare }
      case 'check':
        if (s.check === false) return st
        if (typeof s.check !== 'string' || typeof s.answer !== 'string') throw new Error('check 和 answer 都要寫目標名稱,例如 { "check": "part:h1", "answer": "part:h1" }')
        return { ...st, verdict: { target: s.check, right: s.check === s.answer } }
      case 'press': {
        const p = st.page.parts.find((x) => x.id === s.press)
        if (!p) throw new Error(`press:網頁上沒有「${String(s.press)}」`)
        if (p.kind !== 'button' && p.kind !== 'game' && p.kind !== 'link') throw new Error(`press:「${p.id}」不是按鈕或小遊戲`)
        return { ...st, presses: { ...st.presses, [p.id]: (st.presses[p.id] ?? 0) + 1 }, pressed: st.pressed + 1 }
      }
      case 'cheer':
        return { ...st, cheer: true }
      default:
        return st
    }
  },

  duration(kind, step, _props, prev) {
    return segments(kind, step, prev).reduce((n, x) => n + x.ms, 0)
  },

  cursor(kind, step) {
    if (!step.tap) return null
    const to: Record<string, string | undefined> = {
      ask: step.ask ? `card:${step.ask}` : undefined,
      pick: step.pick ? `card:${step.pick}` : undefined,
      unpick: step.unpick ? `card:${step.unpick}` : undefined,
      send: 'send',
      press: step.press ? `part:${step.press}` : undefined,
      sketch: step.sketch ? `tpl:${step.sketch}` : undefined,
      draw: typeof step.draw === 'string' ? `tool:${step.draw}` : undefined,
    }
    const target = to[kind]
    return target ? { moves: [{ at: 150, target }], clickAt: TAP_AT } : null
  },

  mount(root, props) {
    root.classList.add('A-lt11-helper')
    const paperMode = props.paper ?? (props.goal ? 'goal' : props.sketch || props.templates || props.palette ? 'sketch' : 'none')
    root.dataset.paper = paperMode === 'none' ? 'false' : 'true'
    root.dataset.compose = props.compose ? 'true' : 'false'
    const tpls = props.templates ?? []
    root.innerHTML = `
      <section class="lh-paper">
        <p class="lh-label">${paperMode === 'goal' ? '🎯 目標' : '✏️ 草圖'}</p>
        ${tpls.length ? `<div class="lh-tpls">${tpls.map((t) => `<span class="lh-tpl" data-id="${kit.esc(t.id)}">${kit.esc(t.emoji ?? '📄')} ${kit.esc(t.name)}</span>`).join('')}</div>` : ''}
        ${props.palette ? `<div class="lh-pens">${PALETTE.map((k) => `<span class="lh-pen" data-kind="${k}">${PEN[k].icon} ${PEN[k].name}</span>`).join('')}</div>` : ''}
        <div class="lh-sheet"></div>
        <p class="lh-score"></p>
      </section>
      <section class="lh-web">
        <div class="lh-bar"><span class="lh-lights"><i></i><i></i><i></i></span><span class="lh-title">小幫手做的網頁</span></div>
        <div class="lh-page"></div>
      </section>
      <section class="lh-side">
        <div class="lh-head">
          <div class="lh-bot">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <line x1="60" y1="8" x2="60" y2="26" stroke="#2b2620" stroke-width="6" stroke-linecap="round"/>
              <circle class="lh-bulb" cx="60" cy="10" r="9" stroke="#2b2620" stroke-width="5"/>
              <rect x="14" y="26" width="92" height="78" rx="26" fill="#9fd8ff" stroke="#2b2620" stroke-width="6"/>
              <rect x="26" y="40" width="68" height="44" rx="18" fill="#fff" stroke="#2b2620" stroke-width="5"/>
              <g class="lh-eyes"></g>
              <path class="lh-mouth" fill="none" stroke="#2b2620" stroke-width="5" stroke-linecap="round"/>
              <circle cx="8" cy="64" r="8" fill="#ffb3c7" stroke="#2b2620" stroke-width="5"/>
              <circle cx="112" cy="64" r="8" fill="#ffb3c7" stroke="#2b2620" stroke-width="5"/>
            </svg>
            <b class="lh-q">？</b>
          </div>
          <div class="lh-name"><strong>小幫手</strong><small class="lh-status"></small></div>
          <div class="lh-stars"></div>
        </div>
        <div class="lh-chat"></div>
      </section>
      <section class="lh-tray">
        <div class="lh-compose"><span class="lh-say"></span><span class="lh-send">送出 ➜</span></div>
        <div class="lh-cards"></div>
      </section>
      <div class="lh-cheer"></div>`
    const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!
    const paper = $('.lh-paper')
    const sheet = $('.lh-sheet')
    const score = $('.lh-score')
    const pageEl = $('.lh-page')
    const bot = $('.lh-bot')
    const eyes = root.querySelector<SVGGElement>('.lh-eyes')!
    const mouth = root.querySelector<SVGPathElement>('.lh-mouth')!
    const bulb = root.querySelector<SVGCircleElement>('.lh-bulb')!
    const q = $('.lh-q')
    const status = $('.lh-status')
    const starsEl = $('.lh-stars')
    const chatEl = $('.lh-chat')
    const tray = $('.lh-tray')
    const compose = $('.lh-compose')
    const sayEl = $('.lh-say')
    const sendBtn = $('.lh-send')
    const cardsEl = $('.lh-cards')
    const cheerEl = $('.lh-cheer')
    const isTall = kit.tallWatch(root)
    // 彩帶:位置、顏色固定(kit.rand),畫面只看時間
    const r = kit.rand('lt11-cheer')
    const bits = Array.from({ length: 36 }, (_, i) => ({ x: r() * 100, d: 0.6 + r() * 0.5, s: (r() - 0.5) * 30, ch: i % 4 === 0 ? '⭐' : '', c: ['#ff6b8b', '#ffd84d', '#5cc477', '#58a6ff', '#b18cff'][i % 5] }))
    cheerEl.innerHTML = bits.map((b) => (b.ch ? `<i class="star">${b.ch}</i>` : `<i style="background:${b.c}"></i>`)).join('')
    const bitEls = [...cheerEl.children] as HTMLElement[]

    const find = (name: string): HTMLElement | null => {
      if (name === 'window') return root
      if (name === 'helper') return bot
      if (name === 'chat') return chatEl
      if (name === 'page') return pageEl
      if (name === 'paper') return paperMode === 'none' ? null : paper
      if (name === 'tray') return tray
      if (name === 'compose') return props.compose ? compose : null
      if (name === 'send') return props.compose ? sendBtn : null
      if (name === 'stars') return props.starsOf ? starsEl : null
      const m = /^(part|goal|box|card|tpl|tool):(.+)$/.exec(name)
      if (!m) return null
      const sel = { part: '.lh-page .lh-part', goal: '.lh-sheet .lh-part', box: '.lh-box', card: '.lh-card', tpl: '.lh-tpl', tool: '.lh-pen' }[m[1]]!
      const attr = m[1] === 'tool' ? 'kind' : 'id'
      return root.querySelector<HTMLElement>(`${sel}[data-${attr}="${CSS.escape(m[2])}"]`)
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as Kind) ? view.ev : null
        const kind = ev?.kind as Kind | undefined
        const step = (ev?.step ?? {}) as Step
        const from = view.prev
        const to = view.ev?.kind === 'hide' ? view.prev : view.state
        const seg = ev && kind ? segAt(segments(kind, step, from), ev.local) : null
        const tall = isTall()
        if (root.dataset.tall !== String(tall)) root.dataset.tall = String(tall)
        let resp: Response | null = null
        if (ev && kind) {
          try {
            resp = responseOf(from, kind, step)
          } catch {
            resp = null
          }
        }

        // ── 網頁:想好之後一項一項改,正在改的那一塊亮一下 ──
        let page = to.page
        let glow: { id: string; p: number } | null = null
        if (resp && seg && resp.ops.length) {
          if (seg.kind === 'tap' || seg.kind === 'say' || seg.kind === 'think') page = from.page
          else if (seg.kind === 'op') {
            page = applyOps(from.page, resp.ops.slice(0, (seg.i ?? 0) + 1), resp.loose)
            glow = { id: opTarget(resp.ops[seg.i ?? 0]), p: seg.p }
          }
        }
        const pressing = kind === 'press' && seg?.kind === 'act' ? { id: step.press!, p: seg.p } : null
        const presses = pressing && seg && seg.p < 0.3 ? from.presses : to.presses
        const markP = kind === 'mark' && seg?.kind === 'act' ? seg.p : 1
        // anim:動畫進行中的畫面和靜止的畫面 html 不同,倒轉、跳段時一定重建,不會留下前一格的 style
        const anim = glow ? `glow:${glow.id}` : pressing ? `press:${pressing.id}` : kind === 'mark' && markP < 1 ? 'mark' : ''
        kit.setIf(pageEl, 'html', pageHtml(page, { presses, marks: to.marks, sames: to.sames, anim }))
        pageEl.style.background = page.bg ?? '#fffdf7'
        if (glow) {
          const el = pageEl.querySelector<HTMLElement>(`.lh-part[data-id="${CSS.escape(glow.id)}"]`)
          if (el) {
            const e = kit.ease.outBack(kit.clamp(glow.p / 0.6))
            kit.css(el, { transform: `scale(${(0.7 + 0.3 * e).toFixed(3)})`, opacity: kit.clamp(glow.p / 0.3).toFixed(3) })
            el.dataset.glow = 'true'
          }
        }
        if (pressing) {
          const el = pageEl.querySelector<HTMLElement>(`.lh-part[data-id="${CSS.escape(pressing.id)}"] .lh-btn`)
          if (el) kit.css(el, { transform: pressing.p < 0.25 ? 'translateY(6px)' : 'none' })
        }
        if (kind === 'mark' && typeof step.mark === 'string') {
          const el = pageEl.querySelector<HTMLElement>(`.lh-part[data-id="${CSS.escape(step.mark)}"] .lh-ring`)
          if (el) kit.css(el, { opacity: kit.clamp(markP / 0.4).toFixed(3), transform: `scale(${(1.3 - 0.3 * kit.ease.outCubic(kit.clamp(markP / 0.5))).toFixed(3)})` })
        }

        // ── 左邊的紙:目標圖(一格一格打勾)或草圖 ──
        if (paperMode === 'goal' && to.goal) {
          const n = kind === 'compare' && step.compare && seg ? Math.floor(kit.clamp((seg.local - 400) / 250, 0, 99)) : 99
          const okSet = new Set(kit.clamp(n, 0, 99) >= 0 ? to.ok : [])
          const showMarks = to.compare
          kit.setIf(sheet, 'html', pageHtml(to.goal, { presses: {}, marks: [], sames: [], badges: showMarks ? { ok: okSet, upto: n } : undefined }))
          sheet.style.background = to.goal.bg ?? '#fffdf7'
          const total = to.goal.parts.length + (to.goal.bg ? 1 : 0)
          kit.setIf(score, 'text', showMarks ? `一樣的：${to.ok.length} / ${total}` : '')
        } else if (paperMode === 'sketch') {
          let boxes = to.sketch
          let reveal = 99
          if (kind === 'sketch' && seg?.kind === 'act') reveal = Math.floor(seg.local / 300) - 1
          if ((kind === 'sketch' || kind === 'draw') && seg?.kind === 'tap') boxes = from.sketch
          const numbered = to.split ? (kind === 'split' && seg ? Math.floor((seg.local - 400) / 450) + 1 : 99) : 0
          kit.setIf(sheet, 'html', sketchHtml(boxes, reveal, numbered) + (kind === 'draw' && seg?.kind === 'act' ? '<i hidden data-anim="draw"></i>' : ''))
          if (kind === 'draw' && seg?.kind === 'act') {
            const all = sheet.querySelectorAll<HTMLElement>('.lh-box')
            const last = all[all.length - 1]
            if (last) kit.css(last, kit.enter(seg.p, { dist: '0.8em' }))
          }
          sheet.style.background = ''
          kit.setIf(score, 'text', '')
          for (const el of paper.querySelectorAll<HTMLElement>('.lh-tpl')) el.dataset.on = kind === 'sketch' && step.sketch === el.dataset.id && seg?.kind !== 'act' ? 'true' : 'false'
          for (const el of paper.querySelectorAll<HTMLElement>('.lh-pen')) el.dataset.on = kind === 'draw' && step.draw === el.dataset.kind && seg?.kind === 'tap' ? 'true' : 'false'
        }

        // ── 小幫手的臉:想的時候眼睛往上、燈泡亮;聽不懂時頭上冒問號 ──
        const thinking = !!seg && (seg.kind === 'think' || seg.kind === 'op')
        const mood: Mood = thinking ? 'idle' : seg?.kind === 'reply' && resp ? resp.mood : seg && resp ? from.mood : to.mood
        const lookUp = thinking ? -6 : 0
        kit.setIf(
          eyes,
          'innerHTML',
          mood === 'happy'
            ? `<path d="M40 ${64 + lookUp} q8 -10 16 0 M64 ${64 + lookUp} q8 -10 16 0" fill="none" stroke="#2b2620" stroke-width="5" stroke-linecap="round"/>`
            : `<circle cx="48" cy="${60 + lookUp}" r="6" fill="#2b2620"/><circle cx="72" cy="${60 + lookUp}" r="6" fill="#2b2620"/>`,
        )
        mouth.setAttribute('d', mood === 'happy' ? 'M48 72 q12 10 24 0' : mood === 'puzzled' ? 'M50 76 q6 -4 10 0 q6 4 10 0' : thinking ? 'M54 75 h12' : 'M50 73 q10 6 20 0')
        bulb.setAttribute('fill', thinking && Math.floor((seg?.local ?? 0) / 300) % 2 === 0 ? '#ffd84d' : '#fff3c4')
        q.dataset.show = mood === 'puzzled' && !thinking ? 'true' : 'false'
        kit.setIf(status, 'text', seg?.kind === 'op' ? '做做看…' : thinking ? `想一想${kit.dots(seg!.local)}` : mood === 'puzzled' ? '聽不太懂' : '等你說')
        if (props.starsOf) {
          const got = resp && seg && seg.kind !== 'reply' ? from.stars.length : to.stars.length
          kit.setIf(starsEl, 'html', Array.from({ length: Math.max(props.starsOf, got) }, (_, i) => `<i data-on="${i < got}">${i < got ? '⭐' : '☆'}</i>`).join(''))
        }

        // ── 對話:我說的話滑進來,小幫手先想,做完才回答(一個字一個字打出來) ──
        let msgs: { from: 'me' | 'bot'; html: string; mood?: Mood; enter?: number }[] = to.chat.map((m) => ({ from: m.from, html: rich(m.text), mood: m.mood }))
        if (resp && seg) {
          const base = from.chat.map((m) => ({ from: m.from, html: rich(m.text), mood: m.mood }))
          const me = resp.me !== null ? [{ from: 'me' as const, html: rich(resp.me), enter: seg.kind === 'say' ? seg.p : 1 }] : []
          if (seg.kind === 'tap') msgs = base
          else if (seg.kind === 'say') msgs = [...base, ...me]
          else if (seg.kind === 'think' || seg.kind === 'op') msgs = [...base, ...me, { from: 'bot', html: `<span class="lh-dots">${seg.kind === 'op' ? '🔧 ' : ''}${kit.dots(seg.local)}</span>` }]
          else if (seg.kind === 'reply' && resp.reply) {
            const typed = kit.typewriter(resp.reply, seg.local, { cps: REPLY_CPS })
            msgs = [...base, ...me, { from: 'bot', html: rich(typed.text), mood: resp.mood }]
          }
        }
        const recent = msgs.slice(-(tall ? 2 : 3))
        const entering = recent.length && recent[recent.length - 1].enter !== undefined && recent[recent.length - 1].enter! < 1
        kit.setIf(chatEl, 'html', recent.map((m) => `<p class="lh-msg" data-from="${m.from}" data-mood="${m.mood ?? ''}">${m.from === 'me' ? '<em>🧒</em>' : ''}<span>${m.html}</span></p>`).join('') + (entering ? '<i hidden></i>' : ''))
        const lastMe = entering ? chatEl.querySelector('.lh-msg:last-of-type') : null
        if (lastMe instanceof HTMLElement) kit.css(lastMe, kit.enter(recent[recent.length - 1].enter!, { dir: 'up', dist: '1.4em' }))

        // ── 卡片盤:放進句子的卡片變淡;說過的卡片右上角有小勾 ──
        let draft = to.draft
        let cards = to.cards
        if (seg && (seg.kind === 'tap' || (kind === 'send' && seg.kind === 'say'))) draft = from.draft
        if (kind === 'deal' && seg && seg.p < 0.2) cards = from.cards
        const activeCard = kind === 'ask' && seg && (seg.kind === 'tap' || seg.kind === 'say') ? step.ask : kind === 'pick' || kind === 'unpick' ? (step.pick ?? step.unpick) : null
        // 拆成句子:一句一句出現,標上第幾句
        const numbered = to.split && kind !== 'deal' ? (kind === 'split' && seg ? Math.floor((seg.local - 400) / 450) + 1 : 99) : 0
        kit.setIf(
          cardsEl,
          'html',
          cards
            .map(
              (c, i) =>
                `<span class="lh-card" data-id="${kit.esc(c.id)}" data-in="${draft.includes(c.id)}" data-asked="${to.asked.includes(c.id)}" data-on="${activeCard === c.id}"${to.split && i >= numbered ? ' style="visibility:hidden"' : ''}>${c.tag ? `<small>${kit.esc(c.tag)}</small>` : ''}${to.split && kind !== 'deal' ? `<small>第 ${i + 1} 句</small>` : ''}<span>${rich(c.text)}</span></span>`,
            )
            .join('') + (kind === 'deal' && seg ? '<i hidden></i>' : ''),
        )
        if (kind === 'deal' && seg) {
          ;[...cardsEl.querySelectorAll('.lh-card')].forEach((el, i) => kit.css(el as HTMLElement, kit.enter(kit.clamp((seg.local - 300 - i * 120) / 300), { dist: '1em' })))
        }
        if (props.compose) {
          const words = draft.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => !!c)
          kit.setIf(sayEl, 'html', words.length ? words.map((c) => `<b>${rich(c.text)}</b>`).join('<i>，</i>') : '<s>點卡片，拼出你要說的話</s>')
          kit.css(sendBtn, { transform: kind === 'send' && seg?.kind === 'tap' && seg.p > 0.9 ? 'translateY(4px)' : 'none' })
          sendBtn.dataset.ready = words.length ? 'true' : 'false'
        }

        // ── 回答題目、彩帶 ──
        const v = to.verdict
        for (const el of root.querySelectorAll<HTMLElement>('[data-verdict]')) {
          el.dataset.verdict = ''
          el.style.translate = ''
        }
        if (v) {
          const el = find(v.target)
          if (el) {
            el.dataset.verdict = v.right ? 'right' : 'wrong'
            const shake = !v.right && kind === 'check' && ev ? Math.sin(ev.p * Math.PI * 6) * (1 - ev.p) * 14 : 0
            kit.css(el, { translate: `${shake.toFixed(2)}px 0` })
          }
        }
        const cheerP = kind === 'cheer' && ev ? ev.p : -1
        cheerEl.dataset.show = cheerP >= 0 && cheerP < 1 ? 'true' : 'false'
        if (cheerP >= 0 && cheerP < 1) {
          bits.forEach((b, i) => {
            const y = -10 + kit.clamp(cheerP / b.d) * 120
            kit.css(bitEls[i], { left: `${b.x.toFixed(1)}%`, top: `${y.toFixed(1)}%`, transform: `rotate(${(b.s * cheerP * 20).toFixed(1)}deg)`, opacity: (1 - kit.clamp((cheerP - 0.8) / 0.2)).toFixed(2) })
          })
        }
      },

      target(name) {
        return find(name)
      },
    }
  },
})

/** 卡片與對話的文字:[[名詞]] 畫成重點字 */
const rich = (s: string): string => kit.esc(s).replace(/\[\[(.+?)\]\]/g, '<b class="lh-em">$1</b>')

const SIZE: Record<string, number> = { s: 0.75, m: 0.9, l: 1, xl: 1.3 }
/** 畫出網頁(做出來的網頁、目標圖共用);badges 是目標圖上的打勾(前 upto 格) */
function pageHtml(
  page: PageSpec,
  o: { presses: Record<string, number>; marks: string[]; sames: string[]; badges?: { ok: Set<string>; upto: number }; anim?: string },
): string {
  if (!page.parts.length) return '<p class="lh-blank">（還是空空的）</p>'
  const n = page.parts.length
  const fit = n <= 3 ? 1 : n === 4 ? 0.92 : n === 5 ? 0.82 : 0.72
  const parts = page.parts
    .map((p, i) => {
      const st: string[] = []
      if (p.color) st.push(`color:${p.color}`)
      if (p.align) st.push(`text-align:${p.align}`)
      const k = SIZE[p.size ?? 'l'] ?? 1
      st.push(`--k:${k}`)
      if (p.bold) st.push('font-weight:900')
      const bg = p.bg ? ` style="background:${kit.esc(p.bg)}"` : ''
      let inner = ''
      if (p.kind === 'img') inner = `<span class="lh-img"${bg}>${kit.esc(p.emoji ?? '🖼️')}</span>`
      else if (p.kind === 'ul' || p.kind === 'ol')
        inner = `<${p.kind === 'ul' ? 'ul' : 'ol'} class="lh-list"${bg}>${(p.items ?? []).map((x) => `<li>${kit.esc(x)}</li>`).join('')}</${p.kind === 'ul' ? 'ul' : 'ol'}>`
      else if (p.kind === 'button') inner = `<span class="lh-btn"${bg}>${kit.esc(p.text ?? '按鈕')}</span>`
      else if (p.kind === 'link') inner = `<span class="lh-link">🔗 ${kit.esc(p.text ?? '連結')}</span>`
      else if (p.kind === 'game') {
        const res = p.results ?? ['🎲']
        const c = o.presses[p.id] ?? 0
        inner = `<span class="lh-game"${bg}><span>${kit.esc(p.text ?? '小遊戲')}</span><b>${c ? kit.esc(res[(c - 1) % res.length]) : '❓'}</b><span class="lh-btn">${kit.esc(p.button ?? '按我')}</span></span>`
      } else inner = `<span class="lh-txt"${bg}>${kit.esc(p.text ?? '')}</span>`
      let badge = ''
      if (o.badges && i < o.badges.upto) badge = `<em class="lh-badge" data-ok="${o.badges.ok.has(p.id)}">${o.badges.ok.has(p.id) ? '✓' : '✗'}</em>`
      const ring = o.marks.includes(p.id) ? '<em class="lh-ring"><span>不一樣</span></em>' : o.sames.includes(p.id) ? '<em class="lh-ring" data-same="true"><span>一樣 ✓</span></em>' : ''
      return `<div class="lh-part" data-id="${kit.esc(p.id)}" data-kind="${p.kind}" style="${st.join(';')}">${inner}${badge}${ring}</div>`
    })
    .join('')
  return `<div class="lh-site" style="--fit:${fit}" data-anim="${kit.esc(o.anim ?? '')}">${parts}</div>`
}

/** 畫出草圖:格子依序出現(reveal),拆成句子後標上第幾句(numbered:前幾格有編號) */
function sketchHtml(boxes: Box[], reveal: number, numbered: number): string {
  if (!boxes.length) return '<p class="lh-blank">（一張空白的紙）</p>'
  return boxes
    .map((b, i) => {
      const hidden = i > reveal ? ' data-hide="true"' : ''
      const num = i < numbered ? `<i>${i + 1}</i>` : ''
      return `<div class="lh-box" data-id="${kit.esc(b.id)}" data-kind="${b.kind}"${hidden}>${num}<span>${PEN[b.kind].icon}</span><b>${kit.esc(b.label)}</b></div>`
    })
    .join('')
}

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
