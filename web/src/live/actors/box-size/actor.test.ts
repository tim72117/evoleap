import { describe, expect, it } from 'vitest'
import { applyStep, boxSvg, initState, pressSteps, shown, type BoxSizeState } from './actor'

const press = (st: BoxSizeState, ...names: string[]): BoxSizeState =>
  names.reduce((s, name) => {
    const steps = pressSteps(s, name)
    if (!steps) return s
    return steps.reduce((x: BoxSizeState, step) => applyStep(x, Object.keys(step as object)[0] as never, step as never), s)
  }, st)

describe('box-size', () => {
  it('點欄位再按數字:第一個數字取代舊值,之後接在後面', () => {
    const st = press(initState({}), 'field:width', 'key:4', 'key:2')
    expect(st.size).toEqual({ width: 42, depth: 20, height: 20 })
    expect(shown(st, 'width')).toBe('42')
  })

  it('還沒點欄位不能打字;超過 200 或開頭是 0 按了沒反應', () => {
    const start = initState({})
    expect(pressSteps(start, 'key:1')).toBeNull()
    const picked = press(start, 'field:depth')
    expect(pressSteps(picked, 'key:0')).toBeNull()
    expect(press(picked, 'key:9', 'key:9', 'key:9').size.depth).toBe(99)
  })

  it('倒退刪光時盒子維持原來的尺寸', () => {
    const st = press(initState({}), 'field:height', 'erase', 'erase')
    expect(shown(st, 'height')).toBe('')
    expect(st.size.height).toBe(2)
    expect(pressSteps(st, 'erase')).toBeNull()
  })

  it('記下來:同一組尺寸不重複記,最多留 3 筆', () => {
    let st = press(initState({}), 'record', 'record')
    expect(st.records).toHaveLength(1)
    for (const k of ['1', '2', '3']) st = press(st, 'field:width', `key:${k}`, 'record')
    expect(st.records.map((r) => r.width)).toEqual([1, 2, 3])
    st = press(st, 'field:width', 'key:4', 'record')
    expect(st.records.map((r) => r.name)).toEqual(['第 3 件', '第 4 件', '第 5 件'])
  })

  it('腳本寫錯會報錯', () => {
    expect(() => initState({ size: { width: 0 } })).toThrow()
    expect(() => applyStep(initState({}), 'type', { type: '5' })).toThrow()
    expect(() => applyStep(initState({}), 'pick', { pick: 'x' as never })).toThrow()
  })

  it('畫面上標出三個尺寸,正在輸入的那一邊亮起來', () => {
    const { body } = boxSvg({ width: 42, depth: 18, height: 12 }, 'depth')
    for (const text of ['寬 42 mm', '深 18 mm', '高 12 mm']) expect(body).toContain(text)
    expect(body).toContain('bs-dim is-on" data-dim="depth"')
  })
})
