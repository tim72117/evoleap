import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { adminApi, type SchemaReport, type AdminOverview, type AdminUser, type Count, type AdminRange, type GuestVisit, type HomePath, type HomeStay, type LessonStat, type LoginStats, type UserProgress } from './api'
import { AI_APPS_TOPIC, CLAUDE_CODE_TOPIC, IDEA_TOPIC, KIDS_TOPIC, LAUNCH_TOPIC, SOFTWARE_TOPIC, WEB_TOPIC } from '../content/topics'
import { KIDS_OPEN_LESSONS } from '../content/kidsCourse'
import { LAUNCH_LESSON_PAGES, launchLessonPath, launchScriptKey } from '../content/launchCourse'
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

/** 時間篩選的選項:整頁的統計都只算這段時間內的資料 */
const RANGES: { value: AdminRange; label: string }[] = [
  { value: '', label: '全部' },
  { value: '30m', label: '30 分鐘' },
  { value: '12h', label: '12 小時' },
  { value: '1d', label: '1 天' },
  { value: '7d', label: '7 天' },
]

/** 後台內容(不含版面):依登入狀態與權限顯示載入中、請先登入、沒有權限或儀表板 */
export function AdminConsole() {
  const auth = useAuth()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [range, setRange] = useState<AdminRange>('')
  // 換篩選時保留舊資料,載入完再換,畫面不會閃成「載入中」
  const [refreshing, setRefreshing] = useState(false)
  /** 換篩選後重新載入失敗的訊息:保留舊資料與篩選按鈕,才能再選一次 */
  const [refreshError, setRefreshError] = useState<string | null>(null)
  /** 是否已經載入過一次資料(之後換篩選失敗時不換成錯誤畫面) */
  const loaded = useRef(false)

  useEffect(() => {
    if (auth.status === 'loading') return
    if (auth.status === 'disabled') {
      setState({ kind: 'guest' })
      return
    }
    // 沒登入也先問伺服器:本機用 -open-studio 啟動時後台不檢查權限;正式環境會回 401,顯示「請先登入」
    let cancelled = false
    setRefreshing(true)
    setRefreshError(null)
    Promise.all([adminApi.overview(range), adminApi.users(range)])
      .then(([overview, users]) => {
        if (cancelled) return
        loaded.current = true
        setState({ kind: 'ready', data: { overview, users } })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 403) setState({ kind: 'forbidden' })
        else if (err instanceof ApiError && err.status === 401) setState({ kind: 'guest' })
        else {
          const message = err instanceof ApiError ? err.message : '連線失敗，請檢查網路後再試一次'
          // 換篩選時失敗:留在儀表板(保留上一次的資料與篩選按鈕),只在篩選旁顯示錯誤
          if (loaded.current) setRefreshError(message)
          else setState({ kind: 'error', message })
        }
      })
      .finally(() => !cancelled && setRefreshing(false))
    return () => {
      cancelled = true
    }
  }, [auth.status, range])

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
        {state.kind === 'ready' && (
          <>
            <div className={styles.ranges} role="group" aria-label="時間範圍">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={styles.range}
                  aria-pressed={range === r.value}
                  disabled={refreshing}
                  onClick={() => setRange(r.value)}
                >
                  {r.label}
                </button>
              ))}
              {refreshing && <span className={styles.muted}>更新中…</span>}
              {refreshError && <span className={styles.rangeError}>{refreshError}（目前顯示的是上一次的資料）</span>}
            </div>
            <Dashboard data={state.data} filtered={range !== ''} />
          </>
        )}
    </div>
  )
}

function Dashboard({ data, filtered }: { data: Data; filtered: boolean }) {
  const { overview, users } = data
  return (
    <>
      <div className={styles.stats}>
        <Stat label={filtered ? '新會員' : '會員數'} value={overview.users} />
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

      <SchemaPanel />
    </>
  )
}

