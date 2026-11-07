import { describe, expect, it } from 'vitest'
import actor, { drawOrder, type TreeState } from './actor'
import { dragPlan } from '../../../kids/drag'
import lesson from '../../../content/live/web/1.2.json'
import lesson11 from '../../../content/live/web/1.1.json'

// 成人版(look: clean,網頁怎麼運作 1.2):節點寫 tag,id 自己取;任務可以用 parent(直接在某個盒子底下)
const props = lesson.cast.tree.props as Parameters<NonNullable<typeof actor.init>>[0]

describe('kid-tree 成人版(look: clean)', () => {
  it('依 tag 判斷容器,樹的順序照網頁由上往下', () => {
    const st = actor.init!(props) as TreeState
    expect(Object.keys(st.kids)).toEqual(['root', 'picks', 'latte', 'pour'])
    expect(drawOrder(st.kids)).toEqual(['title', 'picks', 'picks-title', 'latte', 'latte-img', 'latte-text', 'pour', 'pour-img', 'pour-text', 'buy'])
    expect(st.labels.buy).toBe('<button> 加入購物車')
  })

  it('任務:inside 算更深層,parent 只算直接在底下(root 是最外層)', () => {
    let st = actor.init!(props) as TreeState
    expect(st.achieved).toEqual([])
    st = actor.apply!(st, 'put', { put: 'pour', parent: 'latte', index: 2 }) as TreeState
    expect(st.achieved).toEqual(['pour-in'])
    st = actor.apply!(st, 'put', { put: 'buy', parent: 'picks', index: 2 }) as TreeState
    expect(st.achieved).toEqual(['pour-in'])
    st = actor.apply!(st, 'put', { put: 'buy', parent: 'root', index: 2 }) as TreeState
    expect(st.achieved).toEqual(['pour-in', 'buy-out'])
  })

  it('不認得的標籤、葉子節點當容器都會報錯', () => {
    expect(() => actor.init!({ look: 'clean', nodes: [{ id: 'x', tag: 'blink' }] })).toThrow(/不認得的標籤/)
    expect(() => actor.apply!(actor.init!(props), 'put', { put: 'buy', parent: 'title' })).toThrow(/不是可以放東西的地方/)
  })

  it('拖放計畫用節點的標籤當名稱,不能放進自己裡面', () => {
    const plan = dragPlan('kid-tree', 'tree', actor.init!(props))!
    expect(plan.items.find((x) => x.id === 'pour')?.label).toBe('<div> 手沖 NT$ 150')
    expect(plan.slotsFor('picks').some((d) => d.target.startsWith('tree:slot:latte'))).toBe(false)
  })

  it('1.2 的腳本:做完了／直接看答案的示範都讓兩個任務完成', () => {
    const drag = (lesson.steps as { id?: string; options?: { steps: Record<string, unknown>[] }[]; skip?: { steps: Record<string, unknown>[] } }[]).find((s) => s.id === 'drag')!
    for (const steps of [drag.options![0].steps, drag.skip!.steps]) {
      let st = actor.init!(props) as TreeState
      for (const s of steps) if ('put' in s) st = actor.apply!(st, 'put', s) as TreeState
      expect(st.achieved.sort()).toEqual(['buy-out', 'pour-in'])
    }
  })
})

