import { describe, expect, it } from 'vitest'
import { formatDateTime, formatDuration, percentOf } from './format'

describe('formatDuration', () => {
  it('依長度選擇單位', () => {
    expect(formatDuration(42_000)).toBe('42 秒')
    expect(formatDuration(303_000)).toBe('5 分 03 秒')
    expect(formatDuration(3_900_000)).toBe('1 時 05 分')
    expect(formatDuration(-5)).toBe('0 秒')
  })
})

describe('formatDateTime', () => {
  it('空值與無效值顯示破折號', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('not a date')).toBe('—')
  })
  it('格式為 YYYY-MM-DD HH:mm', () => {
    expect(formatDateTime('2026-11-03T06:05:00Z')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })
})

describe('percentOf', () => {
  it('總長為 0 回 0,超過上限收斂到 100', () => {
    expect(percentOf(10, 0)).toBe(0)
    expect(percentOf(150, 100)).toBe(100)
    expect(percentOf(1, 3)).toBe(33)
  })
})
