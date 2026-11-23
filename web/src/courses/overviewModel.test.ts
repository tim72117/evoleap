import { describe, expect, it } from 'vitest'
import { COURSES, courseMapId, lessonUrl } from '../content/catalog'
import { SEED_COURSES, seedCourse } from '../content/courseSeed'
import type { CourseMap, MapLesson, MapUnit } from '../content/courseMap'
import { courseRoutes } from './routes'
import { artOf, DEFAULT_ART, lessonLink, overviewGroups, rowLabel, rowLink, startLesson, unitAnchor, unitGroupTitle } from './overviewModel'

const lesson = (id: string, status: MapLesson['status'] = 'open', extra: Partial<MapLesson> = {}): MapLesson => ({
  id,
  title: `課 ${id}`,
  summary: '',
  access: 'login-free',
  status,
  ...(status !== 'planned' ? { script: `x/${id}.json` } : {}),
  ...extra,
})
const unit = (id: string, lessons: MapLesson[], extra: Partial<MapUnit> = {}): MapUnit => ({ id, title: `單元 ${id}`, subtitle: '', lessons, ...extra })
const mapOf = (units: MapUnit[], extra: Partial<CourseMap> = {}): CourseMap => ({ id: 'c', title: '課', access: 'login-free', units, ...extra })
// 資料庫的課程地圖(伺服器回的 JSON)和種子同形
const seedMap = (id: string): CourseMap => seedCourse(id) as unknown as CourseMap
const course = (slug: string) => COURSES.find((c) => c.slug === slug)!

describe('unitGroupTitle:有簡短名稱是「名稱・標題冒號前」', () => {
  it('標題前綴是簡短名稱時去掉重複的前綴', () => {
    expect(unitGroupTitle({ label: '起步', title: '起步・AI 工具介紹：讓 AI 在你的電腦上做出第一個網站' })).toBe('起步・AI 工具介紹')
    expect(unitGroupTitle({ label: '基礎', title: '基礎・Vibe Coding 入門：用 AI 做出你的第一個小工具' })).toBe('基礎・Vibe Coding 入門')
  })
  it('標題沒有前綴也照樣加上名稱', () => {
    expect(unitGroupTitle({ label: '起步', title: 'AI 工具介紹：說明' })).toBe('起步・AI 工具介紹')
  })
  it('沒有簡短名稱就是單元標題(不截斷)', () => {
    expect(unitGroupTitle({ title: '單元 1　結構：網頁是一棵樹' })).toBe('單元 1　結構：網頁是一棵樹')
  })
})

describe('overviewGroups', () => {
  it('跳過先不公開(hidden)的單元;每個單元都有 #stage-<單元 id> 的錨點、標題下的小字', () => {
    const groups = overviewGroups(mapOf([unit('a', [lesson('1')], { subtitle: '小字' }), unit('b', [lesson('2')], { hidden: true }), unit('c', [lesson('3')], { label: '基礎' })]))
    expect(groups.map((g) => [g.id, g.anchor, g.title, g.subtitle])).toEqual([
      ['a', 'stage-a', '單元 a', '小字'],
      ['c', 'stage-c', '基礎・單元 c', undefined],
    ])
    expect(unitAnchor('x')).toBe('stage-x')
  })

  it('整門課都沒有課:單元本身是規劃中的項目,合成一組(組名是課程名稱)', () => {
    const groups = overviewGroups(mapOf([unit('1', [], { title: '主題一', subtitle: '說明' }), unit('2', [], { title: '主題二' })], { title: '進階' }))
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ title: '進階', plannedUnits: true })
    expect(groups[0].anchor).toBeUndefined()
    expect(groups[0].lessons.map((l) => [l.id, l.title, l.summary, l.status])).toEqual([
      ['1', '主題一', '說明', 'planned'],
      ['2', '主題二', '', 'planned'],
    ])
  })

  it('先不公開的單元不算「有課」:只剩它有課時,公開的單元當成規劃中的項目', () => {
    const groups = overviewGroups(mapOf([unit('1', [], {}), unit('2', [lesson('9')], { hidden: true })]))
    expect(groups[0].plannedUnits).toBe(true)
    expect(groups[0].lessons).toHaveLength(1)
  })

  it('沒有任何單元:沒有分組', () => {
    expect(overviewGroups(mapOf([]))).toEqual([])
  })

  it('種子:software 只列起步、基礎(零基礎不公開),錨點是階段 id;advanced、ai-agent 是規劃中的項目', () => {
    expect(overviewGroups(seedMap('software')).map((g) => [g.anchor, g.title])).toEqual([
      ['stage-tools', '起步・AI 工具介紹'],
      ['stage-vibe-coding-basics', '基礎・Vibe Coding 入門'],
    ])
    for (const id of ['advanced', 'ai-agent']) {
      const g = overviewGroups(seedMap(id))
      expect(g.map((x) => x.plannedUnits)).toEqual([true])
      expect(g[0].lessons.map((l) => l.id)).toEqual(seedCourse(id).units.map((u) => u.id))
    }
    // 其他課每個單元一組
    for (const id of ['web', 'launch', 'claude-code']) expect(overviewGroups(seedMap(id)).map((g) => g.id), id).toEqual(seedCourse(id).units.map((u) => u.id))
  })
})

