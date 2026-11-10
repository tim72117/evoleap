// fable-sky 的夜景畫法:星空、月亮、雲、遠山、城市、地面、地底的光纖,整張畫在一個 canvas 上。
// 只依傳入的 ms 與「樣子」(SkyLook)畫,同一組輸入畫出同一張圖(SPEC 第 1 節)。
// fable-sky(依 mood 動作切換樣子)與 fable-scene(依場景狀態自動算出樣子)共用這份畫法。
import { kit } from '../../../../live/kit'

/** 背景的樣子:streams 光纖亮度 0–1、dawn 天亮的程度 0–1、city 城市窗戶的亮度倍數(1 是平常) */
export type SkyLook = { streams: number; dawn: number; city: number }

export const W = 1920
const H = 1080
const HORIZON = 800

type RGB = readonly [number, number, number]
const mix = (a: RGB, b: RGB, p: number): string => `rgb(${a.map((v, i) => Math.round(kit.lerp(v, b[i], p))).join(',')})`


// ---------- 固定種子的場景資料(mount 時算一次) ----------
interface Star { x: number; y: number; r: number; phase: number; period: number }
interface Building { x: number; w: number; h: number; layer: 0 | 1; cols: number; rows: number; lit: boolean[]; flicker: number[] }
interface Cloud { x: number; y: number; w: number; h: number; speed: number; a: number }

function makeScene() {
  const r = kit.rand('fable-sky')
  const stars: Star[] = []
  for (let i = 0; i < 260; i++) {
    const y = r() ** 1.6 * (HORIZON - 120)
    stars.push({ x: r() * W, y, r: 0.6 + r() * 1.6, phase: r() * Math.PI * 2, period: 1800 + r() * 3200 })
  }
  const buildings: Building[] = []
  for (const layer of [0, 1] as const) {
    let x = -40
    while (x < W + 40) {
      const w = layer === 0 ? 70 + r() * 110 : 50 + r() * 90
      const h = layer === 0 ? 90 + r() * 220 : 120 + r() * 300
      const cols = Math.max(1, Math.floor(w / 22))
      const rows = Math.max(1, Math.floor(h / 26))
      const lit: boolean[] = []
      const flicker: number[] = []
      for (let i = 0; i < cols * rows; i++) {
        lit.push(r() < (layer === 0 ? 0.42 : 0.55))
        flicker.push(r() < 0.08 ? 3000 + r() * 9000 : 0)
      }
      buildings.push({ x, w, h, layer, cols, rows, lit, flicker })
      x += w + 4 + r() * 18
    }
  }
  const clouds: Cloud[] = []
  for (let i = 0; i < 7; i++) clouds.push({ x: r() * W, y: 120 + r() * 320, w: 260 + r() * 420, h: 40 + r() * 50, speed: 0.006 + r() * 0.012, a: 0.05 + r() * 0.07 })
  return { stars, buildings, clouds }
}

/** 光纖:三條從左下穿過城市地底到右邊的曲線(二次貝茲),光點沿線流動 */
type Pt = readonly [number, number]
const FIBERS: [Pt, Pt, Pt][] = [
  [[-60, 960], [700, 860], [1980, 930]],
  [[-60, 1010], [900, 940], [1980, 990]],
  [[-60, 900], [1100, 1040], [1980, 870]],
]
const bez = ([a, c, b]: [Pt, Pt, Pt], t: number): Pt => [
  (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0],
  (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1],
]

