import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react'
import type { YouTubePlayerHandle } from './YouTubePlayer'
import styles from './MockPlayer.module.css'

// 影片尚未上架時的模擬播放器：外觀與操作仿照影片播放器，用計時器推進「播放秒數」，
// 和 YouTubePlayer 一樣透過 onTime 回報進度、透過 ref.seekTo 跳轉，
// 讓課程頁的「播到哪一步就展開哪一步」在影片完成前就能預覽與檢查。

export type MockChapter = { at: number; label: string }

type Props = {
  title: string
  /** 模擬影片長度（秒） */
  duration: number
  onTime: (seconds: number) => void
  chapters?: MockChapter[]
}

const SPEEDS = [1, 2, 5, 10] as const
const REPORT_MS = 250

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const MockPlayer = forwardRef<YouTubePlayerHandle, Props>(function MockPlayer(
  { title, duration, onTime, chapters = [] },
  ref,
) {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const timeRef = useRef(0)
  const onTimeRef = useRef(onTime)
  onTimeRef.current = onTime

  const seek = (t: number) => {
    const next = Math.min(Math.max(0, t), duration)
    timeRef.current = next
    setTime(next)
    onTimeRef.current(next)
  }

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      seek(seconds)
      setPlaying(true)
    },
  }))

  // 一開始回報 0 秒，讓課程頁的進度歸零
  useEffect(() => {
    onTimeRef.current(0)
  }, [])

  // 播放中：以 requestAnimationFrame 推進時間，每 REPORT_MS 回報一次給課程頁
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastReport = last
    const tick = (now: number) => {
      const t = Math.min(duration, timeRef.current + ((now - last) / 1000) * speed)
      last = now
      timeRef.current = t
      setTime(t)
      if (now - lastReport >= REPORT_MS || t >= duration) {
        lastReport = now
        onTimeRef.current(t)
      }
      if (t >= duration) {
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, duration])

  const toggle = () => {
    if (!playing && timeRef.current >= duration) seek(0)
    setPlaying((p) => !p)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // 焦點在其他按鈕上時，空白鍵交給按鈕本身處理
    if (e.key !== ' ' || (e.target !== e.currentTarget && (e.target as HTMLElement).tagName === 'BUTTON')) return
    e.preventDefault()
    toggle()
  }

  let chapter: MockChapter | undefined
  for (const c of chapters) if (time >= c.at) chapter = c
  const pct = duration > 0 ? (time / duration) * 100 : 0

  return (
    <div className={styles.player} tabIndex={0} onKeyDown={onKeyDown} aria-label={`模擬播放器：${title}`} role="group">
      <div className={styles.screen} onClick={toggle}>
        <span className={styles.badge}>模擬播放 · 影片製作中</span>
        <p className={styles.title}>{title}</p>
        <p className={styles.chapter} aria-live="polite">
          {chapter ? chapter.label : time === 0 && !playing ? '按下播放開始模擬' : '開場：目標 → 步驟拆解'}
        </p>
        {!playing && (
          <span className={styles.bigPlay} aria-hidden="true">
            ▶
          </span>
        )}
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.btn} onClick={toggle} aria-label={playing ? '暫停' : '播放'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <div className={styles.bar}>
          <div className={styles.track} aria-hidden="true">
            <div className={styles.fill} style={{ width: `${pct}%` }} />
            {chapters.map((c) => (
              <span key={c.at} className={styles.tick} style={{ left: `${(c.at / duration) * 100}%` }} title={c.label} />
            ))}
          </div>
          <input
            type="range"
            className={styles.range}
            min={0}
            max={duration}
            step={1}
            value={Math.floor(time)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="播放進度"
            aria-valuetext={`${clock(time)} / ${clock(duration)}`}
          />
        </div>
        <span className={styles.time}>
          {clock(time)} / {clock(duration)}
        </span>
        <div className={styles.speeds} role="group" aria-label="播放速度">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={s === speed ? styles.speedOn : ''}
              aria-pressed={s === speed}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})
