import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SiteLayout } from '../../site/SiteLayout'
import { articles, CATEGORY_LABEL, type ArticleCategory } from '../articles/registry'
import type { Doc } from './registry'
import { docs } from './registry'
import './docs.css'

export function DocPage({ doc }: { doc: Doc }) {
  return (
    <SiteLayout title={doc.title} narrow>
      <div className="doc-page">
        <nav className="doc-nav" aria-label="麵包屑">
          <Link to="/proposal">課程研發</Link>
          <span aria-hidden="true"> / </span>
          <Link to="/proposal#docs">文件</Link>
          <span aria-hidden="true"> / </span>
          <span>{doc.title}</span>
        </nav>
        <article className="doc-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {doc.content}
          </ReactMarkdown>
        </article>
        <footer className="doc-footer">來源:{doc.source}</footer>
      </div>
    </SiteLayout>
  )
}

const GROUPS: { label: string; items: { slug: string; title: string; summary?: string }[] }[] = [
  ...(Object.keys(CATEGORY_LABEL) as ArticleCategory[]).map((c) => ({
    label: CATEGORY_LABEL[c],
    items: articles.filter((a) => a.category === c),
  })),
  { label: '工具與規格', items: docs },
]

/** 文件列表(研究文章與 Markdown 文件),顯示在課程研發總覽頁的「文件」區塊 */
export function DocList() {
  return (
    <>
      {GROUPS.filter((g) => g.items.length).map((g) => (
        <section key={g.label}>
          <h3>{g.label}</h3>
          <ul className="plain-list">
            {g.items.map((d) => (
              <li key={d.slug}>
                <Link to={`/docs/${d.slug}`}>{d.title}</Link>
                {d.summary && <span className="doc-summary"> — {d.summary}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
