import { describe, expect, it } from 'vitest'
import actor, { apply, frameLayers, frameSvg, SCENES, T, type ReelState } from './actor'
import md from './assets/ATTRIBUTION.md?raw'
import script from '../../../../content/live/promo/trellis-reel.json?raw'
import raw from './assets/bust.vox128.b64?raw'
import { CREDIT, GX, GY, GZ, LEVELS, N, SOURCE, VX, VY, VZ, BASE } from './bust'
import { paintMesh, type MeshSpec } from './mist'
import { FACTS, fmtK, total } from './data'
import { hash } from './draw'

const init = actor.init!({}) as ReelState

describe('trellis-reel 動作', () => {
  it('scene 要是已知的段落', () => {
    expect(() => apply(init, 'scene', { scene: 'nope' as never })).toThrow(/scene/)
    expect(() => apply(init, 'scene', {})).toThrow()
    expect(apply(init, 'scene', { scene: 'io' })).toEqual({ scene: 'io', prev: null })
    expect(apply({ scene: 'io', prev: null }, 'scene', { scene: 'speed' })).toEqual({ scene: 'speed', prev: 'io' })
  })
})

describe('trellis-reel 畫面是時間的純函式', () => {
  for (const sc of SCENES) {
    it(`${sc}:同一個時間點同一個畫面,沒有 NaN,結束後仍有內容`, () => {
      const st: ReelState = { scene: sc, prev: null }
      const D = T[sc]
      for (let l = 0; l <= D; l += D / 25) {
        const a = frameSvg(st, l, D)
        expect(a).toBe(frameSvg(st, l, D))
        expect(a).not.toMatch(/NaN|undefined|Infinity/)
        expect(a.length).toBeGreaterThan(100)
      }
      expect(frameSvg(st, 100000, 1000)).not.toMatch(/NaN|undefined/)
    })
  }
  it('換景時舊畫面與新畫面交叉淡化', () => {
    expect(frameSvg({ scene: 'repo', prev: 'hook' }, 100, 8000)).toContain('opacity="0.69"')
  })
  it('不用任何 CSS 動畫', () => {
    const svg = SCENES.map((s) => frameSvg({ scene: s, prev: null }, 3000, 9000)).join('')
    expect(svg).not.toMatch(/animation|transition/)
  })
})

describe('trellis-reel 數字只用查證過的', () => {
  it('速度三檔:形狀 + 材質 = 3、17、60 秒', () => {
    expect(FACTS.speed.map((s) => [s.res, s.shape, s.tex, total(s)])).toEqual([['512³', 2, 1, 3], ['1024³', 10, 7, 17], ['1536³', 35, 25, 60]])
  })
  it('終點畫面有速度與門檻數字', () => {
    const sp = frameSvg({ scene: 'speed', prev: null }, 100000, 1000)
    for (const t of ['約 3 秒', '約 17 秒', '約 60 秒', '10 + 7', '35 + 25']) expect(sp).toContain(t)
    const lm = frameSvg({ scene: 'limits', prev: null }, 100000, 1000)
    for (const t of ['≥ 24GB', 'Linux', 'CUDA 12.4', '官方沒給數字']) expect(lm).toContain(t)
  })
  it('GitHub 狀態:13.2k 星、MIT、4B', () => {
    expect(fmtK(FACTS.repo.stars)).toBe('13.2k')
    const svg = frameSvg({ scene: 'repo', prev: null }, 100000, 1000)
    for (const t of ['13.2k', '1.6k', 'MIT', '4B', '抓取當下']) expect(svg).toContain(t)
  })
  it('三段生成各 1.3B,整體 4B', () => {
    const svg = frameSvg({ scene: 'flow', prev: null }, 100000, 1000)
    expect(svg.match(/1\.3B/g)).toHaveLength(3)
    expect(svg).toContain('整體 4B')
  })
})

