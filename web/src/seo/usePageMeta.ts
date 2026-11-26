import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { routerBasename } from '../i18n/locale'
import { SITE_ORIGIN } from '../site/siteInfo'
import type { PageMeta } from './pages'

/**
 * 切換頁面時更新 <head> 的 description、canonical、og:*、twitter:*、robots 與 JSON-LD。
 * 首次載入時 server 回傳的 HTML 已含這一頁的標籤(課程相關頁面是 server 讀資料庫填的),canonical 對得上就不動;
 * 這裡只負責前端路由切換後的同步。document.title 由各頁的 layout 設定。
 * lookup 回傳 null 表示這一頁不歸它管,或這次讀不到(公開頁與內部頁的資料分開打包,各自呼叫);可以回傳 Promise。
 * pages.ts 是用到才動態載入;課程相關頁面的資料在那裡向 server 讀(resolvePage)。
 */
let first = true

export function usePageMeta(lookup: (pathname: string) => PageMeta | null | Promise<PageMeta | null>) {
  const { pathname } = useLocation()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const head = document.head
      const full = (routerBasename() ?? '') + pathname
      const current = SITE_ORIGIN + (full.length > 1 ? full.replace(/\/+$/, '') : full)
      const matches = () => head.querySelector('link[rel="canonical"][data-seo]')?.getAttribute('href') === current
      if (first && matches()) {
        first = false
        return
      }
      const page = await lookup(pathname)
      if (cancelled) return
      if (!page) {
        // 讀不到:不要把上一頁的描述、canonical 留在這一頁(別的 lookup 管的頁面,它自己會補上)
        if (!first && !matches()) head.querySelectorAll('[data-seo]').forEach((el) => el.remove())
        return
      }
      const { headTags } = await import('./pages')
      if (cancelled) return
      first = false
      head.querySelectorAll('[data-seo]').forEach((el) => el.remove())
      for (const t of headTags(page)) {
        const el = document.createElement(t.tag)
        for (const [k, v] of Object.entries(t.attrs)) el.setAttribute(k, v)
        el.setAttribute('data-seo', '')
        if (t.tag === 'script') el.textContent = t.text
        head.appendChild(el)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname, lookup])
}
