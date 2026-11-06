// 首頁兒童課卡片的段落說明(KIDS_TOPIC.preview.sections)用段落名稱對到預覽腳本的 chapter:
// 腳本改了段落名稱、這裡沒跟著改,說明就默默不見了,所以在這裡檢查。
import { describe, expect, it } from 'vitest'
import { KIDS_TOPIC } from './topics'

type Script = { steps: { chapter?: string }[] }

const SCRIPTS = import.meta.glob<Script>('./live/**/*.json', { import: 'default', eager: true })

describe('KIDS_TOPIC.preview', () => {
  const preview = KIDS_TOPIC.preview
  const script = SCRIPTS[`./live/${preview.script}`]

  it('預覽腳本對得到 src/content/live/ 的檔案', () => {
    expect(Object.keys(SCRIPTS)).toContain(`./live/${preview.script}`)
  })

  it('sections 的每個段落名稱都是預覽腳本裡的 chapter', () => {
    const chapters = new Set(script.steps.map((x) => x.chapter).filter((c): c is string => typeof c === 'string'))
    const keys = Object.keys(preview.sections)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) expect([...chapters], `段落「${key}」不在 ${preview.script} 的 chapter 裡`).toContain(key)
  })
})