describe('半身像資料與動畫(hook、voxel、flow、cell 共用同一份資料)', () => {
  const at = (sc: 'hook' | 'voxel' | 'flow' | 'cell', p: number): string => frameSvg({ scene: sc, prev: null }, p * T[sc], T[sc])
  const spec = (sc: 'hook' | 'voxel' | 'flow' | 'cell', p: number): MeshSpec => frameLayers({ scene: sc, prev: null }, p * T[sc], T[sc]).mesh!
  const lit = (buf: Uint32Array): number => buf.reduce((a: number, v: number) => a + (v ? 1 : 0), 0)
  const dims = { hook: [870, 930], voxel: [870, 722], flow: [870, 612], cell: [870, 552] } as const
  const paint = (sc: 'hook' | 'voxel' | 'flow' | 'cell', p: number): { n: number; buf: Uint32Array } => {
    const [w, h] = dims[sc]
    const buf = new Uint32Array(w * h)
    return { n: paintMesh(buf, w, h, spec(sc, p)), buf }
  }
  it('資料檔:載得進來,格數合理,四個階層由粗到細', () => {
    expect(N).toBeGreaterThan(25000)
    expect(N).toBeLessThan(40000)
    expect(raw.length).toBeLessThan(150 * 1024)
    const counts = LEVELS.map((l) => l.n)
    expect(counts[3]).toBe(N)
    expect(LEVELS[3].rep.reduce((a: number, v: number) => a + v, 0)).toBe(N)
    for (let i = 1; i < 4; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1] * 2)
    expect(counts[0]).toBeGreaterThan(100)
    expect(counts[0]).toBeLessThan(1000)
    expect(GY).toBe(128)
    for (let n = 0; n < N; n += 97) {
      expect(Math.abs(VX[n])).toBeLessThanOrEqual(GX / 2)
      expect(Math.abs(VZ[n])).toBeLessThanOrEqual(GZ / 2)
      expect(Math.abs(VY[n])).toBeLessThanOrEqual(GY / 2)
      expect(BASE[n * 3] + BASE[n * 3 + 1] + BASE[n * 3 + 2]).toBeGreaterThan(0)
    }
    for (const L of LEVELS) for (const arr of [L.x, L.y, L.z, L.s, L.nx, L.ny, L.nz, L.cr, L.cg, L.cb, L.dl]) for (let i = 0; i < L.n; i += 13) expect(Number.isFinite(arr[i])).toBe(true)
    for (let l = 1; l < 4; l++) for (let i = 0; i < LEVELS[l].n; i += 7) expect(LEVELS[l].par![i]).toBeLessThan(LEVELS[l - 1].n)
    expect(Math.max(...Array.from(VY))).toBeGreaterThan(60)
  })
  it('hook:輸入圖與 GLB 都是半身像,點數依階層單調變多,最後是平滑著色(全程圓點,沒有方格)', () => {
    expect(at('hook', 0.12)).toContain('輸入：一張圖片')
    expect(at('hook', 1)).toContain('GLB')
    expect(at('hook', 1)).toContain('示意')
    expect(at('hook', 1)).toContain('bust-render')
    expect(at('hook', 1)).not.toMatch(/IMAGE.*polygon points="100,830/)
    const counts = [0.2, 0.3, 0.43, 0.55, 0.68, 0.8, 1].map((p) => paint('hook', p).n)
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
    expect(counts[counts.length - 1]).toBe(N)
    expect(paint('hook', 0.1).n).toBe(0)
    expect(lit(paint('hook', 1).buf)).toBeGreaterThan(20000)
  })
  it('hook:每一刻都沒有 NaN,畫面是時間的純函式,相鄰時間點不會整張突然改變', () => {
    const a = new Uint32Array(870 * 930)
    const b = new Uint32Array(870 * 930)
    paintMesh(a, 870, 930, spec('hook', 0.5))
    paintMesh(b, 870, 930, spec('hook', 0.5))
    expect(a).toEqual(b)
    let prev = paint('hook', 0.2).buf
    for (let p = 0.22; p <= 1.0001; p += 0.02) {
      const m = spec('hook', p)
      expect(JSON.stringify(m)).not.toMatch(/NaN|null/)
      const cur = paint('hook', p).buf
      let diff = 0
      for (let i = 0; i < cur.length; i += 3) if ((cur[i] >>> 24) !== (prev[i] >>> 24)) diff++
      expect(diff / (cur.length / 3)).toBeLessThan(0.12)
      prev = cur
    }
  })
  it('flow:霧一開始整團積木就全在(N 顆固定),每一刻都有畫出東西,沒有 NaN', () => {
    for (const p of [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 0.95, 1]) {
      const m = spec('flow', p)
      const { n, buf } = paint('flow', p)
      expect(n).toBeGreaterThan(300)
      expect(n).toBeLessThanOrEqual(N)
      expect(lit(buf)).toBeGreaterThan(3000)
      expect(JSON.stringify(m)).not.toMatch(/NaN|null/)
    }
    const sig = [0.2, 0.5, 0.7, 1].map((p) => paint('flow', p).buf.reduce((a: number, v: number, i: number) => (a + v * ((i % 97) + 1)) % 1000003, 0))
    expect(new Set(sig).size).toBe(sig.length)
  })
  it('flow:畫面是時間的純函式;三段各有一次從亂到準', () => {
    expect(paint('flow', 0.4).buf).toEqual(paint('flow', 0.4).buf)
    const f = [0.2, 0.3, 0.45, 0.58, 0.7, 0.8, 1].map((p) => at('flow', p))
    expect(new Set(f).size).toBe(f.length)
    expect(at('flow', 0.4)).toContain('① 結構')
    expect(at('flow', 0.5)).toContain('② 形狀')
    expect(at('flow', 0.8)).toContain('③ 貼圖')
    expect(at('flow', 0.05)).toContain('起點：一團雜訊')
    expect(at('flow', 0.1)).toContain('16 倍下採樣')
    expect(at('flow', 0.1)).toContain('在壓縮後的潛在空間生成')
    expect(at('flow', 0.1)).not.toContain('壓縮 VAE')
  })
  it('flow:不出現新增的數字,也不暗示光影', () => {
    const svg = at('flow', 1)
    expect(svg).not.toMatch(/光影|打光|陰影/)
    const nums = [...svg.matchAll(/>([^<>]*\d[^<>]*)</g)].map((m) => m[1])
    expect(nums.sort()).toEqual(['1', '1.3B', '1.3B', '1.3B', '2', '3', '512', '64³', '整體 4B 參數', '16 倍下採樣', CREDIT].sort())
  })
  it('voxel:稀疏(空間格線 → 只有東西的格子長成方塊 → 由粗到細),方塊數依階層單調', () => {
    expect(at('voxel', 0.1)).toContain('展開成整個空間的格子')
    expect(at('voxel', 0.3)).toContain('只記有東西的格子')
    expect(at('voxel', 0.05)).toContain('VAE 解碼')
    expect(at('voxel', 0.5)).toContain('由粗到細')
    expect(at('voxel', 0.7)).toContain('貼上貼圖色')
    expect(at('voxel', 1)).toContain('平滑著色成網格（示意）')
    expect(at('voxel', 1)).toContain('稀疏體素')
    expect(at('voxel', 1)).toContain('不經有損的等值面轉換')
    expect(at('voxel', 1)).not.toMatch(/底色|粗糙度|金屬度|不透明度|等值面場/)
    const dots = paint('voxel', 0.15)
    expect(dots.n).toBe(0) // 一開始只有淡淡的格線,還沒有方塊
    expect(lit(dots.buf)).toBeGreaterThan(500)
    const counts = [0.34, 0.5, 0.62, 0.75, 1].map((p) => paint('voxel', p).n)
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
    expect(counts[0]).toBe(LEVELS[0].n)
    expect(counts[4]).toBe(N)
  })
  it('cell:在 flow 之後才出現「這一格同時記著」形狀與 PBR 四項,等值面場被劃掉', () => {
    expect(SCENES.indexOf('cell')).toBe(SCENES.indexOf('voxel') + 1)
    expect(SCENES.indexOf('flow')).toBeLessThan(SCENES.indexOf('voxel'))
    const v = at('cell', 1)
    for (const t of ['這一格同時記著', '形狀', '底色', '粗糙度', '金屬度', '不透明度', '幾何 + PBR', '等值面場']) expect(v).toContain(t)
    for (const sc of ['voxel', 'flow'] as const) expect(at(sc, 1)).not.toContain('這一格同時記著')
    expect(paint('cell', 1).n).toBe(N)
  })
  it('方格(O-Voxel)只出現在 voxel 解碼與 cell;hook 與 flow 全程是圓點', () => {
    for (const p of [0.2, 0.5, 0.9]) {
      expect(spec('hook', p).mode).toBe('hook')
      expect(spec('flow', p).mode).toBe('flow')
      expect(spec('hook', p).vx).toBeUndefined()
    }
    for (const sc of ['voxel', 'cell'] as const) expect(spec(sc, 0.5).mode).toBe('voxel')
    for (const sc of ['hook', 'flow'] as const) expect(at(sc, 1)).not.toMatch(/O-Voxel|方格|格線/)
  })
  it('單幀 renderAt(畫面的軟體光柵)夠快', () => {
    const t0 = performance.now()
    for (const p of [0.3, 0.5, 0.7, 0.9]) paint('hook', p)
    for (const p of [0.4, 0.6, 0.9]) paint('flow', p)
    expect((performance.now() - t0) / 7).toBeLessThan(60)
  })
})

