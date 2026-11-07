import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FLUSH_MS, startGuestView } from './guestActivity'

// 播放器的「在不在播放」由測試控制;時鐘用假的(setInterval 與 performance.now 一起快轉)
function fakeApi() {
  const watched: number[] = []
  return {
    watched,
    api: {
      open: vi.fn(async () => 'v1'),
      watch: vi.fn(async (_id: string, ms: number) => {
        watched.push(Math.round(ms))
        return new Response(null, { status: 204 })
      }),
    },
  }
}

describe('startGuestView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('document', doc)
    vi.stubGlobal('window', Object.assign(new EventTarget(), { setInterval, clearInterval }))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('打開時記一筆,只累計播放中的時間,暫停與停止時補送', async () => {
    const { api, watched } = fakeApi()
    let playing = false
    const stop = startGuestView('live:a.json', () => playing, api)
    await vi.waitFor(() => expect(api.open).toHaveBeenCalled())
    await Promise.resolve()
    expect(api.open).toHaveBeenCalledWith('live:a.json')

    vi.advanceTimersByTime(5000) // 還沒播放:不算
    playing = true
    vi.advanceTimersByTime(10_000)
    playing = false
    vi.advanceTimersByTime(1000) // 剛暫停:送一次
    expect(watched).toEqual([10_000])

    vi.advanceTimersByTime(60_000) // 暫停中:不算、不送
    playing = true
    vi.advanceTimersByTime(FLUSH_MS + 1000) // 累計滿 FLUSH_MS:播放中也送
    expect(watched.at(-1)).toBeGreaterThanOrEqual(10_000 + FLUSH_MS)
    vi.advanceTimersByTime(4000)
    stop()
    // waitFor 等待時會讓假時鐘多走幾十毫秒
    expect(Math.abs(watched.at(-1)! - (10_000 + FLUSH_MS + 5000))).toBeLessThan(200)
  })

  it('休眠之類的長時間空白不算進播放時間', async () => {
    const { api, watched } = fakeApi()
    const stop = startGuestView('live:a.json', () => true, api)
    await Promise.resolve()
    vi.advanceTimersByTime(3000)
    // 把 performance.now 往後跳兩個小時(電腦休眠醒來),這次檢查的間隔過大,不算
    const now = performance.now()
    const spy = vi.spyOn(performance, 'now').mockReturnValue(now + 2 * 3600_000)
    vi.advanceTimersByTime(1000)
    spy.mockReturnValue(now + 2 * 3600_000 + 2000)
    stop()
    expect(watched).toEqual([5000])
  })

  it('伺服器不記(會員或沒開放)時什麼都不送', async () => {
    const { api } = fakeApi()
    api.open.mockResolvedValueOnce(null as unknown as string)
    const stop = startGuestView('live:a.json', () => true, api)
    await Promise.resolve()
    vi.advanceTimersByTime(FLUSH_MS * 2)
    stop()
    expect(api.watch).not.toHaveBeenCalled()
  })
})
