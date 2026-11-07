import { describe, expect, it } from 'vitest'
import { withTeacher } from './teacher'
import type { StageScript } from './types'

const base: StageScript = { title: 't', cast: { claude: { actor: 'claude-desktop' } }, steps: [{ show: 'claude' }] }

describe('withTeacher', () => {
  it('沒有 teacher 時原樣回傳', () => {
    expect(withTeacher(base)).toBe(base)
  })

  it('展開成老師登場、共用招呼、這一課的一句、退場,放在最前面', () => {
    const s = withTeacher({ ...base, teacher: { say: '今天做訂購單', line: '今天要來做一張訂購單。' } })
    expect(Object.keys(s.cast)).toEqual(['teacher', 'claude'])
    expect(s.cast.teacher).toMatchObject({ actor: 'person', props: { name: 'Lena', look: 'teacher' }, hidden: true })
    expect(s.steps.slice(0, 4)).toEqual([
      { show: 'teacher' },
      { on: 'teacher', say: '大家好，我是 Lena！', mood: 'happy', narration: '大家好，我是 Lena。' },
      { on: 'teacher', say: '今天做訂購單', mood: 'happy', narration: '今天要來做一張訂購單。' },
      { hide: 'teacher' },
    ])
    expect(s.steps[4]).toEqual({ show: 'claude' })
  })

  it('可以換掉共用的招呼語(其他語言的試做)', () => {
    const s = withTeacher({ ...base, teacher: { say: 'Hi', line: 'Today…', greeting: "Hi everyone, I'm Lena.", greetingSay: "Hi, I'm Lena!" } })
    expect(s.steps[1]).toEqual({ on: 'teacher', say: "Hi, I'm Lena!", mood: 'happy', narration: "Hi everyone, I'm Lena." })
  })

  it('演員表已經有 teacher 代號時報錯', () => {
    expect(() => withTeacher({ ...base, cast: { teacher: { actor: 'person' } }, teacher: { say: 'a', line: 'b' } })).toThrow()
  })
})
