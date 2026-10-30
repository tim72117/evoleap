import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './CoverDesignerPage.module.css'
import { drawCover, drawCoverSquare } from './coverDrawing'

function openImage(cv: HTMLCanvasElement, label: string): string {
  try {
    const win = window.open()
    if (win) {
      win.document.write(
        `<title>${label}</title><body style="margin:0;background:#1c1915;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${cv.toDataURL('image/png')}" style="max-width:100%;height:auto"></body>`,
      )
      return '已在新分頁開啟，長按或右鍵另存'
    }
    return '瀏覽器封鎖了彈出分頁，請允許後再試一次'
  } catch (e) {
    return '開啟失敗：' + (e instanceof Error ? e.message : String(e))
  }
}

export function CoverDesignerPage() {
  const coverRef = useRef<HTMLCanvasElement>(null)
  const squareRef = useRef<HTMLCanvasElement>(null)
  const [exportMeta, setExportMeta] = useState('')
  const [exportSqMeta, setExportSqMeta] = useState('')

  useEffect(() => {
    const prevTitle = document.title
    document.title = '課程封面'
    return () => {
      document.title = prevTitle
    }
  }, [])

  // Draw immediately on mount — the canvases on screen ARE the final images,
  // not separate previews that might drift from them. Drawing fully repaints
  // each canvas, so StrictMode's double-invoked effect is harmless.
  useEffect(() => {
    const cover = coverRef.current?.getContext('2d')
    if (cover) drawCover(cover)
    const square = squareRef.current?.getContext('2d')
    if (square) drawCoverSquare(square)
  }, [])

  return (
    <div className={styles.root}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <Link to="/proposal" target="_top" className={styles.backLink}>← 回總覽</Link>
          <div className={styles.eyebrowLbl}>Hahow 課程封面</div>
          <h1 className={styles.title}>從零到上線：打造你的第一個 AI Agent 整合應用</h1>
          <p className={styles.sub}>下方兩張即為實際輸出內容（長形 1000×620、方形 800×800）。</p>
        </header>

        <canvas ref={coverRef} className={styles.canvas} width={1000} height={620} />
        <div className={styles.exportRow}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => coverRef.current && setExportMeta(openImage(coverRef.current, '課程封面 1000×620'))}
          >
            長形封面 1000×620（另開分頁可另存）
          </button>
          <span className={styles.resultMeta}>{exportMeta}</span>
        </div>

        <canvas ref={squareRef} className={`${styles.canvas} ${styles.canvasSquare}`} width={800} height={800} />
        <div className={styles.exportRow}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => squareRef.current && setExportSqMeta(openImage(squareRef.current, '課程封面 800×800'))}
          >
            方形封面 800×800（另開分頁可另存）
          </button>
          <span className={styles.resultMeta}>{exportSqMeta}</span>
        </div>

        <footer className={styles.footer}>web/src/studio/materials/CoverDesignerPage.tsx · 所有處理都在瀏覽器本機完成</footer>
      </div>
    </div>
  )
}
