import { useRef, type KeyboardEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { SIMULATED_ROLES } from '../auth/simulationRoles'
import styles from './member.module.css'

// 管理員專用:用膠囊切換模擬的身分(訪客、註冊未訂閱、已訂閱),方便看不同人看到的畫面。
// 只改這個瀏覽器看到的畫面(全站的登入狀態與訂閱旗標),伺服器仍把你當管理員,重新整理分頁後保留、關掉分頁後回到本人。

export function SimulationSwitch() {
  const { simulation, setSimulation } = useAuth()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = SIMULATED_ROLES.find((r) => r.id === simulation)!

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const n = SIMULATED_ROLES.length
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n : -1
    if (to < 0) return
    e.preventDefault()
    setSimulation(SIMULATED_ROLES[to].id)
    refs.current[to]?.focus()
  }

  return (
    <section className={styles.panel} aria-labelledby="member-sim-title">
      <h2 id="member-sim-title" className={styles.panelTitle}>
        模擬身分
        <span className={styles.adminTag}>管理員專用</span>
      </h2>
      <div className={styles.capsule} role="radiogroup" aria-labelledby="member-sim-title">
        {SIMULATED_ROLES.map((r, i) => (
          <button
            key={r.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={simulation === r.id}
            tabIndex={simulation === r.id ? 0 : -1}
            className={simulation === r.id ? `${styles.capsuleItem} ${styles.capsuleActive}` : styles.capsuleItem}
            onClick={() => setSimulation(r.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className={styles.muted} role="status">
        {current.hint}。切換後到網站其他頁面看看；只改這個瀏覽器的畫面，伺服器仍把你當管理員。
      </p>
    </section>
  )
}
