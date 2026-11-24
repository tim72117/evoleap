import { useEffect, useState } from 'react'
import { createStage } from '../../live/stage'
import { loadScript, useScriptPaths } from '../../live/scripts'

export type CheckStatus = 'missing' | 'wait' | 'ok' | 'error'
export type CheckResult = { status: CheckStatus; ms?: number; error?: string }

const WAIT: CheckResult = { status: 'wait' }

/**
 * 逐一載入腳本(和試做頁同一個舞台),回傳每份腳本的狀態:還沒有檔案、檢查中、通過(含長度)、錯誤(含訊息)。
 * 有哪些腳本檔要向伺服器問(useScriptPaths),問到之前每份都是檢查中;paths 變了(例如呼叫端也是問到清單才知道)就重新檢查。
 * 結果也放在 window[globalKey],給自動化檢查讀。
 */
export function useScriptCheck(paths: string[], globalKey: string): Record<string, CheckResult> {
  const all = useScriptPaths()
  const [results, setResults] = useState<Record<string, CheckResult>>({})
  const key = all === null ? null : paths.join('\n')
  useEffect(() => {
    if (all === null) return
    let cancelled = false
    const have = new Set(all)
    const next: Record<string, CheckResult> = Object.fromEntries(paths.map((p) => [p, have.has(p) ? WAIT : { status: 'missing' }]))
    setResults({ ...next })
    const box = document.createElement('div')
    box.style.cssText = 'position:fixed;left:-99999px;top:0;width:1920px;height:1080px;overflow:hidden'
    document.body.appendChild(box)
    void (async () => {
      for (const p of paths) {
        if (cancelled) return
        if (next[p].status !== 'wait') continue
        const root = document.createElement('div')
        box.replaceChildren(root)
        try {
          const ms = await createStage(root).load(await loadScript(p))
          next[p] = { status: 'ok', ms }
        } catch (e) {
          next[p] = { status: 'error', error: e instanceof Error ? e.message : String(e) }
        }
        if (!cancelled) setResults({ ...next })
      }
      if (!cancelled) (window as unknown as Record<string, unknown>)[globalKey] = next
    })()
    return () => {
      cancelled = true
      box.remove()
    }
    // key 涵蓋 all 與 paths 的內容;呼叫端每次 render 給的是新陣列,不能直接放進依賴
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  // 還沒檢查到的(含清單還沒到的)都當作檢查中,呼叫端可以直接用 results[p]
  return Object.fromEntries(paths.map((p) => [p, results[p] ?? WAIT]))
}
