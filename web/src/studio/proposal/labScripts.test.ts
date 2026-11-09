import { describe, expect, it } from 'vitest'
import type { StageScript } from '../../live/stage'
import { momentsOf } from '../interactive/scene'

// 試做腳本都要能被播放器解析互動點:舞台載入得了,但互動點寫錯(例如有 id 卻沒有選項)時,試做頁一樣播不了。
const SCRIPTS = import.meta.glob('../../content/live/lab/**/*.json', { eager: true, import: 'default' }) as Record<string, StageScript>

describe('試做腳本的互動點', () => {
  it('有腳本可以檢查', () => {
    expect(Object.keys(SCRIPTS).length).toBeGreaterThan(300)
  })

  it.each(Object.keys(SCRIPTS))('%s', (path) => {
    expect(() => momentsOf(SCRIPTS[path])).not.toThrow()
  })
})
