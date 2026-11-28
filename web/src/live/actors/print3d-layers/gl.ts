// print3d-layers 的 3D 畫面(Three.js)。整個模組只有一個 WebGL context 和一份場景:每次要畫時把零件擺到位、
// 畫一張、貼到呼叫者自己的 2D canvas。所以開幾個播放器、重新載入幾次都不會多佔 context,畫面也只由傳入的狀態決定。
// 平面上色(不打光),顏色和稜線照原本的平面插圖。
import * as THREE from 'three'
import { DEFAULTS, ringAt } from '../../../shapes/mesh'
import { BEAM_UP, BED, CENTER_Z, DIST, GANTRY, SCALE, SPOOL_AT, type Camera } from './scene'

export type Layer = { half: number; z0: number; height: number; raised: boolean }
export type Frame3d = {
  camera: Camera
  /** 置中縮放與目前畫布看得到的範圍(viewBox 單位) */
  fit: { k: number; x: number; y: number }
  visible: { x: number; y: number; w: number; h: number }
  shape: 'dome' | 'block'
  layers: Layer[]
  /** 模型底下的接觸陰影半寬;0 = 沒有 */
  contact: number
  opacity: number
  nozzle: { x: number; z: number; hot: boolean }
  bedY: number
  spin: number
  lcd: string
}

type Mat = [side: string, front: string, top: string]
const MATS = {
  alu: ['#9fa8b3', '#c5ccd4', '#eef1f4'],
  steel: ['#8b949f', '#b5bdc7', '#ffffff'],
  motor: ['#252b33', '#3a424d', '#59626e'],
  bed: ['#414a55', '#59626e', '#f7f8fa'],
  knob: ['#92702a', '#c89b3c', '#c89b3c'],
  shell: ['#b9c0c9', '#e4e7eb', '#ffffff'],
  fins: ['#7b8490', '#aab1ba', '#aab1ba'],
} satisfies Record<string, Mat>

const flat = (color: string, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...extra })
const stroke = (color: string) => new THREE.LineBasicMaterial({ color })

