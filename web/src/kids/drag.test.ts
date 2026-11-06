import { describe, expect, it } from 'vitest'
import kidTree, { drawOrder, type TreeState } from '../live/actors/kid-tree/actor'
import { dragPlan } from './drag'

// 拖曳層給的每一個放置位置,都要是 kid-tree 演員接受的操作,而且放下去的位置和看到的那條縫一致。

const init = () =>
  kidTree.init!({
    goals: [
      { id: 'img-top', label: '', first: 'img' },
      { id: 'button-in-card', label: '', inside: ['button', 'card'] },
    ],
  }) as TreeState

describe('kid-tree 的拖放', () => {
  it('每個節點、每個放置位置都是演員接受的移動', () => {
    const st = init()
    const plan = dragPlan('kid-tree', 'kid', st)!
    expect(plan.items.map((x) => x.id).sort()).toEqual(['button', 'card', 'h1', 'img', 'p'])
    for (const it of plan.items) for (const d of plan.slotsFor(it.id)) expect(() => kidTree.apply!(st, 'put', d.step as never)).not.toThrow()
  })

  it('名片盒不能放進自己裡面;放回原位不算一個位置', () => {
    const plan = dragPlan('kid-tree', 'kid', init())!
    expect(plan.slotsFor('card').some((d) => d.target.includes(':slot:card:'))).toBe(false)
    expect(plan.slotsFor('h1').map((d) => d.target)).not.toContain('kid:slot:root:0')
    expect(plan.slotsFor('h1').map((d) => d.target)).not.toContain('kid:slot:root:1')
  })

  it('放在縫上,節點就到那條縫的位置;完成任務記進 achieved', () => {
    const st = init()
    const plan = dragPlan('kid-tree', 'kid', st)!
    // 圖片放到 root 的最上面那條縫
    const top = plan.slotsFor('img').find((d) => d.target === 'kid:slot:root:0')!
    const a = kidTree.apply!(st, 'put', top.step as never) as TreeState
    expect(drawOrder(a.kids)[0]).toBe('img')
    expect(a.achieved).toContain('img-top')
    // 標題往下放到按鈕後面(同一個容器,往下放 index 要減一)
    const last = plan.slotsFor('h1').find((d) => d.target === 'kid:slot:root:3')!
    const b = kidTree.apply!(st, 'put', last.step as never) as TreeState
    expect(b.kids.root).toEqual(['card', 'button', 'h1'])
    // 按鈕放進名片盒
    const inCard = plan.slotsFor('button').find((d) => d.target === 'kid:slot:card:2')!
    const c = kidTree.apply!(st, 'put', inCard.step as never) as TreeState
    expect(c.kids.card).toEqual(['img', 'p', 'button'])
    expect(c.achieved).toContain('button-in-card')
  })
})
