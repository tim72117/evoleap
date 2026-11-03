import { describe, expect, it } from 'vitest'
import type { StageScript } from '../../live/types'
import bakery from '../../content/live/lab/interactive-bakery.json'
import l0Claude from '../../content/live/lab/interactive-l0-claude.json'
import l00 from '../../content/live/l0/0.0-tools.json'
import { withL0Moments } from './l0-0.0'
import l01 from '../../content/live/l0/0.1-project.json'
import { withL01Moments } from './l0-0.1'
import { answerLabel, expandAnswers, momentsOf, withoutAnswer, type Answer, type Moment } from './scene'

const script = {
  title: 't',
  cast: { phone: { actor: 'chat' } },
  steps: [
    { receive: '蛋糕', from: '甲' },
    {
      checkpoint: '怎麼回?',
      id: 'a',
      options: [{ label: '好', steps: [{ reply: '好' }, { receive: '謝謝', from: '甲' }] }],
      free: { placeholder: '打字', steps: [{ reply: '{{text}}!{{text}}' }] },
    },
    { receive: '可頌', from: '乙' },
  ],
} as unknown as StageScript

type Loose = { reply?: string; receive?: string; checkpoint?: string }
const texts = (s: StageScript) => s.steps.map((x) => (x as Loose).reply ?? (x as Loose).receive ?? (x as Loose).checkpoint)

describe('expandAnswers', () => {
  it('沒回答、略過時不插入步驟', () => {
    expect(expandAnswers(script, {}).steps).toEqual(script.steps)
    expect(expandAnswers(script, { a: { skipped: true } }).steps).toEqual(script.steps)
  })

  it('選項的步驟插在互動點後面,第一步標成章節', () => {
    const out = expandAnswers(script, { a: { option: 0 } })
    expect(texts(out)).toEqual(['蛋糕', '怎麼回?', '好', '謝謝', '可頌'])
    expect(out.steps[2]).toMatchObject({ chapter: '你的回答' })
    expect(out.steps[3]).not.toHaveProperty('chapter')
  })

  it('自己打字:填入每個 {{text}},特殊字元照原樣', () => {
    expect(texts(expandAnswers(script, { a: { text: '$& <b>' } }))[2]).toBe('$& <b>!$& <b>')
  })

  it('不改動原本的腳本', () => {
    const before = JSON.stringify(script)
    expandAnswers(script, { a: { text: 'x' } })
    expect(JSON.stringify(script)).toBe(before)
  })

  it('選項不存在時丟錯', () => {
    expect(() => expandAnswers(script, { a: { option: 5 } })).toThrow('沒有第 5 個選項')
  })
})

describe('momentsOf', () => {
  it('只列出有 id 的 checkpoint', () => {
    const plain = { ...script, steps: [...script.steps, { checkpoint: '一般練習點' }] } as StageScript
    expect(momentsOf(plain).map((m) => m.id)).toEqual(['a'])
  })

  it('沒有選項、id 重複時丟錯', () => {
    const noOptions = { ...script, steps: [{ checkpoint: 'x', id: 'x' }] } as unknown as StageScript
    expect(() => momentsOf(noOptions)).toThrow('沒有選項')
    const dup = { ...script, steps: [script.steps[1], script.steps[1]] } as StageScript
    expect(() => momentsOf(dup)).toThrow('重複')
  })

  it('試做腳本的互動點都可以展開', () => {
    const scene = bakery as unknown as StageScript
    const moments = momentsOf(scene)
    expect(moments.map((m) => m.id)).toEqual(['cake', 'phone'])
    for (const m of moments) {
      m.options.forEach((_, option) => expect(() => expandAnswers(scene, { [m.id]: { option } })).not.toThrow())
    }
  })
})

