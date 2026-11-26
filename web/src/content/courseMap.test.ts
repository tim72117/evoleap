import { describe, expect, it } from 'vitest'
import { KIDS_LESSON_PAGES } from './kidsCourse'
import { launchLessonPath } from './launchCourse'
import { WEB_LESSON_PAGES } from './webCourse'
import { hideDrafts } from './courseMap'
import { CLAUDE_CODE_LESSON_PAGES, CLAUDE_CODE_TOPIC, LAUNCH_TOPIC, WEB_TOPIC } from './topics'

// 課程地圖的內容以資料庫為準;這裡只測前端自己的規則(網址、腳本檔、草稿),不比對課程內容。
describe('課頁網址與腳本', () => {
  it('主題的網址就是課程總覽頁,課頁網址照課號規則', () => {
    expect(WEB_TOPIC.path).toBe('/courses/web')
    expect(LAUNCH_TOPIC.path).toBe('/courses/launch')
    expect(CLAUDE_CODE_TOPIC.path).toBe('/courses/claude-code')
    expect(launchLessonPath('2.3')).toBe('/courses/launch/2-3')
    expect(WEB_LESSON_PAGES['0.1'].path).toBe('/courses/web/0-1')
    expect(KIDS_LESSON_PAGES['0.1'].path).toBe('/courses/kids/0-1')
    expect(CLAUDE_CODE_LESSON_PAGES['1']).toMatchObject({ path: '/courses/claude-code/1', script: `claude-code/${CLAUDE_CODE_LESSON_PAGES['1'].anchor}.json` })
  })

  it('前端課頁指到的腳本檔都存在,而且不在研發基地專用的 lab/', () => {
    const live = new Set(Object.keys(import.meta.glob('./live/**/*.json')).map((k) => k.replace('./live/', '')))
    const scripts = [KIDS_LESSON_PAGES, WEB_LESSON_PAGES, CLAUDE_CODE_LESSON_PAGES].flatMap((pages) => Object.values(pages).map((p) => p.script))
    expect(scripts.filter((p) => !live.has(p) || p.startsWith('lab/'))).toEqual([])
  })
})

describe('畫面上的身分不是管理員時,草稿當成規劃中(模擬身分、備援地圖)', () => {
  const units = [{ id: '1', title: 'u', subtitle: '', lessons: [
    { id: '1.1', title: 'a', summary: '', access: 'login-free' as const, status: 'open' as const, script: 'k/1.1.json' },
    { id: '1.2', title: 'b', summary: '', access: 'login-free' as const, status: 'draft' as const, script: 'k/1.2.json' },
  ] }]
  it('不是管理員:草稿變規劃中、拿掉腳本;開放的不動', () => {
    const out = hideDrafts(units, false)
    expect(out[0].lessons.map((l) => [l.id, l.status, l.script])).toEqual([['1.1', 'open', 'k/1.1.json'], ['1.2', 'planned', undefined]])
  })
  it('管理員:原樣', () => {
    expect(hideDrafts(units, true)).toBe(units)
  })
})
