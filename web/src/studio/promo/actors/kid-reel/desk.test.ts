import { describe, expect, it } from 'vitest'
import actor, { apply, type ReelFrame, type ReelState } from './actor'
import { DICE, DRAG, dieAfter, poseOf, project, SLIDE, SUBS, TAP } from './desk'

const base: ReelState = { ...(actor.init!({}) as ReelState), desk: true, learn: 3 }
const frame = (st: ReelState, kind: ReelFrame['kind'], l: number): ReelFrame => ({ st, prev: st, kind, l, dur: 1500, ms: 30000 + l })
const tapFrame = (taps: number, l: number, cheerAt = taps >= 3 ? 3 : 0): ReelFrame => frame({ ...base, taps, cheerAt }, 'deskTap', l)
const learnFrame = (learn: number, l: number): ReelFrame => frame({ ...base, learn }, 'deskLearn', l)

describe('kid-reel 書桌鏡頭:動作順序', () => {
  const off = actor.init!({}) as ReelState
  it('學習畫面要依序 drag → answer → play,之後才能擲骰子', () => {
    const on = apply(off, 'desk', { desk: true })
    expect(on.learn).toBe(0)
    expect(() => apply(off, 'deskLearn', { deskLearn: 'drag' })).toThrow(/desk/)
    expect(() => apply(on, 'deskTap', { deskTap: true })).toThrow(/play/)
    expect(() => apply(on, 'deskLearn', { deskLearn: 'answer' })).toThrow(/前一步/)
    expect(() => apply(on, 'deskLearn', { deskLearn: 'jump' as never })).toThrow()
    let st = on
    for (const k of ['drag', 'answer', 'play'] as const) st = apply(st, 'deskLearn', { deskLearn: k })
    expect(st.learn).toBe(3)
    expect(apply(st, 'deskTap', { deskTap: true }).taps).toBe(1)
    // 重新切到書桌鏡頭時從學習畫面開始
    expect(apply(apply(st, 'desk', { desk: false }), 'desk', { desk: true })).toMatchObject({ learn: 0, taps: 0 })
  })
})

describe('kid-reel 書桌鏡頭:學習畫面', () => {
  it('拖積木:按住後跟著手指走,放開後才算放好', () => {
    const start = poseOf(learnFrame(1, 0))
    expect(start).toMatchObject({ learn: 0, chip: { p: 0 } })
    const mid = poseOf(learnFrame(1, (DRAG.grab + DRAG.drop) / 2))
    expect(mid.chip.p).toBeGreaterThan(0.2)
    expect(mid.chip.p).toBeLessThan(0.8)
    expect(mid.chip.lifted).toBeGreaterThan(0.9)
    expect(mid.tip.z).toBeLessThan(5)
    const done = poseOf(learnFrame(1, DRAG.release + 50))
    expect(done.learn).toBe(1)
    expect(done.chip.p).toBe(1)
    expect(done.fx).not.toBeNull()
  })

  it('測驗:按到「不會」那一刻答對,孩子開心一下', () => {
    expect(poseOf(learnFrame(2, TAP.touch - 10)).learn).toBe(1)
    const ok = poseOf(learnFrame(2, TAP.touch + 250))
    expect(ok.learn).toBe(2)
    expect(ok.excite).toBeGreaterThan(0)
    expect(SUBS[2]).toContain('答對了')
  })

  it('換頁:按下「換你擲骰子」之後才往左滑', () => {
    expect(poseOf(learnFrame(3, TAP.touch)).slide).toBe(0)
    expect(poseOf(learnFrame(3, SLIDE.start + SLIDE.dur / 2)).slide).toBeGreaterThan(0.2)
    expect(poseOf(learnFrame(3, SLIDE.start + SLIDE.dur)).slide).toBe(1)
    expect(SLIDE.start).toBeGreaterThan(TAP.touch)
    // 動作結束後停在骰子遊戲
    expect(poseOf(frame({ ...base, learn: 3 }, null, 0))).toMatchObject({ slide: 1, shown: 0, reach: 0 })
    expect(poseOf(frame({ ...base, learn: 1 }, null, 0))).toMatchObject({ slide: 0, learn: 1, chip: { p: 1 } })
  })
})

