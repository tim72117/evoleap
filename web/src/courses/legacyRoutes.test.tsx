import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AI_APPS_TOPIC } from '../content/topics'
import { COURSES } from '../content/catalog'

// 轉址元件(Navigate)在 effect 才會轉,靜態渲染看不到;換成把目標記下來的替身
let navigated: unknown
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  Navigate: ({ to }: { to: unknown }) => {
    navigated = to
    return null
  },
}))

const { courseRoutes, legacyCourseRoutes, claudeCodeAnchorTarget } = await import('./routes')

/** 在舊網址上跑轉址路由,回傳 Navigate 的目標(統一成 pathname/search/hash) */
function redirectOf(path: string, url: string): { pathname: string; search: string; hash: string } {
  const route = legacyCourseRoutes.find((r) => r.path === path)
  expect(route, path).toBeDefined()
  navigated = undefined
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={path} element={route!.element} />
      </Routes>
    </MemoryRouter>,
  )
  const to = navigated as string | { pathname: string; search?: string; hash?: string }
  const o = typeof to === 'string' ? { pathname: to } : to
  return { pathname: o.pathname, search: o.search ?? '', hash: o.hash ?? '' }
}

// 舊網址轉址(站內連結、網頁內導覽;伺服器另外 301)
describe('AI Agent 中階課沒有自己的頁面,舊網址轉到主題頁', () => {
  it('/courses/ai-agent 與底下的單元頁(/courses/ai-agent/:chapter)轉到 /topics/ai-apps', () => {
    for (const path of ['/courses/ai-agent', '/courses/ai-agent/:chapter']) {
      const route = legacyCourseRoutes.find((r) => r.path === path)
      expect(route, path).toBeDefined()
      expect(route!.element.props.to, path).toBe(AI_APPS_TOPIC.path)
    }
  })

  it('課程路由不再有 /courses/ai-agent(不然轉址會被專屬頁蓋掉)', () => {
    expect(courseRoutes.some((r) => r.path.startsWith('/courses/ai-agent'))).toBe(false)
    expect(COURSES.some((c) => c.slug === 'ai-agent')).toBe(false)
  })
})

describe('舊網址轉址保留 search 與 hash', () => {
  it('/courses/tools|ai-tools|vibe-coding 轉到 /courses/software(保留 search,hash 是階段錨點)', () => {
    for (const slug of ['tools', 'ai-tools', 'vibe-coding']) {
      const r = redirectOf(`/courses/${slug}`, `/courses/${slug}?a=1`)
      expect(r.pathname).toBe('/courses/software')
      expect(r.search).toBe('?a=1')
    }
  })
  it('/courses/<舊>/:lesson 轉到 /courses/software/:lesson,保留 search 與 hash', () => {
    for (const slug of ['tools', 'ai-tools', 'vibe-coding']) {
      expect(redirectOf(`/courses/${slug}/:lesson`, `/courses/${slug}/1-2?a=1#x`)).toEqual({ pathname: '/courses/software/1-2', search: '?a=1', hash: '#x' })
    }
  })
  it('/topics/web|launch|kids 與底下的單課頁', () => {
    for (const [slug, lesson] of [['web', '1-2'], ['launch', '1-2'], ['kids', '0-1']]) {
      expect(redirectOf(`/topics/${slug}`, `/topics/${slug}?a=1#x`)).toEqual({ pathname: `/courses/${slug}`, search: '?a=1', hash: '#x' })
      expect(redirectOf(`/topics/${slug}/:lesson`, `/topics/${slug}/${lesson}?a=1#x`)).toEqual({ pathname: `/courses/${slug}/${lesson}`, search: '?a=1', hash: '#x' })
    }
  })
})

describe('Claude Code 舊網址:壞掉的百分比編碼不丟錯', () => {
  it('claudeCodeAnchorTarget 壞編碼回 undefined、正常錨點轉到情境課頁', () => {
    expect(claudeCodeAnchorTarget('#%E0%A4%A')).toBeUndefined()
    expect(claudeCodeAnchorTarget('#%')).toBeUndefined()
    expect(claudeCodeAnchorTarget('#remote')).toMatch(/#remote$/)
  })
  it('LegacyClaudeCodeRedirect:壞編碼留在總覽頁並保留 search/hash;#scenarios 變 #map;影片錨點轉課頁', () => {
    expect(redirectOf('/topics/claude-code', '/topics/claude-code?a=1#%E0%A4%A')).toEqual({ pathname: '/courses/claude-code', search: '?a=1', hash: '#%E0%A4%A' })
    expect(redirectOf('/topics/claude-code', '/topics/claude-code#%')).toMatchObject({ pathname: '/courses/claude-code', hash: '#%' })
    expect(redirectOf('/topics/claude-code', '/topics/claude-code#scenarios')).toMatchObject({ pathname: '/courses/claude-code', hash: '#map' })
    expect(claudeCodeAnchorTarget('#remote')).toBe('/courses/claude-code/2#remote')
  })
})
