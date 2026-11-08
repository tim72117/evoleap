import { Fragment, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { adminApi, type AdminOverview, type AdminUser, type Count, type GuestVisit, type HomePath, type LessonStat, type UserProgress } from './api'
import { AI_APPS_TOPIC, CLAUDE_CODE_TOPIC, KIDS_TOPIC, SOFTWARE_TOPIC, WEB_TOPIC } from '../content/topics'
import { KIDS_OPEN_LESSONS } from '../content/kidsCourse'
import { WEB_OPEN_LESSONS } from '../content/webCourse'
import { ADMIN_PATH } from './paths'
import { formatDateTime, formatDuration, percentOf } from './format'
import { isGate, isHomeShowcase, isPage } from '../courses/guestActivity'
import styles from './AdminPage.module.css'

// 管理後台:會員列表、播放進度與訪客上課紀錄的概況。放在研發基地的「會員」標籤(studio/proposal/MembersPage.tsx),
// 舊的 /admin 轉到那裡。權限由伺服器判定(Email 白名單;本機 -open-studio 時不檢查),
// 這裡只負責呈現;非管理員打 API 會得到 403,顯示「沒有權限」。

type Data = { overview: AdminOverview; users: AdminUser[] }
type State =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: Data }

/** 舊網址 /admin:轉到研發基地的「會員」標籤 */
export function AdminRedirect() {
  return <Navigate to={ADMIN_PATH} replace />
}

/** 後台內容(不含版面):依登入狀態與權限顯示載入中、請先登入、沒有權限或儀表板 */
export function AdminConsole() {
  const auth = useAuth()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (auth.status === 'loading') return
    if (auth.status === 'disabled') {
      setState({ kind: 'guest' })
      return
    }
    // 沒登入也先問伺服器:本機用 -open-studio 啟動時後台不檢查權限;正式環境會回 401,顯示「請先登入」
    let cancelled = false
    Promise.all([adminApi.overview(), adminApi.users()])
      .then(([overview, users]) => !cancelled && setState({ kind: 'ready', data: { overview, users } }))
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 403) setState({ kind: 'forbidden' })
        else if (err instanceof ApiError && err.status === 401) setState({ kind: 'guest' })
        else setState({ kind: 'error', message: err instanceof ApiError ? err.message : '連線失敗，請檢查網路後再試一次' })
      })
    return () => {
      cancelled = true
    }
  }, [auth.status])

  return (
    <div className={styles.console}>
        {state.kind === 'loading' && <p className={styles.note}>載入中…</p>}
        {state.kind === 'guest' && (
          <p className={styles.note}>
            請先 <Link to={loginHref(ADMIN_PATH)}>登入</Link>。
          </p>
        )}
        {state.kind === 'forbidden' && <p className={styles.note}>這個帳號沒有管理權限。</p>}
        {state.kind === 'error' && <p className={styles.note}>{state.message}</p>}
        {state.kind === 'ready' && <Dashboard data={state.data} />}
    </div>
  )
}