describe('kid-reel 書桌鏡頭:擲骰子', () => {
  it('骰子依序擲出 3、5、6', () => {
    expect([1, 2, 3].map(dieAfter)).toEqual([3, 5, 6])
    expect(dieAfter(0)).toBe(1)
    expect(dieAfter(DICE.length + 1)).toBe(DICE[0])
  })

  it('落地前畫面還是上一次的結果,落地後換成這一次', () => {
    const before = poseOf(tapFrame(2, TAP.roll - 10))
    expect(before.shown).toBe(1)
    expect(before.face).toBe(3)
    expect(before.rolling).toBeNull()
    expect(poseOf(tapFrame(2, (TAP.roll + TAP.land) / 2)).rolling).not.toBeNull()
    const after = poseOf(tapFrame(2, TAP.land + 1))
    expect(after.shown).toBe(2)
    expect(after.face).toBe(5)
  })

  it('同一個時間點一定是同一個姿勢(可以任意拖曳)', () => {
    for (const l of [0, 300, 600, 900, 1200, 1499]) {
      expect(poseOf(tapFrame(3, l))).toEqual(poseOf(tapFrame(3, l)))
      expect(poseOf(learnFrame(1, l))).toEqual(poseOf(learnFrame(1, l)))
    }
  })

  it('按下去時指尖貼在螢幕上,沒在按時手放回桌邊', () => {
    const press = poseOf(tapFrame(1, TAP.touch + 40))
    expect(press.press).toBeGreaterThan(0.5)
    expect(press.tip.z).toBeLessThan(1)
    expect(press.ripple).not.toBeNull()
    const idle = poseOf(frame({ ...base, taps: 2 }, null, 0))
    expect(idle).toMatchObject({ shown: 2, face: 5, press: 0, reach: 0, rolling: null, confetti: null })
  })

  it('寫 "cheer" 的那一次擲完就慶祝;沒寫時第 3 次照舊慶祝', () => {
    let st = apply(apply(actor.init!({}) as ReelState, 'desk', { desk: true }), 'deskLearn', { deskLearn: 'drag' })
    st = apply(apply(st, 'deskLearn', { deskLearn: 'answer' }), 'deskLearn', { deskLearn: 'play' })
    const one = apply(st, 'deskTap', { deskTap: true })
    expect(one.cheerAt).toBe(0)
    const two = apply(one, 'deskTap', { deskTap: 'cheer' })
    expect(two.cheerAt).toBe(2)
    expect(() => apply(one, 'deskTap', { deskTap: 'yay' as never })).toThrow()
    // 舊腳本:三次都寫 true,第 3 次慶祝
    expect(apply(apply(one, 'deskTap', { deskTap: true }), 'deskTap', { deskTap: true }).cheerAt).toBe(3)
    // 第 2 次就慶祝:彩紙、聳肩
    const cheer2 = poseOf(frame(two, 'deskTap', TAP.land + 100))
    expect(cheer2.confetti).not.toBeNull()
    expect(cheer2.excite).toBeGreaterThan(0.5)
    expect(poseOf(frame(one, 'deskTap', TAP.land + 100)).confetti).toBeNull()
  })

  it('只有第 3 次會慶祝(沒寫 cheer 時)', () => {
    expect(poseOf(tapFrame(2, TAP.land + 100)).confetti).toBeNull()
    const cheer = poseOf(tapFrame(3, TAP.land + 100))
    expect(cheer.confetti).not.toBeNull()
    expect(cheer.excite).toBeGreaterThan(0.5)
  })

  it('平板的投影:越靠近鏡頭(z 越大)放得越大', () => {
    expect(project(300, 200, 50).k).toBeGreaterThan(project(300, 200, 0).k)
    expect(project(0, 440).y).toBeGreaterThan(project(0, 0).y)
  })
})
