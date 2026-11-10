import { useRef, type KeyboardEvent } from 'react'
import { useAuth } from './AuthContext'
import { SIMULATED_ROLES } from './simulationRoles'
import styles from './SimulationBanner.module.css'

// 管理員模擬身分時,每一頁底部的浮動膠囊:免得忘了自己正在模擬,也能直接換成別的身分(選「管理員」就結束模擬)。
// 和會員空間的膠囊(member/SimulationSwitch)是同一組身分。

export function SimulationBanner() {
  const { simulation, setSimulation } = useAuth()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  if (simulation === 'admin') return null

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const n = SIMULATED_ROLES.length
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n : -1
    if (to < 0) return
    e.preventDefault()
    setSimulation(SIMULATED_ROLES[to].id)
    refs.current[to]?.focus()
  }

  return (
    <div className={styles.banner}>
      {/* 呼吸燈:表示正在模擬(不寫字,螢幕閱讀器由 radiogroup 的名稱得知) */}
      <span className={styles.dot} aria-hidden="true" />
      <div className={styles.capsule} role="radiogroup" aria-label="模擬中的身分">
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
            className={simulation === r.id ? `${styles.item} ${styles.active}` : styles.item}
            onClick={() => setSimulation(r.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {r.id === 'admin' ? '結束模擬' : r.label}
          </button>
        ))}
      </div>
    </div>
  )
}
