import { useState } from 'react'
import { DAYS, isFull, isPicked, MAX_PER_WEEK, slotKey, slotLabel, TIMES, toggleSlot, type Slot } from './kidsSchedule'
import styles from './KidsSchedulePlanner.module.css'
import ui from './proposal.module.css'

// 兒童課家長模式的排課畫面(試作):列出一週七天的時段,家長點選排入,每週最多 3 堂。
// 只在畫面上操作,不會存進資料庫;規則在 kidsSchedule.ts。廣告框是示意家長設定畫面上廣告的位置。

export function KidsSchedulePlanner() {
  const [picked, setPicked] = useState<Slot[]>([])
  const [saved, setSaved] = useState<Slot[] | null>(null)
  const full = isFull(picked)
  const dirty = saved == null ? picked.length > 0 : saved.map(slotKey).join() !== picked.map(slotKey).join()

  const toggle = (s: Slot): void => setPicked((p) => toggleSlot(p, s))

  const status = picked.length === 0
    ? `還沒排課。從下面的一週時間點選時段，每週最多 ${MAX_PER_WEEK} 堂。`
    : full
      ? `已排滿 ${MAX_PER_WEEK} 堂。要換時段，先取消其中一堂。`
      : `還可以再排 ${MAX_PER_WEEK - picked.length} 堂。`

  return (
    <section className={ui.card}>
      <div className={ui['card-head']}>
        <div>
          <h3>孩子這週的上課時間</h3>
          <div className={ui.meta}>每堂上一課（約 5–8 分鐘），依進度接著上</div>
        </div>
        <span className={`${ui.chip} ${full ? ui.done : ui.todo}`}>
          已排 {picked.length}／{MAX_PER_WEEK} 堂
        </span>
      </div>

      <div className={ui['card-body']}>
        <ol className={styles.picked} aria-label="已排的上課時間">
          {Array.from({ length: MAX_PER_WEEK }, (_, i) => {
            const s = picked[i]
            return (
              <li key={i} className={s ? styles.filled : styles.empty}>
                <span className={styles.nth}>第 {i + 1} 堂</span>
                {s ? (
                  <>
                    <strong>{slotLabel(s)}</strong>
                    <button type="button" className={styles.remove} onClick={() => toggle(s)} aria-label={`取消 ${slotLabel(s)}`} title="取消這一堂">
                      ×
                    </button>
                  </>
                ) : (
                  <span className={styles.placeholder}>未排</span>
                )}
              </li>
            )
          })}
        </ol>
        <p className={styles.status} aria-live="polite">
          {status}
        </p>

        <div className={styles.week} role="group" aria-label="一週的上課時段">
          {DAYS.map((day, d) => (
            <div key={day} className={`${styles.day} ${d >= 5 ? styles.weekend : ''}`}>
              <div className={styles['day-name']}>{day}</div>
              <div className={styles.times}>
                {TIMES.map((time) => {
                  const s = { day: d, time }
                  const on = isPicked(picked, s)
                  const blocked = full && !on
                  return (
                    <button
                      key={time}
                      type="button"
                      className={`${styles.slot} ${on ? styles.on : ''}`}
                      aria-pressed={on}
                      aria-disabled={blocked}
                      aria-label={`${day} ${time}${on ? '，已排' : ''}`}
                      title={blocked ? `已排滿 ${MAX_PER_WEEK} 堂，先取消一堂才能換` : undefined}
                      onClick={() => !blocked && toggle(s)}
                    >
                      {on && <span aria-hidden="true">✓ </span>}
                      {time}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.ad} aria-label="廣告位置示意">
          廣告位置（示意）：只出現在家長的設定畫面，孩子上課的畫面沒有廣告
        </div>
      </div>

      <div className={ui['card-foot']}>
        <span className={ui.count}>{saved ? `已儲存 ${saved.length} 堂（試作，不會寫入資料庫）` : '尚未儲存'}</span>
        <button type="button" className={styles.save} disabled={!dirty} onClick={() => setSaved(picked)}>
          儲存上課時間
        </button>
      </div>
    </section>
  )
}
