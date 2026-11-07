import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { articles } from '../articles/registry'
import ui from './proposal.module.css'

type Tab = { to: string; label: string; code?: string; match?: string; also?: string[]; /** 相鄰、同一個 group 的頁籤框在一起,前面標群組名稱 */ group?: string }

/** 一級頁籤:每一個對應一個區塊,第二排再列出該區塊裡的頁面。 */
type Section = { id: 'overview' | 'todo' | 'members' | 'levels' | 'dev' | 'ideas' | 'docs' | 'tools'; label: string; to: string; tabs?: Tab[]; wrapTabs?: boolean }

/** 依課程地圖（src/content/levels.ts 的 LEVELS）分等級，再接不屬於等級的課程（AI 工具技巧、兒童網頁課、網頁運作知識）。 */
const LEVELS: Tab[] = [
  { to: '/studio/tools', code: 'L0', group: '做出自己的軟體', label: 'AI 工具介紹' },
  { to: '/studio/ai-tools', code: 'L1', group: '做出自己的軟體', label: 'AI 工具入門', also: ['/studio/life-tools', '/studio/l1-ideas'] },
  { to: '/studio/vibe-coding', code: 'L2', group: '做出自己的軟體', label: 'Vibe Coding 入門' },
  { to: '/studio/ai-agent/fields', code: 'L3', group: '做出自己的軟體', label: 'AI Agent 整合應用', match: '/studio/ai-agent' },
  { to: '/studio/advanced', code: 'L4', group: '做出自己的軟體', label: '進階' },
  // 不屬於 L0–L4 的課程
  { to: '/studio/ai-tips', label: 'AI 工具技巧' },
  { to: '/studio/kids-web', label: '兒童網頁課', also: ['/studio/kids-web/0-1', '/studio/kids-web/0-1/live', '/studio/kids-web/0-2/live', '/studio/kids-web/0-3/live', '/studio/kids-web/xray'] },
  { to: '/studio/web-basics', label: '網頁運作知識', match: '/studio/web-basics' },
]

/** 開發中:已有原型或試做、還在做的功能。 */
const DEV: Tab[] = [
  { to: '/studio/visuals', label: '即時教學影像' },
  { to: '/studio/actor-interaction', label: '演員互動', match: '/studio/actor-interaction' },
  { to: '/studio/portrait', label: '直式舞台' },
]

/** 跨等級構想。 */
const IDEAS: Tab[] = [
  { to: '/studio/mcp', label: '課程 MCP' },
  { to: '/studio/member', label: '會員空間' },
  { to: '/studio/resources', label: '資源系統' },
  { to: '/studio/news-feed', label: '科技新知動態牆' },
  { to: '/studio/extensions', label: '延伸課程' },
]

/** 文件清單與每一份文件。 */
const DOCS: Tab[] = [
  { to: '/studio/docs', label: '全部文件' },
  ...articles.map((a) => ({ to: `/docs/${a.slug}`, label: a.tab ?? a.title })),
]

