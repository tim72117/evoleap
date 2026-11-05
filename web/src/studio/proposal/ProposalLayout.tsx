import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ui from './proposal.module.css'

type Tab = { to: string; label: string; code?: string; match?: string; also?: string[] }

/** 一級頁籤:每一個對應一個區塊,第二排再列出該區塊裡的頁面。 */
type Section = { id: 'overview' | 'todo' | 'levels' | 'ideas' | 'docs' | 'tools'; label: string; to: string; tabs?: Tab[] }

/** 依課程地圖（src/content/levels.ts 的 LEVELS）分等級。 */
const LEVELS: Tab[] = [
  { to: '/studio/tools', code: 'L0', label: 'AI 工具介紹' },
  { to: '/studio/ai-tools', code: 'L1', label: 'AI 工具入門', also: ['/studio/life-tools', '/studio/l1-ideas'] },
  { to: '/studio/vibe-coding', code: 'L2', label: 'Vibe Coding 入門' },
  { to: '/studio/ai-agent/fields', code: 'L3', label: 'AI Agent 整合應用', match: '/studio/ai-agent' },
  { to: '/studio/advanced', code: 'L4', label: '進階' },
]

/** 跨等級構想。 */
const IDEAS: Tab[] = [
  { to: '/studio/mcp', label: '課程 MCP' },
  { to: '/studio/member', label: '會員空間' },
  { to: '/studio/resources', label: '資源系統' },
  { to: '/studio/news-feed', label: '科技新知動態牆' },
  { to: '/studio/ai-tips', label: 'AI 工具技巧' },
  { to: '/studio/visuals', label: '即時教學影像' },
  { to: '/studio/actor-interaction', label: '演員互動', match: '/studio/actor-interaction' },
]

const SECTIONS: Section[] = [
  { id: 'overview', label: '總覽', to: '/studio' },
  { id: 'todo', label: '待辦', to: '/studio/todo' },
  { id: 'levels', label: '課程', to: '/studio/tools', tabs: LEVELS },
  { id: 'ideas', label: '構想', to: '/studio/mcp', tabs: IDEAS },
  { id: 'docs', label: '文件', to: '/studio#docs' },
  { id: 'tools', label: '工具', to: '/materials' },
]

/** L1 的子頁面：兩門並列的課程與構想區。 */
const L1_NAV: Tab[] = [
  { to: '/studio/ai-tools', label: 'AI 工具入門' },
  { to: '/studio/life-tools', label: '生活小工具' },
  { to: '/studio/l1-ideas', label: '構想區' },
]

/** L3 的子頁面（沿用原本的提案頁）。 */
const L3_NAV: Tab[] = [
  { to: '/studio/ai-agent/fields', label: '提案內容' },
  { to: '/studio/ai-agent/structure', label: '課程架構' },
  { to: '/studio/ai-agent/cover', label: '封面圖' },
]

/** 演員互動的子頁面。 */
const ACTOR_NAV: Tab[] = [
  { to: '/studio/actor-interaction', label: '構想' },
  { to: '/studio/actor-interaction/showcase', label: '演員展示' },
  { to: '/studio/actor-interaction/scene', label: '互動教學場景' },
  { to: '/studio/actor-interaction/push', label: '把演員推到主畫面' },
  { to: '/studio/actor-interaction/static', label: '靜態演員' },
]

const tabActive = (t: Tab, pathname: string): boolean =>
  t.match ? pathname.startsWith(t.match) : pathname === t.to || (t.also ?? []).includes(pathname)

/** 目前的頁面屬於哪個區塊(「文件」是連到總覽的錨點,不會成為目前區塊) */
function sectionOf(pathname: string): Section['id'] | null {
  if (pathname === '/studio') return 'overview'
  if (pathname === '/studio/todo') return 'todo'
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
  const inL3 = pathname.startsWith('/studio/ai-agent')
  const inL1 = L1_NAV.some((t) => t.to === pathname)
  const inActors = ACTOR_NAV.some((t) => t.to === pathname)

  useEffect(() => {
    document.title = `${title} · 課程提案`
  }, [title])

  const current = sectionOf(pathname)
  const section = SECTIONS.find((x) => x.id === current)

  return (
    <div className={ui.proposal} lang="zh-Hant">
      <header className={ui.topbar}>
        <div className={ui['topbar-inner']}>
          <Link className={ui.brand} to="/studio">
            研發基地
          </Link>
          <nav className={ui.tabs} aria-label="研發基地">
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
        {inActors && (
          <div className={`${ui.subnav} ${ui.subnav3}`}>
            <nav className={ui.subtabs} aria-label="演員互動頁面">
              {ACTOR_NAV.map((t) => (
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
          <Link className={ui.back} to="/studio">
            ← 回總覽
          </Link>
        )}
        {children}
      </main>

      <footer>
        {back ? (
          <>
            <Link className={ui.back} to="/studio">
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
