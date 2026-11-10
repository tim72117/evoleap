import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import styles from './lazyPage.module.css'

// 用到才下載的頁面或元件:打包成另一個 chunk,第一次顯示時才載入。
// 舞台引擎與演員(src/live)、播放器只在課程頁用到;法務頁也只有打開時才需要,都不放進首頁就要下載的主程式。
// load 回傳具名匯出的元件,例如 lazyPage(() => import('./TermsPage').then((m) => m.TermsPage))。
//
// 下載中:稍等一下才顯示「載入中」,下載很快時不會閃一下。
// 下載失敗:多半是網站剛部署新版,舊版的檔案已經不在(檔名帶雜湊)。自動重新整理一次拿到新版;
// 短時間內又失敗(網路斷了)就不再自動重整,改顯示說明和「重新整理」按鈕,不會整個網站變空白。

/** 上次因為下載失敗而自動重整的時間(sessionStorage),避免一直重整 */
const RELOAD_KEY = 'lazy-chunk-reload'
const RELOAD_WINDOW_MS = 10_000

function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // 不能用 sessionStorage(例如隱私模式的限制):不自動重整,交給錯誤畫面
    return false
  }
  window.location.reload()
  return true
}

function Loading() {
  return (
    <div className={`${styles.state} ${styles.loading}`} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <p>載入中…</p>
    </div>
  )
}

/** 下載失敗(自動重整過仍失敗)時的畫面 */
class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className={styles.state} role="alert">
        <h1>這一頁沒有載入成功</h1>
        <p>可能是網路不穩，或網站剛更新。重新整理就能繼續。</p>
        <button type="button" className={styles.reload} onClick={() => window.location.reload()}>
          重新整理
        </button>
      </div>
    )
  }
}

export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  const Lazy = lazy(() =>
    load().then(
      (Component) => ({ default: Component }),
      (err: unknown) => {
        // 重整中:不要讓錯誤畫面閃一下
        if (reloadOnce()) return new Promise<never>(() => {})
        throw err
      },
    ),
  )
  function LazyPage(props: P) {
    return (
      <LoadBoundary>
        <Suspense fallback={<Loading />}>
          <Lazy {...props} />
        </Suspense>
      </LoadBoundary>
    )
  }
  return LazyPage
}
