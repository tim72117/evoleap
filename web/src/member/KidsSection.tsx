import { Fragment, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KIDS_OPEN_LESSONS, KIDS_RELEASED_LESSONS, kidsLessonTitle } from '../content/kidsCourse'
import { dateLabel, parentWeek } from '../kidsMode/plan'
import { kidsApi, type Child } from '../kidsMode/api'
import { KIDS_MODE_HOME, useKidsMode } from '../kidsMode/KidsModeContext'
import { DAYS, isFull, isPicked, MAX_PER_WEEK, MINUTES_OPTIONS, slotKey, sortSlots, TIMES, toggleSlot, type Slot } from '../kidsMode/schedule'
import styles from './member.module.css'
import kids from './KidsSection.module.css'

// 會員空間「兒童」分頁(粗略版):家長設定兒童(暱稱、每週上課時段,最多 3 堂),並在這台裝置開啟兒童模式讓孩子上課。
// 每次上課多久也由家長設定(最長 60 分鐘)。兒童模式下只顯示兒童課程,只有排入的時段打得開(伺服器判斷,台灣時間)。規則見 server/internal/store/kids.go。

/** 看完的兒童課與看完的時間(每個孩子自己的上課紀錄,GET /api/kids/children/{id}/lessons) */
type Finished = { lessonId: string; at: Date }

/** 上課紀錄的 kids:<腳本> 換成課號 */
const LESSON_BY_KEY = new Map(Object.entries(KIDS_OPEN_LESSONS).map(([id, l]) => [`kids:${l.script}`, id]))

export function KidsSection() {
  const [children, setChildren] = useState<Child[] | null>(null)
  const [avatars, setAvatars] = useState<string[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    kidsApi.children().then(
      (r) => {
        setChildren(r.children)
        setAvatars(r.avatars)
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    )
  useEffect(() => {
    void load()
  }, [])

  const add = async () => {
    setBusy(true)
    setError('')
    try {
      const c = await kidsApi.createChild(name)
      setChildren((list) => [...(list ?? []), c])
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className={styles.panel} aria-labelledby="kids-title">
        <h2 id="kids-title" className={styles.panelTitle}>
          兒童
        </h2>
        <p className={styles.muted}>
          替孩子排每週的上課時間（最多 {MAX_PER_WEEK} 堂），再按「開啟兒童模式」把這台裝置交給孩子：畫面只會有兒童課程，而且只有在排好的時段（台灣時間）才能上課，每次上課多久也由你決定（最長 60 分鐘）。按右上角的孩子頭像就能離開兒童模式。
        </p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <form
          className={kids.add}
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy && name.trim()) void add()
          }}
        >
          <div className={styles.field}>
            <label htmlFor="kid-name">孩子的暱稱</label>
            <input id="kid-name" value={name} maxLength={20} placeholder="例如：小花" onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className={styles.primary} disabled={busy || !name.trim()}>
            新增
          </button>
        </form>
      </section>
      {children === null ? (
        <p className={styles.muted}>讀取中…</p>
      ) : children.length === 0 ? (
        <p className={styles.muted}>還沒有設定孩子。</p>
      ) : (
        children.map((c) => (
          <ChildCard
            key={c.id}
            child={c}
            onChange={(next) => setChildren((list) => (list ?? []).map((x) => (x.id === next.id ? next : x)))}
            onDelete={() => setChildren((list) => (list ?? []).filter((x) => x.id !== c.id))}
            avatars={avatars}
          />
        ))
      )}
    </>
  )
}

