// 左下角的 AI 頭像(女聲版):暖色的細長條末端帶光點、中央暖白光、幾條交纏的柔順光絲。
// 旁白在講話時出現並脈動,沒有在播時消失。形狀是時間 t 的純函式(不自己跑 rAF,跟著外殼的時鐘走)。

export const BARS = 48

/** 講話的整體起伏(0.3..1):兩個不同週期疊起來,像一句話裡的輕重音 */
export const loudness = (t: number): number => 0.3 + 0.7 * Math.abs(Math.sin(t / 230) * 0.6 + Math.sin(t / 520 + 1.3) * 0.4)

/** 第 i 根長條的高度(0..1)。左右對稱,波在圓周上緩緩流動 */
export function barLevel(t: number, i: number): number {
  const k = Math.min(i, BARS - i) / (BARS / 2)
  const wave = Math.abs(Math.sin(k * 6 - t / 220)) * 0.6 + Math.abs(Math.sin(k * 13 + t / 170)) * 0.25 + Math.abs(Math.sin(k * 3 + t / 410)) * 0.15
  return Math.min(1, wave * loudness(t) * 1.2)
}

const point = (a: number, r: number): string => `${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`
const angle = (i: number, n: number): number => (i / n) * Math.PI * 2 - Math.PI / 2

/** 長條(bars)與它末端的光點(dots:長度 0 的線段配圓端點) */
export function barsPath(t: number, level: number | null = null, inner = 27, span = 17): { bars: string; dots: string } {
  let bars = ''
  let dots = ''
  for (let i = 0; i < BARS; i++) {
    const a = angle(i, BARS)
    // 有實際音量:強弱照音量,長條之間的分布仍是模擬的
    const h = level === null ? barLevel(t, i) : (barLevel(t, i) / loudness(t)) * level
    const r = inner + 1.5 + Math.min(1, h) * span
    bars += `M${point(a, inner)}L${point(a, r)}`
    dots += `M${point(a, r + 2.2)}h0`
  }
  return { bars, dots }
}

/** 一條柔順的光絲:圓周上疊兩個波,用二次曲線接起來(沒有尖角);seed 讓幾條交錯 */
export function ribbonPath(t: number, seed: number, radius = 21.5, power = loudness(t), points = 24): string {
  const at = (i: number): [number, number] => {
    const a = angle(i % points, points)
    const r = radius + (Math.sin(a * 3 + t / 260 + seed * 2.1) * 2.6 + Math.sin(a * 5 - t / 340 + seed) * 1.4) * power
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r]
  }
  const mid = (i: number) => {
    const [a, b] = [at(i), at(i + 1)]
    return `${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`
  }
  let d = `M${mid(points - 1)}`
  for (let i = 0; i < points; i++) d += `Q${at(i).map((v) => v.toFixed(1)).join(' ')} ${mid(i)}`
  return `${d}Z`
}

export const VOICE_ORB_HTML = `<div class="vp-voice" aria-hidden="true"><svg viewBox="0 0 100 100">
  <defs>
    <linearGradient id="vp-voice-line" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f43f5e"/><stop offset="0.55" stop-color="#c026d3"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
    <radialGradient id="vp-voice-core"><stop offset="0" stop-color="#fff1f2"/><stop offset="0.45" stop-color="#fb7185"/><stop offset="1" stop-color="#c026d3" stop-opacity="0"/></radialGradient>
  </defs>
  <path class="bars" stroke="url(#vp-voice-line)"/>
  <path class="dots"/>
  <circle class="core" cx="50" cy="50" r="19" fill="url(#vp-voice-core)"/>
  <path class="ribbon r1"/><path class="ribbon r2"/><path class="ribbon r3"/>
</svg></div>`

/** level 是正在播的聲音的音量(0..1);null 代表沒有資料,用模擬的起伏 */
export function drawVoiceOrb(el: Element, speaking: boolean, t: number, level: number | null = null): void {
  const loud = level ?? loudness(t)
  el.classList.toggle('on', speaking)
  if (!speaking) return // 淡出時保留最後一格的樣子
  const { bars, dots } = barsPath(t, level)
  el.querySelector('.bars')!.setAttribute('d', bars)
  el.querySelector('.dots')!.setAttribute('d', dots)
  el.querySelectorAll('.ribbon').forEach((p, i) => p.setAttribute('d', ribbonPath(t, i + 1, 21.5, 0.2 + loud * 1.2)))
  // 減少動態效果:中央的光維持固定大小
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  el.querySelector('.core')!.setAttribute('r', still ? '19' : (13 + 8 * loud).toFixed(1))
}

/** 頭像不能蓋到字幕:左右有重疊時,把底緣墊到字幕上方(CSS 的 --vp-voice-min);沒重疊就用 CSS 預設位置 */
export function placeVoiceOrb(el: HTMLElement, caption: HTMLElement): void {
  const cap = caption.getBoundingClientRect()
  const orb = el.getBoundingClientRect()
  const parent = el.parentElement
  if (parent && cap.width > 0 && cap.left < orb.right + 4 && cap.right > orb.left - 4) {
    el.style.setProperty('--vp-voice-min', `${Math.ceil(parent.getBoundingClientRect().bottom - cap.top + 6)}px`)
  } else el.style.removeProperty('--vp-voice-min')
}
