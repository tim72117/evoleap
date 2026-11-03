import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { COURSES } from '../../content/catalog'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'
import { buildSeed, moveCourse, moveSegment, nudge, reconcile, staleIds, type CourseMap, type MapCourse } from './courseMap'
import styles from './CourseMapPage.module.css'

// 課程編排:程度 → 課程 → 段落的看板,拖曳後立刻存到 course-map.json(經由 vite.config.ts 的開發伺服器 API)。
// 這裡只改編排草稿,不會動到 src/content/ 的單課資料;正式站沒有存檔 API,只顯示說明。

const API = '/__studio/course-map'
const FILE = 'web/src/studio/materials/course-map.json'

type Kind = 'segment' | 'course'
type Drag = { kind: Kind; id: string }
/** 放下的位置:目的清單(課程或程度)的 id 與插入位置 */
type Target = { parent: string; index: number }
type Status = { state: 'idle' | 'saving' | 'saved'; at?: string } | { state: 'error'; message: string }

/** 滑鼠在元素上半部就插到前面,下半部插到後面 */
function indexByPointer(e: DragEvent<HTMLElement>, index: number): number {
  const rect = e.currentTarget.getBoundingClientRect()
  return e.clientY < rect.top + rect.height / 2 ? index : index + 1
}

export function CourseMapPage() {
  const seed = useMemo(() => buildSeed(COURSES), [])
  const [map, setMap] = useState<CourseMap | null>(null)
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<CourseMap[]>([])
  const rev = useRef<string | null>(null)
  const pending = useRef<CourseMap | null>(null)
  const saving = useRef(false)
  const focusId = useRef<string | null>(null)
  const dragging = useRef(false)
  const opened = useRef(false)

  const load = useCallback(async (): Promise<CourseMap | null> => {
    const res = await fetch(API, { cache: 'no-store' })
    const body = (await res.json()) as { rev: string | null; map: CourseMap | null; error?: string }
    if (!res.ok) throw new Error(body.error ?? `讀取失敗(${res.status})`)
    rev.current = body.rev
    return body.map
  }, [])

  // 一次只送一個請求;存檔途中又有新修改時,送完再存最新的一份
  const flush = useCallback(async () => {
    if (saving.current) return
    saving.current = true
    while (pending.current) {
      const next = pending.current
      pending.current = null
      setStatus({ state: 'saving' })
      try {
        const stamped: CourseMap = { ...next, updatedAt: new Date().toISOString() }
        const res = await fetch(API, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rev: rev.current, map: stamped }),
        })
        const body = (await res.json()) as { rev?: string; error?: string }
        if (res.status === 409) {
          // 檔案在外部被改過(例如 Claude 改了):以檔案為準,不蓋掉對方的修改
          pending.current = null
          const latest = await load()
          if (latest) setMap(latest)
          setHistory([])
          setNotice('檔案在外部被改過，已載入最新內容；剛才那次移動沒有存入，請重新拖曳。')
          setStatus({ state: 'idle' })
          continue
        }
        if (!res.ok || !body.rev) throw new Error(body.error ?? `儲存失敗(${res.status})`)
        rev.current = body.rev
        setStatus({ state: 'saved', at: new Date().toLocaleTimeString('zh-TW', { hour12: false }) })
      } catch (e) {
        // 留著最新的一份,讓「重試」或下一次修改可以再送
        pending.current ??= next
        setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) })
        break
      }
    }
    saving.current = false
  }, [load])

  const save = useCallback(
    (next: CourseMap) => {
      pending.current = next
      void flush()
    },
    [flush],
  )

  const open = useCallback(async () => {
    setLoadError(null)
    try {
      const stored = await load()
      const merged = stored ? reconcile(stored, seed) : seed
      setMap(merged)
      // 第一次使用,或單課資料有新內容:寫回檔案
      if (!stored || JSON.stringify({ ...stored, updatedAt: '' }) !== JSON.stringify({ ...merged, updatedAt: '' })) save(merged)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [load, save, seed])

  useEffect(() => {
    // 開發模式的 StrictMode 會執行兩次 effect;只讀一次,免得兩次讀取和第一次存檔互相競爭
    if (!import.meta.env.DEV || opened.current) return
    opened.current = true
    void open()
  }, [open])

  // 回到這個分頁時重新讀檔,看得到 Claude 對檔案的修改
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onFocus = () => {
      if (saving.current || pending.current || dragging.current) return
      const before = rev.current
      void load()
        .then((latest) => {
          if (latest && rev.current !== before) {
            setMap(latest)
            setHistory([])
          }
        })
        .catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  // 鍵盤移動跨清單時元素會重建,移動後把焦點放回去
  useEffect(() => {
    if (!focusId.current) return
    document.querySelector<HTMLElement>(`[data-item="${CSS.escape(focusId.current)}"]`)?.focus()
    focusId.current = null
  }, [map])

  const stale = useMemo(() => (map ? staleIds(map, seed) : new Set<string>()), [map, seed])

  const apply = (next: CourseMap) => {
    // 放回原位不算修改
    if (!map || JSON.stringify(next.levels) === JSON.stringify(map.levels)) return
    setHistory((h) => [...h.slice(-49), map])
    setMap(next)
    setNotice(null)
    save(next)
  }

  const undo = () => {
    const prev = history.at(-1)
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setMap(prev)
    save(prev)
  }

  const startDrag = (e: DragEvent<HTMLElement>, kind: Kind, id: string) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    dragging.current = true
    setDrag({ kind, id })
  }
  const endDrag = () => {
    dragging.current = false
    setDrag(null)
    setTarget(null)
  }
  /** 目前拖的是這一類才接受,並記下放下的位置(沒變就不更新,dragover 觸發很頻繁) */
  const accept = (e: DragEvent<HTMLElement>, kind: Kind, parent: string, index: number) => {
    if (drag?.kind !== kind) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setTarget((t) => (t?.parent === parent && t.index === index ? t : { parent, index }))
  }
  const drop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (map && drag && target) apply((drag.kind === 'segment' ? moveSegment : moveCourse)(map, drag.id, target.parent, target.index))
    endDrag()
  }

  const onKeyMove = (e: KeyboardEvent<HTMLElement>, kind: Kind, id: string) => {
    if (!map || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    e.stopPropagation()
    focusId.current = id
    apply(nudge(map, kind, id, e.key === 'ArrowUp' ? -1 : 1))
  }

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const courseIds = map ? map.levels.flatMap((l) => l.courses.map((c) => c.id)) : []
  const allCollapsed = courseIds.length > 0 && courseIds.every((id) => collapsed.has(id))
  const nameOf = (id: string) => map?.levels.find((l) => l.id === id)?.label ?? id

  const isTarget = (parent: string, index: number) => target?.parent === parent && target.index === index

  const renderCourse = (course: MapCourse, index: number, levelId: string, count: number) => {
    const isCollapsed = collapsed.has(course.id)
    const segTarget = drag?.kind === 'segment' && target?.parent === course.id
    const classes = [
      styles.course,
      drag?.id === course.id ? styles.dragging : '',
      segTarget ? styles.over : '',
      isTarget(levelId, index) ? styles.lineBefore : '',
      index === count - 1 && isTarget(levelId, count) ? styles.lineAfter : '',
    ]
    return (
      <li
        key={course.id}
        className={classes.join(' ')}
        onDragOver={(e) => {
          if (drag?.kind === 'course') accept(e, 'course', levelId, indexByPointer(e, index))
          else accept(e, 'segment', course.id, course.segments.length)
        }}
        onDrop={drop}
      >
        <div
          className={styles.courseHead}
          draggable
          tabIndex={0}
          data-item={course.id}
          title="拖曳到其他程度；Alt + ↑↓ 用鍵盤移動"
          onDragStart={(e) => startDrag(e, 'course', course.id)}
          onDragEnd={endDrag}
          onKeyDown={(e) => onKeyMove(e, 'course', course.id)}
        >
          <span className={styles.grip} aria-hidden="true">
            ⠿
          </span>
          <span className={styles.courseText}>
            <span className={styles.code}>{course.code}</span> {course.title}
            {course.from !== levelId && <span className={styles.moved}>原本在 {nameOf(course.from)}</span>}
            {stale.has(course.id) && <span className={styles.stale}>單課資料裡已沒有</span>}
          </span>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? '展開' : '收合'} ${course.title}`}
            onClick={() => toggle(course.id)}
          >
            {course.segments.length} {isCollapsed ? '▸' : '▾'}
          </button>
        </div>
        {!isCollapsed &&
          (course.segments.length ? (
            <ol className={styles.segments}>
              {course.segments.map((seg, i) => (
                <li
                  key={seg.id}
                  className={[
                    styles.segment,
                    drag?.id === seg.id ? styles.dragging : '',
                    isTarget(course.id, i) ? styles.lineBefore : '',
                    i === course.segments.length - 1 && isTarget(course.id, course.segments.length) ? styles.lineAfter : '',
                  ].join(' ')}
                  draggable
                  tabIndex={0}
                  data-item={seg.id}
                  title="拖曳到其他課程；Alt + ↑↓ 用鍵盤移動"
                  onDragStart={(e) => startDrag(e, 'segment', seg.id)}
                  onDragEnd={endDrag}
                  onDragOver={(e) => accept(e, 'segment', course.id, indexByPointer(e, i))}
                  onDrop={drop}
                  onKeyDown={(e) => onKeyMove(e, 'segment', seg.id)}
                >
                  <span className={styles.grip} aria-hidden="true">
                    ⠿
                  </span>
                  <span className={styles.segmentText}>
                    {seg.title}
                    {seg.from !== course.id && <span className={styles.moved}>原本在 {seg.from}</span>}
                    {stale.has(seg.id) && <span className={styles.stale}>單課資料裡已沒有</span>}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.emptySegments}>{drag?.kind === 'segment' ? '放到這裡' : '還沒有段落'}</p>
          ))}
      </li>
    )
  }

  const moves = map?.changes.length ?? 0

  return (
    <ProposalLayout title="課程編排" footer={`課程編排工具 · 資料：${FILE}`}>
      <h1>課程編排</h1>
      <p className={ui.lead}>
        拖曳段落到不同課程、拖曳課程到不同程度，放開就存檔。這裡只改編排草稿，不會動到課程內容；確定後請 Claude 依檔案套用。
      </p>

      {!import.meta.env.DEV ? (
        <div className={ui.note}>
          <strong>只能在本機開發站使用</strong>
          這個工具把修改寫進 repo 裡的檔案，正式站沒有存檔功能。請在 web/ 執行 npm run dev，再開啟這一頁。
        </div>
      ) : loadError ? (
        <div className={ui.note} role="alert">
          <strong>讀不到編排檔</strong>
          {loadError}
          <div className={styles.errorAction}>
            <button type="button" className={ui.btn} onClick={() => void open()}>
              重新讀取
            </button>
          </div>
        </div>
      ) : !map ? (
        <p className={ui.lead}>讀取中…</p>
      ) : (
        <div className={styles.page}>
          <div className={styles.toolbar}>
            <button type="button" className={`${ui.btn} ${styles.button}`} disabled={!history.length} onClick={undo}>
              復原上一步
            </button>
            <button
              type="button"
              className={`${ui.btn} ${ui.ghost} ${styles.button}`}
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(courseIds))}
            >
              {allCollapsed ? '全部展開' : '全部收合'}
            </button>
            <span className={styles.summary}>已跨區移動 {moves} 項</span>
            <span className={styles.status} role="status">
              {status.state === 'saving' && '儲存中…'}
              {status.state === 'saved' && `已儲存 ${status.at}`}
              {status.state === 'error' && (
                <span className={styles.error}>
                  儲存失敗：{status.message}{' '}
                  <button type="button" className={styles.retry} onClick={() => void flush()}>
                    重試
                  </button>
                </span>
              )}
            </span>
            <code className={styles.file}>{FILE}</code>
          </div>
          {notice && (
            <p className={styles.notice} role="alert">
              {notice}
            </p>
          )}
          <div className={styles.board}>
            {map.levels.map((level) => (
              <section
                key={level.id}
                className={styles.level}
                aria-label={level.label}
                onDragOver={(e) => accept(e, 'course', level.id, level.courses.length)}
                onDrop={drop}
              >
                <header className={styles.levelHead}>
                  <h2>{level.label}</h2>
                  <p title={level.title}>{level.title}</p>
                  <span className={styles.count}>{level.courses.length} 課</span>
                </header>
                {level.courses.length ? (
                  <ol className={styles.courses}>{level.courses.map((c, i) => renderCourse(c, i, level.id, level.courses.length))}</ol>
                ) : (
                  <p className={`${styles.emptyLevel} ${target?.parent === level.id ? styles.over : ''}`}>
                    {drag?.kind === 'course' ? '放到這裡' : '這個程度還沒有課程'}
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </ProposalLayout>
  )
}