/** 資料庫結構檢查:程式的資料表定義和資料庫實際的欄位、主鍵對不對得上,有沒有遺留表(AutoMigrate 不會處理改名、刪欄位、改主鍵) */
function SchemaPanel() {
  const [report, setReport] = useState<SchemaReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const check = () => {
    setError(null)
    adminApi
      .schemaCheck()
      .then(setReport)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }
  useEffect(check, [])
  const problems = report?.tables.filter((t) => !t.ok) ?? []
  return (
    <>
      <h2 className={styles.heading}>
        資料庫結構檢查{' '}
        <button type="button" onClick={check}>
          重新檢查
        </button>
      </h2>
      {error ? (
        <p className={styles.note}>檢查失敗：{error}</p>
      ) : !report ? (
        <p className={styles.note}>檢查中…</p>
      ) : report.ok ? (
        <p className={styles.note}>{report.tables.length} 張表都和程式的定義一致，沒有遺留表。</p>
      ) : (
        <ul>
          {problems.map((t) => (
            <li key={t.table}>
              <code>{t.table}</code>
              {t.missing?.length ? `：缺少欄位 ${t.missing.join('、')}` : ''}
              {t.extra?.length ? `：多出欄位 ${t.extra.join('、')}` : ''}
              {t.primaryKey ? `：主鍵應為 ${t.primaryKey.expected.join('+')}，實際是 ${t.primaryKey.actual.join('+') || '（沒有）'}` : ''}
            </li>
          ))}
          {report.orphans.map((t) => (
            <li key={t}>
              <code>{t}</code>：遺留表（程式裡已經沒有這張表的定義）
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function LessonName({ lesson }: { lesson: string }) {
  return (
    <>
      {isHomeShowcase(lesson) && <span className={styles.tag} title="2026-11-09 前在首頁,之後在展示頁 /showcase">展示影片</span>}
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
                    <td>{l.guestReady ? formatMs(l.guestReadyAvgMs) : '—'}</td>
                    <td>{l.guestBots}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <HomePaths paths={g.homePaths ?? []} total={g.homeVisits ?? 0} />
      <HomeStays stays={g.homeStays ?? []} />
      <IdleVisits visits={g.idleVisits ?? []} />
      {gates.length > 0 && (
        <div className={styles.breakdown}>
          <CountList title="看到登入門檻（訪客打開要登入的課）" items={gates.map((l) => ({ name: l.lesson.slice('gate:'.length), count: l.guestTracked }))} />
        </div>
      )}
      <LoginFunnel login={g.login} />
    </>
  )
}

/** 載入時間:不到 1 秒用毫秒,其餘用秒(一位小數) */
const formatMs = (ms: number): string => (ms < 1000 ? `${ms} 毫秒` : `${(ms / 1000).toFixed(1)} 秒`)

const LOGIN_OUTCOME: Record<string, string> = {
  signin: 'Email 登入成功',
  register: 'Email 註冊成功',
  google: 'Google 登入成功',
  failed: '試過但失敗，沒有登入',
  left: '沒有登入就離開',
}

/** 訪客打開登入／註冊頁:結果、登入後要去哪裡、看到的錯誤訊息 */
function LoginFunnel({ login }: { login?: LoginStats }) {
  if (!login?.visits) return null
  const ok = login.outcomes.filter((c) => c.name === 'signin' || c.name === 'register' || c.name === 'google').reduce((n, c) => n + c.count, 0)
  return (
    <>
      <h3 className={`${styles.subheading} ${styles.section}`}>
        登入／註冊頁（訪客打開 {login.visits} 次，登入或註冊成功 {ok} 次，{pct(ok, login.visits)}）
      </h3>
      <div className={styles.breakdown}>
        <CountList title="結果" items={login.outcomes} label={LOGIN_OUTCOME} />
        <CountList title="登入後要去哪裡" items={login.next} label={{ '/': '沒有指定（直接打開登入頁）' }} />
        <CountList title="看到的錯誤訊息" items={login.fails} empty="沒有" />
      </div>
      {(login.googleReady > 0 || login.googleFailed > 0) && (
        <>
          <p className={styles.note}>
            Google 登入按鈕：畫好 {login.googleReady} 次，從打開登入頁到畫好平均 {login.googleReady ? formatMs(login.googleReadyAvgMs) : '—'}；載入失敗 {login.googleFailed} 次。
          </p>
          {login.googleFailed > 0 && (
            <div className={styles.breakdown}>
              <CountList title="Google 按鈕載入失敗的原因" items={login.googleErrors} />
            </div>
          )}
        </>
      )}
    </>
  )
}

const PAGE_NAME: Record<string, string> = {
  '/login': '登入／註冊頁',
  '/': '首頁',
  '/showcase': '展示頁',
  [SOFTWARE_TOPIC.path]: `${SOFTWARE_TOPIC.name}（地圖）`,
  [AI_APPS_TOPIC.path]: `${AI_APPS_TOPIC.name}（地圖）`,
  [CLAUDE_CODE_TOPIC.path]: `${CLAUDE_CODE_TOPIC.name}（地圖）`,
  [KIDS_TOPIC.path]: `${KIDS_TOPIC.name}（地圖）`,
  [WEB_TOPIC.path]: `${WEB_TOPIC.name}（地圖）`,
  [LAUNCH_TOPIC.path]: `${LAUNCH_TOPIC.name}（地圖）`,
  [IDEA_TOPIC.path]: `${IDEA_TOPIC.name}（地圖）`,
  [SOFTWARE_TOPIC.topicPath]: `${SOFTWARE_TOPIC.name}（主題）`,
  [AI_APPS_TOPIC.topicPath]: `${AI_APPS_TOPIC.name}（主題）`,
  [CLAUDE_CODE_TOPIC.topicPath]: `${CLAUDE_CODE_TOPIC.name}（主題）`,
  [KIDS_TOPIC.topicPath]: `${KIDS_TOPIC.name}（主題）`,
  [WEB_TOPIC.topicPath]: `${WEB_TOPIC.name}（主題）`,
  [LAUNCH_TOPIC.topicPath]: `${LAUNCH_TOPIC.name}（主題）`,
  [IDEA_TOPIC.topicPath]: `${IDEA_TOPIC.name}（主題）`,
  // 這幾課還沒開放時,訪客看到的是提示頁(LaunchLessonPage 的 Notice),記成 page:<網址>
  ...Object.fromEntries(LAUNCH_LESSON_PAGES.map((id) => [launchLessonPath(id), `上線課 ${id}（還沒開放）`])),
}
const LESSON_NAME: Record<string, string> = {
  ...Object.fromEntries(Object.entries(WEB_OPEN_LESSONS).map(([id, l]) => [`live:${l.script}`, `網頁課 ${id}`])),
  ...Object.fromEntries(Object.entries(KIDS_OPEN_LESSONS).map(([id, l]) => [`kids:${l.script}`, `兒童課 ${id}`])),
  ...Object.fromEntries(LAUNCH_LESSON_PAGES.map((id) => [launchScriptKey(id), `上線課 ${id}`])),
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
  if (isHomeShowcase(lesson)) return '展示影片'
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

/** 每個訪客在首頁停留多久:最近來過的在前 */
function HomeStays({ stays }: { stays: HomeStay[] }) {
  if (!stays.length) return null
  return (
    <>
      <h3 className={`${styles.subheading} ${styles.section}`}>每個訪客在首頁停留多久（最近 {stays.length} 人）</h3>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>最後造訪</th>
              <th>訪客</th>
              <th>裝置／來源</th>
              <th>次數</th>
              <th>停留合計</th>
              <th>最長一次</th>
              <th>捲到</th>
            </tr>
          </thead>
          <tbody>
            {stays.map((s, i) => (
              <tr key={i}>
                <td>{formatDateTime(s.lastOpened)}</td>
                <td>
                  <code>{s.guest}</code>
                </td>
                <td>
                  {DEVICE_LABEL[s.device] ?? s.device}
                  <br />
                  <small className={styles.muted}>{SOURCE_LABEL[s.source] ?? (s.source || '—')}</small>
                </td>
                <td>{s.visits}</td>
                <td>{formatDuration(s.totalMs)}</td>
                <td>{formatDuration(s.longestMs)}</td>
                <td>{s.maxScroll ? `${s.maxScroll}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
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
                <td>{v.loadError ? <span title={v.loadError}>失敗</span> : v.readyMs ? formatMs(v.readyMs) : isGate(v.lesson) ? '—' : '沒載入完'}</td>
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
