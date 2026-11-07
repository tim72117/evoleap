import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// 站內換頁(點連結)時回到新頁面的最上方;瀏覽器的上一頁/下一頁(POP)保留原本的捲動位置,
// 網址帶 #錨點 時交給頁面自己捲到那個區塊。
export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const type = useNavigationType()
  useLayoutEffect(() => {
    if (type !== 'POP' && !hash) window.scrollTo(0, 0)
  }, [pathname, hash, type])
  return null
}