const SECTIONS: Section[] = [
  { id: 'overview', label: '總覽', to: '/studio' },
  { id: 'todo', label: '待辦', to: '/studio/todo' },
  { id: 'members', label: '會員', to: '/studio/members' },
  { id: 'levels', label: '課程', to: '/studio/tools', tabs: LEVELS },
  { id: 'dev', label: '開發', to: '/studio/visuals', tabs: DEV },
  { id: 'ideas', label: '構想', to: '/studio/mcp', tabs: IDEAS },
  { id: 'docs', label: '文件', to: '/studio/docs', tabs: DOCS, wrapTabs: true },
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

/** 把相鄰、同一個 group 的頁籤合成一段;沒有 group 的頁籤各自一段 */
function groupRuns(tabs: Tab[]): { group?: string; tabs: Tab[] }[] {
  const runs: { group?: string; tabs: Tab[] }[] = []
  for (const t of tabs) {
    const last = runs[runs.length - 1]
    if (t.group && last?.group === t.group) last.tabs.push(t)
    else runs.push({ group: t.group, tabs: [t] })
  }
  return runs
}

const tabActive = (t: Tab, pathname: string): boolean =>
  t.match ? pathname.startsWith(t.match) : pathname === t.to || (t.also ?? []).includes(pathname)

/** 目前的頁面屬於哪個區塊 */
function sectionOf(pathname: string): Section['id'] | null {
  if (pathname === '/studio') return 'overview'
  if (pathname === '/studio/todo') return 'todo'
  if (pathname === '/studio/members') return 'members'
  if (DOCS.some((t) => tabActive(t, pathname))) return 'docs'
  if (LEVELS.some((t) => tabActive(t, pathname))) return 'levels'
  if (DEV.some((t) => tabActive(t, pathname))) return 'dev'
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
  /** 內容區加寬,放得下內文加右側目錄(文件頁) */
  wide?: boolean
  children: ReactNode
}

export function ProposalLayout({ title, footer, back = true, wide = false, children }: Props) {
  const { pathname } = useLocation()
  const inL3 = pathname.startsWith('/studio/ai-agent')
  const inL1 = L1_NAV.some((t) => t.to === pathname)
  const inActors = ACTOR_NAV.some((t) => t.to === pathname)

  useEffect(() => {
    document.title = `${title} · 課程提案`
  }, [title])

  // 第二排放不下時可以橫向捲動:把目前的標籤捲到看得到的位置
  const subtabsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = subtabsRef.current
    const active = nav?.querySelector('[aria-current="page"]')
    if (!nav || !active) return
    const n = nav.getBoundingClientRect()
    const a = active.getBoundingClientRect()
    nav.scrollLeft += a.left - n.left - (n.width - a.width) / 2
  }, [pathname])

  // 標籤列的高度會隨視窗寬度換行改變,文件頁的目錄與段落捲動位置要跟著它
  const rootRef = useRef<HTMLDivElement>(null)
  const topbarRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = rootRef.current
    const topbar = topbarRef.current
    if (!root || !topbar) return
    const ro = new ResizeObserver(() => root.style.setProperty('--topbar-h', `${topbar.offsetHeight}px`))
    ro.observe(topbar)
    return () => ro.disconnect()
  }, [])

  const [openGroups, setOpenGroups] = useState<string[]>([])
  const current = sectionOf(pathname)
  const section = SECTIONS.find((x) => x.id === current)

  return (
    <div ref={rootRef} className={ui.proposal} lang="zh-Hant">
      <header ref={topbarRef} className={ui.topbar}>
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
            <nav ref={subtabsRef} className={section.wrapTabs ? `${ui.subtabs} ${ui['subtabs-wrap']}` : ui.subtabs} aria-label={`${section.label}頁面`}>
              {groupRuns(section.tabs).map((run) => {
                // 群組預設收合:只留目前所在的那一課,按群組名稱展開
                const open = run.group ? openGroups.includes(run.group) : true
                const shown = open ? run.tabs : run.tabs.filter((t) => tabActive(t, pathname))
                const links = shown.map((t) => (
                  <Link key={t.to} to={t.to} aria-current={tabActive(t, pathname) ? 'page' : undefined} title={t.code ? `${t.code} ${t.label}` : t.label}>
                    {t.code && <span className={ui['nav-short']}>{t.code}</span>}
                    <span className={t.code ? ui['nav-long'] : undefined}>{t.label}</span>
                  </Link>
                ))
                if (!run.group) return links
                return (
                  <span key={`${run.group}:${run.tabs[0].to}`} className={ui['subtab-group']} role="group" aria-label={run.group}>
                    <button
                      type="button"
                      className={ui['subtab-group-label']}
                      aria-expanded={open}
                      onClick={() => setOpenGroups((gs) => (open ? gs.filter((g) => g !== run.group) : [...gs, run.group!]))}
                    >
                      {run.group} {open ? '▾' : '▸'}
                    </button>
                    {links}
                  </span>
                )
              })}
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

      <main className={wide ? ui.wide : undefined}>
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
