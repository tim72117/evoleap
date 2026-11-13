// host.ts — 舞台的渲染頁(host.html):給 web/scripts/canvas-mcp.mjs 的 canvas_* 工具用,只在 dev server 存在。
// 腳本直接從 src/content/live/ 的檔案讀(import.meta.glob),不經過後端資料庫;展開老師開場(withTeacher)與旁白長度(.voice.json)同 scripts.ts。
// 畫面是時間的純函式,所以截圖、量位置都是 renderAt(ms) 之後直接做。
//
//   window.__canvas.scripts()                               所有腳本路徑與登記的演員
//   await window.__canvas.load({ script, aspect })            載入(錯誤含第幾步)
//   window.__canvas.times(spec)                               "steps" | "chapters" | number[] | "from-to/step" → [{ at, label }]
//   window.__canvas.renderAt(ms, overlays)                    overlays:bounds、safe、grid、time
//   window.__canvas.inspect({ time, targets })                位置、文字、重疊與安全區警告(JSON)
import '../../site/global.css'
import { ACTORS } from '../../live/actors'
import { castActorNames, ensureActors, LAZY_ACTOR_NAMES } from '../../live/actors/lazy'
import { placeOf, stageSize } from '../../live/place'
import { createStage, type Stage } from '../../live/stage'
import { withTeacher } from '../../live/teacher'
import type { Aspect, StageScript } from '../../live/types'
import '../fable/registerActors'
import '../promo/registerActors'
import { SAFE } from '../promo/actors/kid-reel/layout'

type Box = { x: number; y: number; w: number; h: number }
type Mark = { at: number; label: string }

const SCRIPTS = import.meta.glob('/src/content/live/**/*.json', { import: 'default' })
const ACTOR_SRC = import.meta.glob(['/src/live/actors/*/actor.ts', '/src/studio/**/actors/*/actor.ts'], { query: '?raw', import: 'default' })
const PREFIX = '/src/content/live/'

const root = document.getElementById('canvas-root') as HTMLDivElement
document.body.style.cssText = 'margin:0;background:#000'
root.style.cssText = 'position:relative;overflow:hidden'

let stage: Stage | null = null
let el: HTMLDivElement | null = null
let aspect: Aspect = 'landscape'
let scriptPath = ''
let castIds: string[] = []
let castActors: Record<string, string> = {}
const targetNames: Record<string, string[]> = {}

const safeZone = (a: Aspect): Box => (a === 'portrait' ? SAFE : { x: 96, y: 54, w: 1728, h: 972 })
const round = (b: Box): Box => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) })

/** 演員檔開頭註解「目標:…」列出的名稱(只取不帶參數的,例如 window、ask;node:<id> 這種略過) */
function parseTargets(src: string): string[] {
  const lines = src.split('\n')
  const i = lines.findIndex((l) => /^\/\/\s*目標/.test(l))
  if (i < 0) return []
  const names = new Set<string>()
  const head = lines[i].replace(/^\/\/\s*目標[^:]*:/, '')
  for (const tok of head.split(/[、,]/)) {
    const m = tok.trim().match(/^([a-z][\w-]*)(?![\w-]*:)/)
    if (m && !/^同$/.test(m[1])) names.add(m[1])
  }
  for (let k = i + 1; k < lines.length && /^\/\/\s{2,}\S/.test(lines[k]); k++) {
    for (const tok of lines[k].replace(/^\/\/\s+/, '').split(/[、,]/)) {
      const m = tok.trim().match(/^([a-z][\w-]*)(?![\w-]*:)/)
      if (m) names.add(m[1])
    }
  }
  return [...names]
}
async function targetsOf(actor: string): Promise<string[]> {
  if (targetNames[actor]) return targetNames[actor]
  const key = Object.keys(ACTOR_SRC).find((k) => k.endsWith(`/actors/${actor}/actor.ts`))
  targetNames[actor] = key ? parseTargets((await ACTOR_SRC[key]()) as string) : []
  if (!targetNames[actor].includes('window')) targetNames[actor].unshift('window')
  return targetNames[actor]
}

