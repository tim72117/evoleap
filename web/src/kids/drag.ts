// 兒童版播放器的拖曳:哪些東西可以拖、可以放到哪裡、放下去是哪一步操作。
// 演員只負責「怎麼畫、狀態怎麼推算」,不處理拖曳(舞台與演員的介面沒有拖曳);這裡依演員的狀態算出拖放的位置,
// 兒童版子腳本寫 interact.drag 時由 KidsPlayer 使用;成人課的互動點寫 stage.drag 時由靜態互動(StaticActor)使用。目前支援 kid-tree(樹狀圖的節點)。

import type { ScriptStep } from '../live/types'

export type DragItem = { id: string; target: string; label: string }
export type DropSlot = { target: string; step: ScriptStep }
export type DragPlan = { items: DragItem[]; slotsFor: (id: string) => DropSlot[] }

const NAMES: Record<string, string> = { h1: '標題', img: '圖片', p: '文字', button: '按鈕', card: '名片盒' }

type TreeLike = { kids: Record<string, string[]>; labels?: Record<string, string> }

/** kid-tree:每個節點都能拖;可以放進 root 或任何盒子的任何位置,但不能放進自己或自己裡面 */
function treePlan(on: string, st: TreeLike): DragPlan {
  const { kids } = st
  const parentOf = (id: string) => Object.keys(kids).find((p) => kids[p].includes(id))
  const inside = (id: string, box: string): boolean => {
    for (let p = parentOf(id); p; p = parentOf(p)) if (p === box) return true
    return false
  }
  const ids = Object.values(kids).flat()
  return {
    items: ids.map((id) => ({ id, target: `${on}:node:${id}`, label: st.labels?.[id] ?? NAMES[id] ?? id })),
    slotsFor(id) {
      const from = parentOf(id)
      const at = from ? kids[from].indexOf(id) : -1
      const out: DropSlot[] = []
      for (const box of Object.keys(kids)) {
        if (box === id || inside(box, id)) continue
        for (let i = 0; i <= kids[box].length; i++) {
          // 放回原來的位置(自己的上下兩條縫)不算移動
          if (box === from && (i === at || i === at + 1)) continue
          // 演員的 index 是「移走之後」的位置:同一個容器裡往下放要減一
          const index = box === from && i > at ? i - 1 : i
          out.push({ target: `${on}:slot:${box}:${i}`, step: { on, put: id, parent: box, index } as ScriptStep })
        }
      }
      return out
    },
  }
}

/** 依演員種類算出拖放計畫;不支援拖曳的演員回傳 null */
export function dragPlan(actor: string, on: string, state: unknown): DragPlan | null {
  if (actor === 'kid-tree') return treePlan(on, state as TreeLike)
  return null
}
