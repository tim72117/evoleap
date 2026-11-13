import type { SimulatedRole } from './AuthContext'
import { messages } from '../i18n/current'
import type { Messages } from '../i18n/zh'

// 管理員可以模擬的身分(頭像選單「開啟模擬」後,頁面底部的模擬膠囊用)。新增身分時在這裡加一筆、在字典(i18n/*/auth.ts 的 simulation.roles)加名稱與說明,
// 並在 AuthContext 的 value 處理它。

export const SIMULATED_ROLES: { id: SimulatedRole }[] = [{ id: 'admin' }, { id: 'guest' }, { id: 'member' }, { id: 'subscriber' }, { id: 'kids' }]

/** 身分的名稱(目前語言;元件裡傳 useT() 的字典) */
export const roleLabel = (id: SimulatedRole, t: Messages = messages()): string => t.auth.simulation.roles[id]?.label ?? id

/** 身分的說明 */
export const roleHint = (id: SimulatedRole, t: Messages = messages()): string => t.auth.simulation.roles[id]?.hint ?? ''
