import type { ReactNode } from 'react'
import { formatDate, useLocale, useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { CONTACT_EMAIL, isPlaceholder } from './operator'
import styles from './Legal.module.css'

// 隱私權政策、服務條款與退款政策共用的版型:標題、最後更新日期、本頁目錄、條文區塊。

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
  const t = useT()
  const { locale } = useLocale()
  return (
    <SiteLayout title={title}>
      <article className={styles.doc}>
        <header className={styles.head}>
          <h1>{title}</h1>
          {t.legal.translationNotice && (
            <p className={`${styles.note} ${styles.notice}`} role="note">
              {t.legal.translationNotice}
            </p>
          )}
          <p className={styles.updated}>
            {t.legal.updated}
            {/* 日期字串是 UTC 的年月日,用 UTC 格式化才不會因時區差一天 */}
            {/* 中文版維持原本的 2026-11-09 寫法 */}
            <time dateTime={updated}>{locale === 'en' ? formatDate(updated, locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : updated}</time>
          </p>
          <p className={styles.intro}>{intro}</p>
        </header>

        <nav className={styles.toc} aria-label={t.legal.toc}>
          <p className={styles.tocTitle}>{t.legal.toc}</p>
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
