import { describe, expect, it } from 'vitest'
import type { CourseAccessResult } from '../auth/api'
import { gateView } from './courseGate'

const r = (x: Partial<CourseAccessResult>): CourseAccessResult => ({ access: 'subscription', allowed: false, ...x })

describe('gateView', () => {
  it('還沒查到是 checking', () => {
    expect(gateView(null, false)).toBe('checking')
  })

  it('查詢失敗一律不放行,即使有舊的 allowed 結果', () => {
    expect(gateView(null, true)).toBe('failed')
    expect(gateView(r({ allowed: true }), true)).toBe('failed')
  })

  it('allowed 直接看;allowed + ad 先看廣告', () => {
    expect(gateView(r({ allowed: true }), false)).toBe('allowed')
    expect(gateView(r({ allowed: true, ad: false }), false)).toBe('allowed')
    expect(gateView(r({ allowed: true, ad: true }), false)).toBe('ad')
  })

  it('不能看:依原因顯示登入提示或導去方案頁', () => {
    expect(gateView(r({ reason: 'login_required' }), false)).toBe('login')
    expect(gateView(r({ reason: 'plan_required' }), false)).toBe('pricing')
  })

  it('看不懂的回傳不放行', () => {
    expect(gateView(r({}), false)).toBe('failed')
    expect(gateView(r({ reason: 'other' as never }), false)).toBe('failed')
    expect(gateView({ allowed: 'yes' } as never, false)).toBe('failed')
    expect(gateView({} as never, false)).toBe('failed')
  })
})
