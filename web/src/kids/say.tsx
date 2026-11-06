import type { CSSProperties } from 'react'
import { TAG_COLORS } from './tags'

/**
 * 把句子裡的「<h1>」這類標籤畫成彩色小積木(span.chip),其他文字照原樣。
 * 小積木帶 --c(積木本體色)與 --d(深色)兩個 CSS 變數,樣式由各頁自己的 chip class 決定;
 * 沒有配色的標籤不帶變數,由 chip class 自己給預設色。
 */
export function Say({ text, chip }: { text: string; chip: string }) {
  return (
    <>
      {text.split(/(<[a-z0-9]+>)/).map((piece, i) => {
        const tag = /^<([a-z0-9]+)>$/.exec(piece)?.[1]
        if (!tag) return piece
        const c = TAG_COLORS[tag]
        return (
          <span key={i} className={chip} style={c ? ({ '--c': c.color, '--d': c.shade } as CSSProperties) : undefined}>
            {piece}
          </span>
        )
      })}
    </>
  )
}