describe('kid-tree:anatomy、wrap、unwrap(網頁怎麼運作 1.1)', () => {
  type P = Parameters<NonNullable<typeof actor.init>>[0]
  const p11 = lesson11.cast.tree.props as P
  const ids = (kids: Record<string, string[]>, at = 'root'): string => (kids[at] ?? []).map((id) => (kids[id] ? `${id}(${ids(kids, id)})` : id)).join(',')
  const grown = () => actor.apply!(actor.init!(p11), 'grow', { grow: true }) as TreeState

  it('anatomy 拆開一個節點並亮起來,false 或其他動作收起', () => {
    const st = actor.apply!(grown(), 'anatomy', { anatomy: 'title' }) as TreeState
    expect(st.anatomy).toBe('title')
    expect(st.focus).toBe('title')
    expect((actor.apply!(st, 'anatomy', { anatomy: false }) as TreeState).anatomy).toBeNull()
    expect((actor.apply!(st, 'inspect', { inspect: 'main' }) as TreeState).anatomy).toBeNull()
    expect(() => actor.apply!(grown(), 'anatomy', { anatomy: 'nope' })).toThrow(/樹上沒有/)
  })

  it('wrap 把同一層相鄰的節點包進新容器,unwrap 拆回原本那一層', () => {
    const wrapped = actor.apply!(grown(), 'wrap', { wrap: ['photo', 'add'], into: { id: 'card', tag: 'div' } }) as TreeState
    expect(ids(wrapped.kids)).toBe('main(title,card(photo,intro,price,add))')
    expect(wrapped.boxes).toEqual({ card: 'div' })
    expect(wrapped.labels.card).toBe('<div>')
    const back = actor.apply!(wrapped, 'unwrap', { unwrap: 'card' }) as TreeState
    expect(ids(back.kids)).toBe('main(title,photo,intro,price,add)')
    expect(back.boxes).toEqual({})
  })

  it('網頁畫好了的話,wrap 之後新的樹也算畫好', () => {
    const st = actor.init!({ ...p11, drawn: true }) as TreeState
    const wrapped = actor.apply!(st, 'wrap', { wrap: ['photo', 'add'], into: { id: 'card', tag: 'div' } }) as TreeState
    expect(wrapped.drawn).toBe(drawOrder(wrapped.kids).length)
  })

  it('mark 可以同時亮好幾個,再做一次取消', () => {
    let st = actor.apply!(grown(), 'mark', { mark: 'title' }) as TreeState
    st = actor.apply!(st, 'mark', { mark: 'price' }) as TreeState
    expect(st.marked).toEqual(['title', 'price'])
    st = actor.apply!(st, 'mark', { mark: 'title' }) as TreeState
    expect(st.marked).toEqual(['price'])
    expect(() => actor.apply!(grown(), 'mark', { mark: 'nope' })).toThrow(/樹上沒有/)
  })

  it('fade 把節點標成藏起來,再做一次恢復', () => {
    const st = actor.apply!(grown(), 'fade', { fade: 'title' }) as TreeState
    expect(st.faded).toEqual(['title'])
    expect((actor.apply!(st, 'fade', { fade: 'title' }) as TreeState).faded).toEqual([])
    expect(() => actor.apply!(grown(), 'fade', { fade: 'nope' })).toThrow(/樹上沒有/)
  })

  it('不合理的 wrap、unwrap 載入時就報錯', () => {
    const into = { id: 'card', tag: 'div' }
    expect(() => actor.apply!(actor.init!(p11), 'wrap', { wrap: ['photo', 'add'], into })).toThrow(/grow/)
    expect(() => actor.apply!(grown(), 'wrap', { wrap: ['title', 'main'], into })).toThrow(/同一層/)
    expect(() => actor.apply!(grown(), 'wrap', { wrap: ['add', 'photo'], into })).toThrow(/前面/)
    expect(() => actor.apply!(grown(), 'wrap', { wrap: ['photo', 'add'], into: { id: 'main', tag: 'div' } })).toThrow(/已經在樹上/)
    expect(() => actor.apply!(grown(), 'wrap', { wrap: ['photo', 'add'], into: { id: 'card', tag: 'p' } })).toThrow(/容器的標籤/)
    expect(() => actor.apply!(grown(), 'unwrap', { unwrap: 'title' })).toThrow(/不是樹上的容器/)
  })

  it('1.1 的結構圖照腳本的動作推算得過:點點看之前包好 div,看完之後維持', () => {
    let st = actor.init!(p11) as TreeState
    const run = (steps: Record<string, unknown>[]) => {
      for (const s of steps) {
        if (s.on && s.on !== 'tree') continue
        const kind = actor.kinds.find((k) => k in s)
        if (kind) st = actor.apply!(st, kind, s as never) as TreeState
      }
    }
    run(lesson11.steps as Record<string, unknown>[])
    expect(ids(st.kids)).toBe('main(title,card(photo,intro,price,add))')
    const explore = (lesson11.steps as { id?: string; options?: { steps: Record<string, unknown>[] }[] }[]).find((s) => s.id === 'explore')!
    run(explore.options![0].steps)
    expect(ids(st.kids)).toBe('main(title,card(photo,intro,price,add))')
  })
})
