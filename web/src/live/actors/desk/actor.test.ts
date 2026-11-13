import { describe, expect, it } from 'vitest'
import actor, { type DeskKind, type DeskState, type DeskStep } from './actor'

// desk 演員的狀態推算(init/apply):動作是操作,結果由演員推算;對不上狀態時丟錯。畫面要看舞台才知道,這裡不測。

const TREE = { 文件: { '工作報告.docx': '' }, 下載: { 'a.pdf': '', 'b.zip': '' } }
const run = (st: DeskState, ...steps: DeskStep[]): DeskState =>
  steps.reduce((s, step) => {
    const kind = actor.kinds.find((k) => k in step) as DeskKind
    return actor.apply!(s, kind, step)
  }, st)
const ready = () => actor.init!({ tree: TREE, installed: true, running: true })

describe('desk 登場設定', () => {
  it('照 props 推出起始狀態', () => {
    const st = actor.init!({ tree: TREE, installed: true, running: true, account: 'you@example.com', open: '下載' })
    expect([st.installed, st.running, st.account, st.open, st.pending]).toEqual([true, true, 'you@example.com', '下載', null])
  })
  it('props 對不上時報錯', () => {
    expect(() => actor.init!({ tree: TREE, running: true })).toThrow(/installed/)
    expect(() => actor.init!({ tree: TREE, installed: true, account: 'x' })).toThrow(/running/)
    expect(() => actor.init!({ tree: TREE, open: '音樂' })).toThrow(/音樂/)
  })
})

describe('desk 的操作', () => {
  it('安裝 → 打開 → 登入', () => {
    const st = run(actor.init!({ tree: TREE }), { install: true }, { launch: true }, { signin: 'you@example.com' })
    expect([st.installed, st.running, st.account]).toEqual([true, true, 'you@example.com'])
    expect(() => run(st, { install: true })).toThrow(/已經裝好/)
    expect(() => run(actor.init!({ tree: TREE }), { launch: true })).toThrow(/還沒安裝/)
    expect(() => run(st, { signin: 'x' })).toThrow(/已經登入/)
  })

  it('打開、關掉資料夾視窗', () => {
    const st = run(ready(), { open: '下載' })
    expect(st.open).toBe('下載')
    expect(run(st, { close: true }).open).toBeNull()
    expect(() => run(ready(), { open: '工作報告.docx' })).toThrow(/資料夾/)
    expect(() => run(ready(), { close: true })).toThrow(/沒有打開/)
  })

  it('讀、改檔案會留下標記,下一句話清掉', () => {
    const st = run(ready(), { user: '看看報告' }, { read: '文件/工作報告.docx' }, { edit: '文件/工作報告.docx' })
    expect(st.marks).toEqual({ '文件/工作報告.docx': 'edit' })
    expect(st.activity).toEqual({ kind: 'edit', text: '文件/工作報告.docx' })
    expect(run(st, { user: '下一件事' }).marks).toEqual({})
    expect(() => run(ready(), { read: '文件/不存在.txt' })).toThrow(/找不到/)
    expect(() => run(actor.init!({ tree: TREE, installed: true }), { read: '文件/工作報告.docx' })).toThrow(/還沒打開/)
  })

  const ask: DeskStep = { ask: 'rm -rf ~/下載/*', say: '刪除下載裡的檔案', will: { empty: '下載' } }

  it('拒絕:什麼都不動', () => {
    const st = run(ready(), { open: '下載' }, ask, { answer: 'deny' })
    expect(st.tree).toEqual(TREE)
    expect([st.pending, st.result?.answer, st.always]).toEqual([null, 'deny', false])
  })

  it('允許一次:照 will 清空資料夾;一律允許另外記下來', () => {
    const once = run(ready(), { open: '下載' }, ask, { answer: 'once' })
    expect(once.tree.下載).toEqual({})
    expect([once.open, once.result?.answer, once.always]).toEqual(['下載', 'once', false])
    const always = run(ready(), ask, { answer: 'always' })
    expect([always.result?.answer, always.always]).toEqual(['always', true])
  })

  it('mkdir、delete;刪掉開著的資料夾時視窗跟著關', () => {
    expect(run(ready(), { ask: 'mkdir projects', will: { mkdir: 'projects' } }, { answer: 'once' }).tree.projects).toEqual({})
    const st = run(ready(), { open: '下載' }, { ask: 'rm -rf ~/下載', will: { delete: '下載' } }, { answer: 'once' })
    expect([st.tree.下載, st.open]).toEqual([undefined, null])
  })

  it('確認提示對不上狀態時報錯', () => {
    expect(() => run(ready(), { answer: 'once' })).toThrow(/沒有等待回答/)
    expect(() => run(ready(), ask, ask)).toThrow(/還在等回答/)
    expect(() => run(ready(), ask, { user: '先等等' })).toThrow(/還在等回答/)
    expect(() => run(ready(), { ask: 'rm x', will: { empty: '音樂' } })).toThrow(/音樂/)
    expect(() => run(ready(), { ask: 'mkdir 文件', will: { mkdir: '文件' } })).toThrow(/已經有/)
    expect(() => run(ready(), ask, { answer: 'maybe' as never })).toThrow(/answer 只能是/)
  })
})