function build() {
  const cache = new Map<string, THREE.MeshBasicMaterial>()
  const mat = (color: string) => cache.get(color) ?? (cache.set(color, flat(color)), cache.get(color)!)
  const edge = stroke('#2c333d')
  const unit = new THREE.BoxGeometry(1, 1, 1)
  const unitEdges = new THREE.EdgesGeometry(unit)
  const scene = new THREE.Scene()
  const top = new THREE.Scene()
  const group = (parent: THREE.Object3D) => {
    const g = new THREE.Group()
    parent.add(g)
    return g
  }
  const box = (parent: THREE.Object3D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, name: keyof typeof MATS, outline = true) => {
    const [side, front, up] = MATS[name]
    // BoxGeometry 的面順序:+x、-x、+y、-y、+z、-z
    const m = new THREE.Mesh(unit, [side, side, front, front, up, side].map(mat))
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    m.scale.set(x1 - x0, y1 - y0, z1 - z0)
    if (outline) m.add(new THREE.LineSegments(unitEdges, edge))
    parent.add(m)
    return m
  }
  const slab = (parent: THREE.Object3D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string) => {
    const m = new THREE.Mesh(unit, mat(color))
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    m.scale.set(x1 - x0, y1 - y0, z1 - z0)
    parent.add(m)
    return m
  }
  /** 虛線(皮帶):一排小方塊 */
  const belt = (parent: THREE.Object3D, from: number, to: number, put: (a: number, b: number) => [number, number, number, number, number, number]) => {
    for (let a = from; a < to; a += 2) slab(parent, ...put(a, Math.min(to, a + 1.2)), '#1d232b')
  }
  /** 軸向沿 Y 的圓盤 */
  const discGeo = new THREE.CylinderGeometry(1, 1, 1, 40)
  const disc = (parent: THREE.Object3D, x: number, y: number, z: number, r: number, thick: number, color: string, outline = true) => {
    const m = new THREE.Mesh(discGeo, mat(color))
    m.position.set(x, y, z)
    m.scale.set(r, thick, r)
    if (outline) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(discGeo, 30), edge))
    parent.add(m)
    return m
  }

  // ---------- 不動的部分 ----------
  const base = group(scene)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(156, 148), flat('#14181d', { transparent: true, opacity: 0.08, depthWrite: false }))
  shadow.position.set(0, -2, -22.2)
  base.add(shadow)
  box(base, -68, 68, 56, 66, -20, -12, 'alu')
  box(base, -68, -56, -66, 56, -20, -12, 'alu')
  box(base, 56, 68, -66, 56, -20, -12, 'alu')
  box(base, -68, 68, -76, -66, -20, -12, 'alu')
  for (const x of [-62, 62]) slab(base, x - 0.35, x + 0.35, -66, 66, -12, -11.8, '#6b747f')
  box(base, -9, 9, 68, 84, -22, -4, 'motor')
  box(base, -26, -20, -72, 70, -12, -8, 'steel')
  box(base, 20, 26, -72, 70, -12, -8, 'steel')
  belt(base, -70, 70, (a, b) => [-0.5, 0.5, a, b, -10.5, -9.5])
  // 控制盒:螢幕是一張畫布貼圖
  box(base, 14, 78, -84, -72, -24, -6, 'motor')
  const lcdCanvas = document.createElement('canvas')
  lcdCanvas.width = 500
  lcdCanvas.height = 96
  const lcdTexture = new THREE.CanvasTexture(lcdCanvas)
  lcdTexture.colorSpace = THREE.SRGBColorSpace
  lcdTexture.anisotropy = 4
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(50, 9.6), new THREE.MeshBasicMaterial({ map: lcdTexture }))
  lcd.rotation.x = Math.PI / 2
  lcd.position.set(43, -84.2, -13.8)
  base.add(lcd)
  disc(base, 73.6, -84.4, -13.8, 3.6, 0.8, '#8a929d')
  slab(base, 73.2, 74, -85.1, -84.8, -13.8, -10.8, '#ffffff')

  // ---------- 熱床(整組沿 Y 移動) ----------
  const bed = group(scene)
  const h = BED.half
  box(bed, -30, 30, -22, 22, -8, -6, 'motor')
  for (const [x, y] of [[-h + 5, h - 5], [h - 5, h - 5], [-h + 5, -h + 5], [h - 5, -h + 5]]) box(bed, x - 3, x + 3, y - 3, y + 3, -7, -BED.thick, 'knob')
  box(bed, -h, h, -h, h, -BED.thick, 0, 'bed')
  const grid = [-24, -8, 8, 24].flatMap((v) => [v, -h, 0.05, v, h, 0.05, -h, v, 0.05, h, v, 0.05])
  const gridGeo = new THREE.BufferGeometry()
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3))
  bed.add(new THREE.LineSegments(gridGeo, stroke('#d5dae1')))
  const contact = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(new THREE.CircleGeometry(1, 48), flat('#14181d', { transparent: true, opacity: 0.18, depthWrite: false, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
  contact.position.z = 0.02
  bed.add(contact)
  const square = new THREE.PlaneGeometry(2, 2)
  const circle = contact.geometry

  // ---------- 立柱、絲桿、頂樑、線材捲 ----------
  const frame = group(scene)
  const { x: gx, y: gy, top: gt } = GANTRY
  const rodGeo = new THREE.CylinderGeometry(1, 1, 1, 12).rotateX(Math.PI / 2)
  const rod = (parent: THREE.Object3D, x: number, y: number, z: number, r: number, len: number, color: string) => {
    const m = new THREE.Mesh(rodGeo, mat(color))
    m.position.set(x, y, z)
    m.scale.set(r, r, len)
    parent.add(m)
    return m
  }
  /** 螺紋:一串深色環,跟著橫桿高度往上下移 */
  const threads = group(frame)
  for (const s of [-1, 1]) {
    box(frame, s * gx - 5, s * gx + 5, gy - 5, gy + 5, -12, gt, 'alu')
    slab(frame, s * gx - 0.35, s * gx + 0.35, gy - 5.15, gy - 5, -10, gt - 2, '#6b747f')
    const sx = s * (gx - 10)
    box(frame, sx - 6, sx + 6, gy - 6, gy + 6, -12, 1, 'motor')
    box(frame, sx - 3, sx + 3, gy - 3, gy + 3, 1, 5, 'steel')
    rod(frame, sx, gy, (5 + gt) / 2, 1.2, gt - 5, '#b5bdc7')
    for (let z = 6; z < gt - 3; z += 2.4) rod(threads, sx, gy, z, 1.28, 0.6, '#4b5460')
  }
  box(frame, -gx - 5, gx + 5, gy - 5, gy + 5, gt, gt + 8, 'alu')
  const [px, , pz] = SPOOL_AT
  box(frame, px - 3, px + 3, gy - 3, gy + 3, gt + 8, gt + 20, 'motor')
  disc(frame, px, gy + 4, pz, 12, 1, '#aab1ba')
  disc(frame, px, gy, pz, 8, 7, '#2a9d8f')
  disc(frame, px, gy - 4, pz, 12, 1, '#e4e7eb')
  disc(frame, px, gy - 4.6, pz, 8, 0.2, '#2a9d8f', false)
  disc(frame, px, gy - 4.8, pz, 3.2, 0.2, '#c5ccd4')
  const spokes = group(frame)
  spokes.position.set(px, gy - 5, pz)
  slab(spokes, -2.6, 2.6, -0.1, 0.1, -0.4, 0.4, '#59626e')
  slab(spokes, -0.4, 0.4, -0.1, 0.1, -2.6, 2.6, '#59626e')

  // ---------- X 軸橫桿(整組沿 Z) ----------
  const beam = group(scene)
  box(beam, -gx - 18, -gx - 4, gy - 8, gy + 8, -8, 8, 'motor')
  for (const s of [-1, 1]) box(beam, Math.min(s * (gx - 14), s * (gx + 7)), Math.max(s * (gx - 14), s * (gx + 7)), gy - 8, gy + 7, -7, 7, 'motor')
  box(beam, -gx + 7, gx - 14, gy - 4, gy + 4, -4, 4, 'steel')
  belt(beam, -gx + 7, gx - 14, (a, b) => [a, b, gy - 4.2, gy - 4, 1, 2.1])
  slab(beam, -gx + 7, gx - 14, gy - 4.15, gy - 4, -1.8, -1.3, '#6b747f')

  // ---------- 噴頭組(原點是噴嘴尖) ----------
  const head = group(scene)
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 0.6, 3, 4).rotateX(Math.PI / 2), mat('#c89b3c'))
  tip.position.z = 1.5
  head.add(tip)
  box(head, -4, 4, -3, 3, 3, 7, 'steel')
  box(head, -3, 3, -3, 3, 7, 10, 'fins')
  box(head, -8, 8, -7, 5, 10, 25, 'shell')
  box(head, -4, 4, -3, 3, 25, 29, 'motor')
  box(head, -6, 6, 5, gy - 4, 10, 22, 'steel')
  disc(head, 0, -7.1, 17.5, 5.4, 0.2, '#ffffff')
  const fan = group(head)
  fan.position.set(0, -7.35, 17.5)
  const blade = new THREE.BufferGeometry()
  blade.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 4.6, 0, 0, 4.6 * Math.cos(0.9), 0, 4.6 * Math.sin(0.9)], 3))
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(blade, flat('#68717d', { side: THREE.DoubleSide }))
    m.rotation.y = (i * Math.PI * 2) / 3
    fan.add(m)
  }
  disc(head, 0, -7.5, 17.5, 1.3, 0.2, '#414a55', false)
  const hot = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), flat('#cfd4da'))
  head.add(hot)

  // ---------- 模型的層:單位大小的柱體,畫的時候再縮放(輪廓取自繪圖工具的 ringAt) ----------
  const prism = (ring: [number, number][]) => new THREE.ExtrudeGeometry(new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 1, bevelEnabled: false })
  const shapes = {
    dome: prism(ringAt({ ...DEFAULTS, kind: 'prism', sides: 64, radius: 1, height: 1, scale: 1 }, 0)),
    block: prism(ringAt({ ...DEFAULTS, kind: 'box', width: 2, depth: 2, height: 1, scale: 1 }, 0)),
  }
  const shapeEdges = { dome: new THREE.EdgesGeometry(shapes.dome, 30), block: new THREE.EdgesGeometry(shapes.block, 30) }
  const skin = (cap: string, side: string, line: string) => ({ mats: [flat(cap, { transparent: true }), flat(side, { transparent: true })], line: new THREE.LineBasicMaterial({ color: line, transparent: true }) })
  const plain = skin('#7fd1c4', '#2a9d8f', '#0f5f58')
  const peeked = skin('#f5d58a', '#d99a2b', '#92400e')
  const model = group(scene)
  const lifted = group(top)
  const pool: THREE.Mesh[] = []

  const filament = new THREE.Mesh(new THREE.BufferGeometry(), mat('#2a9d8f'))
  scene.add(filament)

  const cam = new THREE.PerspectiveCamera()
  cam.up.set(0, 0, 1)
  let lcdText = ''

  return (renderer: THREE.WebGLRenderer, f: Frame3d) => {
    // 相機:位置照 scene.ts;投影矩陣讓 3D 畫面和疊在上面的 SVG 用同一套座標(不是另外設視角角度)
    cam.position.set(...f.camera.eye)
    cam.lookAt(0, 0, CENTER_Z)
    cam.updateMatrixWorld()
    const near = 50
    const per = near / (f.fit.k * SCALE * DIST)
    const { x, y, w, h: vh } = f.visible
    cam.projectionMatrix.makePerspective((x - f.fit.x) * per, (x + w - f.fit.x) * per, -(y - f.fit.y) * per, -(y + vh - f.fit.y) * per, near, 3000)
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert()

    const nz = f.nozzle.z
    bed.position.y = f.bedY
    beam.position.z = nz + BEAM_UP
    head.position.set(f.nozzle.x, 0, nz)
    threads.position.z = (nz % 2.4) * 1
    fan.rotation.y = f.spin * 0.019
    spokes.rotation.y = f.spin * 0.002
    ;(hot.material as THREE.MeshBasicMaterial).color.set(f.nozzle.hot ? '#dc4c2c' : '#cfd4da')

    if (f.lcd !== lcdText) {
      lcdText = f.lcd
      const g = lcdCanvas.getContext('2d')!
      g.fillStyle = '#0f2f2c'
      g.fillRect(0, 0, 500, 96)
      g.strokeStyle = '#8a929d'
      g.lineWidth = 4
      g.strokeRect(2, 2, 496, 92)
      g.fillStyle = '#5eead4'
      g.font = '40px -apple-system, "PingFang TC", "Noto Sans TC", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(f.lcd, 250, 50, 480)
      lcdTexture.needsUpdate = true
    }

    const geo = shapes[f.shape]
    for (let i = 0; i < Math.max(pool.length, f.layers.length); i++) {
      let m = pool[i]
      if (!m) {
        m = pool[i] = new THREE.Mesh(geo, plain.mats)
        m.add(new THREE.LineSegments(shapeEdges[f.shape], plain.line))
      }
      const layer = f.layers[i]
      if (!layer) {
        m.removeFromParent()
        continue
      }
      const look = layer.raised ? peeked : plain
      const lines = m.children[0] as THREE.LineSegments
      m.geometry = geo
      m.material = look.mats
      lines.geometry = shapeEdges[f.shape]
      lines.material = look.line
      m.scale.set(layer.half, layer.half, layer.height)
      m.position.set(0, f.bedY, layer.z0)
      ;(layer.raised ? lifted : model).add(m)
    }
    for (const material of [...plain.mats, plain.line, ...peeked.mats, peeked.line]) material.opacity = f.opacity
    contact.visible = f.contact > 0
    if (f.contact > 0) {
      contact.geometry = f.shape === 'dome' ? circle : square
      contact.scale.set(f.contact, f.contact, 1)
    }

    // 線材:從線材捲彎下來到噴頭頂端
    const from = new THREE.Vector3(px - 8, gy - 4, pz)
    const to = new THREE.Vector3(f.nozzle.x, 0, nz + 29)
    const curve = new THREE.CubicBezierCurve3(from, new THREE.Vector3(px - 25, gy - 4, pz + 4), new THREE.Vector3(to.x, to.y, to.z + 22), to)
    filament.geometry.dispose()
    filament.geometry = new THREE.TubeGeometry(curve, 32, 0.45, 6)

    renderer.autoClear = true
    renderer.render(scene, cam)
    // 拿起來看的那一層蓋在最上面
    renderer.autoClear = false
    renderer.clearDepth()
    renderer.render(top, cam)
  }
}

