import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FLUSH_MS, startGuestView, type GuestExtra } from './guestActivity'

// 播放器的「在不在播放」由測試控制;時鐘用假的(setInterval 與 performance.now 一起快轉)
function fakeApi() {
  const watched: number[] = []
  return {
    watched,
    api: {
      open: vi.fn(async () => 'v1'),
      watch: vi.fn(async (_id: string, ms: number, _extra?: GuestExtra) => {
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
    vi.stubGlobal('location', { pathname: '/topics/web/0-1', origin: 'http://x', href: 'http://x/topics/web/0-1' })
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

  it('onPlay(首頁展示):只打開不記,第一次播放才記一筆', async () => {
    const { api, watched } = fakeApi()
    let playing = false
    const stop = startGuestView('home:live:a.json', () => playing, api, true)
    vi.advanceTimersByTime(10_000)
    expect(api.open).not.toHaveBeenCalled()
    playing = true
    vi.advanceTimersByTime(3000)
    await vi.waitFor(() => expect(api.open).toHaveBeenCalledWith('home:live:a.json'))
    playing = false
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => expect(watched.length).toBeGreaterThan(0))
    expect(api.open).toHaveBeenCalledTimes(1)
    expect(watched.at(-1)!).toBeGreaterThanOrEqual(2000)
    stop()
  })

  it('onPlay:一直沒播放就不記', () => {
    const { api } = fakeApi()
    const stop = startGuestView('home:live:a.json', () => false, api, true)
    vi.advanceTimersByTime(60_000)
    stop()
    expect(api.open).not.toHaveBeenCalled()
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

  it('回報載入完成的時間(只記第一次)與頁面在前景的時間', async () => {
    const { api } = fakeApi()
    const stop = startGuestView('live:a.json', () => false, api)
    await vi.waitFor(() => expect(api.open).toHaveBeenCalled())
    vi.advanceTimersByTime(3000)
    stop.ready()
    await vi.waitFor(() => expect(api.watch).toHaveBeenCalledTimes(1))
    const first = api.watch.mock.calls[0][2]!
    expect(first.readyMs).toBeGreaterThanOrEqual(3000)
    stop.ready()
    vi.advanceTimersByTime(20_000)
    stop()
    const last = api.watch.mock.calls.at(-1)![2]!
    expect(api.watch).toHaveBeenCalledTimes(2)
    expect(last.readyMs).toBeUndefined()
    expect(last.visibleMs).toBeGreaterThanOrEqual(22_000)
  })

  it('載入失敗:回報錯誤訊息;還沒拿到紀錄編號時等拿到再送', async () => {
    const { api } = fakeApi()
    const stop = startGuestView('live:a.json', () => false, api)
    stop.fail('找不到腳本')
    await vi.waitFor(() => expect(api.watch).toHaveBeenCalled())
    expect(api.watch.mock.calls[0][2]).toMatchObject({ error: '找不到腳本' })
    stop()
  })

  it('足跡:播放、暫停、點擊、站內離開都記下來,停止時整份送出', async () => {
    const { api } = fakeApi()
    let playing = false
    const stop = startGuestView('live:a.json', () => playing, api)
    await vi.waitFor(() => expect(api.open).toHaveBeenCalled())
    await Promise.resolve()
    stop.ready()
    document.dispatchEvent(new Event('click'))
    document.dispatchEvent(new Event('click')) // 連按同一處只記一次
    playing = true
    vi.advanceTimersByTime(3000)
    playing = false
    vi.advanceTimersByTime(1000)
    ;(location as { pathname: string }).pathname = '/topics/web'
    stop()
    const events = api.watch.mock.calls.at(-1)![2]!.events!.map((x) => x.e)
    expect(events).toEqual(['ready', 'click:畫面', 'play', 'pause', 'leave:/topics/web'])
  })
})
