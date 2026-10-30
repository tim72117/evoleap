import type { ReactNode } from 'react'
import { Callout, Ext } from '../Article'
import styles from './ResearchNote.module.css'

// 研究筆記頁(methodology / recording / script-template)共用的小元件。
// 每個研究問題的結構:重點摘要 → 研究發現(附來源)→ 推論 → 資料缺口。

export interface Src {
  label: string
  href: string
}

export interface Finding {
  text: ReactNode
  src: Src[]
}

/** 重點摘要(原筆記的 Takeaway) */
export function Takeaway({ children }: { children: ReactNode }) {
  return (
    <Callout tone="key" title="重點摘要">
      <p>{children}</p>
    </Callout>
  )
}

/** 研究發現清單,每條附上小字來源連結 */
export function Findings({ items, label = '研究發現' }: { items: Finding[]; label?: string }) {
  return (
    <>
      <p className={styles.label}>{label}</p>
      <ul className={styles.findings}>
        {items.map((f, i) => (
          <li key={i} className={styles.finding}>
            {f.text}
            <span className={styles.src}>
              來源:
              {f.src.map((s, j) => (
                <span key={s.href + s.label}>
                  {j > 0 && '、'}
                  <Ext href={s.href}>{s.label}</Ext>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** 推論(原筆記的 Inferences):由研究發現推得、非直接引用的看法 */
export function Inferences({ items }: { items: ReactNode[] }) {
  return (
    <Callout title="推論與應用">
      <ul className={styles.list}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </Callout>
  )
}

/** 資料缺口(原筆記的 Gaps) */
export function Gaps({ items }: { items: ReactNode[] }) {
  return (
    <Callout tone="warn" title="資料缺口">
      <ul className={styles.list}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </Callout>
  )
}

/** 橫向流程標籤,用於「A → B → C」這類段落順序 */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className={styles.steps}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  )
}
