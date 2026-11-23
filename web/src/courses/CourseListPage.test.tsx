// 全部課程頁:清單來自 GET /api/courses;這裡驗證分組、主題連結、讀取中與讀不到的畫面。
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { fetchCourseList, groupByTopic, type CourseListItem, type CourseListState } from '../content/courseList'
import type { CourseMapState } from '../content/courseMap'
import { zh } from '../i18n/zh'

vi.mock('../content/courseMap', async (orig) => ({
  ...(await orig<typeof import('../content/courseMap')>()),
  useCourseMap: (id: string): CourseMapState =>
    id === 'software'
      ? {
          status: 'ready',
          map: {
            id,
            title: '做出自己的軟體',
            access: 'login-free',
            units: [
              { id: '1', title: '起步', subtitle: '', label: '起步', lessons: [{ id: '1.1', title: 'a', summary: '', access: 'free', status: 'open' }, { id: '1.2', title: 'b', summary: '', access: 'free', status: 'planned' }] },
              { id: '2', title: '藏起來', subtitle: '', hidden: true, lessons: [{ id: '2.1', title: 'c', summary: '', access: 'free', status: 'open' }] },
            ],
          },
        }
      : id === 'agent'
        ? { status: 'ready', map: { id, title: '代理', access: 'login-free', units: [{ id: '0', title: '單元', subtitle: '', lessons: [] }] } }
        : { status: 'loading' },
}))
let list: CourseListState = { status: 'loading' }
vi.mock('../content/courseList', async (orig) => ({ ...(await orig<typeof import('../content/courseList')>()), useCourseList: () => list }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ status: 'guest' }) }))
vi.mock('../i18n/I18nProvider', () => ({ useT: () => zh }))
vi.mock('../site/SiteLayout', () => ({ SiteLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

const { CourseListPage } = await import('./CourseListPage')

const item = (id: string, topic: string, extra: Partial<CourseListItem> = {}): CourseListItem => ({ id, title: `課 ${id}`, access: 'login-free', topicId: topic.toLowerCase(), topic, topicSlogan: `${topic}標語`, ...extra })

describe('groupByTopic', () => {
  it('連續同主題的課分成一組,順序不變', () => {
    const g = groupByTopic([item('a', 'A'), item('b', 'A'), item('c', 'B'), item('d', 'A')])
    expect(g.map((x) => [x.topic, x.courses.map((c) => c.id)])).toEqual([['A', ['a', 'b']], ['B', ['c']], ['A', ['d']]])
  })
  it('topicPath 省略時連到這組第一門課的總覽頁', () => {
    const g = groupByTopic([item('a', 'A', { topicPath: '/topics/x' }), item('b', 'B'), item('c', 'B')])
    expect(g.map((x) => x.topicPath)).toEqual(['/topics/x', '/courses/b'])
  })
  it('空清單沒有組', () => expect(groupByTopic([])).toEqual([]))
})

const render = (state: CourseListState) => {
  list = state
  return renderToStaticMarkup(
    <MemoryRouter>
      <CourseListPage />
    </MemoryRouter>,
  )
}

describe('CourseListPage', () => {
  it('讀取中顯示佔位', () => {
    const html = render({ status: 'loading' })
    expect(html).toContain('data-testid="lesson-list-loading"')
    expect(html).not.toContain('<section')
  })

  it('讀不到顯示「無法讀取課程資訊」', () => {
    const html = render({ status: 'error' })
    expect(html).toContain('data-testid="lesson-list-error"')
    expect(html).toContain('無法讀取課程資訊')
  })

  it('依主題分組、課名連到 /courses/<id>、主題連結與卡片標籤', () => {
    const html = render({ status: 'ready', courses: [item('software', 'S', { summary: '簡介文字', topicPath: '/topics/software' }), item('kids', 'K')] })
    expect(html.match(/<section/g)).toHaveLength(2)
    expect([...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => m[1])).toEqual(['S', 'K'])
    expect([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(['/topics/software', '/courses/software', '/courses/kids', '/courses/kids'])
    expect(html).toContain('簡介文字')
    expect(html).toContain(zh.courses.list.openN(1))
    expect(html).toContain(zh.courses.levelName('起步'))
  })

  it('overview:false 的課卡片連主題頁;其他連 /courses/<id>;advanced(無 overview 欄位、單元沒課)連 /courses/advanced', () => {
    const html = render({
      status: 'ready',
      courses: [
        item('software', 'S', { topicPath: '/topics/software' }),
        item('agent', 'A', { topicPath: '/topics/ai-apps', overview: false }),
        item('advanced', 'A', { topicPath: '/topics/ai-apps' }),
      ],
    })
    const hrefs = [...html.matchAll(/<h3><a href="([^"]*)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(['/courses/software', '/topics/ai-apps', '/courses/advanced'])
  })

  it('地圖還在讀時連結不變(overview:false 仍連主題頁、其他仍連 /courses/<id>)', () => {
    const html = render({
      status: 'ready',
      courses: [item('loading1', 'L', { topicPath: '/topics/l', overview: false }), item('loading2', 'L', { topicPath: '/topics/l' })],
    })
    const hrefs = [...html.matchAll(/<h3><a href="([^"]*)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(['/topics/l', '/courses/loading2'])
  })
})

describe('fetchCourseList', () => {
  it('讀 /api/courses 取出 courses;失敗時丟錯', async () => {
    const courses = [item('a', 'A')]
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ courses }) })))
    expect(await fetchCourseList()).toEqual(courses)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/courses')
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 500 }))
    await expect(fetchCourseList()).rejects.toThrow()
    vi.unstubAllGlobals()
  })
})
