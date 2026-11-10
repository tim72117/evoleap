import { describe, expect, it } from 'vitest'
import { kit, type CursorMove } from './kit'

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b), `${a} ≉ ${b}`).toBeLessThan(eps)

describe('splitCaption', () => {
  const width = (s: string) => [...s].reduce((m, c) => m + (c.charCodeAt(0) < 256 ? 0.55 : 1), 0)

  it('短句不動,依句子切開', () => {
    expect(kit.splitCaption('好。接著看這裡！')).toEqual(['好。', '接著看這裡！'])
  })

  it('太長時依逗號切,行尾的逗號拿掉', () => {
    expect(kit.splitCaption('這一課要做四件事情而且每一件都很重要，先看這類工具能對你的檔案做什麼，再安裝並登入。')).toEqual(['這一課要做四件事情而且每一件都很重要', '先看這類工具能對你的檔案做什麼，再安裝並登入。'])
  })

  it('沒有標點的長句也會斷;英文單字與檔名不切開,標點不放行首', () => {
    const lines = kit.splitCaption('請打開名字叫做 super-long-file-name.html 的那一個檔案然後再確認裡面的每一段內容都沒有問題。', 20)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toContain('super-long-file-name.html')
    expect(lines.some((l) => l.includes('super-long-file-name.html'))).toBe(true)
    for (const l of lines) expect(l).not.toMatch(/^[。，、！？]/)
  })

  it('所有腳本的旁白切完都不超過一行', () => {
    const scripts = import.meta.glob(['../content/live/**/*.json', '!../content/live/data/**'], { eager: true, import: 'default' })
    const texts: string[] = []
    for (const [file, data] of Object.entries(scripts)) {
      if (file.endsWith('.voice.json') || file.includes('/site/')) continue
      JSON.stringify(data, (k, v: unknown) => {
        if (k === 'narration' && typeof v === 'string') texts.push(v)
        return v
      })
    }
    expect(texts.length).toBeGreaterThan(50)
    for (const t of texts) for (const line of kit.splitCaption(t)) expect(width(line), line).toBeLessThanOrEqual(24)
  })
})

