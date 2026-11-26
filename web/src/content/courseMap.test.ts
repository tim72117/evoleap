import { describe, expect, it } from 'vitest'
import { hideDrafts } from './courseMap'

describe('畫面上的身分不是管理員時,草稿當成規劃中(模擬身分、備援地圖)', () => {
  const units = [{ id: '1', title: 'u', subtitle: '', lessons: [
    { id: '1.1', title: 'a', summary: '', access: 'login-free' as const, status: 'open' as const, script: 'k/1.1.json' },
    { id: '1.2', title: 'b', summary: '', access: 'login-free' as const, status: 'draft' as const, script: 'k/1.2.json' },
  ] }]
  it('不是管理員:草稿變規劃中、拿掉腳本;開放的不動', () => {
    const out = hideDrafts(units, false)
    expect(out[0].lessons.map((l) => [l.id, l.status, l.script])).toEqual([['1.1', 'open', 'k/1.1.json'], ['1.2', 'planned', undefined]])
  })
  it('管理員:原樣', () => {
    expect(hideDrafts(units, true)).toBe(units)
  })
})
