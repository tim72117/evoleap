// 演員 trellis-reel:microsoft/TRELLIS.2(單張圖變 3D)的 FB Reels 介紹片(直式 1080×1920;研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 作法同 archify-reel:全部用圖形「模擬」,所有動畫由 render 依時間算出(不用 CSS 動畫、不用 Math.random)。
// 數字來源 data.ts(GitHub 與 arXiv 2512.14692;星數與 fork 為抓取當下);3D 示意是大理石半身像 Marble Bust 01(Poly Haven,CC0;見 bust.ts、assets/ATTRIBUTION.md),用 2D 近似,畫面標「示意」。
// 半身像約 3.2 萬個格子,畫在 canvas(mist.ts 軟體光柵);其餘仍是 SVG。frameLayers 把畫面分成「畫布下的 SVG、網格、畫布上的 SVG」。
//
// props:無
//
// 動作(任何一步都可以寫 ms 指定長度):
//   { "scene": "hook" }    開場:輸入一張圖(半身像渲染圖)→ 方格由粗到細堆出半身像 → 平滑著色(GLB),3 秒到 60 秒
//   { "scene": "repo" }    GitHub 狀態:星數、fork、MIT、4B、HuggingFace 模型與 Space
//   { "scene": "io" }      能做什麼:圖 → 帶 PBR(底色、粗糙度、金屬度、不透明度)的網格,匯出 GLB
//   { "scene": "speed" }   速度:512³、1024³、1536³ 三條長條(形狀 + 材質)
//   { "scene": "voxel" }   原理一:O-Voxel 稀疏體素(空間格線 → 只有東西的格子長成方塊 → 16→128 格切細、上色)
//   { "scene": "flow" }    原理二:壓縮 VAE + 三段 flow matching(結構 16 格、形狀 64→128 格、貼圖上色),最後平滑著色(示意)
//   { "scene": "cell" }    凝聚完成後:選一格,這一格同時記著形狀與 PBR 四項;不經等值面場
//   { "scene": "limits" }  門檻:Linux、24GB、CUDA 12.4、安裝繁瑣、沒有品質評比
//   { "scene": "outro" }   收尾:GitHub 與 HuggingFace 兩張卡片
//
// 目標:window
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { H, W, clamp, n2, type SceneOut } from './draw'
import { paintMesh, type MeshSpec } from './mist'
import { cell, flow, hook, io, limits, outro, repo, speed, voxel } from './scenes'
import './actor.css'

export const SCENES = ['hook', 'repo', 'io', 'speed', 'voxel', 'flow', 'cell', 'limits', 'outro'] as const
export type Scene = (typeof SCENES)[number]
export type ReelStep = CommonStepFields & { scene?: Scene }
export interface ReelState {
  scene: Scene | null
  prev: Scene | null
}
export type Target = 'window'

export const DRAW: Record<Scene, (l: number, D: number) => SceneOut> = { hook, repo, io, speed, voxel, flow, cell, limits, outro }
/** 各段的預設長度(毫秒;腳本通常自己寫 ms) */
export const T: Record<Scene, number> = { hook: 13800, repo: 8000, io: 9000, speed: 9500, voxel: 11400, flow: 12600, cell: 12800, limits: 9000, outro: 4500 }
/** 換景時的交叉淡化(毫秒) */
export const FADE = 320

export function apply(st: ReelState, kind: 'scene', s: ReelStep): ReelState {
  void kind
  if (!s.scene || !(SCENES as readonly string[]).includes(s.scene)) throw new Error(`scene 要寫 ${SCENES.join('、')} 其中之一`)
  return { scene: s.scene, prev: st.scene }
}

export interface Layers {
  /** 網格畫布下面的 SVG */
  under: string
  /** 網格畫布上面的 SVG(標示框) */
  over: string
  /** 這一刻要畫的網格(沒有就是 null)與畫布的不透明度 */
  mesh: MeshSpec | null
  meshAlpha: number
}