/** 在 canvas 上畫夜景;回傳 paint(ms, look),畫面相同時跳過 */
export function createSkyPainter(canvas: HTMLCanvasElement): (ms: number, look: SkyLook) => void {
  const ctx = canvas.getContext('2d')
  const scene = makeScene()
  let lastKey = ''
  let res = 1
  let resAt = -1

  /** 解析度:依畫布實際顯示的大小(外殼縮放 × 鏡頭推近 × 螢幕像素密度)決定,0.5 倍一階、最多 2 倍,
   *  推近時不會軟掉。只影響清晰度,畫出來的內容和時間點一一對應;每 0.5 秒(依 ms)才量一次版面 */
  function resolution(ms: number): number {
    const slot = Math.floor(ms / 500)
    if (slot === resAt) return res
    resAt = slot
    const shown = canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1)
    return shown > 0 ? kit.clamp(Math.ceil((shown / W) * 2) / 2, 1, 2) : res
  }

  function draw(ms: number, { streams, dawn, city }: SkyLook): void {
    if (!ctx) return
    ctx.setTransform(res, 0, 0, res, 0, 0)
    // 天空:深夜的藍 → 黎明的橘;地平線附近較亮
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON)
    sky.addColorStop(0, mix([6, 9, 28], [52, 60, 130], dawn))
    sky.addColorStop(0.55, mix([16, 24, 66], [150, 110, 150], dawn))
    sky.addColorStop(1, mix([40, 52, 110], [246, 170, 110], dawn))
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, HORIZON + 2)

    // 星星:各自的週期閃爍;天亮時退去
    const starA = 1 - dawn * 0.92
    if (starA > 0.01) {
      for (const s of scene.stars) {
        const tw = 0.55 + 0.45 * Math.sin(ms / s.period * Math.PI * 2 + s.phase)
        ctx.globalAlpha = tw * starA * (0.35 + 0.65 * (1 - s.y / HORIZON))
        ctx.fillStyle = '#eef2ff'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // 月亮與光暈(天亮時變成淡淡的太陽光)
    const mx = 1500
    const my = kit.lerp(170, 330, dawn)
    const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 260)
    halo.addColorStop(0, `rgba(255, 244, 214, ${0.45 - dawn * 0.1})`)
    halo.addColorStop(1, 'rgba(255, 244, 214, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(mx - 260, my - 260, 520, 520)
    ctx.fillStyle = mix([255, 246, 222], [255, 214, 150], dawn)
    ctx.beginPath()
    ctx.arc(mx, my, 44, 0, Math.PI * 2)
    ctx.fill()

    // 雲:很慢地往右飄,過了右邊從左邊回來
    for (const c of scene.clouds) {
      const x = ((c.x + ms * c.speed) % (W + c.w * 2)) - c.w
      const g = ctx.createRadialGradient(x, c.y, 0, x, c.y, c.w / 2)
      g.addColorStop(0, `rgba(190, 200, 240, ${c.a * (1 + dawn)})`)
      g.addColorStop(1, 'rgba(190, 200, 240, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x, c.y, c.w / 2, c.h, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // 遠山:兩層平滑雜訊的稜線
    const hills: [number, number, number, RGB][] = [[0, HORIZON - 150, 90, [14, 20, 52]], [1, HORIZON - 70, 50, [10, 14, 40]]]
    for (const [layer, base, amp, col] of hills) {
      ctx.fillStyle = mix(col, [120, 70, 110], dawn * 0.6)
      ctx.beginPath()
      ctx.moveTo(0, HORIZON)
      for (let x = 0; x <= W; x += 24) ctx.lineTo(x, base + kit.noise(x / 260 + layer * 7, 11 + layer) * amp)
      ctx.lineTo(W, HORIZON)
      ctx.closePath()
      ctx.fill()
    }

    // 城市:後排矮一點、暗一點;窗戶依種子決定亮暗,少數會每隔一陣子閃一下
    for (const b of scene.buildings) {
      const top = HORIZON - b.h
      ctx.fillStyle = b.layer === 0 ? mix([18, 22, 48], [70, 50, 80], dawn * 0.5) : mix([9, 12, 30], [40, 30, 60], dawn * 0.5)
      ctx.fillRect(b.x, top, b.w, b.h + 4)
      const cw = b.w / b.cols
      const rh = b.h / b.rows
      for (let i = 0; i < b.lit.length; i++) {
        let on = b.lit[i]
        const f = b.flicker[i]
        if (f) on = Math.floor((ms + i * 977) / f) % 3 !== 0
        if (!on) continue
        const cx = b.x + (i % b.cols) * cw + cw * 0.3
        const cy = top + Math.floor(i / b.cols) * rh + rh * 0.3
        ctx.fillStyle = b.layer === 0 ? `rgba(255, 220, 150, ${((0.35 - dawn * 0.2) * city).toFixed(3)})` : `rgba(255, 228, 170, ${Math.min(1, (0.7 - dawn * 0.4) * city).toFixed(3)})`
        ctx.fillRect(cx, cy, Math.max(3, cw * 0.4), Math.max(3, rh * 0.42))
      }
    }

    // 地面
    const ground = ctx.createLinearGradient(0, HORIZON, 0, H)
    ground.addColorStop(0, mix([12, 14, 30], [50, 36, 60], dawn * 0.5))
    ground.addColorStop(1, mix([4, 5, 12], [22, 16, 30], dawn * 0.5))
    ctx.fillStyle = ground
    ctx.fillRect(0, HORIZON, W, H - HORIZON)

    // 光纖:地面下的曲線,光點(帶尾巴)沿線往右流
    if (streams > 0.01) {
      ctx.lineCap = 'round'
      FIBERS.forEach((f, fi) => {
        ctx.strokeStyle = `rgba(90, 170, 255, ${0.16 * streams})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(f[0][0], f[0][1])
        ctx.quadraticCurveTo(f[1][0], f[1][1], f[2][0], f[2][1])
        ctx.stroke()
        const n = 7
        for (let i = 0; i < n; i++) {
          const t = ((ms / (5200 + fi * 900) + i / n + fi * 0.13) % 1)
          for (let k = 0; k < 6; k++) {
            const tt = t - k * 0.012
            if (tt < 0) continue
            const [x, y] = bez(f, tt)
            ctx.globalAlpha = streams * (1 - k / 6) * 0.9
            ctx.fillStyle = k === 0 ? '#dff1ff' : '#5fb6ff'
            ctx.beginPath()
            ctx.arc(x, y, k === 0 ? 4 : 3 - k * 0.3, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.globalAlpha = 1
      })
    }
  }

  return (ms, look) => {
    const r = resolution(ms)
    if (r !== res) {
      res = r
      canvas.width = Math.round(W * r)
      canvas.height = Math.round(H * r)
    }
    // 每一格都在動(星星、光點),同一個 ms 與樣子就畫出同一張圖;只有完全相同時才跳過
    const key = kit.key(Math.floor(ms / 16), look.streams, look.dawn, look.city, res)
    if (key === lastKey) return
    lastKey = key
    draw(ms, look)
  }
}