describe('kit', () => {
  it('blurIn 從模糊透明到清晰,結束時不留 filter', () => {
    const a = kit.blurIn(0)
    expect(a.opacity).toBe('0.000')
    expect(a.filter).toBe('blur(8.00px)')
    const b = kit.blurIn(1)
    expect(b.opacity).toBe('1.000')
    expect(b.filter).toBe('none')
    expect(kit.blurIn(0.4)).toEqual(kit.blurIn(0.4))
  })

  it('streamCount 一段段湧出,不倒退,在 streamDuration 時全部出完', () => {
    const text = '好的，我會建立 index.html，介紹商品和營業時間。'
    const n = kit.graphemes(text).length
    const end = kit.streamDuration(text, { start: 300 })
    expect(kit.streamCount(text, 299, { start: 300 })).toBe(0)
    expect(kit.streamCount(text, end, { start: 300 })).toBe(n)
    let last = 0
    let jumps = 0
    for (let t = 0; t <= end; t += 10) {
      const c = kit.streamCount(text, t, { start: 300 })
      expect(c).toBeGreaterThanOrEqual(last)
      if (c - last > 1) jumps++
      last = c
    }
    expect(jumps).toBeGreaterThan(0)
    expect(kit.streamCount(text, 800, { start: 300 })).toBe(kit.streamCount(text, 800, { start: 300 }))
  })

  it('richChars 依看得到的字拆開,標出強調與換行', () => {
    expect(kit.richChars('做出[[網站]]')).toEqual([
      { ch: '做', em: false },
      { ch: '出', em: false },
      { ch: '網', em: true },
      { ch: '站', em: true },
    ])
    expect(kit.richChars('A\nB').map((c) => c.br ?? c.ch)).toEqual(['A', true, 'B'])
    expect(kit.richChars('👍🏽!').map((c) => c.ch)).toEqual(['👍🏽', '!'])
  })

  it('progress / map 夾在範圍內', () => {
    expect(kit.progress(-5, 0, 100)).toBe(0)
    expect(kit.progress(50, 0, 100)).toBe(0.5)
    expect(kit.progress(500, 0, 100)).toBe(1)
    expect(kit.progress(10, 10, 0)).toBe(1)
    expect(kit.map(150, 100, 200, 0, 10)).toBe(5)
  })

  it('緩動的兩端是 0 和 1', () => {
    const { steps: _steps, ...easings } = kit.ease
    for (const f of Object.values(easings)) {
      near(f(0), 0)
      near(f(1), 1)
    }
  })

  it('spring 從 0 出發、最後停在 1,而且同一時間點結果相同', () => {
    near(kit.spring(0), 0)
    near(kit.spring(5000), 1, 1e-3)
    expect(kit.spring(321)).toBe(kit.spring(321))
    expect(kit.spring(200, { stiffness: 300, damping: 10 }), '低阻尼會回彈超過 1').toBeGreaterThan(1)
    near(kit.spring(5000, { stiffness: 100, damping: 40 }), 1, 1e-3) // 過阻尼
  })

  it('keyframes 內插數值、到點切換非數值', () => {
    const kf = kit.keyframes([
      { at: 0, x: 0, label: 'a' },
      { at: 100, x: 10, label: 'b', ease: 'linear' },
    ])
    expect(kf(-1)).toEqual({ x: 0, label: 'a' })
    expect(kf(50)).toEqual({ x: 5, label: 'a' })
    expect(kf(100)).toEqual({ x: 10, label: 'b' })
    expect(kf(999)).toEqual({ x: 10, label: 'b' })
  })

  it('sequence 依序排程,支援 at、delay、ms', () => {
    const seq = kit.sequence(
      [{ d: 100 }, { d: 200, delay: 50 }, { d: 10, at: 1000 }, { d: 0, ms: 30 }],
      (it: { d: number }) => it.d,
      { gap: 20 },
    ) as { start: number; end: number }[]
    expect(seq.map((s) => [s.start, s.end])).toEqual([
      [0, 100],
      [150, 350],
      [1000, 1010],
      [1030, 1060],
    ])
  })

  it('typewriter 不會切壞 emoji', () => {
    const r = kit.typewriter('好👍🏽了', 1000, { cps: 2 })
    expect(r.text).toBe('好👍🏽')
    expect(r.total).toBe(3)
    expect(kit.typewriter('abc', 99999).done).toBe(true)
  })

  it('rich 跳脫 HTML 並轉換標記', () => {
    expect(kit.rich('<b> `x` **y** [[z]]')).toBe('&lt;b&gt; <code class="k-code">x</code> <b>y</b> <em class="k-em">z</em>')
  })

  it('richCut 不算標記字數、會補上結尾', () => {
    expect(kit.richCut('跑 `npm test` 吧', 4)).toBe('跑 <code class="k-code">np</code>')
    expect(kit.richCut('**粗體**後', 1)).toBe('<b>粗</b>')
  })

  it('countUp 千分位與小數', () => {
    expect(kit.countUp(0, 1280, 1)).toBe('1,280')
    expect(kit.countUp(0, 10, 0.25, { decimals: 1, suffix: '%' })).toBe('2.5%')
  })

  it('rand 與 noise 固定種子可重現', () => {
    const a = kit.rand(42)
    const b = kit.rand(42)
    expect(a()).toBe(b())
    expect(kit.rand('x')()).toBe(kit.rand('x')())
    expect(kit.noise(3.3, 5)).toBe(kit.noise(3.3, 5))
    near(kit.noise(3, 5), kit.noise(3.0000001, 5), 1e-4)
    expect(kit.scramble('hello', 0.4, { seed: 1 })).toBe(kit.scramble('hello', 0.4, { seed: 1 }))
    expect(kit.scramble('hello', 0.4).startsWith('he')).toBe(true)
  })

  it('cursor 移動、點擊與漣漪', () => {
    const moves: CursorMove[] = [
      { at: 0, to: [100, 0], ms: 100, ease: 'linear' },
      { at: 200, to: [100, 100], ms: 100, click: true },
    ]
    expect(kit.cursor(50, moves)).toEqual({ x: 50, y: 0, down: false, ripple: null })
    expect(kit.cursor(150, moves)).toEqual({ x: 100, y: 0, down: false, ripple: null })
    const c = kit.cursor(350, moves)
    expect(c.down).toBe(true)
    expect(c.ripple?.x).toBe(100)
    expect(kit.cursor(2000, moves).ripple).toBeNull()
  })

  it('keycap 顯示期間與淡出', () => {
    expect(kit.keycap(50, [{ at: 100, label: '⌘K' }])).toBeNull()
    expect(kit.keycap(500, [{ at: 100, label: '⌘K' }])?.label).toBe('⌘K')
    expect(kit.keycap(1100, [{ at: 100, label: '⌘K' }])).toBeNull()
  })

  it('focus 進度 0 是全景、1 是特寫置中', () => {
    const view = { w: 1920, h: 1080 }
    const rect = { x: 100, y: 100, w: 400, h: 200 }
    expect(kit.focus(rect, view, 0)).toEqual({ x: 0, y: 0, zoom: 1 })
    const f = kit.focus(rect, view, 1)
    near((rect.x + rect.w / 2) * f.zoom + f.x, 960)
    near((rect.y + rect.h / 2) * f.zoom + f.y, 540)
  })

  it('bars 與 drawPath', () => {
    expect(kit.bars([1, 2], 1)).toEqual([0.5, 1])
    expect(kit.bars([1, 2], 0)).toEqual([0, 0])
    expect(kit.drawPath(0.25, 100)).toEqual({ strokeDasharray: '100', strokeDashoffset: '75.00' })
    expect(kit.stickBottom(500, 800)).toBe(-300)
    expect(kit.stickBottom(500, 200)).toBe(0)
  })
})
