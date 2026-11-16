import { describe, expect, it } from 'vitest'
import { adjust, firstDraft } from './siteSim'

describe('firstDraft', () => {
  it('只說「好看」會被亂猜成深色科技風加大按鈕', () => {
    const d = firstDraft('幫我做個好看的網站')
    expect(d.vague).toBe(true)
    expect(d.site).toMatchObject({ style: 'tech', shout: true, sections: ['products'] })
  })
  it('說清楚區塊與風格就照著做,順序固定', () => {
    const d = firstDraft('為小森烘焙做一頁式網站，介紹商品、預約取貨流程、營業時間和常見問題，風格溫暖有手作感。')
    expect(d.vague).toBe(false)
    expect(d.site.style).toBe('warm')
    expect(d.site.sections).toEqual(['products', 'booking', 'hours', 'faq'])
  })
})

describe('adjust', () => {
  const site = firstDraft('商品、預約、營業時間，風格簡約').site
  it('一句話只動該動的地方', () => {
    const r = adjust(site, '卡片改三欄')
    expect(r.changed).toEqual(['卡片欄數'])
    expect(r.site.style).toBe(site.style)
    expect(r.broad).toBe(false)
  })
  it('加上、拿掉區塊', () => {
    const added = adjust(site, '加上常見問題')
    expect(added.site.sections).toContain('faq')
    expect(adjust(added.site, '拿掉營業時間').site.sections).not.toContain('hours')
  })
  it('說得太籠統會改一大堆,標成 broad', () => {
    const r = adjust(site, '整個再改好看一點')
    expect(r.broad).toBe(true)
    expect(r.changed.length).toBeGreaterThanOrEqual(4)
  })
  it('聽不懂時不改', () => {
    const r = adjust(site, '嗯')
    expect(r.site).toBe(site)
    expect(r.changed).toEqual([])
  })
})
