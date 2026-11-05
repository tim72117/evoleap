import { describe, expect, it } from 'vitest'
import { gateView } from './courseGate'

describe('訂閱課程的權限閘門', () => {
  it('確認前只留標題', () => {
    expect(gateView(null, false)).toBe('checking')
  })

  it('後端回 allowed 才顯示內容', () => {
    expect(gateView({ access: 'subscription', allowed: true }, false)).toBe('allowed')
  })

  it('依原因導向登入或訂閱', () => {
    expect(gateView({ access: 'subscription', allowed: false, reason: 'login_required' }, false)).toBe('login')
    expect(gateView({ access: 'subscription', allowed: false, reason: 'subscription_required' }, false)).toBe('subscribe')
  })

  it('看不懂的原因也不放行', () => {
    expect(gateView({ access: 'subscription', allowed: false }, false)).toBe('subscribe')
  })

  it('查詢失敗不放行', () => {
    expect(gateView(null, true)).toBe('failed')
    expect(gateView({ access: 'subscription', allowed: true }, true)).toBe('failed')
  })
})
