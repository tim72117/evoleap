import { describe, expect, it } from 'vitest'
import { CHAT_MS, chatFrame } from './chatEra'
import { SIGNUP_CODE } from './signupCode'

describe('then-now:對話式 AI 的示範', () => {
  it('第一段結束時 AI 回了程式,但檔案還是空的', () => {
    const f = chatFrame(1, CHAT_MS[1])
    expect(f.html.replace(/<[^>]+>/g, '')).toContain('s.left -= 1')
    expect(f.html).toContain('空白的檔案')
    expect(f.opened).toBe(false)
  })

  it('和手寫版是同一份程式:貼上的初版少了擋額滿那行,修正後一字不差', () => {
    const file = (html: string) => html.slice(html.lastIndexOf('<pre>') + 5, html.lastIndexOf('</pre>')).replace(/<\/?mark>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    expect(file(chatFrame(2, CHAT_MS[2]).html)).toBe(SIGNUP_CODE.filter((l) => !l.includes('if (s.left <= 0)')).join('\n'))
    expect(file(chatFrame(3, CHAT_MS[3]).html)).toBe(SIGNUP_CODE.join('\n'))
  })

  it('等回覆時有三個點;回覆逐字出現;貼回的問題是錯誤樣式', () => {
    expect(chatFrame(1, 3100).html).toContain('tn-cdots')
    expect(chatFrame(1, 3500).html).not.toContain('完整的網頁')
    expect(chatFrame(3, 4700).html).toContain('tn-cq err')
  })

  it('第二段用滑鼠複製、貼上、存檔、打開', () => {
    expect(chatFrame(2, 500).html).toContain('tn-mouse')
    expect(chatFrame(2, 500).opened).toBe(false)
    expect(chatFrame(2, CHAT_MS[2]).opened).toBe(true)
    expect(chatFrame(2, CHAT_MS[2]).html).toContain('已複製')
  })

  it('第三段發現問題、貼回去問、再搬一次;同一時間畫面相同', () => {
    expect(chatFrame(3, 2500).probe).toMatchObject({ at: 'card:1', state: 'fail' })
    expect(chatFrame(3, CHAT_MS[3]).probe).toMatchObject({ at: 'card:1', state: 'pass' })
    expect(chatFrame(3, CHAT_MS[3]).html).toContain('<mark>')
    expect(chatFrame(3, 6000)).toEqual(chatFrame(3, 6000))
  })
})