describe('3D 模型致謝(Poly Haven,CC0)', () => {
  it('使用模型的每一段畫面都有致謝小字,並標「示意」;收尾列出來源', () => {
    expect(CREDIT).toBe('模型：Marble Bust 01／Rico Cilliers（Poly Haven，CC0）')
    expect(SOURCE).toBe('polyhaven.com/a/marble_bust_01')
    for (const sc of ['hook', 'voxel', 'flow', 'cell'] as const) for (const p of [0.3, 0.6, 1]) expect(frameSvg({ scene: sc, prev: null }, p * T[sc], T[sc])).toContain(CREDIT)
    for (const sc of ['voxel', 'flow', 'cell'] as const) expect(frameSvg({ scene: sc, prev: null }, 100000, 1000)).toContain('示意')
    expect(frameSvg({ scene: 'outro', prev: null }, 100000, 1000)).toContain(CREDIT)
    expect(frameSvg({ scene: 'outro', prev: null }, 100000, 1000)).toContain(SOURCE)
    expect(frameSvg({ scene: 'flow', prev: null }, 100000, 1000)).toContain('輸入的一張圖')
  })
  it('腳本與素材資料夾也有說明,沒有舊素材(騎士、Sketchfab、CC BY)殘留', () => {
    for (const t of ['Marble Bust 01', 'Rico Cilliers', 'CC0', 'polyhaven.com/a/marble_bust_01']) expect(script).toContain(t)
    for (const t of ['Marble Bust 01', 'Rico Cilliers', 'CC0', 'RoomEnvironment', '體素']) expect(md).toContain(t)
    const all = [script, md, raw.slice(0, 10)].join('\n') + SCENES.map((s) => frameSvg({ scene: s, prev: null }, 100000, 1000)).join('') + [CREDIT, SOURCE].join('')
    expect(all).not.toMatch(/騎士|Sketchfab|sketchfab|CC BY|Knight|knight|dark_igorek/)
  })
  it('腳本順序:flow → voxel → cell → speed', () => {
    const order = [...script.matchAll(/"scene": "(\w+)"/g)].map((m) => m[1])
    expect(order).toEqual(['hook', 'repo', 'io', 'flow', 'voxel', 'cell', 'speed', 'limits', 'outro'])
  })
})

describe('hash', () => {
  it('同一個 seed 同一個值,範圍 0–1', () => {
    for (let i = 0; i < 50; i++) {
      expect(hash(i)).toBe(hash(i))
      expect(hash(i)).toBeLessThan(1)
    }
  })
})
