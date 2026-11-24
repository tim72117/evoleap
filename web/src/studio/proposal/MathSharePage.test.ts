import { describe, expect, it } from 'vitest'
import { add, fairShare, freshLoaf, MAX_PARTS, reduce, same, shareOf, TASKS, type Loaf } from './MathSharePage'

const loaf = (parts: number, owners: number[]): Loaf => ({ parts, owners })

describe('分食物給動物', () => {
  it('分數加法會約分', () => {
    expect(add([1, 3], [1, 3])).toEqual([2, 3])
    expect(add([1, 2], [1, 2])).toEqual([1, 1])
    expect(same([2, 4], [1, 2])).toBe(true)
  })
  it('2 條麵包 3 隻動物:每條切三份、每隻拿兩塊,各得 2/3', () => {
    const loaves = [loaf(3, [0, 1, 2]), loaf(3, [0, 1, 2])]
    expect(shareOf(loaves, 0)).toEqual([2, 3])
    expect(fairShare(loaves, 3)).toEqual([2, 3])
  })
  it('分得不一樣或還有沒分出去的,不算公平', () => {
    expect(fairShare([loaf(2, [0, 1]), loaf(1, [0])], 2)).toBeNull()
    expect(fairShare([freshLoaf()], 2)).toBeNull()
    expect(fairShare([loaf(2, [0, -1])], 2)).toBeNull()
  })
  it('不同切法也可以公平:3 條 4 隻,每隻 3/4', () => {
    const loaves = [loaf(4, [0, 1, 2, 3]), loaf(4, [0, 1, 2, 3]), loaf(4, [0, 1, 2, 3])]
    expect(fairShare(loaves, 4)).toEqual([3, 4])
  })
  it('每一題的結果都是「麵包 ÷ 動物」;最多切成 MAX_PARTS 份', () => {
    for (const t of TASKS) {
      const all = [...Array(t.loaves)].map(() => loaf(t.animals, [...Array(t.animals).keys()]))
      expect(fairShare(all, t.animals)).toEqual(reduce([t.loaves, t.animals]))
      expect(t.animals).toBeLessThanOrEqual(MAX_PARTS)
    }
  })
})