function Dashboard({ data }: { data: Data }) {
  const { overview, users } = data
  return (
    <>
      <div className={styles.stats}>
        <Stat label="會員數" value={overview.users} />
        <Stat label="有播放紀錄" value={overview.activeUsers} />
        <Stat label="訪客" value={overview.guests} />
        <Stat label="有人學習的課" value={overview.lessons.filter((l) => !isHomeShowcase(l.lesson) && !isGate(l.lesson) && !isPage(l.lesson)).length} />
      </div>

      <h2 className={styles.heading}>各課概況</h2>
      {overview.lessons.length === 0 ? (
        <p className={styles.note}>還沒有任何播放紀錄。</p>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>課程</th>
                <th>學習人數</th>
                <th>看完人數</th>
                <th>平均進度</th>
                <th>訪客打開</th>
                <th>訪客人數</th>
                <th>訪客播放</th>
              </tr>
            </thead>
            <tbody>
              {overview.lessons.map((l) => (
                <tr key={l.lesson}>
                  <td>
                    <LessonName lesson={l.lesson} />
                  </td>
                  <td>{l.learners}</td>
                  <td>{l.completed}</td>
                  <td>{l.learners ? `${Math.round(l.avgPercent)}%` : '—'}</td>
                  <td>{l.guestViews}</td>
                  <td>{l.guestVisitors}</td>
                  <td>{formatDuration(l.guestWatchedMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GuestFunnel overview={overview} />

      <h2 className={styles.heading}>會員列表（{users.length}）</h2>
      <UserTable users={users} />
    </>
  )
}

function LessonName({ lesson }: { lesson: string }) {
  return (
    <>
      {isHomeShowcase(lesson) && <span className={styles.tag}>首頁展示</span>}
      {isGate(lesson) && <span className={styles.tag}>登入門檻</span>}
      {isPage(lesson) && <span className={styles.tag}>頁面</span>}
      {lesson}
    </>
  )
}

const DEVICE_LABEL: Record<string, string> = { bot: '爬蟲／自動化', mobile: '手機', tablet: '平板', desktop: '桌機' }
const SOURCE_LABEL: Record<string, string> = { direct: '直接進入', self: '站內' }
const IDLE_LABEL: Record<string, string> = { under10s: '不到 10 秒', '10to60s': '10–60 秒', over60s: '超過 1 分鐘' }

const pct = (n: number, of: number): string => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—')

/** 訪客漏斗:真人打開 → 播放器載入完成 → 有播放;爬蟲、載入失敗另外列。只算加上漏斗欄位之後的紀錄 */
function GuestFunnel({ overview }: { overview: AdminOverview }) {
  const { guestStats: g } = overview
  // 登入門檻不是播放器,不進漏斗
  const rows = overview.lessons.filter((l) => !isGate(l.lesson) && !isPage(l.lesson) && (l.guestTracked > 0 || l.guestBots > 0))
  const gates = overview.lessons.filter((l) => isGate(l.lesson) && l.guestTracked > 0)
  const sum = (k: keyof LessonStat) => rows.reduce((n, l) => n + (l[k] as number), 0)
  const total = { tracked: sum('guestTracked'), ready: sum('guestReady'), played: sum('guestPlayed'), failed: sum('guestFailed'), bots: sum('guestBots') }
  const steps = [
    { label: '真人打開', n: total.tracked },
    { label: '播放器載入完成', n: total.ready },
    { label: '有播放', n: total.played },
  ]
  return (
    <>
      <h2 className={styles.heading}>訪客漏斗</h2>
      {total.tracked + total.bots === 0 ? (
        <p className={styles.note}>還沒有漏斗資料（加上追蹤之後的訪客紀錄才算）。</p>
      ) : (
        <>
          <ol className={styles.funnel}>
            {steps.map((s, i) => (
              <li key={s.label}>
                <span className={styles.funnelLabel}>{s.label}</span>
                <span className={styles.funnelTrack}>
                  <span className={styles.funnelBar} style={{ width: total.tracked ? `${(s.n / total.tracked) * 100}%` : 0 }} />
                </span>
                <span className={styles.funnelValue}>
                  {s.n}
                  <small>{i === 0 ? '' : ` ${pct(s.n, total.tracked)}`}</small>
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            另外：爬蟲／自動化瀏覽器打開 {total.bots} 次（不算在漏斗裡）；載入失敗 {total.failed} 次。
          </p>

          <div className={styles.breakdown}>
            <CountList title="裝置" items={g.devices} label={DEVICE_LABEL} />
            <CountList title="進站來源（真人）" items={g.sources} label={SOURCE_LABEL} />
            <CountList title="沒播放的人，頁面待了多久" items={g.idleVisible} label={IDLE_LABEL} />
            <CountList title="載入錯誤" items={g.errors} empty="沒有" />
          </div>

          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>課程</th>
                  <th>真人打開</th>
                  <th>載入完成</th>
                  <th>有播放</th>
                  <th>載入失敗</th>
                  <th>沒播放平均停留</th>
                  <th>平均載入時間</th>
                  <th>爬蟲</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.lesson}>
                    <td>
                      <LessonName lesson={l.lesson} />
                    </td>
                    <td>{l.guestTracked}</td>
                    <td>
                      {l.guestReady} <small className={styles.muted}>{pct(l.guestReady, l.guestTracked)}</small>
                    </td>
                    <td>
                      {l.guestPlayed} <small className={styles.muted}>{pct(l.guestPlayed, l.guestTracked)}</small>
                    </td>
                    <td>{l.guestFailed}</td>
                    <td>{l.guestTracked - l.guestPlayed > 0 ? formatDuration(l.guestIdleVisibleMs) : '—'}</td>
                    <td>{l.guestReady ? (l.guestReadyAvgMs < 1000 ? `${l.guestReadyAvgMs} 毫秒` : `${(l.guestReadyAvgMs / 1000).toFixed(1)} 秒`) : '—'}</td>
                    <td>{l.guestBots}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <HomePaths paths={g.homePaths ?? []} total={g.homeVisits ?? 0} />
      <IdleVisits visits={g.idleVisits ?? []} />
      {gates.length > 0 && (
        <div className={styles.breakdown}>
          <CountList title="看到登入門檻（訪客打開要登入的課）" items={gates.map((l) => ({ name: l.lesson.slice('gate:'.length), count: l.guestTracked }))} />
        </div>
      )}
    </>
  )
}

const PAGE_NAME: Record<string, string> = {
  '/': '首頁',
  [SOFTWARE_TOPIC.path]: `${SOFTWARE_TOPIC.name}（地圖）`,
  [AI_APPS_TOPIC.path]: `${AI_APPS_TOPIC.name}（地圖）`,
  [CLAUDE_CODE_TOPIC.path]: `${CLAUDE_CODE_TOPIC.name}（地圖）`,
  [KIDS_TOPIC.path]: `${KIDS_TOPIC.name}（地圖）`,
  [WEB_TOPIC.path]: `${WEB_TOPIC.name}（地圖）`,
}
const LESSON_NAME: Record<string, string> = {
  ...Object.fromEntries(Object.entries(WEB_OPEN_LESSONS).map(([id, l]) => [`live:${l.script}`, `網頁課 ${id}`])),
  ...Object.fromEntries(Object.entries(KIDS_OPEN_LESSONS).map(([id, l]) => [`kids:${l.script}`, `兒童課 ${id}`])),
}

/** 路徑上的一站 → 後台顯示的名稱 */
export function stepName(lesson: string): string {
  if (lesson === 'exit') return '離開網站'
  if (lesson === '…') return '…'
  if (lesson.startsWith('leave:')) return `去了 ${lesson.slice('leave:'.length)}`
  if (isPage(lesson)) {
    const path = lesson.slice('page:'.length)
    return PAGE_NAME[path] ?? path
  }
  if (isGate(lesson)) return `登入門檻 ${lesson.slice('gate:'.length)}`
  if (isHomeShowcase(lesson)) return '首頁展示影片'
  return LESSON_NAME[lesson] ?? lesson
}

/** 從首頁進來的造訪:最常見的路徑 */
function HomePaths({ paths, total }: { paths: HomePath[]; total: number }) {
  if (!paths.length) return null
  return (
    <>
      <h3 className={`${styles.subheading} ${styles.section}`}>從首頁進來的路徑（{total} 次造訪，最常見的 {paths.length} 條）</h3>
      <div className={styles.scroll}>
        <table className={`${styles.table} ${styles.visits}`}>
          <thead>
            <tr>
              <th>次數</th>
              <th>有播放</th>
              <th>路徑</th>
            </tr>
          </thead>
          <tbody>
            {paths.map((p, i) => (
              <tr key={i}>
                <td>
                  {p.count} <small className={styles.muted}>{pct(p.count, total)}</small>
                </td>
                <td>{p.played}</td>
                <td>
                  <ol className={styles.path}>
                    {p.steps.map((s, j) => (
                      <li key={j} data-end={s.lesson === 'exit' || s.lesson.startsWith('leave:') ? 'true' : undefined}>
                        {stepName(s.lesson)}
                        {s.played && <span className={styles.played}>▶ 有播放</span>}
                      </li>
                    ))}
                  </ol>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** 足跡的事件代碼 → 後台顯示的文字 */
export function describeEvent(e: string): string {
  const [kind, ...rest] = e.split(':')
  const arg = rest.join(':')
  switch (kind) {
    case 'ready':
      return '播放器載入完成'
    case 'error':
      return '載入失敗'
    case 'play':
      return '開始播放'
    case 'pause':
      return '暫停'
    case 'hide':
      return '切到別的分頁／App'
    case 'show':
      return '回到這頁'
    case 'close':
      return '關掉或離開網站'
    case 'scroll':
      return `捲到 ${arg}`
    case 'click':
      return arg === '畫面' ? '點了畫面（不是按鈕）' : `按「${arg}」`
    case 'link':
      return `點連結 ${arg}`
    case 'leave':
      return `離開到 ${arg}`
    default:
      return e
  }
}

/** 最近沒播放的造訪:每一筆列出這次造訪的足跡 */
function IdleVisits({ visits }: { visits: GuestVisit[] }) {
  if (!visits.length) return null
  return (
    <>
      <h3 className={`${styles.subheading} ${styles.section}`}>沒有播放的人做了什麼（最近 {visits.length} 筆）</h3>
      <div className={styles.scroll}>
        <table className={`${styles.table} ${styles.visits}`}>
          <thead>
            <tr>
              <th>打開時間</th>
              <th>課程</th>
              <th>裝置／來源</th>
              <th>載入</th>
              <th>前景停留</th>
              <th>足跡</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((v, i) => (
              <tr key={i}>
                <td>{formatDateTime(v.openedAt)}</td>
                <td>
                  <LessonName lesson={v.lesson} />
                </td>
                <td>
                  {DEVICE_LABEL[v.device] ?? v.device}
                  <br />
                  <small className={styles.muted}>{SOURCE_LABEL[v.source] ?? v.source}</small>
                </td>
                <td>{v.loadError ? <span title={v.loadError}>失敗</span> : v.readyMs ? (v.readyMs < 1000 ? `${v.readyMs} 毫秒` : `${(v.readyMs / 1000).toFixed(1)} 秒`) : isGate(v.lesson) ? '—' : '沒載入完'}</td>
                <td>{formatDuration(v.visibleMs)}</td>
                <td>
                  {v.events.length === 0 ? (
                    <span className={styles.muted}>沒有任何動作</span>
                  ) : (
                    <ol className={styles.trail}>
                      {v.events.map((x, j) => (
                        <li key={j}>
                          <span className={styles.muted}>{(x.t / 1000).toFixed(1)}s</span> {describeEvent(x.e)}
                        </li>
                      ))}
                    </ol>
                  )}
                  {v.loadError && <div className={styles.muted}>錯誤：{v.loadError}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CountList({ title, items, label = {}, empty = '—' }: { title: string; items: Count[]; label?: Record<string, string>; empty?: string }) {
  return (
    <section className={styles.countBox}>
      <h3 className={styles.subheading}>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.note}>{empty}</p>
      ) : (
        <ul className={styles.countList}>
          {items.map((c) => (
            <li key={c.name}>
              <span>{label[c.name] ?? c.name}</span>
              <b>{c.count}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

function UserTable({ users }: { users: AdminUser[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>名稱</th>
            <th>Email</th>
            <th>註冊時間</th>
            <th>學習課數</th>
            <th>看完</th>
            <th>累計觀看</th>
            <th>最近學習</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <Fragment key={u.id}>
              <tr>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{formatDateTime(u.createdAt)}</td>
                <td>{u.lessonCount}</td>
                <td>{u.completed}</td>
                <td>{formatDuration(u.watchedMs)}</td>
                <td>{formatDateTime(u.lastActive)}</td>
                <td>
                  {u.lessonCount > 0 && (
                    <button type="button" className={styles.link} aria-expanded={openId === u.id} onClick={() => setOpenId(openId === u.id ? null : u.id)}>
                      {openId === u.id ? '收合' : '進度'}
                    </button>
                  )}
                </td>
              </tr>
              {openId === u.id && (
                <tr>
                  <td colSpan={8} className={styles.detail}>
                    <UserProgressList userId={u.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UserProgressList({ userId }: { userId: string }) {
  const [list, setList] = useState<UserProgress[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    adminApi
      .userProgress(userId)
      .then((p) => !cancelled && setList(p))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : '載入失敗'))
    return () => {
      cancelled = true
    }
  }, [userId])

  if (error) return <span>{error}</span>
  if (!list) return <span>載入中…</span>
  return (
    <ul className={styles.progressList}>
      {list.map((p) => (
        <li key={p.lesson}>
          <span className={styles.lessonName}>{p.lesson}</span>
          <span className={styles.bar} aria-hidden="true">
            <span className={styles.barFill} style={{ width: `${percentOf(p.positionMs, p.durationMs)}%` }} />
          </span>
          <span>
            {percentOf(p.positionMs, p.durationMs)}%（{formatDuration(p.positionMs)} / {formatDuration(p.durationMs)}）
          </span>
          <span className={styles.muted}>{formatDateTime(p.updatedAt)}</span>
        </li>
      ))}
    </ul>
  )
}
