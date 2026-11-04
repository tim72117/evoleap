// dev server 的研發基地權限判斷(vite.config.ts 的 devStudioGate 外掛使用)。
// 正式環境由 Go server 檢查(server/cmd/server/static.go);dev server 直接提供原始碼,所以要連內部模組一起擋。
import { isInternalPath } from './internalPaths'

const INTERNAL_SOURCE = /^\/src\/studio\/(?!interactive\/)|^\/src\/seo\/internalPages|^\/src\/content\/live\/(lab|promo)\/|^\/__studio\//

/** 請求是內部頁面、內部檔案,或不需要檢查(null) */
export function gatedKind(pathname: string): 'page' | 'file' | null {
  if (INTERNAL_SOURCE.test(pathname)) return 'file'
  if (!isInternalPath(pathname)) return null
  return /\.[^/]+$/.test(pathname) ? 'file' : 'page'
}

/**
 * adminStatus 是 /api/admin/me 的 HTTP 狀態,連不上 Go server 時是 null。
 * - pass:放行
 * - login:未登入,導向登入頁
 * - shell:沒有權限的頁面,只給前端外殼;內部模組下載不到,畫面顯示找不到頁面
 * - block:沒有權限的檔案,回 404
 * 只有明確回 200 才放行,其他情況(含連不上)都擋下。
 */
export function devGateDecision(kind: 'page' | 'file', adminStatus: number | null): 'pass' | 'login' | 'shell' | 'block' {
  if (adminStatus === 200) return 'pass'
  if (kind === 'file') return 'block'
  return adminStatus === 401 ? 'login' : 'shell'
}
