import { describe, expect, it } from 'vitest'
import { parseSnapshot, resumeAt } from './liveScript'

describe('即時腳本', () => {
  it('解析推播:格式對才收', () => {
    const s = parseSnapshot('{"version":2,"script":{"title":"t","cast":{"b":{"actor":"browser"}},"steps":[]},"report":null}')
    expect(s?.version).toBe(2)
    expect(s?.script.cast.b.actor).toBe('browser')
    expect(parseSnapshot('not json')).toBeNull()
    expect(parseSnapshot('{"version":"2","script":{}}')).toBeNull()
    expect(parseSnapshot('{"version":2}')).toBeNull()
  })

  it('新版本從哪裡播:原本的位置還在新長度裡就停在原處,超出就回到開頭', () => {
    expect(resumeAt(3000, 8000)).toBe(3000)
    expect(resumeAt(9000, 8000)).toBe(0)
    expect(resumeAt(8000, 8000)).toBe(0)
    expect(resumeAt(0, 0)).toBe(0)
  })
})
