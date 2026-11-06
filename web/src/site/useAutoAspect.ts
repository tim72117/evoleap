import { useEffect, useState } from 'react'
import type { Aspect } from '../live/types'

// 手機直拿時影片自動用直式舞台(1080×1920):所有播放器(互動課程頁、LivePlayer)共用這個判斷。
// 只看「窄」加「直拿」:平板直拿(寬度超過 600px)與手機橫放都維持橫式。網址有 ?aspect= 時以網址為準(見 studio/interactive/portrait.ts)。
export const PHONE_PORTRAIT = '(max-width: 600px) and (orientation: portrait)'

const matches = (): boolean => typeof matchMedia === 'function' && matchMedia(PHONE_PORTRAIT).matches

/** 目前裝置該用的舞台方向;轉向或改變視窗大小時跟著變 */
export function useAutoAspect(): Aspect {
  const [portrait, setPortrait] = useState(matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(PHONE_PORTRAIT)
    const on = () => setPortrait(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return portrait ? 'portrait' : 'landscape'
}
