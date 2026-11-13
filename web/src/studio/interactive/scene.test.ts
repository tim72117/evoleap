import { describe, expect, it } from 'vitest'
import type { StageScript } from '../../live/types'
import bakery from '../../content/live/lab/interactive-bakery.json'
import l0Claude from '../../content/live/lab/interactive-l0-claude.json'
import l00 from '../../content/live/l0/0.0-tools.json'
import { withL0Moments } from './l0-0.0'
import l01 from '../../content/live/l0/0.1-project.json'
import { withL01Moments } from './l0-0.1'
import l02 from '../../content/live/l0/0.2-site.json'
import { withL02Moments } from './l0-0.2'
import intro from '../../content/live/l0/0.intro.json'
import { withL0IntroMoments } from './l0-intro'
import { answerLabel, checkInteract, expandAnswers, momentsOf, collapsedParts, staticScript, withoutAnswer, type Answer, type Moment } from './scene'

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
  it('互動腳本:演員要在 cast 裡、觸發點要有名稱與步驟、until 不能超過觸發點的數量', () => {
    const spot = { target: 'web:sel:#a', id: 'a', label: 'A', steps: [{ on: 'web', click: '#a' }] }
    const ok = { cast: ['web', 'tree'], spots: [spot], until: { picked: 1 } }
    expect(() => checkInteract(ok as never, ['web', 'tree'], 'x')).not.toThrow()
    expect(() => checkInteract({ ...ok, cast: ['nope'] } as never, ['web'], 'x')).toThrow(/不在演員表/)
    expect(() => checkInteract({ ...ok, spots: [{ ...spot, target: 'tree:node:a' }], cast: ['web'] } as never, ['web', 'tree'], 'x')).toThrow(/不在 interact.cast/)
    expect(() => checkInteract({ ...ok, spots: [{ ...spot, label: '' }] } as never, ['web', 'tree'], 'x')).toThrow(/label/)
    expect(() => checkInteract({ ...ok, until: { picked: 2 } } as never, ['web', 'tree'], 'x')).toThrow(/until/)
  })
  it('"skip": false 表示沒有略過鈕;沒回答就播過去時不演任何步驟', () => {
    const script = { cast: {}, steps: [{ checkpoint: '點點看', id: 'explore', options: [{ label: '看完了', steps: [{ wait: 100 }] }], skip: false }, { wait: 200 }] } as unknown as StageScript
    const [m] = momentsOf(script)
    expect(m.noSkip).toBe(true)
    expect(m.skip).toBeUndefined()
    expect(expandAnswers(script, {}).steps).toHaveLength(2)
    expect(expandAnswers(script, { explore: { option: 0 } }).steps).toHaveLength(3)
  })
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

