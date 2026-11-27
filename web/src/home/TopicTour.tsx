import { useEffect, useRef, useState } from 'react'
import type { PlayerHandle } from '../courses/playerHandle'
import { useT } from '../i18n/I18nProvider'
import { lazyPart } from '../site/lazyPart'
import { TourCoverArt } from './TopicArt'
import styles from './TopicTour.module.css'

// 主題頁的導覽影片:播放前蓋一張封面(影片的第一個畫面幾乎是空的),按了才開始播。
// 封面是整塊可以按的按鈕;按下後拿掉封面並從頭播放,之後交給播放器自己的控制列。
// 播放器(連同舞台引擎)另外下載,不放進網站首次載入的主程式;載好之前封面不能按。
// 播放要在按下的當下呼叫(手機瀏覽器只讓使用者的點擊啟動聲音),所以是先載好等人按,不是按了才載。

const LivePlayer = lazyPart(() => import('../courses/LivePlayer').then((m) => m.LivePlayer))

export function TopicTour({ script, title, playLabel }: { script: string; title: string; playLabel: string }) {
  const player = useRef<PlayerHandle>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  const [ready, setReady] = useState(false)
  // 播放器本身下載失敗:拿掉封面,顯示說明
  const [failed, setFailed] = useState(false)
  const t = useT()
  // 封面拿掉後把鍵盤焦點交給播放器(不然焦點會掉回頁面開頭)
  useEffect(() => {
    if (started) stageRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true })
  }, [started])
  return (
    <div className={started ? styles.frame : `${styles.frame} ${styles.covered}`}>
      <div className={styles.player}>
        {/* 封面還在時,底下播放器的按鈕不能按也不能用鍵盤走到 */}
        <div ref={stageRef} className={styles.stage} inert={!started}>
          <LivePlayer ref={player} script={script} title={title} onTime={() => {}} saveProgress={false} onSettled={() => setReady(true)} fallback={null} onFail={() => setFailed(true)} />
          {failed && <p className={styles.failed}>{t.home.lazy.failedTitle}</p>}
        </div>
        {!started && !failed && (
          <button
            type="button"
            className={styles.cover}
            aria-disabled={!ready}
            onClick={() => {
              if (!ready) return
              setStarted(true)
              player.current?.seekTo(0)
            }}
          >
            <TourCoverArt />
            <span className={styles.play}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.5 5.6v12.8a1 1 0 0 0 1.5.86l10.6-6.4a1 1 0 0 0 0-1.72L10 4.74a1 1 0 0 0-1.5.86z" />
              </svg>
              {ready ? playLabel : t.common.loading}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
