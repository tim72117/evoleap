import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { CONTACT_EMAIL, isPlaceholder } from './operator'
import styles from './Legal.module.css'

// 隱私權政策與服務條款共用的版型:標題、最後更新日期、本頁目錄、條文區塊。

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

export function LegalDoc({
  title,
  updated,
  intro,
  sections,
}: {
  title: string
  /** 最後更新日期(YYYY-MM-DD) */
  updated: string
  intro: ReactNode
  sections: LegalSection[]
}) {
  return (
    <SiteLayout title={title}>
      <article className={styles.doc}>
        <header className={styles.head}>
          <h1>{title}</h1>
          <p className={styles.updated}>
            最後更新日期：<time dateTime={updated}>{updated}</time>
          </p>
          <p className={styles.intro}>{intro}</p>
        </header>

        <nav className={styles.toc} aria-label="本頁目錄">
          <p className={styles.tocTitle}>本頁目錄</p>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className={styles.section}>
            <h2>
              {i + 1}. {s.title}
            </h2>
            {s.body}
          </section>
        ))}

        <footer className={styles.footer}>
          相關文件：<Link to="/privacy">隱私權政策</Link> · <Link to="/terms">服務條款</Link>
        </footer>
      </article>
    </SiteLayout>
  )
}

/** 顯示營運者資訊;仍是佔位字串時以醒目樣式標示 */
export function Fill({ value }: { value: string }) {
  return isPlaceholder(value) ? <span className={styles.placeholder}>{value}</span> : <>{value}</>
}

/** 聯絡信箱;填寫後自動成為 mailto 連結 */
export function ContactEmail() {
  return isPlaceholder(CONTACT_EMAIL) ? (
    <Fill value={CONTACT_EMAIL} />
  ) : (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  )
}

/** 補充說明框 */
export function Note({ children }: { children: ReactNode }) {
  return <div className={styles.note}>{children}</div>
}

/** 外部連結(新分頁開啟) */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

/** 簡單的資料表格(例如 cookie 清單);窄螢幕可左右捲動 */
export function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
