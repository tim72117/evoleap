import { useEffect, useRef, useState } from 'react'
import { trackEvent } from './analytics'

// 複製到剪貼簿（clipboard API，失敗時退回 execCommand）。提案頁與課程頁共用。
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

type CopyState = 'idle' | 'copied' | 'failed'

/** Copy-button state: shows "已複製 ✓" / "複製失敗…" for 1.6s, then resets. */
export function useCopy() {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async (text: string) => {
    const ok = await copyText(text.trim())
    setState(ok ? 'copied' : 'failed')
    if (ok) trackEvent('copy_prompt', { page_path: window.location.pathname })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1600)
  }

  return { state, copy }
}

/** Character count as app.js computed it: code points of the trimmed text. */
export function charCount(text: string): number {
  return [...text.trim()].length
}
