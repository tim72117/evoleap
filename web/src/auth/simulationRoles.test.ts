import { describe, expect, it } from 'vitest'
import { userSeesAds } from '../courses/lessonAds'
import type { User } from './api'
import { roleLabel, SIMULATED_ROLES } from './simulationRoles'

const base: User = { id: 'u', email: 'a@example.com', name: 'A', createdAt: '2026-11-10T00:00:00Z' }

describe('模擬身分', () => {
  it('膠囊依序是本人、訪客、註冊未訂閱、已訂閱', () => {
    expect(SIMULATED_ROLES.map((r) => r.id)).toEqual(['admin', 'guest', 'member', 'subscriber'])
    expect(roleLabel('member')).toBe('註冊未訂閱')
  })

  it('模擬出來的使用者(AuthContext 的規則:不是管理員,訂閱與否照選)只有註冊未訂閱會看到廣告', () => {
    const member = { ...base, isAdmin: false, subscribed: false }
    const subscriber = { ...base, isAdmin: false, subscribed: true }
    expect(userSeesAds(null)).toBe(false) // 訪客
    expect(userSeesAds(member)).toBe(true)
    expect(userSeesAds(subscriber)).toBe(false)
    expect(userSeesAds({ ...base, isAdmin: true })).toBe(false) // 管理員本人不看廣告
  })
})
