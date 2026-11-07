import { describe, expect, it } from 'vitest'
import actor, { type DomNode } from './actor'

const nodes: DomNode[] = [
  {
    id: 'main',
    tag: 'main',
    children: [
      { id: 'title', tag: 'h1', text: '小森咖啡' },
      { id: 'photo', tag: 'img', void: true },
      { id: 'intro', tag: 'p', text: '介紹' },
      { id: 'add', tag: 'button', text: '加入購物車' },
    ],
  },
]
const props = { nodes }
const grown = () => actor.apply!(actor.init!(props), 'grow', { grow: true })
const ids = (list: DomNode[]): string => list.map((n) => (n.children ? `${n.id}(${ids(n.children)})` : n.id)).join(',')

describe('dom-tree', () => {
  it('一開始只長出第一個元素,grow 長到指定的元素或全部', () => {
    const st = actor.init!(props)
    expect(st.shown).toBe(1)
    expect(actor.apply!(st, 'grow', { grow: 'photo' }).shown).toBe(3)
    expect(grown().shown).toBe(5)
  })

  it('wrap 把同一層相鄰的元素包進新容器,unwrap 拆回原本那一層', () => {
    const wrapped = actor.apply!(grown(), 'wrap', { wrap: ['photo', 'add'], into: { id: 'card', tag: 'div' } })
    expect(ids(wrapped.tree)).toBe('main(title,card(photo,intro,add))')
    expect(wrapped.shown).toBe(6)
    const back = actor.apply!(wrapped, 'unwrap', { unwrap: 'card' })
    expect(ids(back.tree)).toBe('main(title,photo,intro,add)')
  })

  it('不合理的操作載入時就報錯', () => {
    expect(() => actor.apply!(actor.init!(props), 'wrap', { wrap: ['photo'], into: { id: 'card', tag: 'div' } })).toThrow(/先把元素都長出來/)
    expect(() => actor.apply!(grown(), 'wrap', { wrap: ['title', 'main'], into: { id: 'x', tag: 'div' } })).toThrow(/同一層/)
    expect(() => actor.apply!(grown(), 'anatomy', { anatomy: 'main' })).toThrow(/容器/)
    expect(() => actor.init!({ nodes: [{ id: 'a', tag: 'img', void: true, text: 'x' }] })).toThrow(/void/)
  })
})
