import { useRef, type KeyboardEvent } from 'react'
import { useAuth } from './AuthContext'
import { roleLabel, SIMULATED_ROLES } from './simulationRoles'
import { useT } from '../i18n/I18nProvider'
import styles from './SimulationBanner.module.css'

// 管理員模擬身分時,每一頁底部的浮動膠囊:在這裡選要模擬的身分,也免得忘了自己正在模擬。剛開啟時是「管理員」(本人),
// 選其他身分才換畫面;右邊的「結束模擬」回到本人、收起膠囊。
// 從頭像選單的「開啟模擬」打開(auth/SimulationMenuItems)。

export function SimulationBanner() {
  const { simulation, setSimulation, simulating, closeSimulation } = useAuth()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const t = useT()
  if (!simulating) return null

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const n = SIMULATED_ROLES.length
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n : -1
    if (to < 0) return
    e.preventDefault()
    // 方向鍵在身分之間移動(管理員也是一個身分,不會結束模擬;結束要按右邊的「結束模擬」)
    setSimulation(SIMULATED_ROLES[to].id)
    refs.current[to]?.focus()
  }

  return (
    <div className={styles.banner}>
      {/* 呼吸燈:表示正在模擬(不寫字,螢幕閱讀器由 radiogroup 的名稱得知) */}
      <span className={styles.dot} aria-hidden="true" />
      <div className={styles.capsule} role="radiogroup" aria-label={t.auth.simulation.groupLabel}>
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
            {roleLabel(r.id, t)}
          </button>
        ))}
      </div>
      {/* 結束模擬:回到本人並收起膠囊(和身分分開,選「管理員」只是模擬成管理員本人) */}
      <button type="button" className={styles.close} onClick={closeSimulation}>
        {t.auth.simulation.end}
      </button>
    </div>
  )
}
