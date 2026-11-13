// art/fx/editor:程式碼編輯器的內容 —— 每一行(行號 + 上色的程式碼 + 游標)、掃描時的亮條、圈起可疑的那一行(手繪的紅圈)。
// 純函式。容器要有 class "art-code art-ed"(上色在 codeStream.css、版面在 editor.css);每行高 ROW_H、容器上方留 ROW_PAD。
import { kit } from '../../kit'
import { highlight, type Lang } from './codeStream'
import { fx } from '../dom'
import './editor.css'

export const ROW_H = 18
export const ROW_PAD = 8
/** 第 i 行(從 0 數)上緣在容器裡的 y */
export const rowTop = (i: number): number => ROW_PAD + i * ROW_H

export interface EditorRow {
  text: string
  lang?: Lang
  /** 0–1:亮條蓋過這一行的程度 */
  hot?: number
  /** 這一行剛被改過(底色閃一下) */
  flash?: number
  /** 游標放在這一行的最後 */
  caret?: boolean
}
/** 每一行 → HTML(行號、上色、游標) */
export function editorHtml(rows: EditorRow[]): string {
  return rows
    .map((r, i) => {
      const style = r.hot || r.flash ? ` style="${r.hot ? `--hot:${fx(r.hot, 2)};` : ''}${r.flash ? `--flash:${fx(r.flash, 2)}` : ''}"` : ''
      return `<div class="art-ed-row${r.hot ? ' art-ed-hot' : ''}${r.flash ? ' art-ed-flash' : ''}"${style}><em>${i + 1}</em><span>${highlight(r.text, r.lang ?? 'html')}${r.caret ? '<i class="art-caret"></i>' : ''}</span></div>`
    })
    .join('')
}

/** 手繪感的圈:繞中心 (cx, cy) 約一圈半、半徑有一點抖(固定種子),回傳 SVG path 的 d */
export function scribbleCircle(cx: number, cy: number, rx: number, ry: number, seed = 5): string {
  const r = kit.rand(seed)
  const n = 44
  const pts: string[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = -2.2 + t * Math.PI * 2.75
    const grow = 1 + 0.07 * t + (r() - 0.5) * 0.05
    pts.push(`${fx(cx + Math.cos(a) * rx * grow, 1)} ${fx(cy + Math.sin(a) * ry * grow * (1 - 0.08 * t), 1)}`)
  }
  return `M${pts[0]} ` + pts.slice(1).map((p) => `L${p}`).join(' ')
}
