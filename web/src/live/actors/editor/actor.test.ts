import { describe, expect, it } from 'vitest'
import actor from './actor'

// editor 的 files 起始檔案、paste 貼上、suggest／accept AI 補全(L2 4.1 試做用)
type St = { files: Record<string, string>; tabs: string[]; active: string | null; ghost: string | null }
const init = (props = {}) => actor.init!(props as never) as St
const apply = (st: St, kind: string, step: Record<string, unknown>) => actor.apply!(st as never, kind as never, step as never) as St

describe('editor', () => {
  it('files 開成分頁,最後一個是目前的檔案', () => {
    const st = init({ files: { 'a.css': 'x', 'index.html': '<h1>hi</h1>\n' } })
    expect(st.tabs).toEqual(['a.css', 'index.html'])
    expect(st.active).toBe('index.html')
    expect(init().active).toBeNull()
  })

  it('paste 一次貼到最後', () => {
    const st = apply(init({ files: { 'index.html': '<h1>hi</h1>\n' } }), 'paste', { paste: '<p>yo</p>\n' })
    expect(st.files['index.html']).toBe('<h1>hi</h1>\n<p>yo</p>\n')
  })

  it('suggest 只是灰字,accept 才寫進檔案;type 會清掉沒接受的建議', () => {
    let st = apply(init({ files: { 'index.html': '<p>' } }), 'suggest', { suggest: 'yo</p>\n' })
    expect(st.files['index.html']).toBe('<p>')
    expect(st.ghost).toBe('yo</p>\n')
    expect(actor.hotspots!(st as never, {} as never).some((h) => h.target === 'ghost')).toBe(true)
    st = apply(st, 'accept', { accept: true })
    expect(st.files['index.html']).toBe('<p>yo</p>\n')
    expect(st.ghost).toBeNull()
    st = apply(apply(st, 'suggest', { suggest: 'z' }), 'type', { type: 'a' })
    expect(st.ghost).toBeNull()
  })

  it('沒有建議就 accept、沒打開檔案就 paste 會報錯', () => {
    expect(() => apply(init({ files: { 'a.html': '' } }), 'accept', { accept: true })).toThrow('accept')
    expect(() => apply(init(), 'paste', { paste: 'x' })).toThrow('還沒打開檔案')
  })
})