async function load({ script, aspect: a = 'landscape' }: { script: string | StageScript; aspect?: Aspect }) {
  aspect = a
  let data: StageScript
  let voice: Record<string, number> | undefined
  if (typeof script === 'string') {
    const key = PREFIX + script.replace(/^\/?(src\/content\/live\/)?/, '')
    const get = SCRIPTS[key]
    if (!get) throw new Error(`找不到腳本:${script}(相對於 src/content/live/,例如 promo/kids-free-reel-short.json)`)
    data = structuredClone((await get()) as StageScript)
    const v = SCRIPTS[key.replace(/\.json$/, '.voice.json')]
    if (v) {
      const m = (await v()) as { clips?: Record<string, { ms: number }> }
      voice = Object.fromEntries(Object.entries(m.clips ?? {}).map(([t, c]) => [t, c.ms]))
    }
    scriptPath = script
  } else {
    data = structuredClone(script)
    scriptPath = '(inline)'
  }
  data = withTeacher(data)
  await ensureActors(castActorNames(data)) // 延遲載入的演員要先登記進 ACTORS,舞台才找得到
  const { w, h } = stageSize(aspect)
  // 舊舞台沒有銷毀的方法(stage.ts 不改):把它的 DOM 拿掉,演員的 ResizeObserver 看到 root 不在文件裡就會自己斷線;再放掉引用讓它被回收
  el?.remove()
  stage = null
  el = null
  root.innerHTML = ''
  root.style.width = `${w}px`
  root.style.height = `${h}px`
  el = document.createElement('div')
  el.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px`
  root.appendChild(el)
  stage = createStage(el, { aspect })
  await document.fonts.ready
  await stage.load(data, { voice, aspect })
  castIds = Object.keys(data.cast)
  castActors = Object.fromEntries(castIds.map((id) => [id, data.cast[id].actor]))
  await Promise.all(Object.values(castActors).map(targetsOf))
  stage.renderAt(0)
  await document.fonts.ready
  return {
    script: scriptPath,
    title: data.title,
    aspect,
    size: { w, h },
    duration: stage.duration,
    voice: !!voice,
    cast: castIds.map((id) => ({ id, actor: castActors[id], place: placeOf(data.cast[id].place, aspect), targets: targetNames[castActors[id]] })),
    chapters: stage.chapters,
    steps: stage.steps.length,
  }
}

function need(): Stage {
  if (!stage) throw new Error('還沒載入腳本')
  return stage
}

const short = (s: unknown, n = 18): string => (typeof s === 'string' ? (s.length > n ? s.slice(0, n) + '…' : s) : '')
function times(spec: string | number[] = 'steps'): Mark[] {
  const st = need()
  const end = Math.max(0, st.duration - 1)
  let marks: Mark[]
  if (Array.isArray(spec)) marks = spec.map((at) => ({ at, label: `${at}ms` }))
  else if (spec === 'steps') {
    marks = st.steps.map((x, i) => {
      const s = x.step as Record<string, unknown>
      const what = short(s.card ?? s.callout ?? s.show ?? s.hide ?? s.narration ?? '')
      return { at: x.start + x.dur, label: `#${i + 1} ${x.kind}${x.actor ? `@${x.actor}` : ''}${what ? ` ${what}` : ''}` }
    })
  } else if (spec === 'chapters') marks = st.chapters.map((c) => ({ at: c.at + 800, label: c.label }))
  else {
    const m = String(spec).match(/^(\d+)-(\d+|end)\/(\d+)$/)
    if (!m) throw new Error(`at 的寫法不對:${spec}(用 "steps"、"chapters"、毫秒陣列,或 "0-5000/500")`)
    const to = m[2] === 'end' ? end : Number(m[2])
    marks = []
    for (let t = Number(m[1]); t <= to && marks.length < 200; t += Math.max(1, Number(m[3]))) marks.push({ at: t, label: `${t}ms` })
  }
  // 時間太接近(< 80ms)的合併,同一格畫面不用截兩次
  const out: Mark[] = []
  for (const k of marks.map((x) => ({ ...x, at: Math.min(Math.max(0, Math.round(x.at)), end) })).sort((a, b) => a.at - b.at)) {
    const last = out.at(-1)
    if (last && k.at - last.at < 80) last.label += ` / ${k.label}`
    else out.push(k)
  }
  return out
}

