import { describe, expect, it } from 'vitest'
import { accessOf, ALL_LEVELS } from '../content/levels'
import courseSeed from '../../../server/internal/store/courses_seed.json'
import { FREE_LEVELS, formatPlanDate, manageTarget, subscribeAction, subscriptionNotice, SUBSCRIPTION_LEVELS } from './plans'

describe('收費頁的課程分組', () => {
  it('每門課只出現在一組', () => {
    const ids = [...FREE_LEVELS, ...SUBSCRIPTION_LEVELS].map((level) => level.id)
    expect(ids.sort()).toEqual(ALL_LEVELS.map((level) => level.id).sort())
  })

  it('免費組都有價格標籤', () => {
    expect(FREE_LEVELS.every((level) => level.access === 'free' || level.access === 'login-free')).toBe(true)
  })
})

describe('訂閱課程', () => {
  it('免費與登入後免費以外的課程都要訂閱', () => {
    expect(SUBSCRIPTION_LEVELS.map((level) => level.id)).toEqual(['vibe-coding-basics', 'ai-agent', 'advanced'])
  })
})

describe('訂閱按鈕', () => {
  it('Paddle 或價格還沒確定時不能結帳', () => {
    expect(subscribeAction('pri_1', 'loading', 'user')).toBe('wait')
    expect(subscribeAction('pri_1', 'error', 'user')).toBe('wait')
    expect(subscribeAction('pri_1', 'ready', 'loading')).toBe('wait')
  })

  it('沒有價格或伺服器未開放登入時是即將開放', () => {
    expect(subscribeAction(undefined, 'ready', 'user')).toBe('soon')
    expect(subscribeAction('pri_1', 'unavailable', 'user')).toBe('soon')
    expect(subscribeAction('pri_1', 'ready', 'disabled')).toBe('soon')
  })

  it('未登入要先登入,已登入才能結帳', () => {
    expect(subscribeAction('pri_1', 'ready', 'guest')).toBe('login')
    expect(subscribeAction('pri_1', 'ready', 'user')).toBe('subscribe')
  })

  it('已訂閱不再結帳;還不確定是否已訂閱時不能結帳', () => {
    expect(subscribeAction('pri_1', 'ready', 'user', true)).toBe('subscribed')
    expect(subscribeAction('pri_1', 'ready', 'user', null)).toBe('wait')
  })
})

describe('課程的存取方式', () => {
  it('每門課都在 courses_seed.json 裡,名稱和 levels.ts 一致', () => {
    const toRow = (c: { id: string; title: string }) => ({ id: c.id, title: c.title })
    expect(courseSeed.map(toRow)).toEqual(ALL_LEVELS.map(toRow))
  })

  it('levels.ts 的存取方式來自 courses_seed.json', () => {
    for (const course of courseSeed) {
      expect(ALL_LEVELS.find((level) => level.id === course.id)?.access).toBe(course.access)
    }
  })

  it('找不到課程或值不正確時直接丟錯', () => {
    expect(() => accessOf('nope')).toThrow()
    expect(() => accessOf('x', [{ id: 'x', access: 'paid' }])).toThrow()
    expect(accessOf('x', [{ id: 'x', access: 'subscription' }])).toBe('subscription')
  })
})

describe('訂閱狀態的提示', () => {
  const end = '2026-12-05T08:00:00Z'
  const cancel = '2026-12-20T08:00:00Z'

  it('沒有訂閱時沒有提示', () => {
    expect(subscriptionNotice(undefined)).toEqual({ pastDue: false, text: '' })
  })

  it('正常訂閱顯示下次續訂日', () => {
    expect(subscriptionNotice({ status: 'active', currentPeriodEnd: end }).text).toBe(`下次續訂日：${formatPlanDate(end)}`)
  })

  it('已排定取消時顯示結束日,不顯示續訂日', () => {
    const notice = subscriptionNotice({ status: 'active', currentPeriodEnd: end, cancelAt: cancel })
    expect(notice.text).toBe(`訂閱將在 ${formatPlanDate(cancel)} 結束`)
  })

  it('扣款失敗優先提醒更新付款方式', () => {
    expect(subscriptionNotice({ status: 'past_due', currentPeriodEnd: end, cancelAt: cancel })).toEqual({
      pastDue: true,
      text: '上次扣款失敗，請更新付款方式。',
    })
  })

  it('沒有日期或日期無法解析時不顯示日期', () => {
    expect(subscriptionNotice({ status: 'active' }).text).toBe('')
    expect(subscriptionNotice({ status: 'active', currentPeriodEnd: 'not a date' }).text).toBe('')
  })
})

describe('管理訂閱的連結', () => {
  it('換卡優先用換卡連結,沒有就用總覽', () => {
    const links = { url: 'https://pay.example/overview', updatePaymentUrl: 'https://pay.example/card' }
    expect(manageTarget(links, true)).toBe(links.updatePaymentUrl)
    expect(manageTarget(links, false)).toBe(links.url)
    expect(manageTarget({ url: links.url }, true)).toBe(links.url)
  })
})
