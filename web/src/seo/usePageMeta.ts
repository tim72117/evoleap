import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { findPage, headTags } from './pages'

/**
 * 切換頁面時更新 <head> 的 description、canonical、og:*、twitter:*、robots 與 JSON-LD。
 * 首次載入時 server 回傳的 HTML 已含同一份標籤(build 時由 scripts/seo.mjs 產生),
 * 這裡只負責前端路由切換後的同步。document.title 由各頁的 layout 設定。
 */
export function usePageMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const head = document.head
    head.querySelectorAll('[data-seo]').forEach((el) => el.remove())
    for (const t of headTags(findPage(pathname))) {
      const el = document.createElement(t.tag)
      for (const [k, v] of Object.entries(t.attrs)) el.setAttribute(k, v)
      el.setAttribute('data-seo', '')
      if (t.tag === 'script') el.textContent = t.text
      head.appendChild(el)
    }
  }, [pathname])
}