let shared: { renderer: THREE.WebGLRenderer; draw: ReturnType<typeof build> } | null = null

/** 建立失敗過就不再試(不然每一格都重建一次 context) */
let failed = false

/** context 遺失期間沒畫到的畫布 → 回復後要呼叫的重畫 */
const waiting = new Map<HTMLCanvasElement, () => void>()

/**
 * 把這一格畫到 target(2D canvas,像素大小就是 target.width×height)。
 * WebGL 不能用時回傳 false;context 暫時遺失時回傳 null,回復後呼叫 onRestored
 */
export function drawPrinter(target: HTMLCanvasElement, frame: Frame3d, onRestored?: () => void): boolean | null {
  if (failed) return false
  if (!shared) {
    let renderer: THREE.WebGLRenderer | null = null
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
      renderer.setPixelRatio(1)
      shared = { renderer, draw: build() }
      // three.js 自己會在回復時重建 GL 狀態(它的監聽先註冊),這裡只負責重畫
      renderer.domElement.addEventListener('webglcontextrestored', () => {
        const redraws = [...waiting.values()]
        waiting.clear()
        for (const redraw of redraws) redraw()
      })
    } catch (e) {
      console.warn('WebGL 無法使用', e)
      failed = true
      renderer?.dispose()
      renderer?.forceContextLoss()
      return false
    }
  }
  const { renderer, draw } = shared
  if (renderer.getContext().isContextLost()) {
    if (onRestored) waiting.set(target, onRestored)
    return null
  }
  const g = target.getContext('2d')
  if (!g) return false
  if (renderer.domElement.width !== target.width || renderer.domElement.height !== target.height) renderer.setSize(target.width, target.height, false)
  draw(renderer, frame)
  g.clearRect(0, 0, target.width, target.height)
  g.drawImage(renderer.domElement, 0, 0)
  return true
}
