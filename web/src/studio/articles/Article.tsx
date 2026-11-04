import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../../site/SiteLayout'
import { articles, CATEGORY_LABEL, findArticle } from './registry'
import styles from './Article.module.css'

// 文章頁的共用元件。每篇文章的寫法:
//
//   <Article slug="research/recording" toc={[{ id: 'outline', title: '大綱與逐字稿' }, ...]}>
//     <Section id="outline" title="大綱與逐字稿">
//       <p>…</p>
//       <Callout title="結論">…</Callout>
//       <SourceList sources={[{ label: 'Lynda.com', href: '…' }]} />
//     </Section>
//   </Article>
//
// toc 的 id 要與 Section 的 id 對應,桌機版會顯示在右側目錄。

export interface TocItem {
  id: string
  title: string
}

/** 文件頁的共用版型:麵包屑、標題與摘要、內文、上下篇、右側目錄。研究文章與 Markdown 文件都用它,版型才會一致 */
export function DocLayout({ slug, toc = [], children }: { slug: string; toc?: TocItem[]; children: ReactNode }) {
  const meta = findArticle(slug)
  const index = articles.indexOf(meta)
  const prev = articles[index - 1]
  const next = articles[index + 1]

  return (
    <SiteLayout title={meta.title}>
      <div className={styles.wrap}>
        <article className={styles.article}>
          <nav className={styles.crumb} aria-label="麵包屑">
            <Link to="/studio">研發基地</Link>
            <span aria-hidden="true"> / </span>
            <Link to="/studio#docs">文件</Link>
            <span aria-hidden="true"> / </span>
            <span>{CATEGORY_LABEL[meta.category]}</span>
          </nav>
          <header className={styles.head}>
            <h1>{meta.title}</h1>
            <p className={styles.summary}>{meta.summary}</p>
          </header>
          {children}
          <nav className={styles.pager} aria-label="上一篇與下一篇">
            {prev ? (
              <Link to={`/docs/${prev.slug}`} className={styles.pagerLink}>
                <small>上一篇</small>
                {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={`/docs/${next.slug}`} className={`${styles.pagerLink} ${styles.pagerNext}`}>
                <small>下一篇</small>
                {next.title}
              </Link>
            )}
          </nav>
        </article>
        {toc.length > 0 && (
          <aside className={styles.toc} aria-label="本頁目錄">
            <p className={styles.tocTitle}>本頁目錄</p>
            <ol>
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`}>{t.title}</a>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </SiteLayout>
  )
}

export function Article({ slug, toc = [], children }: { slug: string; toc?: TocItem[]; children: ReactNode }) {
  return (
    <DocLayout slug={slug} toc={toc}>
      <div className={styles.body}>{children}</div>
    </DocLayout>
  )
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/** 重點提示框。tone: note(預設)一般補充、key 結論/建議、warn 注意事項 */
export function Callout({
  title,
  tone = 'note',
  children,
}: {
  title?: string
  tone?: 'note' | 'key' | 'warn'
  children: ReactNode
}) {
  return (
    <div className={`${styles.callout} ${styles[tone]}`}>
      {title && <p className={styles.calloutTitle}>{title}</p>}
      {children}
    </div>
  )
}

/** 卡片格,用於並列的要點 */
export function CardGrid({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <div className={styles.cards}>
      {items.map((item) => (
        <div key={item.title} className={styles.card}>
          <h3>{item.title}</h3>
          <div>{item.body}</div>
        </div>
      ))}
    </div>
  )
}

/** 資料表格,窄螢幕可橫向捲動 */
export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 外部連結(新分頁開啟) */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

/** 參考來源清單 */
export function SourceList({ sources }: { sources: { label: string; href: string }[] }) {
  return (
    <div className={styles.sources}>
      <p className={styles.sourcesTitle}>參考來源</p>
      <ul>
        {sources.map((s) => (
          <li key={s.href + s.label}>
            <Ext href={s.href}>{s.label}</Ext>
          </li>
        ))}
      </ul>
    </div>
  )
}
