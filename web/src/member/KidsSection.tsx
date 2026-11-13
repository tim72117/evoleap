import { Fragment, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KIDS_OPEN_LESSONS, kidsLessonTitle } from '../content/kidsCourse'
import { dateLabel, parentWeek } from '../kidsMode/plan'
import { kidsApi, type Child } from '../kidsMode/api'
import { KIDS_MODE_HOME, useKidsMode } from '../kidsMode/KidsModeContext'
import { useKidsReleased } from '../kidsMode/progress'
import { useLocale, useT } from '../i18n/I18nProvider'
import { isFull, isPicked, MAX_PER_WEEK, MINUTES_OPTIONS, slotKey, sortSlots, TIMES, toggleSlot, type Slot } from '../kidsMode/schedule'
import styles from './member.module.css'
import kids from './KidsSection.module.css'

// 會員空間「兒童」分頁(粗略版):家長設定兒童(暱稱、每週上課時段,最多 3 堂),並在這台裝置開啟兒童模式讓孩子上課。
// 每次上課多久也由家長設定(最長 60 分鐘)。兒童模式下只顯示兒童課程,只有排入的時段打得開(伺服器判斷,台灣時間)。規則見 server/internal/store/kids.go。

/** 一個家長帳號最多幾個孩子(同 server/internal/store/kids.go 的 MaxChildren) */
const MAX_CHILDREN = 5

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
  const k = useT().member.kids

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
          {k.title}
        </h2>
        <p className={styles.muted}>
          {k.intro(MAX_PER_WEEK)}
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
            <label htmlFor="kid-name">{k.nickname}</label>
            <input id="kid-name" value={name} maxLength={20} placeholder={k.nicknamePlaceholder} onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className={styles.primary} disabled={busy || !name.trim()}>
            {k.add}
          </button>
        </form>
      </section>
      <PairPanel
        unpaired={(children ?? []).filter((c) => !c.paired)}
        full={(children ?? []).length >= MAX_CHILDREN}
        onPaired={(c, replaced) => setChildren((list) => (replaced ? (list ?? []).map((x) => (x.id === c.id ? c : x)) : [...(list ?? []), c]))}
      />
      {children === null ? (
        <p className={styles.muted}>{k.loading}</p>
      ) : children.length === 0 ? (
        <p className={styles.muted}>{k.none}</p>
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
      {/* 這個帳號是小朋友的:沒有自己的孩子時才列出產生配對碼 */}
      {children !== null && children.length === 0 ? <PairCodePanel /> : null}
    </>
  )
}