// ---------- 量位置 ----------
const boxOf = (e: Element): Box => {
  const r = e.getBoundingClientRect()
  const o = root.getBoundingClientRect()
  return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }
}
const shownEl = (e: Element): boolean => {
  if (!(e instanceof HTMLElement || e instanceof SVGElement)) return false
  if (!e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false
  const b = boxOf(e)
  return b.w > 0 && b.h > 0
}
const inter = (a: Box, b: Box): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
const outsideOf = (b: Box, z: Box): boolean => b.x < z.x - 1 || b.y < z.y - 1 || b.x + b.w > z.x + z.w + 1 || b.y + b.h > z.y + z.h + 1

function castBoxes(extra: string[] = []) {
  const st = need()
  return castIds.map((id) => {
    const slot = el!.querySelector(`.slot[data-cast="${id}"]`)
    const names = new Set([...(targetNames[castActors[id]] ?? []), ...extra.filter((t) => !t.includes(':')), ...extra.filter((t) => t.startsWith(id + ':')).map((t) => t.slice(id.length + 1))])
    const targets: { name: string; box: Box }[] = []
    for (const n of names) {
      if (n === 'window') continue
      const t = st.element(`${id}:${n}`)
      if (t && shownEl(t)) targets.push({ name: n, box: round(boxOf(t)) })
    }
    return { id, actor: castActors[id], shown: !!slot && shownEl(slot), box: slot ? round(boxOf(slot)) : null, targets }
  })
}

function visibleTexts(): { text: string; box: Box; where: string }[] {
  const out: { text: string; box: Box; where: string }[] = []
  const walker = document.createTreeWalker(el!, NodeFilter.SHOW_TEXT)
  const seen = new Set<Element>()
  for (let n = walker.nextNode(); n && out.length < 120; n = walker.nextNode()) {
    const p = n.parentElement
    if (!p || seen.has(p) || !n.textContent?.trim()) continue
    seen.add(p)
    if (!shownEl(p)) continue
    const range = document.createRange()
    range.selectNodeContents(p)
    const r = range.getBoundingClientRect()
    const o = root.getBoundingClientRect()
    const box = round({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height })
    if (!box.w || !box.h) continue
    const slot = p.closest<HTMLElement>('.slot')
    out.push({ text: (p.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60), box, where: slot?.dataset.cast ?? (p.closest('.st-card') ? 'card' : p.closest('.st-bubble') ? 'callout' : 'stage') })
  }
  return out
}

function inspect({ time, targets = [] }: { time: number; targets?: string[] }) {
  const st = need()
  st.renderAt(time)
  const size = stageSize(aspect)
  const zone = safeZone(aspect)
  const cast = castBoxes(targets)
  const texts = visibleTexts()
  const warnings: string[] = []
  // 文字疊在其他文字上(不同元素、交集超過較小者的 25%)
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i].box
      const b = texts[j].box
      const x = inter(a, b)
      if (x > 0.25 * Math.min(a.w * a.h, b.w * b.h) && !(texts[i].text.includes(texts[j].text) || texts[j].text.includes(texts[i].text)))
        warnings.push(`文字重疊:「${texts[i].text}」(${texts[i].where})和「${texts[j].text}」(${texts[j].where})`)
    }
  for (const t of texts) {
    if (outsideOf(t.box, zone)) warnings.push(`文字超出安全區:「${t.text}」[${t.box.x},${t.box.y} ${t.box.w}×${t.box.h}](${t.where})`)
    if (outsideOf(t.box, { x: 0, y: 0, ...size })) warnings.push(`文字超出畫面:「${t.text}」`)
  }
  for (const c of cast) for (const t of c.targets) if (outsideOf(t.box, { x: 0, y: 0, ...size })) warnings.push(`目標超出畫面:${c.id}:${t.name}`)
  const caption = st.captions.find((c) => c.from <= time && time < c.to)?.text ?? ''
  const step = [...st.steps].reverse().findIndex((x) => x.start <= time)
  return { script: scriptPath, time, aspect, size, safe: zone, step: step < 0 ? null : st.steps.length - step, caption, cast, texts, warnings }
}

