import { describe, expect, it } from 'vitest'
import { drawerSummary, nextDrawerOpen, parseAspect, usesDrawer, withAspect } from './portrait'

describe('parseAspect', () => {
  it('只有 portrait 是直式', () => {
    expect(parseAspect('portrait')).toBe('portrait')
    expect(parseAspect('landscape')).toBe('landscape')
    expect(parseAspect(null)).toBe('landscape')
    expect(parseAspect(undefined)).toBe('landscape')
    expect(parseAspect('Portrait')).toBe('landscape')
    expect(parseAspect('')).toBe('landscape')
  })
  it('網址沒寫時用裝置的方向(手機直拿是直式);網址寫了就照網址', () => {
    expect(parseAspect(null, 'portrait')).toBe('portrait')
    expect(parseAspect('nope', 'portrait')).toBe('portrait')
    expect(parseAspect('landscape', 'portrait')).toBe('landscape')
    expect(parseAspect('portrait', 'landscape')).toBe('portrait')
  })
})

describe('withAspect', () => {
  it('直式加參數、橫式拿掉,其他參數保留', () => {
    expect(withAspect(new URLSearchParams(''), 'portrait').toString()).toBe('aspect=portrait')
    expect(withAspect(new URLSearchParams('aspect=portrait'), 'landscape').toString()).toBe('')
    expect(withAspect(new URLSearchParams('a=1&aspect=portrait'), 'landscape').toString()).toBe('a=1')
    expect(withAspect(new URLSearchParams('a=1'), 'portrait').toString()).toBe('a=1&aspect=portrait')
  })
  it('和裝置方向一樣就不寫進網址;手機上選橫式要寫 aspect=landscape', () => {
    expect(withAspect(new URLSearchParams(''), 'landscape', 'portrait').toString()).toBe('aspect=landscape')
    expect(withAspect(new URLSearchParams('aspect=landscape'), 'portrait', 'portrait').toString()).toBe('')
  })
  it('不改動傳入的物件', () => {
    const p = new URLSearchParams('aspect=portrait')
    withAspect(p, 'landscape')
    expect(p.get('aspect')).toBe('portrait')
  })
})

describe('usesDrawer', () => {
  it('窄視窗的直式才用抽屜', () => {
    expect(usesDrawer('portrait', true)).toBe(true)
    expect(usesDrawer('portrait', false)).toBe(false)
    expect(usesDrawer('landscape', true)).toBe(false)
    expect(usesDrawer('landscape', false)).toBe(false)
  })
})

describe('nextDrawerOpen', () => {
  it('停在新的互動點時自動展開', () => {
    expect(nextDrawerOpen(false, true, undefined, 'm1')).toBe(true)
    expect(nextDrawerOpen(false, true, 'm1', 'm2')).toBe(true)
  })
  it('同一個互動點上學員自己收合後不再打開', () => {
    expect(nextDrawerOpen(false, true, 'm1', 'm1')).toBe(false)
  })
  it('離開互動點不動它', () => {
    expect(nextDrawerOpen(true, true, 'm1', undefined)).toBe(true)
    expect(nextDrawerOpen(false, true, 'm1', undefined)).toBe(false)
  })
  it('不是抽屜(側欄)時維持原狀', () => {
    expect(nextDrawerOpen(false, false, undefined, 'm1')).toBe(false)
    expect(nextDrawerOpen(true, false, undefined, 'm1')).toBe(true)
  })
})

describe('drawerSummary', () => {
  const chapters = [
    { at: 0, label: '開場' },
    { at: 5000, label: '下指令' },
    { at: 9000, label: '收尾' },
  ]
  it('依時間找出章節與第幾個', () => {
    expect(drawerSummary(chapters, 0)).toEqual({
      label: '開場',
      index: 1,
      total: 3,
    })
    expect(drawerSummary(chapters, 5000)).toEqual({
      label: '下指令',
      index: 2,
      total: 3,
    })
    expect(drawerSummary(chapters, 99999)).toEqual({
      label: '收尾',
      index: 3,
      total: 3,
    })
  })
  it('第一個章節之前算第 1 個,沒有章節回 null', () => {
    expect(drawerSummary([{ at: 300, label: 'A' }], 0)).toEqual({
      label: 'A',
      index: 1,
      total: 1,
    })
    expect(drawerSummary([], 0)).toBeNull()
  })
})
