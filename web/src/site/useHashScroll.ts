import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { safeDecodeURIComponent } from './safeDecode'

/** react-router doesn't scroll to #hash targets on client-side navigation; do it here. */
export function useHashScroll(/** 內容是讀回來才畫的頁面:讀到後傳不同的值,再捲一次 */ ready?: unknown) {
  const { hash, key } = useLocation()
  // 內容讀好後捲過一次就不再捲:登入狀態確定後資料重讀,不能把已經往下看的人拉回錨點
  const done = useRef('')
  useEffect(() => {
    if (!hash || done.current === key + hash) return
    const el = document.getElementById(safeDecodeURIComponent(hash.slice(1)))
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (el && (ready === undefined || ready === 'ready')) done.current = key + hash
  }, [hash, key, ready])
}