// ---------- 疊加線 ----------
const NS = 'http://www.w3.org/2000/svg'
const PALETTE = ['#ff2d55', '#007aff', '#34c759', '#ff9500', '#af52de', '#00c7be', '#ffcc00', '#5856d6']
function overlays(list: string[], time: number, scale: number) {
  root.querySelector('#cv-ov')?.remove()
  if (!list.length) return
  const { w, h } = stageSize(aspect)
  const u = 1 / scale
  const ov = document.createElementNS(NS, 'svg')
  ov.id = 'cv-ov'
  ov.setAttribute('viewBox', `0 0 ${w} ${h}`)
  ov.setAttribute('style', `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:2147483647`)
  root.appendChild(ov)
  const add = (tag: string, attrs: Record<string, string | number>, parent: Element = ov) => {
    const e = document.createElementNS(NS, tag)
    for (const k in attrs) e.setAttribute(k, String(attrs[k]))
    parent.appendChild(e)
    return e
  }
  const labels: SVGGElement[] = []
  const label = (x: number, y: number, t: string, color: string, fs = 13) => {
    const g = add('g', {}) as SVGGElement
    const r = add('rect', { fill: color, opacity: 0.88 }, g)
    const tx = add('text', { x: x + 3 * u, y: y + fs * u, 'font-size': fs * u, 'font-family': 'Consolas, monospace', fill: '#fff' }, g) as SVGTextElement
    tx.textContent = t
    const b = tx.getBBox()
    r.setAttribute('x', String(b.x - 2 * u))
    r.setAttribute('y', String(b.y - 1 * u))
    r.setAttribute('width', String(b.width + 4 * u))
    r.setAttribute('height', String(b.height + 2 * u))
    labels.push(g)
  }
  if (list.includes('grid')) {
    for (let x = 0; x <= w; x += 50) add('line', { x1: x, y1: 0, x2: x, y2: h, stroke: '#00b7ff', 'stroke-opacity': x % 100 ? 0.18 : 0.5, 'stroke-width': u })
    for (let y = 0; y <= h; y += 50) add('line', { x1: 0, y1: y, x2: w, y2: y, stroke: '#00b7ff', 'stroke-opacity': y % 100 ? 0.18 : 0.5, 'stroke-width': u })
    for (let x = 100; x < w; x += 100) label(x, 0, String(x), '#0077aa', 11)
    for (let y = 100; y < h; y += 100) label(0, y, String(y), '#0077aa', 11)
  }
  if (list.includes('safe')) {
    const z = safeZone(aspect)
    add('path', { d: `M0 0H${w}V${h}H0Z M${z.x} ${z.y}V${z.y + z.h}H${z.x + z.w}V${z.y}Z`, fill: '#ff2d55', 'fill-opacity': 0.14, 'fill-rule': 'evenodd' })
    add('rect', { x: z.x, y: z.y, width: z.w, height: z.h, fill: 'none', stroke: '#ff2d55', 'stroke-width': 2 * u, 'stroke-dasharray': `${10 * u} ${6 * u}` })
    label(z.x, z.y, aspect === 'portrait' ? 'Reels safe' : 'title safe 5%', '#ff2d55')
  }
  if (list.includes('bounds')) {
    castBoxes().forEach((c, i) => {
      if (!c.box || !c.shown) return
      const col = PALETTE[i % PALETTE.length]
      // 滿版的演員(場景、特效層)不畫外框,只標它的目標
      const full = c.box.x <= 0 && c.box.y <= 0 && c.box.w >= w && c.box.h >= h
      if (!full) {
        add('rect', { x: c.box.x, y: c.box.y, width: c.box.w, height: c.box.h, fill: 'none', stroke: col, 'stroke-width': 3 * u })
        label(c.box.x, c.box.y, `${c.id} (${c.actor}) ${c.box.w}×${c.box.h}`, col, 14)
      }
      for (const t of c.targets) {
        add('rect', { x: t.box.x, y: t.box.y, width: t.box.w, height: t.box.h, fill: 'none', stroke: col, 'stroke-width': 1.5 * u, 'stroke-dasharray': `${5 * u} ${3 * u}` })
        label(t.box.x, t.box.y + t.box.h - 15 * u, `${c.id}:${t.name}`, col, 11)
      }
    })
  }
  if (list.includes('pivots')) {
    for (const p of el!.querySelectorAll('[data-pivot]')) {
      const b = boxOf(p)
      const [px, py] = (p.getAttribute('data-pivot') ?? '').split(/[\s,]+/).map(Number)
      const cx = Number.isFinite(px) ? b.x + px : b.x + b.w / 2
      const cy = Number.isFinite(py) ? b.y + py : b.y + b.h / 2
      add('circle', { cx, cy, r: 7 * u, fill: 'none', stroke: '#ff2d55', 'stroke-width': 2 * u })
    }
  }
  if (list.includes('time')) label(8 * u, 8 * u, `${Math.round(time)} ms`, '#000', 22)
  for (const g of labels) ov.appendChild(g)
}

function renderAt(ms: number, list: string[] = [], scale = 1) {
  need().renderAt(ms)
  overlays(list, ms, scale)
  return stageSize(aspect)
}

declare global {
  interface Window {
    __canvas?: unknown
  }
}
window.__canvas = {
  ready: true,
  scripts: () => ({ scripts: Object.keys(SCRIPTS).filter((k) => !/\.(voice|mix)\.json$/.test(k)).map((k) => k.slice(PREFIX.length)), actors: [...new Set([...Object.keys(ACTORS), ...LAZY_ACTOR_NAMES])].sort() }),
  load,
  times,
  renderAt,
  inspect,
}

// 網址帶參數時直接畫出(給人用瀏覽器看):?script=…&aspect=portrait&t=3000&overlays=bounds,safe
const q = new URLSearchParams(location.search)
const qs = q.get('script')
if (qs) {
  load({ script: qs, aspect: q.get('aspect') === 'portrait' ? 'portrait' : 'landscape' })
    .then(() => renderAt(Number(q.get('t') ?? 0), (q.get('overlays') ?? '').split(',').filter(Boolean)))
    .catch((e: unknown) => {
      root.style.cssText = 'color:#fff;padding:24px;font:16px sans-serif'
      root.textContent = `載入失敗:${e instanceof Error ? e.message : String(e)}`
    })
}

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
