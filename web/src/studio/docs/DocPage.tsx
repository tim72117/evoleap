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
          <Link to="/docs">文件</Link>
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
  { label: '影片腳本', items: docs },
]

export function DocIndexPage() {
  return (
    <SiteLayout title="文件" narrow>
      <div className="doc-page">
        <nav className="doc-nav" aria-label="麵包屑">
          <Link to="/proposal">課程研發</Link>
          <span aria-hidden="true"> / </span>
          <span>文件</span>
        </nav>
        <article className="doc-body">
          <h1>文件</h1>
          {GROUPS.map((g) => (
            <section key={g.label}>
              <h2>{g.label}</h2>
              <ul className="doc-list">
                {g.items.map((d) => (
                  <li key={d.slug}>
                    <Link to={`/docs/${d.slug}`}>{d.title}</Link>
                    {d.summary && <span className="doc-summary"> — {d.summary}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      </div>
    </SiteLayout>
  )
}
