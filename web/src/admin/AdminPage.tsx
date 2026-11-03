import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { ApiError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { adminApi, type AdminOverview, type AdminUser, type UserProgress } from './api'
import { ADMIN_PATH } from './paths'
import { formatDateTime, formatDuration, percentOf } from './format'
import styles from './AdminPage.module.css'

// 管理後台:會員列表與播放進度概況。權限由伺服器判定(Email 白名單),
// 這裡只負責呈現;非管理員打 API 會得到 403,顯示「沒有權限」。

type Data = { overview: AdminOverview; users: AdminUser[] }
type State =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: Data }

export function AdminPage() {
  const auth = useAuth()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (auth.status === 'loading') return
    if (auth.status !== 'user') {
      setState({ kind: 'guest' })
      return
    }
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
    <SiteLayout title="管理後台">
      <div className={styles.wrap}>
        <h1 className={styles.title}>管理後台</h1>
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
    </SiteLayout>
  )
}

function Dashboard({ data }: { data: Data }) {
  const { overview, users } = data
  return (
    <>
      <div className={styles.stats}>
        <Stat label="會員數" value={overview.users} />
        <Stat label="有播放紀錄" value={overview.activeUsers} />
        <Stat label="有人學習的課" value={overview.lessons.length} />
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
              </tr>
            </thead>
            <tbody>
              {overview.lessons.map((l) => (
                <tr key={l.lesson}>
                  <td>{l.lesson}</td>
                  <td>{l.learners}</td>
                  <td>{l.completed}</td>
                  <td>{Math.round(l.avgPercent)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={styles.heading}>會員列表（{users.length}）</h2>
      <UserTable users={users} />
    </>
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
