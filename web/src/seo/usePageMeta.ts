import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { PageMeta } from './pages'

/**
 * 切換頁面時更新 <head> 的 description、canonical、og:*、twitter:*、robots 與 JSON-LD。
 * 首次載入時 server 回傳的 HTML 已含同一份標籤(build 時由 scripts/seo.mjs 產生),
 * 這裡只負責前端路由切換後的同步。document.title 由各頁的 layout 設定。
 * 第一次載入時 server 的 HTML 已是這一頁的標籤(結構化資料裡的課程連結還依資料庫處理過,見 server/cmd/server/seo_ld.go),
 * 不能換成 build 時的版本(沒有 url、還帶著 evoleapLesson 標記),所以第一次若 canonical 已經對得上就不動;
 * 前端切換過去的頁面沒有資料庫處理,課程連結的標記直接拿掉。
 * lookup 回傳 null 表示這一頁不歸它管(公開頁與內部頁的資料分開打包,各自呼叫);可以回傳 Promise(公開頁的資料含整份課程種子,動態載入、不放進主程式)。
 * pages.ts(含種子)也是用到才動態載入。
 */
let first = true

export function usePageMeta(lookup: (pathname: string) => PageMeta | null | Promise<PageMeta | null>) {
  const { pathname } = useLocation()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const page = await lookup(pathname)
      if (!page || cancelled) return
      const { absoluteUrl, headTags } = await import('./pages')
      if (cancelled) return
      const head = document.head
      const initial = first
      first = false
      if (initial && head.querySelector('link[rel="canonical"][data-seo]')?.getAttribute('href') === absoluteUrl(page.path)) return
      head.querySelectorAll('[data-seo]').forEach((el) => el.remove())
      for (const t of headTags(page, { keepLessonLinks: false })) {
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
