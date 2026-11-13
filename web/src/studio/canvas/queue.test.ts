import { describe, expect, it, vi } from 'vitest'
import { assertNotCancelled, CanvasCancelledError, CanvasTimeoutError, createSerial } from '../../../scripts/canvas/queue.mjs'

const never = () => new Promise<never>(() => {})
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('canvas MCP 的呼叫佇列', () => {
  it('一次只跑一個,依序完成', async () => {
    const serial = createSerial({ timeoutMs: 1000 })
    const log: string[] = []
    const run = serial(async (n: number) => {
      log.push(`start ${n}`)
      await wait(n === 1 ? 30 : 1)
      log.push(`end ${n}`)
      return n
    })
    expect(await Promise.all([run(1), run(2)])).toEqual([1, 2])
    expect(log).toEqual(['start 1', 'end 1', 'start 2', 'end 2'])
  })

  it('呼叫自己丟出的錯誤照樣丟出,不影響後面的呼叫', async () => {
    const serial = createSerial({ timeoutMs: 1000 })
    const boom = serial(async () => {
      throw new Error('找不到腳本')
    })
    const ok = serial(async () => 'ok')
    await expect(boom(undefined)).rejects.toThrow('找不到腳本')
    expect(await ok(undefined)).toBe('ok')
  })

  it('永遠不結束的呼叫會逾時、先重設瀏覽器,而且不擋住後面的呼叫', async () => {
    const onTimeout = vi.fn(async () => {})
    const serial = createSerial({ timeoutMs: 40, onTimeout })
    const hang = serial(never)
    const next = serial(async () => 'after')
    await expect(hang(undefined)).rejects.toBeInstanceOf(CanvasTimeoutError)
    await expect(hang(undefined)).rejects.toThrow(/逾時 0 秒|逾時/)
    expect(await next(undefined)).toBe('after')
    expect(onTimeout).toHaveBeenCalledTimes(2)
  })

  it('排隊等待的時間不算進逾時:前一個跑 60ms,後一個逾時是 100ms,後一個照樣完成', async () => {
    const serial = createSerial({ timeoutMs: 100 })
    const slow = serial(async () => {
      await wait(60)
      return 'slow'
    })
    const quick = serial(async () => 'quick')
    expect(await Promise.all([slow(undefined), quick(undefined)])).toEqual(['slow', 'quick'])
  })

  it('逾時之後卡住的呼叫就算回來,也不會改變已經回傳的結果', async () => {
    const serial = createSerial({ timeoutMs: 30 })
    let release: (v: string) => void = () => {}
    const late = serial(() => new Promise<string>((r) => (release = r)))
    await expect(late(undefined)).rejects.toBeInstanceOf(CanvasTimeoutError)
    release('太晚了')
    await wait(10)
    expect(await serial(async () => 'fine')(undefined)).toBe('fine')
  })

  it('逾時之後,卡住的呼叫再去取得瀏覽器會被中止;還沒逾時的呼叫不受影響', async () => {
    const serial = createSerial({ timeoutMs: 30 })
    let late: () => void = () => {}
    const outcome = new Promise<unknown>((resolve) => {
      late = () => {
        try {
          assertNotCancelled()
          resolve('沒被中止')
        } catch (e) {
          resolve(e)
        }
      }
    })
    const hang = serial(async () => {
      await wait(60) // 比逾時久:醒來時已經被取消
      late()
    })
    await expect(hang(undefined)).rejects.toBeInstanceOf(CanvasTimeoutError)
    expect(await outcome).toBeInstanceOf(CanvasCancelledError)
    expect(await serial(async () => (assertNotCancelled(), 'ok'))(undefined)).toBe('ok')
    expect(() => assertNotCancelled()).not.toThrow() // 不在佇列裡的呼叫不受影響
  })
})
