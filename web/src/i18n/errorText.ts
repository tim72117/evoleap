// 伺服器錯誤 → 目前語言的訊息。auth/api.ts 的 ApiError 與 live/scripts.ts 都用這個。
import { messages } from './current'

type ErrorBody = { error?: string; message?: string; next?: { day?: number; time?: string } }

/** 依錯誤代碼取目前語言的訊息;沒有對應的代碼用伺服器附的訊息,兩者都沒有用通用訊息 */
export function errorText(body: ErrorBody): string {
  const m = messages()
  if (body.error === 'kids_closed' && body.next && typeof body.next.day === 'number' && body.next.time) {
    return m.errors.kidsClosedNext(body.next.day, body.next.time)
  }
  return (body.error && m.errors.codes[body.error]) || body.message || m.common.genericError
}