describe('L0 第 2 課的互動版', () => {
  const base = l02 as unknown as StageScript
  const scene = withL02Moments(base)
  const said = (s: StageScript) => s.steps.map((x) => (x as { narration?: string }).narration).filter(Boolean)

  it('一個「device」互動點,在步驟 4 演完之後、原本的「換你試試」之前', () => {
    const moments = momentsOf(scene)
    expect(moments.map((m) => m.id)).toEqual(['device'])
    expect(moments[0].title).toBe('同一個網頁，換個裝置會變成什麼樣子？')
    expect(moments[0].options.map((o) => o.label)).toEqual(['📱 手機', '📲 平板', '🖥️ 桌面'])
    expect(moments[0].stage?.focus).toBeTruthy()
    const at = scene.steps.findIndex((s) => (s as { id?: string }).id === 'device')
    expect(JSON.stringify(scene.steps[at - 1])).toContain('"scroll":"top"')
    expect(JSON.stringify(scene.steps[at + 1])).toContain('"hide":"browser"')
    expect(scene.steps.filter((s) => (s as { checkpoint?: string }).checkpoint === '換你試試')).toHaveLength(4)
  })

  it('沒回答與略過時,內容和原本的腳本完全一樣(skip 是空的)', () => {
    expect(momentsOf(scene)[0].skip?.steps).toEqual([])
    const kinds = (s: StageScript) => s.steps.filter((x) => !('checkpoint' in x && 'id' in x))
    expect(kinds(expandAnswers(scene, {}))).toEqual(base.steps)
    expect(kinds(expandAnswers(scene, { device: { skipped: true } }))).toEqual(base.steps)
    expect(said(expandAnswers(scene, {}))).toEqual(said(base))
  })

  it('每個選項展開後:原本的旁白照舊,最後還原成桌面寬度與頁面頂端,說明點出響應式', () => {
    for (const [option, o] of momentsOf(scene)[0].options.entries()) {
      const out = expandAnswers(scene, { device: { option } })
      expect(out.steps.length).toBe(scene.steps.length + o.steps.length)
      expect(said(base).every((n) => said(out).includes(n))).toBe(true)
      const last = o.steps.at(-1) as Record<string, unknown>
      expect(last).toEqual({ scroll: 'top' })
      const widths = o.steps.filter((s) => 'width' in s).map((s) => (s as { width: string }).width)
      expect(widths.at(-1)).toBe('desktop')
      expect(JSON.stringify(o.steps)).toContain('響應式設計')
      expect(o.steps.some((s) => 'callout' in s)).toBe(true)
    }
    expect(momentsOf(scene)[0].options.map((o) => (o.steps.find((s) => 'width' in s && (s as { width: string }).width !== 'desktop') as { width?: string } | undefined)?.width)).toEqual(['phone', 'tablet', undefined])
  })

  it('演員代號都有定義,課程步驟仍是 1 到 9,找不到位置就丟錯', () => {
    const cast = Object.keys(base.cast)
    for (const raw of scene.steps as Record<string, unknown>[]) {
      for (const key of ['show', 'hide']) if (typeof raw[key] === 'string') expect(cast).toContain(raw[key])
      if (typeof raw.callout === 'string') expect(cast).toContain(raw.callout.split(':')[0])
    }
    for (const o of momentsOf(scene)[0].options) for (const raw of o.steps as Record<string, unknown>[]) if (typeof raw.callout === 'string') expect(cast).toContain(raw.callout.split(':')[0])
    const lessonSteps = new Set(expandAnswers(scene, {}).steps.map((x) => (x as { lessonStep?: number }).lessonStep).filter(Boolean))
    expect([...lessonSteps]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(() => withL02Moments({ ...base, steps: base.steps.slice(0, 5) })).toThrow('l0-0.2.ts')
  })
})

describe('序章的互動版', () => {
  const base = intro as unknown as StageScript
  const scene = withL0IntroMoments(base)
  const said = (s: StageScript) => s.steps.map((x) => (x as { narration?: string }).narration).filter(Boolean)

  it('三個互動點,位置在原本腳本的三個地方', () => {
    const moments = momentsOf(scene)
    expect(moments.map((m) => m.id)).toEqual(['hardest', 'who', 'verify'])
    expect(moments.map((m) => m.options.length)).toEqual([4, 2, 3])
    expect(moments.map((m) => m.title)).toEqual(['以前自己寫程式,哪一段最花時間?', '把程式碼存成檔案、打開來看、把錯誤貼回去問,這些要誰做?', 'AI 說做好了,你要怎麼辦?'].map((s) => s.replace(',', '，').replace('?', '？')))
    const index = (id: string) => scene.steps.findIndex((s) => (s as { id?: string }).id === id)
    const text = (i: number) => JSON.stringify(scene.steps[i - 1])
    expect(text(index('hardest'))).toContain('"slump":true')
    expect(text(index('who'))).toContain('複製 → 貼上')
    expect(text(index('verify'))).toContain('boss:bubble')
    for (const m of moments) {
      expect(m.stage?.focus).toBeTruthy()
      expect(m.skip?.label).toBe('先看示範')
    }
  })

  it('沒回答時旁白和原本的腳本一樣(順序也不變)', () => {
    expect(said(expandAnswers(scene, {}))).toEqual(said(base))
    expect(said(expandAnswers(scene, { hardest: { skipped: true }, who: { skipped: true }, verify: { skipped: true } }))).toEqual(said(base))
    const kinds = (s: StageScript) => s.steps.filter((x) => !('checkpoint' in x && 'id' in x))
    expect(kinds(expandAnswers(scene, {}))).toEqual(base.steps)
  })

  it('每個選項都能展開:原本的旁白照舊,多出的回應只有一張章節卡,不動演員', () => {
    for (const m of momentsOf(scene)) {
      m.options.forEach((o, option) => {
        const out = expandAnswers(scene, { [m.id]: { option } })
        expect(said(out).filter((x) => !said(base).includes(x))).toHaveLength(o.steps.length)
        for (const s of o.steps) expect(s).toHaveProperty('card')
        expect(out.steps.length).toBe(scene.steps.length + o.steps.length)
      })
    }
    expect(() => expandAnswers(scene, { hardest: { option: 3 }, who: { option: 1 }, verify: { option: 2 } })).not.toThrow()
  })

  it('演員代號都有定義且不重複,課程步驟是 1 到 5,舊的兩份腳本已合併', () => {
    const cast = Object.keys(base.cast)
    expect(new Set(cast).size).toBe(cast.length)
    const refs = new Set<string>()
    for (const raw of base.steps as Record<string, unknown>[]) {
      for (const key of ['on', 'show', 'hide', 'move']) if (typeof raw[key] === 'string') refs.add(raw[key] as string)
      if (typeof raw.callout === 'string') refs.add(raw.callout.split(':')[0])
    }
    for (const ref of refs) expect(cast, `演員 ${ref}`).toContain(ref)
    const lessonSteps = new Set(base.steps.map((x) => (x as { lessonStep?: number }).lessonStep).filter(Boolean))
    expect([...lessonSteps]).toEqual([1, 2, 3, 4, 5])
  })

  it('原本的腳本改了位置時,找不到就丟錯', () => {
    expect(() => withL0IntroMoments({ ...base, steps: base.steps.slice(0, 5) })).toThrow('l0-intro.ts')
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

describe('staticScript', () => {
  const script = withL0Moments(l00 as unknown as StageScript)
  const kinds = ['user', 'thinking', 'say', 'tool', 'edit', 'todos', 'ask', 'choose', 'mode']
  const stepsOf = (out: StageScript) => out.steps as unknown as Record<string, unknown>[]

  it('只留這位演員與他的動作,演到互動點之前,沒有鏡頭、旁白與舞台效果', () => {
    const out = staticScript(script, {}, 'delete', 'claude', kinds)
    expect(out.camera).toBeUndefined()
    // 課程腳本有調度(claude、finder),靜態舞台只有一位演員,不能帶著調度
    expect(script.blocking).toBeDefined()
    expect(out.blocking).toBeUndefined()
    expect(Object.keys(out.cast)).toEqual(['claude'])
    expect(out.cast.claude.place).toBe('full')
    expect(out.cast.claude.hidden).toBe(false)
    expect(stepsOf(out).length).toBeGreaterThan(0)
    for (const s of stepsOf(out)) {
      for (const k of ['narration', 'chapter', 'focus', 'checkpoint', 'card', 'callout', 'wait', 'move']) expect(k in s, k).toBe(false)
      for (const k of ['show', 'hide', 'on']) if (k in s) expect(s[k]).toBe('claude')
      expect('create' in s, '其他演員的動作').toBe(false)
    }
  })

  it('把前面的回答演進去', () => {
    expect(stepsOf(staticScript(script, { prompt: { option: 2 } }, 'create', 'claude', kinds)).some((s) => s.user === '幫我打個招呼')).toBe(true)
  })

  it('找不到互動點時丟錯', () => {
    expect(() => staticScript(script, {}, 'nope', 'claude', kinds)).toThrow('nope')
  })
})

describe('collapsedParts', () => {
  const collapsible = { sidebar: 900, titlebar: 480 }
  it('舞台比門檻窄時收合', () => {
    expect(collapsedParts(collapsible, undefined, 800)).toEqual({ sidebar: false })
    expect(collapsedParts(collapsible, undefined, 300)).toEqual({ sidebar: false, titlebar: false })
  })
  it('在互動區的不收合', () => {
    expect(collapsedParts(collapsible, ['sidebar'], 300)).toEqual({ titlebar: false })
  })
  it('舞台夠寬就不收合,演員沒有宣告也不收合', () => {
    expect(collapsedParts(collapsible, undefined, 900)).toEqual({})
    expect(collapsedParts(undefined, undefined, 300)).toEqual({})
  })
})
