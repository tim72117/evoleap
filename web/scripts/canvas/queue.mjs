// queue.mjs — canvas MCP 的呼叫佇列:所有工具共用同一個瀏覽器頁面,所以一次只跑一個;每個呼叫都有逾時。
//
// 為什麼要逾時:佇列是一條 Promise 串,前一個呼叫永遠不結束(瀏覽器啟動、截圖、頁面腳本沒回來),
// 後面所有呼叫就永遠排在它後面(2026-11-13 卡了一小時以上,四個同時在用的子代理全部跟著卡住)。
// 現在:呼叫開始跑之後超過 timeoutMs 就中止(回傳錯誤訊息,不是無限等);中止時先呼叫 onTimeout(重設瀏覽器,
// 自己也有時間上限),再放行下一個呼叫,下一個呼叫會用全新的瀏覽器。排隊等待的時間不算進逾時。

import { AsyncLocalStorage } from 'node:async_hooks'

/** 預設逾時(毫秒);環境變數 CANVAS_TIMEOUT_MS 可改(舞台聯絡表格數多時可以調大) */
export const DEFAULT_TIMEOUT_MS = 120_000
/** 重設瀏覽器(onTimeout)自己的時間上限 */
const RESET_LIMIT_MS = 15_000

export class CanvasTimeoutError extends Error {
  constructor(ms) {
    super(`逾時 ${Math.round(ms / 1000)} 秒:這次呼叫沒有回應,已中止並重設瀏覽器。請重試一次;如果同樣的內容一直逾時,通常是內容太複雜(濾鏡太多、格數太多)或頁面腳本卡住,先縮小再試(CANVAS_TIMEOUT_MS 可調長逾時)`)
    this.name = 'CanvasTimeoutError'
  }
}

// 逾時的呼叫只是不再被等待,它的程式還在跑:瀏覽器重設之後,它若再呼叫 getPage 會把瀏覽器開回來、動到下一個呼叫正在用的頁面。
// 所以每個呼叫帶一個「已取消」旗標(AsyncLocalStorage,跟著這個呼叫的非同步流程走),逾時時設起來;
// 要取得瀏覽器與頁面的地方(art.mjs 的 browser、getPage)先呼叫 assertNotCancelled,已取消的呼叫就在那裡中止。
const callState = new AsyncLocalStorage()
export class CanvasCancelledError extends Error {
  constructor() {
    super('這次呼叫已逾時取消')
    this.name = 'CanvasCancelledError'
  }
}
/** 在已逾時的呼叫裡丟出 CanvasCancelledError;不在佇列的呼叫裡(例如直接 import 用)什麼都不做 */
export function assertNotCancelled() {
  if (callState.getStore()?.cancelled) throw new CanvasCancelledError()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 回傳 serial(fn):把 fn 包成「一次只跑一個、有逾時」的版本 */
export function createSerial({ timeoutMs = DEFAULT_TIMEOUT_MS, onTimeout } = {}) {
  let chain = Promise.resolve()
  return (fn) => (args) => {
    const run = () =>
      new Promise((resolve, reject) => {
        let done = false
        const state = { cancelled: false }
        const timer = setTimeout(async () => {
          if (done) return
          done = true
          state.cancelled = true
          // 先重設瀏覽器(有上限),再放行佇列;卡住的那個呼叫之後就算回來也不會再有人等它
          await Promise.race([Promise.resolve().then(() => onTimeout?.()).catch(() => {}), sleep(RESET_LIMIT_MS)])
          reject(new CanvasTimeoutError(timeoutMs))
        }, timeoutMs)
        Promise.resolve()
          .then(() => callState.run(state, () => fn(args)))
          .then(
            (v) => {
              if (done) return
              done = true
              clearTimeout(timer)
              resolve(v)
            },
            (e) => {
              if (done) return
              done = true
              clearTimeout(timer)
              reject(e)
            },
          )
      })
    const p = chain.then(run)
    chain = p.catch(() => {})
    return p
  }
}