/** 某一刻整張畫面分成三層:網格畫布下的 SVG、網格、網格上的 SVG(純函式) */
export function frameLayers(st: ReelState, l: number, D: number): Layers {
  if (!st.scene) return { under: '', over: '', mesh: null, meshAlpha: 0 }
  const cur = DRAW[st.scene](l, D)
  const f = clamp(l / FADE)
  const body = (o: SceneOut): string => `<rect width="${W}" height="${H}" fill="${o.bg}"/>${o.body}`
  if (st.prev && f < 1) {
    const old = DRAW[st.prev](1000, 1000)
    const under = `<g opacity="${n2(1 - f)}">${body(old)}</g><g opacity="${n2(f)}">${body(cur)}</g>`
    const over = `<g opacity="${n2(1 - f)}">${old.over ?? ''}</g><g opacity="${n2(f)}">${cur.over ?? ''}</g>`
    if (cur.mesh) return { under, over, mesh: cur.mesh, meshAlpha: old.mesh ? 1 : f }
    return { under, over, mesh: old.mesh ?? null, meshAlpha: 1 - f }
  }
  return { under: body(cur), over: cur.over ?? '', mesh: cur.mesh ?? null, meshAlpha: 1 }
}

/** 某一刻整張畫面的 SVG(不含網格那一層;純函式:同樣的輸入一定同樣的字串) */
export function frameSvg(st: ReelState, l: number, D: number): string {
  const y = frameLayers(st, l, D)
  return y.under + y.over
}

const actor = defineActor<'scene', ReelStep, object, ReelState, Target>({
  name: 'trellis-reel',
  kinds: ['scene'],
  init() {
    return { scene: null, prev: null }
  },
  apply,
  duration(_kind, step) {
    return T[(step.scene ?? 'hook') as Scene] ?? 5000
  },
  autoFocus() {
    return undefined
  },
  mount(root) {
    root.classList.add('A-trellis-reel')
    const ns = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"`
    root.innerHTML = `<div class="tr-stage"><svg class="tr-svg tr-under" ${ns}></svg><canvas class="tr-mesh"></canvas><svg class="tr-svg tr-over" ${ns}></svg></div>`
    const stage = root.querySelector<HTMLDivElement>('.tr-stage')!
    const under = root.querySelector<SVGSVGElement>('.tr-under')!
    const over = root.querySelector<SVGSVGElement>('.tr-over')!
    const cv = root.querySelector<HTMLCanvasElement>('.tr-mesh')!
    let lastU = ''
    let lastO = ''
    let img: ImageData | null = null
    let ctx: CanvasRenderingContext2D | null = null
    let lastMesh = ''
    let lastBox = ''
    return {
      render(frame, ms) {
        const view = frame.view
        if (!view) return
        const ev = view.ev
        const running = ev && ev.kind !== 'hide'
        const D = running ? Math.max(1, ev!.dur) : 1000
        const l = running ? ev!.local : 100000 + ms
        // 舞台維持 1080×1920 的比例,放進視窗(同 SVG 的 meet)
        const cw = root.clientWidth || W
        const ch = root.clientHeight || H
        const k = Math.min(cw / W, ch / H)
        const box = `${n2(k)}|${cw}|${ch}`
        if (box !== lastBox) {
          lastBox = box
          stage.style.width = `${W * k}px`
          stage.style.height = `${H * k}px`
          stage.style.left = `${(cw - W * k) / 2}px`
          stage.style.top = `${(ch - H * k) / 2}px`
        }
        const y = frameLayers(view.state, l, D)
        if (y.under !== lastU) {
          lastU = y.under
          under.innerHTML = y.under
        }
        if (y.over !== lastO) {
          lastO = y.over
          over.innerHTML = y.over
        }
        if (!y.mesh || y.meshAlpha <= 0) {
          if (lastMesh) cv.style.display = 'none'
          lastMesh = ''
          return
        }
        const r = y.mesh.region
        if (!img || img.width !== r.w || img.height !== r.h) {
          cv.width = r.w
          cv.height = r.h
          ctx = cv.getContext('2d')
          img = ctx ? ctx.createImageData(r.w, r.h) : null
        }
        if (!ctx || !img) return
        cv.style.cssText = `display:block;left:${(r.x / W) * 100}%;top:${(r.y / H) * 100}%;width:${(r.w / W) * 100}%;height:${(r.h / H) * 100}%;opacity:${n2(y.meshAlpha)}`
        const key = `${y.mesh.mode}|${n2(l)}|${r.x},${r.y},${r.w}`
        if (key === lastMesh) return
        lastMesh = key
        paintMesh(new Uint32Array(img.data.buffer), r.w, r.h, y.mesh)
        ctx.putImageData(img, 0, 0)
      },
      target() {
        return root
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
