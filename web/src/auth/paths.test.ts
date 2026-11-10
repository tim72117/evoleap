import { describe, expect, it } from 'vitest'
import { LOGIN_PATH, loginHref, safeNextPath } from './paths'

describe('safeNextPath', () => {
  it.each([null, undefined, '', 'http://x', 'https://evil.com/a', '//evil.com', '/\\evil', 'javascript:alert(1)', 'courses'])(
    'rejects %j → /',
    (next) => {
      expect(safeNextPath(next)).toBe('/')
    },
  )
  it.each(['/', '/x?y', '/courses/software/1#step-2'])('keeps site-internal %j unchanged', (next) => {
    expect(safeNextPath(next)).toBe(next)
  })
})

describe('loginHref', () => {
  it('omits next for missing, home and login paths', () => {
    expect(loginHref()).toBe(LOGIN_PATH)
    expect(loginHref('')).toBe(LOGIN_PATH)
    expect(loginHref('/')).toBe(LOGIN_PATH)
    expect(loginHref('/login')).toBe(LOGIN_PATH)
    expect(loginHref('/login?next=%2Fx')).toBe(LOGIN_PATH)
  })

  it('keeps the CLI approval page as next (it needs a login first)', () => {
    expect(loginHref('/login/cli?id=abc')).toBe('/login?next=%2Flogin%2Fcli%3Fid%3Dabc')
  })
  it('encodes next', () => {
    expect(loginHref('/x?y=1&z=2')).toBe('/login?next=%2Fx%3Fy%3D1%26z%3D2')
    expect(new URLSearchParams(loginHref('/courses/software/1-1').split('?')[1]).get('next')).toBe('/courses/software/1-1')
  })
  it('falls back to / for an unsafe next', () => {
    expect(loginHref('//evil.com')).toBe('/login?next=%2F')
  })
})
