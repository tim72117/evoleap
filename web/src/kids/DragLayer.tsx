// 拖曳層:兒童版播放器(KidsPlayer)與成人課的靜態互動(studio/interactive/StaticActor)共用。
// 拖放的計畫(哪些東西可以拖、放到哪裡、放下去是哪一步)見 drag.ts;外觀由 classes 決定。
import { useEffect, useRef, useState } from 'react'
import type { ScriptStep } from '../live/types'
import type { DragPlan, DropSlot } from './drag'

type Rect = { x: number; y: number; w: number; h: number }

/**
 * 拖曳層(舞台座標,跟著舞台縮放):可以拖的東西疊上透明的握把;拖的時候畫出所有可以放的位置,
 * 離指標最近的那一條變亮,放開就交給 drop。滑鼠與手指都用 Pointer Events。
 */
export function DragLayer({
  drag,
  classes,
  minZone = { w: 220, h: 70 },
  rects,
  toStage,
  onGrab,
  elementOf,
}: {
  drag: { plan: DragPlan; drop: (step: ScriptStep) => void }
  /** 握把、可以放的位置、最靠近的放置位置、找不到元素時的名牌的樣式(兒童版與成人課各自的外觀) */
  classes: { grab: string; dropZone: string; dropDot: string; ghost: string }
  /** 「放這裡」空位的最小大小(和 rects 同一種座標);兒童版是 1920 寬舞台的 px */
  minZone?: { w: number; h: number }
  rects: Record<string, Rect>
  toStage: (cx: number, cy: number) => { x: number; y: number }
  /** 開始拖的時候(收起提示) */
  onGrab?: () => void
  /** 目標(「演員代號:目標」)現在對應的元素:拖的時候複製一份跟著指標走 */
  elementOf?: (target: string) => HTMLElement | null
}) {
  const [held, setHeld] = useState<{ id: string; label: string; x: number; y: number; slot: DropSlot | null } | null>(null)
  // 拖的時候整個節點跟著指標走:複製一份放進演員裡(才有演員的樣式),原本的先藏起來;放開就拿掉複製的、原本的顯示回來。
  // 這只在停下來等孩子操作時存在,不屬於舞台的時間軸,放開後演員照新的狀態重畫
  const lift = useRef<{ clone: HTMLElement; orig: HTMLElement; host: HTMLElement; dx: number; dy: number } | null>(null)
  const follow = (cx: number, cy: number) => {
    const l = lift.current
    if (!l) return
    const hr = l.host.getBoundingClientRect()
    const k = hr.width / (l.host.offsetWidth || 1) || 1
    l.clone.style.left = `${(cx - l.dx - hr.left) / k}px`
    l.clone.style.top = `${(cy - l.dy - hr.top) / k}px`
  }
  const drop = () => {
    const l = lift.current
    if (!l) return
    l.clone.remove()
    l.orig.style.visibility = ''
    lift.current = null
  }
  useEffect(() => drop, [])
  const slots = held ? drag.plan.slotsFor(held.id).filter((d) => rects[d.target]) : []
  /** 離指標最近的放置位置:指標要在那條縫的左端右邊一點以內(越往右拖越進到裡面一層),上下距離最近的 */
  const nearest = (id: string, x: number, y: number): DropSlot | null => {
    let best: DropSlot | null = null
    let dist = 90
    for (const d of drag.plan.slotsFor(id)) {
      const r = rects[d.target]
      if (!r || x < r.x - 70) continue
      const dy = Math.abs(y - (r.y + r.h / 2))
      // 同樣近時,選比較靠右(比較深)而且指標已經越過它左端的
      if (dy < dist || (dy === dist && best && r.x > rects[best.target].x)) {
        best = d
        dist = dy
      }
    }
    return best
  }
  return (
    <>
      {drag.plan.items.map((it) => {
        const r = rects[it.target]
        if (!r) return null
        return (
          <button
            key={it.id}
            type="button"
            className={classes.grab}
            aria-label={`拖動「${it.label}」`}
            style={{ left: r.x - 10, top: r.y - 10, width: r.w + 20, height: r.h + 20 }}
            onPointerDown={(e) => {
              e.preventDefault()
              e.currentTarget.setPointerCapture(e.pointerId)
              const p = toStage(e.clientX, e.clientY)
              setHeld({ id: it.id, label: it.label, ...p, slot: null })
              onGrab?.()
              const el = elementOf?.(it.target)
              const host = el?.closest<HTMLElement>('[class^="A-"], [class*=" A-"]')
              if (el && host) {
                drop()
                const er = el.getBoundingClientRect()
                const hr = host.getBoundingClientRect()
                const k = hr.width / (host.offsetWidth || 1) || 1
                const clone = el.cloneNode(true) as HTMLElement
                Object.assign(clone.style, {
                  position: 'absolute',
                  margin: '0',
                  width: `${er.width / k}px`,
                  zIndex: '60',
                  pointerEvents: 'none',
                  opacity: '1',
                  filter: 'none',
                  translate: 'none',
                  transform: 'scale(1.08) rotate(-3deg)',
                  boxShadow: '0 18px 30px rgba(0, 0, 0, 0.28)',
                })
                host.appendChild(clone)
                el.style.visibility = 'hidden'
                lift.current = { clone, orig: el, host, dx: e.clientX - er.left, dy: e.clientY - er.top }
                follow(e.clientX, e.clientY)
              }
            }}
            onPointerMove={(e) => {
              if (!held || held.id !== it.id) return
              const p = toStage(e.clientX, e.clientY)
              follow(e.clientX, e.clientY)
              setHeld({ ...held, ...p, slot: nearest(it.id, p.x, p.y) })
            }}
            onPointerUp={() => {
              const slot = held?.slot
              drop()
              setHeld(null)
              if (slot) drag.drop(slot.step)
            }}
            onPointerCancel={() => {
              drop()
              setHeld(null)
            }}
          />
        )
      })}
      {held &&
        slots.map((d) => {
          const r = rects[d.target]
          // 可以放的位置:平常是一顆小小的「+」;最靠近的那個變成一個虛線的空位,大小和拿著的節點一樣,寫著「放這裡」
          const on = held.slot?.target === d.target
          const size = rects[drag.plan.items.find((x) => x.id === held.id)?.target ?? '']
          const w = Math.max(minZone.w, size?.w ?? minZone.w)
          const h = Math.max(minZone.h, size?.h ?? minZone.h)
          return on ? (
            <span key={d.target} className={classes.dropZone} style={{ left: r.x, top: r.y + r.h / 2 - h / 2, width: w, height: h }}>
              放這裡
            </span>
          ) : (
            <span key={d.target} className={classes.dropDot} style={{ left: r.x, top: r.y + r.h / 2 }} aria-hidden="true">
              +
            </span>
          )
        })}
      {/* 找不到可以複製的元素時,才用一個寫著名稱的小牌子跟著指標 */}
      {held && !lift.current && (
        <span className={classes.ghost} style={{ left: held.x, top: held.y }} aria-hidden="true">
          {held.label}
        </span>
      )}
    </>
  )
}
