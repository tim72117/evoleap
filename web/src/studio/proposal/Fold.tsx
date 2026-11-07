import type { ReactNode } from 'react'
import ui from './proposal.module.css'

/** 可收合的段落(標題 + 內容),預設收起;課程頁的「定位」「設計依據」等背景資料用 */
export function Fold({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className={ui.fold} open={open}>
      <summary>
        <h2>{title}</h2>
      </summary>
      {children}
    </details>
  )
}
