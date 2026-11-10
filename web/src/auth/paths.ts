// 登入相關路徑工具。獨立成檔,避免 UserMenu(會被 SiteLayout 引用)經由 routes.tsx 間接引入 LoginPage 造成循環引用。

export const LOGIN_PATH = '/login'
/** evoleap CLI 的登入核准頁(evoleap login --web 會打開這裡) */
export const CLI_AUTH_PATH = '/login/cli'

/** 只接受站內路徑(以 '/' 開頭、不是 '//' 或 '/\'),否則回首頁 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}

/** 登入頁連結;nextPath 為登入後要回到的站內路徑 */
export function loginHref(nextPath?: string): string {
  // 登入頁本身不當成登入後要回去的地方(免得繞圈);CLI 的核准頁要先登入才能核准,登入後要回到它
  if (!nextPath || nextPath === '/' || nextPath === LOGIN_PATH || nextPath.startsWith(`${LOGIN_PATH}?`)) return LOGIN_PATH
  return `${LOGIN_PATH}?next=${encodeURIComponent(safeNextPath(nextPath))}`
}
