import { describe, expect, it } from 'vitest'
import data from '../../content/live/data/lab-trials.json'
import { trialAt, type LabTrialsData } from './labTrials'
import { proposalRoutes } from './routes'

// lab 試做清單是研發基地的資料檔(content/live/data/lab-trials.json):試做頁沒有自己的路由,
// 研發基地找不到路由時依網址在清單裡找(TrialRoutes.tsx 的 LabTrialOrNotFound),所以網址不能重複,也不能和既有的頁面撞名
const { trials } = data as LabTrialsData

describe('lab 試做清單', () => {
  it('每一堂都有課程、課號、課名、腳本與試做頁網址;網址不重複', () => {
    for (const t of trials) {
      expect(t.course && t.code && t.title, t.path).toBeTruthy()
      expect(t.script, t.path).toMatch(/^lab\/.+\.json$/)
      expect(t.path, t.script).toMatch(/^\/studio\/[^:]+$/)
      expect(t.back.to, t.path).toMatch(/^\/studio\//)
    }
    expect(new Set(trials.map((t) => t.path)).size).toBe(trials.length)
  })

  it('試做頁網址不會被研發基地既有的路由搶走(不然開不到試做)', () => {
    const routes = new Set(proposalRoutes.map((r) => r.path))
    expect(trials.filter((t) => routes.has(t.path)).map((t) => t.path)).toEqual([])
  })

  it('依網址找得到那一堂,結尾斜線視為同一頁', () => {
    const t = trials[0]
    expect(trialAt(trials, t.path)).toBe(t)
    expect(trialAt(trials, `${t.path}/`)).toBe(t)
    expect(trialAt(trials, '/studio/no-such-trial')).toBeUndefined()
  })
})