describe('前置的互動點與示範', () => {
  const chained = {
    ...script,
    steps: [
      { checkpoint: '下指令', id: 'a', options: [{ label: '好', steps: [{ reply: '好' }] }], skip: { label: '先看示範', steps: [{ reply: '示範' }] } },
      { checkpoint: '允許嗎', id: 'b', requires: 'a', options: [{ label: '允許', steps: [{ reply: '允許' }] }] },
      { checkpoint: '再確認', id: 'c', requires: 'b', options: [{ label: '確認', steps: [{ reply: '確認' }] }] },
    ],
  } as unknown as StageScript

  it('沒回答時演出示範;前置的互動點沒回答也沒示範時,後面的互動點不出現', () => {
    expect(texts(expandAnswers(chained, {}))).toEqual(['下指令', '示範', '允許嗎'])
    expect(expandAnswers(chained, {}).steps[1]).not.toHaveProperty('chapter')
    expect(texts(expandAnswers(chained, { a: { option: 0 } }))).toEqual(['下指令', '好', '允許嗎'])
  })

  it('有示範的略過會演出示範,章節用按鈕文字', () => {
    const out = expandAnswers(chained, { a: { skipped: true } })
    expect(texts(out)).toEqual(['下指令', '示範', '允許嗎'])
    expect(out.steps[1]).toMatchObject({ chapter: '先看示範' })
  })

  it('收回回答時,接在後面的回答一起收回', () => {
    const moments = momentsOf(chained)
    const answers = { a: { option: 0 }, b: { option: 0 }, c: { option: 0 } }
    expect(withoutAnswer(moments, answers, 'a')).toEqual({})
    expect(withoutAnswer(moments, answers, 'c')).toEqual({ a: { option: 0 }, b: { option: 0 } })
  })

  it('收回回答時,所有依賴它的回答都收回', () => {
    const forked = {
      ...script,
      steps: [
        { checkpoint: 'A', id: 'a', options: [{ label: '1', steps: [] }] },
        { checkpoint: 'B', id: 'b', requires: 'a', options: [{ label: '1', steps: [] }] },
        { checkpoint: 'C', id: 'c', requires: 'a', options: [{ label: '1', steps: [] }] },
      ],
    } as unknown as StageScript
    expect(withoutAnswer(momentsOf(forked), { a: { option: 0 }, b: { option: 0 }, c: { option: 0 } }, 'a')).toEqual({})
  })

  it('沒有示範的略過不算完成前置,後面的互動點不出現', () => {
    const noSkip = {
      ...script,
      steps: [
        { checkpoint: 'A', id: 'a', options: [{ label: '1', steps: [{ reply: '好' }] }] },
        { checkpoint: 'B', id: 'b', requires: 'a', options: [{ label: '1', steps: [] }] },
      ],
    } as unknown as StageScript
    expect(texts(expandAnswers(noSkip, { a: { skipped: true } }))).toEqual(['A'])
    expect(texts(expandAnswers(noSkip, { a: { option: 0 } }))).toEqual(['A', '好', 'B'])
  })

  it('requires 不是前面的互動點時丟錯', () => {
    const bad = { ...script, steps: [{ checkpoint: 'x', id: 'x', requires: 'y', options: [{ label: 'a', steps: [] }] }] } as unknown as StageScript
    expect(() => momentsOf(bad)).toThrow('requires')
  })

  it('L0 試做腳本的每種回答都可以展開', () => {
    const scene = l0Claude as unknown as StageScript
    expect(momentsOf(scene).map((m) => m.id)).toEqual(['prompt', 'permission'])
    const firsts: Answer[] = [{ option: 0 }, { option: 1 }, { option: 2 }, { skipped: true }]
    for (const first of firsts) {
      for (const option of [0, 1]) {
        const out = expandAnswers(scene, { prompt: first, permission: { option } })
        expect(out.steps.some((s) => 'choose' in s && s.choose === (option === 0 ? 1 : 0))).toBe(true)
      }
    }
  })
})

describe('L0 第 0 課的互動版', () => {
  const base = l00 as unknown as StageScript
  const scene = withL0Moments(base)

  it('三個互動點,沒回答時內容和原本的腳本一樣', () => {
    expect(momentsOf(scene).map((m) => m.id)).toEqual(['prompt', 'create', 'delete'])
    const said = (s: StageScript) => s.steps.map((x) => (x as { narration?: string }).narration).filter(Boolean)
    expect(said(expandAnswers(scene, {}))).toEqual(said(base))
  })

  it('每種回答都接得上:都會建立檔案,也都有回顧', () => {
    for (const prompt of [0, 1, 2]) {
      for (const create of [0, 1, 2]) {
        for (const del of [0, 1, 2]) {
          const steps = expandAnswers(scene, { prompt: { option: prompt }, create: { option: create }, delete: { option: del } }).steps as Record<string, unknown>[]
          expect(steps.filter((s) => s.create === 'hello.txt')).toHaveLength(1)
          expect(steps.filter((s) => 'card' in s).at(-1)?.card).toBe('下一課：專案與工作目錄')
        }
      }
    }
  })
})

describe('L0 第 1 課的互動版', () => {
  const base = l01 as unknown as StageScript
  const scene = withL01Moments(base)
  const ids = ['workdir', 'files', 'path', 'move', 'remove']

  it('五個互動點,沒回答時內容和原本的腳本一樣', () => {
    expect(momentsOf(scene).map((m) => m.id)).toEqual(ids)
    const said = (s: StageScript) => s.steps.map((x) => (x as { narration?: string }).narration).filter(Boolean)
    expect(said(expandAnswers(scene, {}))).toEqual(said(base))
    const kinds = (s: StageScript) => s.steps.filter((x) => !('checkpoint' in x && 'id' in x)).length
    expect(kinds(expandAnswers(scene, {}))).toBe(base.steps.length)
  })

  it('每個互動點都有三個選項與示範;一個選項的章節與課程步驟都還在', () => {
    for (const m of momentsOf(scene)) {
      expect(m.options).toHaveLength(3)
      expect(m.skip?.steps.length).toBeGreaterThan(0)
    }
    const stepsOf = (s: StageScript) => s.steps.map((x) => (x as { lessonStep?: number }).lessonStep).filter(Boolean)
    expect(stepsOf(expandAnswers(scene, {}))).toEqual(stepsOf(base))
  })
})

describe('answerLabel', () => {
  const moment: Moment = { id: 'a', title: 't', body: '', options: [{ label: '好', steps: [] }] }
  it('顯示選項文字或打字內容;沒回答、略過是 null', () => {
    expect(answerLabel(moment, { option: 0 })).toBe('好')
    expect(answerLabel(moment, { text: '自己打' })).toBe('自己打')
    expect(answerLabel(moment, { skipped: true })).toBeNull()
    expect(answerLabel(moment, undefined)).toBeNull()
  })
})
