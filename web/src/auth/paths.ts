// 登入相關路徑工具。獨立成檔,避免 UserMenu(會被 SiteLayout 引用)經由 routes.tsx 間接引入 LoginPage 造成循環引用。

export const LOGIN_PATH = '/login'

/** 只接受站內路徑(以 '/' 開頭、不是 '//' 或 '/\'),否則回首頁 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}

/** 登入頁連結;nextPath 為登入後要回到的站內路徑 */
export function loginHref(nextPath?: string): string {
  if (!nextPath || nextPath === '/' || nextPath.startsWith(LOGIN_PATH)) return LOGIN_PATH
  return `${LOGIN_PATH}?next=${encodeURIComponent(safeNextPath(nextPath))}`
}
