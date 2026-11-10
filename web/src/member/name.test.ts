import { describe, expect, it } from 'vitest'
import { nameProblem } from './name'

describe('nameProblem', () => {
  it('一般名稱可以', () => {
    expect(nameProblem('小美')).toBe('')
    expect(nameProblem('Amy Chen')).toBe('')
  })

  it('擋掉換行、零寬、方向控制字元與全是空白的名稱(和伺服器一致)', () => {
    for (const bad of ['a\nb', 'a\tb', '​', 'Amy‮gnp.exe']) expect(nameProblem(bad), JSON.stringify(bad)).not.toBe('')
    expect(nameProblem('　')).toBe('請輸入名稱')
  })
})
