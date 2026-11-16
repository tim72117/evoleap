import { describe, expect, it } from 'vitest'
import actor, { apply, frameSvg, SCENES, T, type FileAiState } from './actor'

const init = actor.init!({}) as FileAiState

describe('file-ai 動作', () => {
  it('scene 要是已知的段落', () => {
    expect(() => apply(init, 'scene', { scene: 'nope' as never })).toThrow(/scene/)
    expect(() => apply(init, 'scene', {})).toThrow()
    expect(apply({ scene: 'four', prev: null }, 'scene', { scene: 'read' })).toEqual({ scene: 'read', prev: 'four' })
  })
})

describe('file-ai 畫面是時間的純函式', () => {
  for (const sc of SCENES) {
    it(`${sc}:同一時間點同一畫面,沒有 NaN,結束後仍有內容`, () => {
      const st: FileAiState = { scene: sc, prev: null }
      for (let l = 0; l <= T[sc]; l += T[sc] / 40) {
        const a = frameSvg(st, l)
        expect(a).toBe(frameSvg(st, l))
        expect(a).not.toMatch(/NaN|undefined|Infinity/)
        expect(a.length).toBeGreaterThan(100)
      }
      expect(frameSvg(st, 100000)).not.toMatch(/NaN|undefined/)
    })
  }
  it('不用 CSS 動畫', () => {
    expect(SCENES.map((s) => frameSvg({ scene: s, prev: null }, 3000)).join('')).not.toMatch(/animation|transition/)
  })
})

describe('file-ai 內容', () => {
  it('保留原字卡的標題', () => {
    const t = (s: FileAiState['scene']) => frameSvg({ scene: s, prev: null }, 100000)
    expect(t('four')).toContain('會操作檔案的 AI 工具')
    expect(t('read')).toContain('讀取檔案')
    expect(t('write')).toContain('建立與修改檔案')
    expect(t('run')).toContain('執行指令')
    expect(t('direct')).toContain('它會直接改動你電腦上的檔案')
    expect(t('tools')).toContain('常見的工具')
  })
})
