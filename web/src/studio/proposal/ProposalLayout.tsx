import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './proposal.css'

type NavItem = { to: string; label: string; short?: string; match?: string }

/** 依課程地圖（src/content/levels.ts 的 LEVELS）分等級。 */
const NAV: NavItem[] = [
  { to: '/proposal', label: '總覽' },
  { to: '/proposal/tools', label: 'L0 AI 工具介紹', short: 'L0' },
  { to: '/proposal/ai-tools', label: 'L1 AI 工具入門', short: 'L1' },
  { to: '/proposal/vibe-coding', label: 'L2 Vibe Coding 入門', short: 'L2' },
  { to: '/proposal/ai-agent/fields', label: 'L3 AI Agent 整合應用', short: 'L3', match: '/proposal/ai-agent' },
  { to: '/proposal/advanced', label: 'L4 進階', short: 'L4' },
  { to: '/docs', label: '文件', short: '文件' },
]

/** L3 的子頁面（沿用原本的提案頁）。 */
const L3_NAV: NavItem[] = [
  { to: '/proposal/ai-agent/fields', label: '提案內容' },
  { to: '/proposal/ai-agent/structure', label: '課程架構' },
  { to: '/proposal/ai-agent/cover', label: '封面圖' },
  { to: '/proposal/ai-agent/video', label: '募資影片' },
]

type Props = {
  /** Page name, used for the document title ("<title> · 課程提案"). */
  title: string
  /** Source note shown in the footer. */
  footer: string
  /** Show the "← 回總覽" back links (every page except the overview). */
  back?: boolean
  children: ReactNode
}

export function ProposalLayout({ title, footer, back = true, children }: Props) {
  const { pathname } = useLocation()
  const inL3 = pathname.startsWith('/proposal/ai-agent')

  useEffect(() => {
    document.title = `${title} · 課程提案`
  }, [title])

  const isActive = (item: NavItem) => (item.match ? pathname.startsWith(item.match) : pathname === item.to)

  return (
    <div className="proposal" lang="zh-Hant">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/proposal">
            課程研發
          </Link>
          <nav aria-label="課程等級">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} aria-current={isActive(item) ? 'page' : undefined} title={item.label}>
                {item.short ? (
                  <>
                    <span className="nav-short">{item.short}</span>
                    <span className="nav-long">{item.label.slice(item.short.length)}</span>
                  </>
                ) : (
                  item.label
                )}
              </Link>
            ))}
          </nav>
        </div>
        {inL3 && (
          <div className="subnav">
            <nav aria-label="L3 提案頁">
              <span className="subnav-label">L3</span>
              {L3_NAV.map((item) => (
                <Link key={item.to} to={item.to} aria-current={pathname === item.to ? 'page' : undefined}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main>
        {back && (
          <Link className="back" to="/proposal">
            ← 回總覽
          </Link>
        )}
        {children}
      </main>

      <footer>
        {back ? (
          <>
            <Link className="back" to="/proposal">
              ← 回總覽
            </Link>{' '}
            · {footer}
          </>
        ) : (
          footer
        )}
      </footer>
    </div>
  )
}
