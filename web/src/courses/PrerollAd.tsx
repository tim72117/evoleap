import { useCallback, useEffect, useState } from 'react'
import { ApiError, authApi } from '../auth/api'
import { AdSlot } from '../site/AdSlot'
import { SiteLayout } from '../site/SiteLayout'
import styles from './PrerollAd.module.css'

// 廣告方案的開課廣告:進入單課前先播一段廣告,倒數結束才能按「開始上課」,不能跳過。
// 流程:開始時向伺服器要 token 與秒數(/api/plan/ads/start)→ 倒數 → 按「開始上課」送出 token(/api/plan/ads/finish),
// 伺服器確認秒數到了才發這一課的短期通行 cookie,之後 onDone 顯示課程內容。倒數只是畫面提示,真正的判定在伺服器。

type Props = {
  /** 標題上方的小字,例如「課程名稱 · 第 1 課」 */
  kicker: string
  title: string
  docTitle: string
  /** 課程種子 id 與課號,送給伺服器 */
  courseId: string
  lessonId: string
  /** 廣告看完、伺服器發了通行之後呼叫 */
  onDone: () => void
}

/** 倒數的更新間隔;用截止時間算剩餘秒數,分頁在背景被降速也不會算錯 */
const TICK_MS = 250
/** 伺服器說還沒到時間(too_early)時,再多等一下 */
const TOO_EARLY_EXTRA_MS = 2000

export function PrerollAd({ kicker, title, docTitle, courseId, lessonId, onDone }: Props) {
  const [token, setToken] = useState<string | null>(null)
  /** 可以開始上課的時間(Date.now() 的毫秒);null = 還沒拿到秒數 */
  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    authApi
      .adsStart(courseId, lessonId)
      .then(({ token, seconds }) => {
        if (cancelled) return
        setToken(token)
        setDeadline(Date.now() + Math.max(0, seconds) * 1000)
        setNow(Date.now())
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : '廣告沒有載入成功，請重新整理再試一次。')
      })
    return () => {
      cancelled = true
    }
  }, [courseId, lessonId])

  const remainingMs = deadline === null ? null : Math.max(0, deadline - now)
  const waiting = remainingMs === null || remainingMs > 0

  // 倒數:還沒到時間才需要計時,到了就停
  useEffect(() => {
    if (deadline === null || !waiting) return
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [deadline, waiting])

  const start = useCallback(async () => {
    if (!token || waiting || busy) return
    setBusy(true)
    setNotice('')
    try {
      await authApi.adsFinish(token)
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'too_early') {
        // 和伺服器的時間差一點:再等一下,不用重來
        setNotice('廣告還沒播完，請再等一下。')
        setDeadline(Date.now() + TOO_EARLY_EXTRA_MS)
        setNow(Date.now())
      } else {
        setError(err instanceof ApiError ? err.message : '暫時無法開始上課，請重新整理再試一次。')
      }
    } finally {
      setBusy(false)
    }
  }, [token, waiting, busy, onDone])

  const seconds = remainingMs === null ? null : Math.ceil(remainingMs / 1000)

  return (
    <SiteLayout title={docTitle}>
      <div className={styles.container}>
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        <p className={styles.note}>廣告方案的每一課開始前會播放一段廣告，看完就可以開始上課。</p>
        <AdSlot className={styles.ad} />
        {error ? (
          <>
            <p className={styles.error} role="alert">
              {error}
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
                重新整理
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.countdown} role="status" aria-live="polite">
              {seconds === null ? '廣告載入中…' : seconds > 0 ? `廣告 ${seconds} 秒後可以開始上課` : '廣告播完了，可以開始上課。'}
            </p>
            {notice && <p className={styles.note}>{notice}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.primary} disabled={!token || waiting || busy} onClick={() => void start()}>
                開始上課
              </button>
            </div>
          </>
        )}
      </div>
    </SiteLayout>
  )
}
