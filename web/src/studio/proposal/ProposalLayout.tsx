import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ui from './proposal.module.css'

type Tab = { to: string; label: string; code?: string; match?: string; also?: string[] }

/** 一級頁籤:每一個對應一個區塊,第二排再列出該區塊裡的頁面。 */
type Section = { id: 'overview' | 'levels' | 'ideas' | 'docs' | 'tools'; label: string; to: string; tabs?: Tab[] }

/** 依課程地圖（src/content/levels.ts 的 LEVELS）分等級。 */
const LEVELS: Tab[] = [
  { to: '/proposal/tools', code: 'L0', label: 'AI 工具介紹' },
  { to: '/proposal/ai-tools', code: 'L1', label: 'AI 工具入門', also: ['/proposal/life-tools', '/proposal/l1-ideas'] },
  { to: '/proposal/vibe-coding', code: 'L2', label: 'Vibe Coding 入門' },
  { to: '/proposal/ai-agent/fields', code: 'L3', label: 'AI Agent 整合應用', match: '/proposal/ai-agent' },
  { to: '/proposal/advanced', code: 'L4', label: '進階' },
]

/** 跨等級構想。 */
const IDEAS: Tab[] = [
  { to: '/proposal/mcp', label: '課程 MCP' },
  { to: '/proposal/member', label: '會員空間' },
  { to: '/proposal/ai-tips', label: 'AI 工具技巧' },
  { to: '/proposal/visuals', label: '即時教學影像' },
  { to: '/proposal/interactive', label: '互動教學場景' },
  { to: '/proposal/interactive/l0-claude', label: '互動場景：L0 對 Claude 下指令' },
  { to: '/proposal/interactive/l0-claude-stage', label: '互動場景：把演員推到主畫面' },
]

const SECTIONS: Section[] = [
  { id: 'overview', label: '總覽', to: '/proposal' },
  { id: 'levels', label: '課程', to: '/proposal/tools', tabs: LEVELS },
  { id: 'ideas', label: '構想', to: '/proposal/mcp', tabs: IDEAS },
  { id: 'docs', label: '文件', to: '/proposal#docs' },
  { id: 'tools', label: '工具', to: '/materials' },
]

/** L1 的子頁面：兩門並列的課程與構想區。 */
const L1_NAV: Tab[] = [
  { to: '/proposal/ai-tools', label: 'AI 工具入門' },
  { to: '/proposal/life-tools', label: '生活小工具' },
  { to: '/proposal/l1-ideas', label: '構想區' },
]

/** L3 的子頁面（沿用原本的提案頁）。 */
const L3_NAV: Tab[] = [
  { to: '/proposal/ai-agent/fields', label: '提案內容' },
  { to: '/proposal/ai-agent/structure', label: '課程架構' },
  { to: '/proposal/ai-agent/cover', label: '封面圖' },
]

const tabActive = (t: Tab, pathname: string): boolean =>
  t.match ? pathname.startsWith(t.match) : pathname === t.to || (t.also ?? []).includes(pathname)

/** 目前的頁面屬於哪個區塊(「文件」是連到總覽的錨點,不會成為目前區塊) */
function sectionOf(pathname: string): Section['id'] | null {
  if (pathname === '/proposal') return 'overview'
  if (LEVELS.some((t) => tabActive(t, pathname))) return 'levels'
  if (IDEAS.some((t) => tabActive(t, pathname))) return 'ideas'
  if (pathname.startsWith('/materials')) return 'tools'
  return null
}

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
  const inL1 = L1_NAV.some((t) => t.to === pathname)

  useEffect(() => {
    document.title = `${title} · 課程提案`
  }, [title])

  const current = sectionOf(pathname)
  const section = SECTIONS.find((x) => x.id === current)

  return (
    <div className={ui.proposal} lang="zh-Hant">
      <header className={ui.topbar}>
        <div className={ui['topbar-inner']}>
          <Link className={ui.brand} to="/proposal">
            課程研發
          </Link>
          <nav className={ui.tabs} aria-label="課程研發">
            {SECTIONS.map((x) => (
              <Link key={x.id} to={x.to} aria-current={x.id === current ? 'page' : undefined}>
                {x.label}
              </Link>
            ))}
          </nav>
        </div>
        {section?.tabs && (
          <div className={ui.subnav}>
            <nav className={ui.subtabs} aria-label={`${section.label}頁面`}>
              {section.tabs.map((t) => (
                <Link key={t.to} to={t.to} aria-current={tabActive(t, pathname) ? 'page' : undefined} title={t.code ? `${t.code} ${t.label}` : t.label}>
                  {t.code && <span className={ui['nav-short']}>{t.code}</span>}
                  <span className={t.code ? ui['nav-long'] : undefined}>{t.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
        {inL1 && (
          <div className={`${ui.subnav} ${ui.subnav3}`}>
            <nav className={ui.subtabs} aria-label="L1 課程頁">
              <span className={ui['subnav-label']}>L1</span>
              {L1_NAV.map((t) => (
                <Link key={t.to} to={t.to} aria-current={pathname === t.to ? 'page' : undefined}>
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
        {inL3 && (
          <div className={`${ui.subnav} ${ui.subnav3}`}>
            <nav className={ui.subtabs} aria-label="L3 提案頁">
              <span className={ui['subnav-label']}>L3</span>
              {L3_NAV.map((t) => (
                <Link key={t.to} to={t.to} aria-current={pathname === t.to ? 'page' : undefined}>
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main>
        {back && (
          <Link className={ui.back} to="/proposal">
            ← 回總覽
          </Link>
        )}
        {children}
      </main>

      <footer>
        {back ? (
          <>
            <Link className={ui.back} to="/proposal">
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
