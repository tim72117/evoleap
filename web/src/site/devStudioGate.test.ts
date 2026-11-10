import { describe, expect, it } from 'vitest'
import { devGateDecision, gatedKind } from './devStudioGate'

describe('gatedKind', () => {
  it.each(['/studio', '/studio/tools', '/materials', '/materials/promo', '/docs/live'])('%s 是內部頁面', (p) => {
    expect(gatedKind(p)).toBe('page')
  })

  it.each([
    '/src/studio/StudioApp.tsx',
    '/src/studio/proposal/routes.tsx',
    '/src/studio/actors/ActorsPage.module.css',
    '/src/seo/internalPages.ts',
    '/src/content/live/lab/actors/notes.json',
    '/src/content/live/promo/multi-session.json',
    '/__studio/course-map',
    '/materials/cover.png',
  ])('%s 是內部檔案', (p) => {
    expect(gatedKind(p)).toBe('file')
  })

  it.each([
    '/',
    '/login',
    '/admin',
    '/courses/software',
    '/studios',
    '/src/App.tsx',
    '/src/studio/interactive/InteractiveScenePage.tsx',
    '/src/content/live/l0/0.0-tools.json',
    '/api/me',
  ])('%s 不需要檢查', (p) => {
    expect(gatedKind(p)).toBeNull()
  })
})

describe('devGateDecision', () => {
  it('只有 200 才放行', () => {
    expect(devGateDecision('page', 200)).toBe('pass')
    expect(devGateDecision('file', 200)).toBe('pass')
  })

  it('未登入:頁面導向登入,檔案擋下', () => {
    expect(devGateDecision('page', 401)).toBe('login')
    expect(devGateDecision('file', 401)).toBe('block')
  })

  it.each([403, 404, 500, null])('狀態 %s:不放行', (status) => {
    expect(devGateDecision('page', status)).toBe('shell')
    expect(devGateDecision('file', status)).toBe('block')
  })
})
