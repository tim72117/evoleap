import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/I18nProvider'
import styles from './AdSlot.module.css'

/**
 * Google AdSense 手動廣告單元。
 * 只在 production build 且設定了 VITE_ADSENSE_CLIENT、VITE_ADSENSE_SLOT 時啟用;否則不載入任何 script。
 * script 在第一個廣告位出現時才插入,看不到廣告的訪客不會連線到 AdSense。
 * AdSense 後台的「自動廣告」要保持關閉:script 載入後會留在頁面上,自動廣告會出現在不該有廣告的頁面。
 * 開發環境沒有設定時顯示灰框,用來檢查版面。
 */
const CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT ?? '').trim()
const SLOT = (import.meta.env.VITE_ADSENSE_SLOT ?? '').trim()
const ENABLED = import.meta.env.PROD && CLIENT !== '' && SLOT !== ''

/** AdSense 廣告單元的最小寬度;太窄(例如側欄收合時)先不要求廣告 */
const MIN_WIDTH = 120
const MAX_WIDTH = 728
const HEIGHT = 100

type AdsWindow = Window & { adsbygoogle?: unknown[] }

let scriptLoad: Promise<void> | null = null

function loadScript(): Promise<void> {
  scriptLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.async = true
    s.crossOrigin = 'anonymous'
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('AdSense script failed to load'))
    document.head.appendChild(s)
  })
  return scriptLoad
}

export function AdSlot({ className }: { className?: string }) {
  const insRef = useRef<HTMLModElement>(null)
  const requested = useRef(false)
  // script 被擋(例如廣告阻擋程式)時整塊收起來,不留空框
  const [blocked, setBlocked] = useState(false)
  const t = useT()

  useEffect(() => {
    const ins = insRef.current
    const parent = ins?.parentElement
    if (!ENABLED || !ins || !parent) return
    let cancelled = false
    // 容器有寬度才要求廣告:寬度 0 時 AdSense 會報錯,而且廣告尺寸要配合容器
    const observer = new ResizeObserver(() => {
      const width = parent.clientWidth
      if (requested.current || width < MIN_WIDTH) return
      requested.current = true
      observer.disconnect()
      ins.style.width = `${Math.min(width, MAX_WIDTH)}px`
      loadScript()
        .then(() => {
          const w = window as AdsWindow
          w.adsbygoogle = w.adsbygoogle || []
          w.adsbygoogle.push({})
        })
        .catch(() => {
          if (!cancelled) setBlocked(true)
        })
    })
    observer.observe(parent)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [])

  if (blocked) return null
  if (!ENABLED) {
    if (!import.meta.env.DEV) return null
    return (
      <aside className={[styles.slot, className].filter(Boolean).join(' ')} aria-label={t.home.ad.label}>
        <span className={styles.label}>{t.home.ad.label}</span>
        <div className={styles.placeholder} style={{ height: HEIGHT }}>
          {t.home.ad.placeholder}
        </div>
      </aside>
    )
  }
  return (
    <aside className={[styles.slot, className].filter(Boolean).join(' ')} aria-label={t.home.ad.label}>
      <span className={styles.label}>{t.home.ad.label}</span>
      <div className={styles.frame}>
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'inline-block', height: HEIGHT }}
          data-ad-client={CLIENT}
          data-ad-slot={SLOT}
        />
      </div>
    </aside>
  )
}
