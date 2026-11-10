import type { SimulatedRole } from './AuthContext'

// 管理員可以模擬的身分(會員空間的膠囊切換、模擬中的提示共用)。新增身分時在這裡加一筆,並在 AuthContext 的 value 處理它。

export const SIMULATED_ROLES: { id: SimulatedRole; label: string; hint: string }[] = [
  { id: 'admin', label: '管理員', hint: '本人，不模擬' },
  { id: 'guest', label: '訪客', hint: '沒登入：看到登入門檻，進度不會記錄' },
  { id: 'member', label: '註冊未訂閱', hint: '登入的一般會員：會看到廣告' },
  { id: 'subscriber', label: '已訂閱', hint: '登入的訂閱者：不看廣告' },
]

export const roleLabel = (id: SimulatedRole): string => SIMULATED_ROLES.find((r) => r.id === id)?.label ?? id