function ChildCard({ child, avatars, onChange, onDelete }: { child: Child; avatars: string[]; onChange: (c: Child) => void; onDelete: () => void }) {
  const [picking, setPicking] = useState(false)
  const t = useT()
  const k = t.member.kids
  const days = t.kidsMode.days
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
    <section className={styles.panel} aria-label={k.scheduleOf(child.name)}>
      <div className={kids.head}>
        <h3 className={`${styles.panelTitle} ${kids.title}`}>
          <span className={kids.avatar} aria-hidden="true">
            {child.avatar}
          </span>
          {child.name}
        </h3>
        <button type="button" className={kids.change} aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
          {picking ? k.collapse : k.changeAvatar}
        </button>
        <span className={kids.count}>
          {k.count(picked.length, MAX_PER_WEEK)}
        </span>
        {child.paired ? (
          <p className={kids.paired}>
            🔗 已配對孩子的帳號：<strong>{child.accountLabel ?? '已配對的帳號'}</strong>。孩子用那個帳號登入就是兒童模式，只能在排好的時段上兒童課。
          </p>
        ) : null}
      </div>
      {picking ? (
        <div className={kids.avatars} role="radiogroup" aria-label={k.avatarsOf(child.name)}>
          {avatars.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={a === child.avatar}
              aria-label={k.avatar(a)}
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
        <label htmlFor={`kid-minutes-${child.id}`}>{k.perClass}</label>
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
              {k.minutes(m)}
            </option>
          ))}
        </select>
        <span className={kids.hint}>{k.minutesHint}</span>
      </div>
      {/* 一週的課表:每一列是一個時間,每一欄是星期幾 */}
      <div className={kids.week} role="group" aria-label={k.weekOf(child.name)}>
        <span className={kids.corner} aria-hidden="true" />
        {days.map((day) => (
          <span key={day} className={kids.dayName} aria-hidden="true">
            {day}
          </span>
        ))}
        {TIMES.map((time) => (
          <Fragment key={time}>
            <span className={kids.timeName} aria-hidden="true">
              {time}
            </span>
            {days.map((day, d) => {
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
                  aria-label={`${day} ${time}${on ? k.slotPicked : ''}`}
                  title={blocked ? k.full(MAX_PER_WEEK) : `${day} ${time}`}
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
          title={!dirty && status !== 'saving' ? k.noChanges : undefined}
          onClick={() =>
            run('saving', async () => {
              onChange(await kidsApi.updateChild(child.id, { slots: picked, minutes }))
              setStatus('saved')
            })
          }
        >
          {status === 'saving' ? k.saving : k.save}
        </button>
        {status === 'saved' ? <span className={styles.saved}>{k.saved}</span> : null}
        <button
          type="button"
          className={styles.primary}
          disabled={dirty || status === 'starting' || child.slots.length === 0}
          title={dirty ? k.saveFirst : child.slots.length === 0 ? k.pickFirst : undefined}
          onClick={() =>
            run('starting', async () => {
              await start(child.id)
              navigate(KIDS_MODE_HOME)
            })
          }
        >
          {status === 'starting' ? k.starting : k.start}
        </button>
        {child.paired ? (
          <button
            type="button"
            className={kids.remove}
            onClick={() => {
              if (!window.confirm(`解除「${child.name}」和帳號「${child.accountLabel ?? ''}」的配對？孩子的帳號會回到一般帳號，孩子的進度與上課時間還留著。`)) return
              void run('', async () => {
                await kidsApi.unpair(child.id)
                onChange({ ...child, paired: false, accountLabel: undefined })
              })
            }}
          >
            解除配對
          </button>
        ) : null}
        <button
          type="button"
          className={kids.remove}
          onClick={() => {
            if (!window.confirm(k.confirmDelete(child.name))) return
            void run('', async () => {
              await kidsApi.deleteChild(child.id)
              onDelete()
            })
          }}
        >
          {k.delete}
        </button>
      </div>
    </section>
  )
}

/** 這週的課(照已儲存的時段):每一次上課的實際日期,上完的課與最近一次要上的課,點課名打開那一課 */
function WeekList({ child, records }: { child: Child; records: Finished[] }) {
  const k = useT().member.kids
  const { locale } = useLocale()
  const released = useKidsReleased()
  if (child.slots.length === 0 || !released) return null
  const rows = parentWeek(child.slots, child.minutes, new Date(), released, records)
  const lesson = (id: string) => (
    <Link to={KIDS_OPEN_LESSONS[id].path}>
      {id} {kidsLessonTitle(id)}
    </Link>
  )
  return (
    <div className={kids.weekList}>
      <h4>{k.thisWeek}</h4>
      <ol>
        {rows.map((r) => (
          <li key={r.start.toISOString()} className={kids[r.state]}>
            <span className={kids.date}>
              {dateLabel(r.start, locale)} {r.slot.time}
            </span>
            <span className={kids.what}>
              {r.finished.length ? (
                <span className={kids.part}>
                  <span className={kids.doneTag}>{k.done}</span>
                  {r.finished.map((id, i) => (
                    <span key={id}>
                      {i ? k.listSep : ''}
                      {lesson(id)}
                    </span>
                  ))}
                </span>
              ) : null}
              {r.lessonId ? (
                <span className={kids.part}>
                  <span className={kids.nextTag}>{r.state === 'next' ? k.next : r.finished.length ? k.continue : k.inClass}</span>
                  {lesson(r.lessonId)}
                </span>
              ) : r.finished.length ? null : r.state === 'done' ? (
                <span className={kids.muted}>{k.missed}</span>
              ) : r.state === 'later' ? (
                <span className={kids.muted}>{k.later}</span>
              ) : (
                <span className={kids.muted}>{k.allDone}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 家長:輸入孩子(已經有自己帳號)產生的配對碼,配成新的孩子,或接到還沒配對的孩子 */
function PairPanel({ unpaired, full, onPaired }: { unpaired: Child[]; full: boolean; onPaired: (c: Child, replaced: boolean) => void }) {
  const [code, setCode] = useState('')
  const [target, setTarget] = useState('') // 空白 = 新增一個孩子
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const newDisabled = full
  // 孩子滿了時只能接到既有的孩子;選的孩子不見了(例如剛配對完)回到預設
  const chosen = target && unpaired.some((c) => c.id === target) ? target : newDisabled ? (unpaired[0]?.id ?? '') : ''
  const ready = /^\d{6}$/.test(code) && !busy && (chosen !== '' || !newDisabled)

  return (
    <section className={styles.panel} aria-labelledby="kids-pair-title">
      <h2 id="kids-pair-title" className={styles.panelTitle}>
        配對已經有帳號的孩子
      </h2>
      <p className={styles.muted}>
        孩子已經有自己的帳號時，請孩子登入自己的帳號，到會員空間的「兒童」分頁按「產生配對碼」，再把 6 位數的配對碼輸入這裡（10 分鐘內有效、只能用一次）。配對後孩子用自己的帳號登入就是兒童模式：只有兒童課，只在你排好的時段能上，孩子原本在兒童課的進度會一起併進來。
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className={styles.saved} role="status">
          {done}
        </p>
      ) : null}
      <form
        className={kids.add}
        onSubmit={(e) => {
          e.preventDefault()
          if (!ready) return
          setBusy(true)
          setError('')
          setDone('')
          kidsApi.pair(code, chosen || undefined).then(
            (c) => {
              onPaired(c, chosen !== '')
              setCode('')
              setTarget('')
              setDone(`已配對：${c.name}${c.accountLabel && c.accountLabel !== c.name ? `（${c.accountLabel}）` : ''}。接著替他排上課時段。`)
              setBusy(false)
            },
            (err: unknown) => {
              setError(err instanceof Error ? err.message : String(err))
              setBusy(false)
            },
          )
        }}
      >
        <div className={styles.field}>
          <label htmlFor="kid-pair-code">配對碼</label>
          <input
            id="kid-pair-code"
            value={code}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="6 位數"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="kid-pair-target">配給</label>
          <select id="kid-pair-target" value={chosen} onChange={(e) => setTarget(e.target.value)}>
            <option value="" disabled={newDisabled}>
              新增一個孩子
            </option>
            {unpaired.map((c) => (
              <option key={c.id} value={c.id}>
                接到「{c.name}」
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={styles.primary} disabled={!ready}>
          {busy ? '配對中…' : '配對'}
        </button>
      </form>
    </section>
  )
}

/** 孩子(這個帳號是小朋友的):產生配對碼,給家長輸入;顯示剩下的有效時間 */
function PairCodePanel() {
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null)
  const [left, setLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    const tick = () => setLeft(Math.max(0, Math.round((code.expiresAt - Date.now()) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [code])

  const expired = code !== null && left === 0
  return (
    <section className={styles.panel} aria-labelledby="kids-code-title">
      <h2 id="kids-code-title" className={styles.panelTitle}>
        我是小朋友，要讓家長配對
      </h2>
      <p className={styles.muted}>
        如果這個帳號是小朋友自己的，按「產生配對碼」，再請家長用自己的帳號，在會員空間的「兒童」分頁輸入這組 6 位數的配對碼。配對之後，這個帳號會變成兒童模式：只有兒童課，而且只在家長排好的時段能上。
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {code && !expired ? (
        <p className={kids.code} role="status" aria-label={`配對碼 ${code.code.split('').join(' ')}`}>
          <strong>{code.code}</strong>
          <span>
            還有 {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} 有效
          </span>
        </p>
      ) : null}
      {expired ? <p className={styles.muted}>配對碼已經過期，請再產生一組。</p> : null}
      <button
        type="button"
        className={styles.secondary}
        disabled={busy}
        onClick={() => {
          setBusy(true)
          setError('')
          kidsApi.pairCode().then(
            (r) => {
              setCode({ code: r.code, expiresAt: new Date(r.expiresAt).getTime() })
              setBusy(false)
            },
            (e: unknown) => {
              setError(e instanceof Error ? e.message : String(e))
              setBusy(false)
            },
          )
        }}
      >
        {busy ? '產生中…' : code && !expired ? '重新產生' : '產生配對碼'}
      </button>
    </section>
  )
}