describe('lessonLink:有腳本而且開放或草稿才連,網址照課號規則', () => {
  it('開放、草稿(管理員才拿得到)有腳本就連;規劃中、沒腳本不連', () => {
    expect(lessonLink('web', lesson('1.2'))).toBe('/courses/web/1-2')
    expect(lessonLink('web', lesson('1.2', 'draft'))).toBe('/courses/web/1-2')
    expect(lessonLink('web', lesson('1.2', 'planned'))).toBeNull()
    expect(lessonLink('web', lesson('1.2', 'open', { script: undefined }))).toBeNull()
  })

  it('網址和現在的一模一樣', () => {
    expect(lessonLink('web', lesson('1.2'))).toBe('/courses/web/1-2')
    expect(lessonLink('launch', lesson('0.1'))).toBe('/courses/launch/0-1')
    expect(lessonLink('claude-code', lesson('1'))).toBe('/courses/claude-code/1')
    expect(lessonLink('software', lesson('0.intro'))).toBe('/courses/software/intro')
    expect(lessonLink('software', lesson('0.1'))).toBe('/courses/software/1')
    expect(lessonLink('software', lesson('1.0'))).toBe('/courses/software/1-0')
    expect(lessonLink('software', lesson('4.3'))).toBe('/courses/software/4-3')
  })
})

describe('資料庫(種子)的課程地圖 ↔ 前端的課頁', () => {
  const routePaths = new Set(courseRoutes.map((r) => r.path))

  it('做出自己的軟體:種子每一課都有路由(不論開放與否),有腳本的課連結等於課頁網址;總覽連出去的網址都有路由', () => {
    const software = course('software')
    const seedLessons = seedCourse('software').units.flatMap((u) => u.lessons)
    for (const s of seedLessons) {
      expect(routePaths.has(lessonUrl('software', s.id)), s.id).toBe(true)
      const to = lessonLink('software', s as unknown as MapLesson)
      if (s.script && s.status !== 'planned') expect(to, s.id).toBe(lessonUrl('software', s.id))
    }
    for (const g of overviewGroups(seedMap('software')))
      g.lessons.forEach((l, i) => {
        const to = rowLink(software, g, l, i)
        if (to) expect(routePaths.has(to), `${l.id} ${to}`).toBe(true)
      })
  })

  it('web、launch、claude-code:有腳本的課連到 /courses/<課程>/ 底下的網址', () => {
    for (const slug of ['web', 'launch', 'claude-code']) {
      for (const g of overviewGroups(seedMap(slug)))
        for (const l of g.lessons) {
          const to = rowLink(course(slug), g, l, 0)
          if (to) expect(to.startsWith(`/courses/${slug}/`), `${slug} ${l.id} ${to}`).toBe(true)
        }
    }
  })

  it('每門課的種子都對得到前端的課程(課程地圖 id)', () => {
    for (const c of COURSES) expect(SEED_COURSES.some((s) => s.id === courseMapId(c)), c.slug).toBe(true)
  })
})

