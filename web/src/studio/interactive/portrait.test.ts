import { describe, expect, it } from 'vitest'
import { parseAspect } from './portrait'

describe('parseAspect', () => {
  it('只有 portrait 是直式', () => {
    expect(parseAspect('portrait')).toBe('portrait')
    expect(parseAspect('landscape')).toBe('landscape')
    expect(parseAspect(null)).toBe('landscape')
    expect(parseAspect(undefined)).toBe('landscape')
    expect(parseAspect('Portrait')).toBe('landscape')
    expect(parseAspect('')).toBe('landscape')
  })
  it('網址沒寫時用裝置的方向(手機直拿是直式);網址寫了就照網址', () => {
    expect(parseAspect(null, 'portrait')).toBe('portrait')
    expect(parseAspect('nope', 'portrait')).toBe('portrait')
    expect(parseAspect('landscape', 'portrait')).toBe('landscape')
    expect(parseAspect('portrait', 'landscape')).toBe('portrait')
  })
})
