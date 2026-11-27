// agent-studio 的資料與規則(不碰畫面):網頁由哪些區塊組成、Agent 怎麼改它、測試檢查哪些事。
import { kit } from '../../kit'

export type Look = 'dev' | 'kids'
export type BlockKind = 'title' | 'text' | 'image' | 'list' | 'button'
export interface Block {
  id: string
  kind: BlockKind
  text?: string
  emoji?: string
  items?: string[]
  /** button:按下去會發生什麼;沒寫就是按了沒反應 */
  does?: string
  /** image:說明文字 */
  alt?: string
  /** 在手機寬度會超出畫面 */
  wide?: boolean
  color?: string
  bg?: string
  size?: 's' | 'm' | 'l' | 'xl'
  align?: 'left' | 'center'
}
export interface Page {
  bg: string
  blocks: Block[]
}

/** Agent 改網頁的做法 */
export type Op =
  | { add: Block; after?: string | null }
  | ({ set: string } & Partial<Omit<Block, 'id' | 'kind'>>)
  | { remove: string }
  | { move: string; after: string | null }

const KINDS: readonly BlockKind[] = ['title', 'text', 'image', 'list', 'button']
const NAMES: Record<Look, Record<BlockKind, string>> = {
  dev: { title: '大標題', text: '段落', image: '圖片', list: '清單', button: '按鈕' },
  kids: { title: '大標題', text: '一段話', image: '圖片', list: '清單', button: '按鈕' },
}

export const emptyPage = (): Page => ({ bg: '#ffffff', blocks: [] })

export function find(page: Page, id: string): number {
  const i = page.blocks.findIndex((b) => b.id === id)
  if (i < 0) throw new Error(`網頁上沒有「${id}」`)
  return i
}

function insert(blocks: Block[], block: Block, after: string | null | undefined): Block[] {
  if (after === undefined) return [...blocks, block]
  const i = after === null ? 0 : find({ bg: '', blocks }, after) + 1
  return [...blocks.slice(0, i), block, ...blocks.slice(i)]
}

export function applyOp(page: Page, op: Op): Page {
  if ('add' in op) {
    const b = op.add
    if (!b?.id || !KINDS.includes(b.kind)) throw new Error(`add 要有 id 與 kind(${KINDS.join('、')})`)
    if (page.blocks.some((x) => x.id === b.id)) throw new Error(`add:網頁上已經有「${b.id}」`)
    return { ...page, blocks: insert(page.blocks, { ...b }, op.after) }
  }
  if ('set' in op) {
    const { set, ...patch } = op
    if (set === 'page') return { ...page, bg: patch.bg ?? page.bg }
    const i = find(page, set)
    return { ...page, blocks: page.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }
  }
  if ('remove' in op) {
    const i = find(page, op.remove)
    return { ...page, blocks: page.blocks.filter((_, j) => j !== i) }
  }
  if ('move' in op) {
    const i = find(page, op.move)
    const rest = page.blocks.filter((_, j) => j !== i)
    return { ...page, blocks: insert(rest, page.blocks[i], op.after) }
  }
  throw new Error('做法要是 add、set、remove 或 move')
}

/** Agent 正在做哪一件事(顯示在對話欄) */
export function opText(look: Look, page: Page, op: Op): string {
  const name = (id: string): string => {
    if (id === 'page') return '背景'
    const b = page.blocks.find((x) => x.id === id)
    return b ? NAMES[look][b.kind] : id
  }
  if ('add' in op) return `加上${NAMES[look][op.add.kind]}`
  if ('set' in op) return `修改${name(op.set)}`
  if ('remove' in op) return `拿掉${name(op.remove)}`
  return `搬動${name(op.move)}`
}

export const blockName = (look: Look, kind: BlockKind): string => NAMES[look][kind]

export type CheckId = 'title' | 'button' | 'alt' | 'phone'
export interface CheckItem {
  id: CheckId
  label: string
  ok: boolean
  /** 第一個有問題的區塊 */
  block?: string
}
const CHECK_LABELS: Record<Look, Record<CheckId, string>> = {
  dev: { title: '頁面有大標題', button: '按鈕按了有反應', alt: '圖片有說明文字', phone: '手機寬度不會超出畫面' },
  kids: { title: '看得出這是什麼網頁', button: '按鈕按了有反應', alt: '圖片有寫上名字', phone: '手機上看得完整' },
}

/** 測試結果完全由網頁內容推算,腳本不用寫哪一項會過 */
export function runChecks(look: Look, page: Page): CheckItem[] {
  const item = (id: CheckId, bad: Block | undefined, ok = !bad): CheckItem => ({ id, label: CHECK_LABELS[look][id], ok, ...(bad ? { block: bad.id } : {}) })
  return [
    item('title', undefined, page.blocks.some((b) => b.kind === 'title')),
    item('button', page.blocks.find((b) => b.kind === 'button' && !b.does)),
    item('alt', page.blocks.find((b) => b.kind === 'image' && !b.alt)),
    item('phone', page.blocks.find((b) => b.wide)),
  ]
}

const attr = (s: string) => kit.esc(s).replace(/"/g, '&quot;')

/** 一個區塊的內容 */
export function blockInner(b: Block): string {
  if (b.kind === 'image') return `<span class="ags-emoji">${kit.esc(b.emoji ?? '🖼️')}</span>${b.alt ? `<span class="ags-alt">${kit.esc(b.alt)}</span>` : ''}`
  if (b.kind === 'list') return `<ul>${(b.items ?? []).map((x) => `<li>${kit.esc(x)}</li>`).join('')}</ul>`
  if (b.kind === 'button') return `<span class="ags-pbtn"${b.bg ? ` style="background:${attr(b.bg)}"` : ''}>${kit.esc(b.text ?? '')}</span>`
  return kit.esc(b.text ?? '')
}

export function blockStyle(b: Block): string {
  const out: string[] = []
  if (b.color) out.push(`color:${b.color}`)
  if (b.bg && b.kind !== 'button') out.push(`background:${b.bg}`)
  if (b.align) out.push(`text-align:${b.align}`)
  return attr(out.join(';'))
}

/** 指令卡:孩子點一張,就是跟小幫手說這句話;小幫手照卡片寫好的做法改網頁 */
export interface Card {
  id: string
  text: string
  emoji?: string
  ops: Op[]
  reply?: string
  /** 網頁上要先有這個區塊,卡片才出現 */
  needs?: string
}

/** 這張卡片現在做得到的部分(例如還沒有按鈕,就改不了按鈕);做了等於沒改時回傳空陣列 */
export function usableOps(page: Page, card: Card): Op[] {
  if (card.needs && !page.blocks.some((b) => b.id === card.needs)) return []
  const done: Op[] = []
  let cur = page
  for (const op of card.ops) {
    try {
      cur = applyOp(cur, op)
      done.push(op)
    } catch {
      // 對不上目前的網頁,略過這一項
    }
  }
  return JSON.stringify(cur) === JSON.stringify(page) ? [] : done
}
