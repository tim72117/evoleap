import { useAuth } from './AuthContext'
import styles from './UserMenu.module.css'

// 頭像選單(帳號選單 UserMenu、兒童模式的膠囊 KidsCapsule)裡的「開啟模擬／結束模擬」:只有真的管理員看得到。
// 開啟後頁面底部出現模擬膠囊(SimulationBanner),在那裡選要模擬的身分;判斷要看真實的登入狀態(real),模擬中畫面上的身分不是管理員。

export function SimulationMenuItems({ onPick }: { onPick?: () => void }) {
  const { real, simulating, openSimulation, closeSimulation } = useAuth()
  if (!real.user?.isAdmin) return null
  return (
    <button
      type="button"
      role="menuitem"
      className={styles.item}
      onClick={() => {
        if (simulating) closeSimulation()
        else openSimulation()
        onPick?.()
      }}
    >
      {simulating ? '結束模擬' : '開啟模擬'}
    </button>
  )
}
