// 課程總覽頁的畫面(伺服端渲染成 HTML 檢查):內容全來自課程地圖(API),這裡用假的地圖驗證課程說明、簡介影片、插圖、單元與連結怎麼畫出來。
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { CourseMap, CourseMapState } from '../content/courseMap'
import { COURSES } from '../content/catalog'
import { zh } from '../i18n/zh'

let state: CourseMapState = { status: 'loading' }
vi.mock('../content/courseMap', async (orig) => ({ ...(await orig<typeof import('../content/courseMap')>()), useCourseMap: () => state }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ status: 'guest' }) }))
vi.mock('../i18n/I18nProvider', () => ({ useT: () => zh }))
vi.mock('../site/SiteLayout', () => ({ SiteLayout: ({ title, children }: { title?: string; children: React.ReactNode }) => <div data-title={title}>{children}</div> }))
vi.mock('../site/lazyPage', () => ({ lazyPage: () => (props: { script: string; saveProgress: boolean }) => <div data-player={props.script} data-save={String(props.saveProgress)} /> }))
vi.mock('../home/LevelArt', () => ({ LevelArt: ({ art }: { art: string }) => <svg data-art={art} /> }))

const { CourseOverviewPage } = await import('./CourseOverviewPage')

const base = { id: 'web', title: '課程名', access: 'login-free' as const }
const page = (slug: string) => (
  <MemoryRouter>
    <CourseOverviewPage course={COURSES.find((c) => c.slug === slug)!} />
  </MemoryRouter>
)
const render = (slug: string, map: Partial<CourseMap> = {}) => {
  state = { status: 'ready', map: { ...base, units: [], ...map } }
  return renderToStaticMarkup(page(slug))
}
const unit = (id: string, extra = {}) => ({
  id,
  title: `單元 ${id}`,
  subtitle: '小字',
  lessons: [{ id: `${id}.1`, title: '一課', summary: '學會', access: 'free' as const, status: 'open' as const, script: 'web/x.json', minutes: 10 }],
  ...extra,
})

describe('CourseOverviewPage(資料來自課程地圖)', () => {
  it('標題、簡介、文件標題(seoTitle 優先)', () => {
    const html = render('web', { summary: '這是簡介', seoTitle: 'SEO 標題', units: [unit('1')] })
    expect(html).toContain('<h1>課程名</h1>')
    expect(html).toContain('這是簡介')
    expect(html).toContain('data-title="SEO 標題"')
    expect(render('web', { units: [unit('1')] })).toContain('data-title="課程名"')
  })

  it('課程說明:每個段落一個 <p>,沒有說明就不畫這一塊', () => {
    const html = render('web', { about: ['第一段', '第二段'], units: [unit('1')] })
    expect(html).toContain('課程說明')
    expect(html).toContain('<p>第一段</p><p>第二段</p>')
    expect(render('web', { units: [unit('1')] })).not.toContain('課程說明')
    expect(render('web', { about: [], units: [unit('1')] })).not.toContain('課程說明')
  })

  it('簡介影片:有 introScript 才畫,不記播放進度;沒有就沒有「課程簡介」', () => {
    const html = render('web', { introScript: 'guide/kids.json', units: [unit('1')] })
    expect(html).toContain('課程簡介')
    expect(html).toContain('data-player="guide/kids.json"')
    expect(html).toContain('data-save="false"')
    const none = render('web', { units: [unit('1')] })
    expect(none).not.toContain('課程簡介')
    expect(none).not.toContain('data-player')
  })

  it('插圖:用課程設定的,沒有就用預設', () => {
    expect(render('web', { art: 'build', units: [unit('1')] })).toContain('data-art="build"')
    expect(render('web', { units: [unit('1')] })).toContain('data-art="tools"')
  })

  it('每個單元一組、有 #stage-<id> 錨點;先不公開的單元不畫;標題是「名稱・標題」', () => {
    const html = render('software', {
      units: [unit('a', { label: '起步', title: '起步・工具：說明' }), unit('b', { hidden: true, label: '零基礎' }), unit('c', { label: '基礎' })],
    })
    expect(html).toContain('id="stage-a"')
    expect(html).toContain('id="stage-c"')
    expect(html).not.toContain('id="stage-b"')
    expect(html).toContain('起步・工具')
    expect(html).toContain('基礎・單元 c')
    // 簡短名稱當作課程標籤(先不公開的不列)
    expect(html).toContain('起步・基礎</span>')
    expect(html).not.toContain('零基礎')
  })

  it('開放且有腳本的課連到課程頁,規劃中的不連;開始學習連到第一個開放的課', () => {
    const html = render('web', {
      units: [
        unit('1', {
          lessons: [
            { id: '1.2', title: '開放課', summary: '', access: 'free', status: 'open', script: 'web/1.2.json' },
            { id: '1.3', title: '規劃課', summary: '', access: 'login-free', status: 'planned' },
          ],
        }),
      ],
    })
    expect(html).toContain('href="/courses/web/1-2"')
    expect(html).not.toContain('href="/courses/web/1-3"')
    expect(html.match(/href="\/courses\/web\/1-2"/g)).toHaveLength(2) // 開始學習 + 課程清單
  })

  it('整門課沒有課:單元列成規劃中的項目,連到規劃中章節頁', () => {
    const html = render('advanced', {
      title: '進階',
      units: [
        { id: '1', title: '主題一', subtitle: '', lessons: [] },
        { id: '2', title: '主題二', subtitle: '', lessons: [] },
      ],
    })
    expect(html).toContain('主題一')
    expect(html).toContain('href="/courses/advanced/topic-1"')
    expect(html).not.toContain('id="stage-1"')
  })

  it('讀取中、讀不到:佔位卡,不用前端資料頂替', () => {
    state = { status: 'loading' }
    expect(renderToStaticMarkup(page('web'))).toContain('lesson-list-loading')
    state = { status: 'error' }
    expect(renderToStaticMarkup(page('web'))).toContain('lesson-list-error')
  })
})
