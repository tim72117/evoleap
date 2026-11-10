// 即時教學畫面的腳本(src/content/live/)與單課資料的對應:
// videos[].live 要對得到腳本檔,腳本裡 lessonStep 的集合要等於該影片的 steps。
import { describe, expect, it } from 'vitest'
import { L0_LESSONS } from './l0Lessons'
import { L1_LESSONS } from './l1Lessons'

type Script = { steps: { lessonStep?: number }[] }

const SCRIPTS = import.meta.glob<Script>(['./live/**/*.json', '!./live/data/**'], { import: 'default', eager: true })
const script = (path: string): Script | undefined => SCRIPTS[`./live/${path}`]

const liveVideos = [...L0_LESSONS, ...L1_LESSONS].flatMap((l) =>
  l.videos.filter((v) => v.live).map((v) => [`${l.id} ${v.title}(${v.live})`, v] as const),
)

describe('即時教學畫面腳本', () => {
  it('至少有三支即時影片(L0 第 0、1、2 課)', () => {
    expect(liveVideos.length).toBeGreaterThanOrEqual(3)
  })

  it.each(liveVideos)('%s:videos[].live 對得到 src/content/live/ 的檔案', (_, v) => {
    expect(Object.keys(SCRIPTS)).toContain(`./live/${v.live}`)
  })

  it.each(liveVideos)('%s:腳本 lessonStep 的集合等於影片的 steps', (_, v) => {
    const s = script(v.live!)
    expect(s?.steps.length).toBeGreaterThan(0)
    const fromScript = [...new Set(s!.steps.map((x) => x.lessonStep).filter((n): n is number => typeof n === 'number'))]
    expect(fromScript.sort((a, b) => a - b)).toEqual([...v.steps].sort((a, b) => a - b))
  })
})
