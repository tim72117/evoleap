import { describe, expect, it } from 'vitest'
import { accessOf, ALL_LEVELS } from '../content/levels'
import courseSeed from '../../../server/internal/store/courses_seed.json'
import { cardAction, checkoutPeriodOf, formatAmount, FREE_LEVELS, formatPlanDate, paidTierOf, TIER_LEVELS, yearlySavingPercent, manageTarget, pricingHref, returnPathOf, subscribeAction, subscriptionNotice, SUBSCRIPTION_LEVELS } from './plans'

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
  // levels.ts 的每門課在 courses_seed.json 裡的那一列;主題課程(網頁怎麼運作、兒童課、從做好到上線等)不在 levels.ts
  const levelSeeds = ALL_LEVELS.map((level) => courseSeed.find((c) => c.id === level.id))

  it('每門課都在 courses_seed.json 裡,名稱和 levels.ts 一致', () => {
    const toRow = (c: { id: string; title: string } | undefined) => c && { id: c.id, title: c.title }
    expect(levelSeeds.map(toRow)).toEqual(ALL_LEVELS.map(toRow))
  })

  it('levels.ts 的存取方式來自 courses_seed.json', () => {
    for (const [i, level] of ALL_LEVELS.entries()) {
      expect(level.access).toBe(levelSeeds[i]?.access)
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
    expect(subscriptionNotice(undefined)).toEqual({ pastDue: false, ending: false, text: '' })
  })

  it('正常訂閱顯示下次續訂日', () => {
    expect(subscriptionNotice({ status: 'active', currentPeriodEnd: end }).text).toBe(`下次續訂日：${formatPlanDate(end)}`)
  })

  it('已排定取消時顯示結束日,不顯示續訂日', () => {
    const notice = subscriptionNotice({ status: 'active', currentPeriodEnd: end, cancelAt: cancel })
    expect(notice.text).toBe(`訂閱將在 ${formatPlanDate(cancel)} 結束，到期前仍可使用。`)
    expect(notice.ending).toBe(true)
  })

  it('扣款失敗優先提醒更新付款方式', () => {
    expect(subscriptionNotice({ status: 'past_due', currentPeriodEnd: end, cancelAt: cancel })).toEqual({
      pastDue: true,
      ending: false,
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

describe('訂閱後回到原本的課程', () => {
  it('收費頁連結帶上要回去的站內頁面', () => {
    expect(pricingHref('/courses/vibe-coding/4-1')).toBe('/pricing?next=%2Fcourses%2Fvibe-coding%2F4-1')
    expect(pricingHref()).toBe('/pricing')
    expect(pricingHref('/')).toBe('/pricing')
    expect(pricingHref('/pricing?next=%2Fx')).toBe('/pricing')
  })

  it('只接受站內路徑,不能被帶到別的網站', () => {
    expect(returnPathOf('/courses/vibe-coding/4-1')).toBe('/courses/vibe-coding/4-1')
    for (const next of [null, '', '/', 'https://evil.example', '//evil.example', '/\\evil.example', '/pricing']) {
      expect(returnPathOf(next)).toBe('')
    }
  })
})

describe('未登入時按訂閱,登入後直接開啟選的方案', () => {
  it('收費頁連結帶上計費週期,也保留要回去的課程', () => {
    expect(pricingHref(undefined, { tier: 'advanced', period: 'yearly' })).toBe('/pricing?plan=advanced&checkout=yearly')
    expect(pricingHref('/courses/vibe-coding/4-1', { tier: 'basic', period: 'monthly' })).toBe(
      '/pricing?next=%2Fcourses%2Fvibe-coding%2F4-1&plan=basic&checkout=monthly',
    )
  })

  it('只認得月繳與年繳', () => {
    expect(checkoutPeriodOf('monthly')).toBe('monthly')
    expect(checkoutPeriodOf('yearly')).toBe('yearly')
    expect(checkoutPeriodOf('weekly')).toBeUndefined()
    expect(checkoutPeriodOf(null)).toBeUndefined()
  })
})

describe('基礎與進階方案', () => {
  it('每個訂閱階段都屬於基礎或進階其中一個方案', () => {
    expect(TIER_LEVELS.basic.map((level) => level.id)).toEqual(['vibe-coding-basics'])
    expect(TIER_LEVELS.advanced.map((level) => level.id)).toEqual(['ai-agent', 'advanced'])
  })

  it('只認得 basic 與 advanced', () => {
    expect(paidTierOf('basic')).toBe('basic')
    expect(paidTierOf('advanced')).toBe('advanced')
    expect(paidTierOf('free')).toBeUndefined()
    expect(paidTierOf(null)).toBeUndefined()
  })
})

describe('年繳折扣與金額', () => {
  it('年繳比 12 個月月繳省多少', () => {
    expect(yearlySavingPercent('30000', '300000')).toBe(17)
    expect(yearlySavingPercent('30000', '360000')).toBe(0)
    expect(yearlySavingPercent(undefined, '300000')).toBe(0)
  })

  it('最小單位的金額依幣別格式化', () => {
    expect(formatAmount('15000', 'TWD')).toBe('NT$150.00')
    expect(formatAmount('1000', 'USD')).toBe('$10.00')
    expect(formatAmount('x', 'TWD')).toBe('')
  })
})

describe('每張方案卡各自判斷能不能訂閱', () => {
  it('沒設定價格或 Paddle 沒回這個價格:只有這張卡即將開放', () => {
    expect(cardAction(undefined, false, 'ready', 'user')).toBe('soon')
    expect(cardAction('pri_adv', false, 'ready', 'user')).toBe('soon')
    expect(cardAction('pri_basic', true, 'ready', 'user')).toBe('subscribe')
  })

  it('Paddle 沒設定是即將開放,連不上是 error,載入中是 wait', () => {
    expect(cardAction('pri_1', false, 'unavailable', 'user')).toBe('soon')
    expect(cardAction('pri_1', false, 'error', 'user')).toBe('error')
    expect(cardAction('pri_1', false, 'loading', 'user')).toBe('wait')
  })

  it('已訂閱與未登入照 subscribeAction', () => {
    expect(cardAction('pri_1', true, 'ready', 'user', true)).toBe('subscribed')
    expect(cardAction('pri_1', true, 'ready', 'guest')).toBe('login')
  })
})