function ChildCard({ child, avatars, onChange, onDelete }: { child: Child; avatars: string[]; onChange: (c: Child) => void; onDelete: () => void }) {
  const [picking, setPicking] = useState(false)
  // 這個孩子自己的上課紀錄(每個孩子分開)
  const [records, setRecords] = useState<Finished[]>([])
  useEffect(() => {
    let cancelled = false
    kidsApi.lessons(child.id).then(
      (list) =>
        !cancelled &&
        setRecords(list.flatMap((x) => (LESSON_BY_KEY.has(x.lesson) ? [{ lessonId: LESSON_BY_KEY.get(x.lesson)!, at: new Date(x.finishedAt) }] : []))),
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [child.id])
  const { start } = useKidsMode()
  const navigate = useNavigate()
  const [picked, setPicked] = useState<Slot[]>(() => sortSlots(child.slots))
  const [minutes, setMinutes] = useState(child.minutes)
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'starting'>('')
  const [error, setError] = useState('')
  const dirty = picked.map(slotKey).join() !== sortSlots(child.slots).map(slotKey).join() || minutes !== child.minutes
  const full = isFull(picked)

  const run = async (s: typeof status, f: () => Promise<void>) => {
    setStatus(s)
    setError('')
    try {
      await f()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('')
    }
  }

  return (
    <section className={styles.panel} aria-label={`${child.name} 的上課時間`}>
      <div className={kids.head}>
        <h3 className={`${styles.panelTitle} ${kids.title}`}>
          <span className={kids.avatar} aria-hidden="true">
            {child.avatar}
          </span>
          {child.name}
        </h3>
        <button type="button" className={kids.change} aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
          {picking ? '收起' : '換頭像'}
        </button>
        <span className={kids.count}>
          已排 {picked.length}／{MAX_PER_WEEK} 堂
        </span>
      </div>
      {picking ? (
        <div className={kids.avatars} role="radiogroup" aria-label={`${child.name} 的頭像`}>
          {avatars.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={a === child.avatar}
              aria-label={`頭像 ${a}`}
              className={a === child.avatar ? `${kids.avatarPick} ${kids.on}` : kids.avatarPick}
              onClick={() =>
                run('', async () => {
                  onChange(await kidsApi.updateChild(child.id, { avatar: a }))
                  setPicking(false)
                })
              }
            >
              {a}
            </button>
          ))}
        </div>
      ) : null}
      <div className={kids.minutes}>
        <label htmlFor={`kid-minutes-${child.id}`}>每次上課</label>
        <select
          id={`kid-minutes-${child.id}`}
          value={minutes}
          onChange={(e) => {
            setMinutes(Number(e.target.value))
            setStatus('')
          }}
        >
          {/* 之前存過選單以外的長度(伺服器接受 5 到 60 分鐘、5 的倍數)也列出來,選單才對得上 */}
          {((MINUTES_OPTIONS as readonly number[]).includes(minutes) ? MINUTES_OPTIONS : [...MINUTES_OPTIONS, minutes].sort((a, b) => a - b)).map((m) => (
            <option key={m} value={m}>
              {m} 分鐘
            </option>
          ))}
        </select>
        <span className={kids.hint}>從排好的時間開始，過了就不能上</span>
      </div>
      {/* 一週的課表:每一列是一個時間,每一欄是星期幾 */}
      <div className={kids.week} role="group" aria-label={`${child.name} 一週的上課時段`}>
        <span className={kids.corner} aria-hidden="true" />
        {DAYS.map((day) => (
          <span key={day} className={kids.dayName} aria-hidden="true">
            {day}
          </span>
        ))}
        {TIMES.map((time) => (
          <Fragment key={time}>
            <span className={kids.timeName} aria-hidden="true">
              {time}
            </span>
            {DAYS.map((day, d) => {
              const s = { day: d, time }
              const on = isPicked(picked, s)
              const blocked = full && !on
              return (
                <button
                  key={day}
                  type="button"
                  className={on ? `${kids.slot} ${kids.on}` : kids.slot}
                  aria-pressed={on}
                  aria-disabled={blocked}
                  aria-label={`${day} ${time}${on ? '，已排' : ''}`}
                  title={blocked ? `已排滿 ${MAX_PER_WEEK} 堂，先取消一堂才能換` : `${day} ${time}`}
                  onClick={() => {
                    if (blocked) return
                    setPicked((p) => toggleSlot(p, s))
                    setStatus('')
                  }}
                >
                  {on ? '✓' : ''}
                </button>
              )
            })}
          </Fragment>
        ))}
      </div>
      <WeekList child={child} records={records} />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={kids.actions}>
        <button
          type="button"
          className={`${styles.secondary} ${kids.save}`}
          disabled={!dirty || status === 'saving'}
          aria-busy={status === 'saving'}
          title={!dirty && status !== 'saving' ? '沒有要儲存的變更' : undefined}
          onClick={() =>
            run('saving', async () => {
              onChange(await kidsApi.updateChild(child.id, { slots: picked, minutes }))
              setStatus('saved')
            })
          }
        >
          {status === 'saving' ? '儲存中…' : '儲存上課設定'}
        </button>
        {status === 'saved' ? <span className={styles.saved}>已儲存</span> : null}
        <button
          type="button"
          className={styles.primary}
          disabled={dirty || status === 'starting' || child.slots.length === 0}
          title={dirty ? '先儲存上課設定' : child.slots.length === 0 ? '先排上課時間' : undefined}
          onClick={() =>
            run('starting', async () => {
              await start(child.id)
              navigate(KIDS_MODE_HOME)
            })
          }
        >
          {status === 'starting' ? '開啟中…' : '開啟兒童模式'}
        </button>
        <button
          type="button"
          className={kids.remove}
          onClick={() => {
            if (!window.confirm(`刪掉「${child.name}」和他的上課時間？`)) return
            void run('', async () => {
              await kidsApi.deleteChild(child.id)
              onDelete()
            })
          }}
        >
          刪除
        </button>
      </div>
    </section>
  )
}

/** 這週的課(照已儲存的時段):每一次上課的實際日期,上完的課與最近一次要上的課,點課名打開那一課 */
function WeekList({ child, records }: { child: Child; records: Finished[] }) {
  if (child.slots.length === 0) return null
  const rows = parentWeek(child.slots, child.minutes, new Date(), KIDS_RELEASED_LESSONS, records)
  const lesson = (id: string) => (
    <Link to={KIDS_OPEN_LESSONS[id].path}>
      {id} {kidsLessonTitle(id)}
    </Link>
  )
  return (
    <div className={kids.weekList}>
      <h4>這週的課</h4>
      <ol>
        {rows.map((r) => (
          <li key={r.start.toISOString()} className={kids[r.state]}>
            <span className={kids.date}>
              {dateLabel(r.start)} {r.slot.time}
            </span>
            <span className={kids.what}>
              {r.finished.length ? (
                <span className={kids.part}>
                  <span className={kids.doneTag}>✓ 已上完</span>
                  {r.finished.map((id, i) => (
                    <span key={id}>
                      {i ? '、' : ''}
                      {lesson(id)}
                    </span>
                  ))}
                </span>
              ) : null}
              {r.lessonId ? (
                <span className={kids.part}>
                  <span className={kids.nextTag}>{r.state === 'next' ? '下一堂' : r.finished.length ? '接著上' : '上課中'}</span>
                  {lesson(r.lessonId)}
                </span>
              ) : r.finished.length ? null : r.state === 'done' ? (
                <span className={kids.muted}>沒有上課</span>
              ) : r.state === 'later' ? (
                <span className={kids.muted}>依進度安排</span>
              ) : (
                <span className={kids.muted}>已開放的課都上完了</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
