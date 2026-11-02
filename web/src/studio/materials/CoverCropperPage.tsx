import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import styles from './CoverCropperPage.module.css'

interface Target {
  w: number
  h: number
}

const TARGETS: (Target & { label: string })[] = [
  { w: 1000, h: 620, label: '長形封面 1000 × 620' },
  { w: 800, h: 800, label: '方形封面 800 × 800' },
]

const STAGE_MAX_W = 760

function stageDims(target: Target): { w: number; h: number } {
  const ratio = target.h / target.w
  const w = Math.min(STAGE_MAX_W, 760)
  const h = Math.round(w * ratio)
  return { w, h }
}

interface Geometry {
  naturalW: number
  naturalH: number
  baseScale: number
  scale: number
  offsetX: number
  offsetY: number
}

interface DragState {
  active: boolean
  startX: number
  startY: number
  startOffX: number
  startOffY: number
}

export function CoverCropperPage() {
  const [target, setTarget] = useState<Target>(TARGETS[0])
  const [ready, setReady] = useState(false)
  const [stageSrc, setStageSrc] = useState<string | undefined>(undefined)
  const [zoom, setZoom] = useState(100)
  const [dragging, setDragging] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [exportMeta, setExportMeta] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultSeq, setResultSeq] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const stageImgRef = useRef<HTMLImageElement>(null)
  const resultBoxRef = useRef<HTMLDivElement>(null)
  const sourceImgRef = useRef<HTMLImageElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const targetRef = useRef<Target>(TARGETS[0])
  const geomRef = useRef<Geometry>({ naturalW: 0, naturalH: 0, baseScale: 1, scale: 1, offsetX: 0, offsetY: 0 })
  const dragRef = useRef<DragState>({ active: false, startX: 0, startY: 0, startOffX: 0, startOffY: 0 })

  // The functions below only touch refs and stable state setters, so it is
  // safe for the window-listener effect to capture the first render's copies.
  function clampAndApply(reset: boolean): void {
    const g = geomRef.current
    const { w, h } = stageDims(targetRef.current)
    const effScale = g.baseScale * g.scale
    const dispW = g.naturalW * effScale
    const dispH = g.naturalH * effScale
    if (reset) {
      g.offsetX = (w - dispW) / 2
      g.offsetY = (h - dispH) / 2
    }
    const minX = w - dispW, maxX = 0
    const minY = h - dispH, maxY = 0
    g.offsetX = Math.min(maxX, Math.max(minX, g.offsetX))
    g.offsetY = Math.min(maxY, Math.max(minY, g.offsetY))
    const el = stageImgRef.current
    if (el) {
      el.style.width = dispW + 'px'
      el.style.height = dispH + 'px'
      el.style.transform = `translate(${g.offsetX}px, ${g.offsetY}px)`
    }
  }

  function layoutStage(): void {
    const g = geomRef.current
    const { w, h } = stageDims(targetRef.current)
    if (g.naturalW) {
      g.baseScale = Math.max(w / g.naturalW, h / g.naturalH)
      clampAndApply(true)
    }
  }

  function pointerDown(x: number, y: number): void {
    const d = dragRef.current
    d.active = true
    d.startX = x
    d.startY = y
    d.startOffX = geomRef.current.offsetX
    d.startOffY = geomRef.current.offsetY
    setDragging(true)
  }

  function pointerMove(x: number, y: number): void {
    const d = dragRef.current
    if (!d.active) return
    geomRef.current.offsetX = d.startOffX + (x - d.startX)
    geomRef.current.offsetY = d.startOffY + (y - d.startY)
    clampAndApply(false)
  }

  function pointerUp(): void {
    dragRef.current.active = false
    setDragging(false)
  }

  useEffect(() => {
    const prevTitle = document.title
    document.title = '封面裁切工具'
    const onMouseMove = (e: MouseEvent) => pointerMove(e.clientX, e.clientY)
    const onMouseUp = () => pointerUp()
    const onResize = () => {
      if (geomRef.current.naturalW) layoutStage()
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('resize', onResize)
      document.title = prevTitle
    }
  }, [])

  // Revoke the last object URL when leaving the page.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  // Scroll the result into view after each export (runs once it is rendered).
  useEffect(() => {
    if (resultSeq > 0) resultBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [resultSeq])

  function loadFile(file: File | undefined): void {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (objectUrlRef.current && objectUrlRef.current !== url) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = url
      sourceImgRef.current = img
      geomRef.current.naturalW = img.naturalWidth
      geomRef.current.naturalH = img.naturalHeight
      geomRef.current.scale = 1
      setStageSrc(url)
      setReady(true)
      setZoom(100)
      layoutStage()
    }
    img.src = url
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>): void {
    loadFile(e.target.files?.[0])
  }

  function onDragEnterOver(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setDragOver(true)
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setDragOver(false)
  }

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setDragOver(false)
    loadFile(e.dataTransfer.files[0])
  }

  function selectTarget(t: Target): void {
    const next = { w: t.w, h: t.h }
    targetRef.current = next
    setTarget(next)
    layoutStage()
  }

  function onZoomInput(e: ChangeEvent<HTMLInputElement>): void {
    const v = Number(e.target.value)
    setZoom(v)
    geomRef.current.scale = v / 100
    clampAndApply(false)
  }

  function onGenerate(): void {
    const g = geomRef.current
    const img = sourceImgRef.current
    if (!g.naturalW || !img) return
    const t = targetRef.current
    const { w: stageW, h: stageH } = stageDims(t)
    const outW = t.w
    const outH = t.h

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const effScale = g.baseScale * g.scale
    const srcX = -g.offsetX / effScale
    const srcY = -g.offsetY / effScale
    const srcW = stageW / effScale
    const srcH = stageH / effScale

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH)

    setResultUrl(canvas.toDataURL('image/png'))
    setExportMeta(`已產生 ${outW}×${outH}px`)
    setResultSeq((n) => n + 1)
  }

  const stage = stageDims(target)
  const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')

  return (
    <div className={styles.root}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>課程平台封面素材工具</div>
          <h1 className={styles.title}>封面裁切工具</h1>
          <p className={styles.sub}>上傳 showcase 截圖或任何素材，拖曳與縮放對齊裁切框，輸出平台要求的比例與解析度。</p>
        </header>

        <div
          className={cx(styles.dropzone, dragOver && styles.drag)}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={onDragEnterOver}
          onDragOver={onDragEnterOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <p><strong>點擊選擇圖片</strong> 或把檔案拖曳到這裡</p>
          <p>支援 jpg / png，建議使用解析度較高的原圖</p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} />
        </div>

        <div className={cx(styles.editor, ready && styles.ready)}>
          <div className={styles.toolbar}>
            {TARGETS.map((t) => (
              <button
                key={t.label}
                type="button"
                className={cx(styles.targetBtn, t.w === target.w && t.h === target.h && styles.active)}
                onClick={() => selectTarget(t)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={styles.stageWrap}>
            <div
              className={cx(styles.stage, dragging && styles.dragging)}
              style={{ width: stage.w + 'px', height: stage.h + 'px' }}
              onMouseDown={(e) => pointerDown(e.clientX, e.clientY)}
              onTouchStart={(e) => {
                const t = e.touches[0]
                pointerDown(t.clientX, t.clientY)
              }}
              onTouchMove={(e) => {
                const t = e.touches[0]
                pointerMove(t.clientX, t.clientY)
              }}
              onTouchEnd={pointerUp}
            >
              <img ref={stageImgRef} src={stageSrc} alt="" />
              <div className={styles.cropFrame} />
            </div>
          </div>

          <div className={styles.controls}>
            <label>
              縮放
              <input type="range" min={100} max={400} step={1} value={zoom} onChange={onZoomInput} />
            </label>
            <span className={styles.resultMeta}>{zoom}%</span>
          </div>

          <div className={styles.exportRow}>
            <button type="button" className={styles.primary} onClick={onGenerate}>產生裁切結果</button>
            <span className={styles.resultMeta}>{exportMeta}</span>
          </div>

          <div ref={resultBoxRef} className={styles.resultBox} hidden={resultUrl === null}>
            {resultUrl !== null && <img src={resultUrl} alt="裁切結果預覽" />}
            <p className={styles.resultHint}>長按（手機）或右鍵（電腦）圖片選擇「另存圖片」即可下載。</p>
          </div>
        </div>

        <div className={styles.specBox}>
          <div><strong>長形封面</strong>比例 1000:620，寬度 &gt; 1000px</div>
          <div><strong>方形封面</strong>比例 1:1，尺寸 800×800px</div>
          <div><strong>提醒</strong>避免把重點文字/人物放在畫面四角，容易被介面元素遮擋</div>
        </div>

        <footer className={styles.footer}>web/src/studio/materials/CoverCropperPage.tsx · 所有處理都在瀏覽器本機完成，圖片不會上傳</footer>
      </div>
    </div>
  )
}