describe('rowLink / rowLabel', () => {
  it('規劃中的單元列表照順序連到規劃中章節頁(進階:/courses/advanced/topic-N),標籤是章節編號', () => {
    const advanced = course('advanced')
    const g = overviewGroups(seedMap('advanced'))[0]
    expect(g.lessons.map((l, i) => rowLink(advanced, g, l, i))).toEqual(advanced.planned.map((p) => `/courses/advanced/${p.slug}`))
    expect(g.lessons.map((l, i) => rowLabel(advanced, g, l, i))).toEqual(advanced.planned.map((p) => p.label))
  })

  it('規劃中的課:做出自己的軟體(每個種子課都有路由)連到單課網址(規劃中章節頁);其他課不連', () => {
    const software = course('software')
    const g = overviewGroups(seedMap('software')).find((x) => x.id === 'vibe-coding-basics')!
    const planned = g.lessons.find((l) => l.status === 'planned')!
    expect(rowLink(software, g, planned, 0)).toBe(`/courses/software/${planned.id.split('.').join('-')}`)
    expect(rowLink(course('web'), overviewGroups(seedMap('web'))[1], lesson('1.9', 'planned'), 0)).toBeNull()
  })

  it('課號:software 是「序章」「第 N 課」,其他課是資料庫的課號', () => {
    const software = course('software')
    const g = overviewGroups(seedMap('software'))[0]
    expect(rowLabel(software, g, g.lessons[0], 0)).toBe('序章')
    expect(rowLabel(software, g, g.lessons[2], 2)).toBe('第 1 課')
    const web = overviewGroups(seedMap('web'))[1]
    expect(rowLabel(course('web'), web, web.lessons[1], 1)).toBe('1.2')
  })
})

describe('startLesson', () => {
  const groups = overviewGroups(mapOf([unit('a', [lesson('1', 'open', { access: 'login-free' }), lesson('2', 'open', { access: 'free' })])]))
  it('登入或還在確認時是第一個開放的課;未登入優先不用登入就能看的課', () => {
    expect(startLesson('x', groups, false)?.id).toBe('1')
    expect(startLesson('x', groups, true)?.id).toBe('2')
  })
  it('沒有開放的課(規劃中的項目、都還沒開放)就沒有開始學習', () => {
    expect(startLesson('x', overviewGroups(mapOf([unit('a', [])])), false)).toBeUndefined()
    expect(startLesson('x', overviewGroups(mapOf([unit('a', [lesson('1', 'planned')])])), false)).toBeUndefined()
  })
})

describe('artOf', () => {
  it('課程沒有設定插圖時用預設', () => {
    expect(artOf({ art: undefined })).toBe(DEFAULT_ART)
    expect(artOf({ art: '' as never })).toBe(DEFAULT_ART)
    expect(artOf({ art: 'agent' })).toBe('agent')
  })
})

describe('軟體課的單課路由(依種子產生)', () => {
  const seedLessons = seedCourse('software').units.flatMap((u) => u.lessons)
  const softwarePaths = courseRoutes.map((r) => r.path).filter((p) => p.startsWith('/courses/software/'))

  it('路由數量等於種子的課數,每個種子課都有路由(不論 status),沒有重複', () => {
    expect(softwarePaths.length).toBe(seedLessons.length)
    expect(new Set(softwarePaths).size).toBe(softwarePaths.length)
    for (const l of seedLessons) expect(softwarePaths, l.id).toContain(lessonUrl('software', l.id))
  })
})
