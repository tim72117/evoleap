import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DocLayout, type TocItem } from '../articles/Article'
import { articles, CATEGORY_LABEL, type ArticleCategory } from '../articles/registry'
import type { Doc } from './registry'
import styles from '../articles/Article.module.css'
import ui from '../proposal/proposal.module.css'

// Markdown 文件頁:版型與研究文章共用(articles/Article.tsx 的 DocLayout),標題與摘要來自 articles/registry.ts。
// 目錄由內文的「## 」標題自動產生;內文開頭的「# 標題」與頁首重複,所以略過。

/** 一行標題的純文字(去掉行內程式碼與連結的 Markdown 符號),要和畫面上算出的標題文字一致才能對上目錄 */
const plain = (line: string): string => line.replace(/`/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim()

function tocOf(content: string): TocItem[] {
  const out: TocItem[] = []
  let fence = false
  for (const line of content.split('\n')) {
    if (line.startsWith('```')) fence = !fence
    const m = !fence && /^## (.+)$/.exec(line)
    if (m) out.push({ id: `sec-${out.length + 1}`, title: plain(m[1]) })
  }
  return out
}

const textOf = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object' && 'props' in node) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

export function DocPage({ doc }: { doc: Doc }) {
  const toc = tocOf(doc.content)
  return (
    <DocLayout slug={doc.slug} toc={toc}>
      <div className={`${styles.body} ${styles.md}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => <h2 id={toc.find((t) => t.title === textOf(children).trim())?.id}>{children}</h2>,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {doc.content.replace(/^# .*(\r?\n)+/, '')}
        </ReactMarkdown>
      </div>
      <p className={styles.source}>來源：{doc.source}</p>
    </DocLayout>
  )
}

const GROUPS = (Object.keys(CATEGORY_LABEL) as ArticleCategory[]).map((c) => ({
  label: CATEGORY_LABEL[c],
  items: articles.filter((a) => a.category === c),
}))

/** 文件列表(研究文章與 Markdown 文件),顯示在課程研發總覽頁的「文件」區塊:一份文件一張卡片 */
export function DocList() {
  return (
    <>
      {GROUPS.filter((g) => g.items.length).map((g) => (
        <section key={g.label}>
          <h3>{g.label}</h3>
          <div className={ui['doc-grid']}>
            {g.items.map((d) => (
              <Link key={d.slug} to={`/docs/${d.slug}`} className={ui['doc-card']}>
                <strong>{d.title}</strong>
                <span>{d.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
