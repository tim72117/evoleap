import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { mountShell, type Shell } from '../live/shell'
import { createStage } from '../live/stage'
import { useAutoAspect } from '../site/useAutoAspect'
import { narrationClips } from '../live/mixPlan'
import { loadMix, loadScript, loadVoice } from '../live/scripts'
import { ScriptError } from '../live/ScriptError'
import { useAuth } from '../auth/AuthContext'
import { clearGuestProgress, memberProgress } from './progress'
import { useGuestView } from './guestActivity'
import '../live/shell.css'
import type { PlayerHandle } from './playerHandle'
import styles from './LivePlayer.module.css'

// 即時教學畫面:不是影片檔,而是 src/live 的舞台依腳本(src/content/live/)即時畫出,由播放器外殼負責播放。
// 透過 onTime 回報播放秒數、透過 ref.seekTo 跳轉(課程頁播放器共用的 PlayerHandle);
// 腳本裡標了 lessonStep 的章節會透過 onCues 回報,讓課程頁播到那裡就展開對應的步驟。
// 播放進度只有登入的會員才記(存伺服器);訪客不存,登入後才開始。訪客只記打開了哪一課與播放了多久(guestActivity.ts)。
// 全螢幕、手機橫放滿版、播放器的快捷鍵都由外殼處理(焦點在播放器裡時 ←/→ 是倒退/快轉,在頁面上時由課程頁切換步驟)。

type Props = {
  /** src/content/live/ 底下的腳本路徑,例如 l0/0.0-tools.json */
  script: string
  title: string
  onTime: (seconds: number) => void
  onCues?: (cues: { step: number; at: number }[]) => void
  /** 還沒開始播放(時間為 0)時顯示的畫面:某個章節開始後幾毫秒。開頭畫面太空時用;播放還是從頭開始 */
  poster?: { chapter: string; after: number }
  /** 要不要記會員的播放進度,預設要。研發頁的預覽播放器不記,免得把研發時的試播算成學員的進度 */
  saveProgress?: boolean
  /** 外層把播放器隱藏(沒有卸載)時設為 true:暫停播放,免得看不到畫面還聽得到旁白。再顯示時不會自動接著播 */
  paused?: boolean
}

export const LivePlayer = forwardRef<PlayerHandle, Props>(function LivePlayer({ script, title, onTime, onCues, poster, saveProgress = true, paused = false }, ref) {
  const boxRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<Shell | null>(null)
  const onTimeRef = useRef(onTime)
  const onCuesRef = useRef(onCues)
  onTimeRef.current = onTime
  onCuesRef.current = onCues
  const [error, setError] = useState<string | null>(null)
  // 登入狀態確認前先不建立播放器,免得會員的進度被當成訪客略過
  const { status, user } = useAuth()
  const memberId = saveProgress ? (user?.id ?? null) : null
  // 訪客打開這一課與播放的時間要記下來;不記進度的預覽播放器也不記
  const guest = useGuestView(saveProgress ? `live:${script}` : null, () => shellRef.current?.playing ?? false)
  // 載入失敗也回報(訪客紀錄用來找出打開了卻沒有播放的原因)
  useEffect(() => {
    if (error) guest.fail(error)
  }, [error, guest])

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      shellRef.current?.seek(seconds * 1000)
      shellRef.current?.play()
    },
  }))

  // 手機直拿自動用直式舞台;轉向時重建播放器,從原本的時間接著(carry)
  const aspect = useAutoAspect()
  const carry = useRef(0)

  useEffect(() => {
    const box = boxRef.current
    if (!box || status === 'loading') return
    if (!memberId) clearGuestProgress()
    let cancelled = false
    const stageEl = document.createElement('div')
    const stage = createStage(stageEl, { aspect })
    const vp = mountShell(box, { stage: stageEl, title, progress: memberId ? memberProgress(`live:${script}`) : undefined, globalKeys: false, aspect })
    shellRef.current = vp
    setError(null)

    // 語音是選用的:讀不到(例如部署後舊頁面找不到檔案)就只顯示字幕,不影響播放
    Promise.all([loadScript(script), loadVoice(script).catch(() => null), loadMix(script).catch(() => null)])
      .then(async ([data, voice, mix]) => {
        await document.fonts.ready
        if (cancelled) return
        await stage.load(data, { voice: voice?.durations, aspect })
        if (cancelled) return
        const caps = stage.captions
        const posterChapter = poster && stage.chapters.find((c) => c.label === poster.chapter)
        const posterAt = posterChapter && poster ? posterChapter.at + poster.after : 0
        vp.update({
          title: data.title,
          duration: stage.duration,
          renderAt: (ms) => stage.renderAt(ms === 0 ? posterAt : ms),
          chapters: stage.chapters,
          stops: stage.stops,
          captions: (ms) => caps.find((c) => ms >= c.from && ms < c.to)?.text || '',
          // 有產生旁白語音的段落,播到那裡就播對應的音檔(合成過章節音軌的用章節音軌)
          clips: narrationClips(stage.narrations, voice, mix),
        })
        guest.ready()
        if (carry.current > 0) {
          vp.seek(carry.current)
          carry.current = 0
        }
        onCuesRef.current?.(stage.chapters.filter((c) => c.step).map((c) => ({ step: c.step!, at: c.at / 1000 })))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })

    // 播放秒數變了才回報(課程頁依此展開步驟)
    let last = -1
    const timer = window.setInterval(() => {
      const t = Math.round(vp.time)
      if (t !== last) {
        last = t
        onTimeRef.current(t / 1000)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      carry.current = vp.time
      vp.destroy()
      shellRef.current = null
    }
  }, [script, title, status, memberId, aspect, guest])

  useEffect(() => {
    if (paused) shellRef.current?.pause()
  }, [paused])

  return (
    <div ref={boxRef} className={styles.box} data-aspect={aspect}>
      {error && <ScriptError className={styles.error} prefix="無法播放：" error={error} />}
    </div>
  )
})
