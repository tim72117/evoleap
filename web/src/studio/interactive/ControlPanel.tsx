// 互動課程頁的控制面板:左上角的標題列、右上角的章節膠囊,和播放器的控制列(膠囊播放條)當成一組。
// 播放中一段時間沒動作時三者一起淡出,滑鼠移動、點畫面或暫停時一起出現(顯示與否跟著播放器 .vp 的 show-ui／paused 狀態)。
// 手機上字幕(CC)鈕與播放速度也放在右上角(CaptionToggle、RateMenu),控制列上的藏起來。
// 標題列與膠囊不在播放器裡面:滑鼠指著它們時告訴播放器先不要收起(holdControls),才不會指著按鈕時整組消失。
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Shell } from '../../live/shell'
import { useT } from '../../i18n/I18nProvider'
import styles from './InteractiveScenePage.module.css'

/**
 * 讀播放器(box 裡的 .vp)的某個狀態,狀態變了才重新 render。
 * 只看 box 的直接子節點(播放器重建時會換掉 .vp)與 watch 列出的幾個節點;不看整棵樹:舞台播放時每一格都在改 DOM。
 */
function useVpState<T>(
  box: RefObject<HTMLElement | null>,
  read: (vp: HTMLElement | null) => T,
  watch: (vp: HTMLElement) => [Node | null, MutationObserverInit][],
  same: (a: T, b: T) => boolean,
): T {
  const [value, setValue] = useState(() => read(null))
  useEffect(() => {
    const el = box.current
    if (!el) return
    let vp: HTMLElement | null = null
    let inner: MutationObserver | null = null
    const update = (): void => {
      const next = read(vp)
      setValue((prev) => (same(prev, next) ? prev : next))
    }
    const attach = (): void => {
      const cur = el.querySelector<HTMLElement>(':scope > .vp')
      if (cur !== vp) {
        inner?.disconnect()
        inner = null
        vp = cur
        if (vp) {
          inner = new MutationObserver(update)
          for (const [node, opts] of watch(vp)) if (node) inner.observe(node, opts)
        }
      }
      update()
    }
    const outer = new MutationObserver(attach)
    outer.observe(el, { childList: true })
    attach()
    return () => {
      outer.disconnect()
      inner?.disconnect()
    }
    // read、watch、same 都是模組層級的固定函式
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box])
  return value
}

/** 播放器的控制列現在看不看得到(暫停、拖曳時間軸、播放中剛動過滑鼠) */
const readShown = (vp: HTMLElement | null): boolean => !vp || ['show-ui', 'paused', 'scrubbing'].some((c) => vp.classList.contains(c))
const watchClass = (vp: HTMLElement): [Node | null, MutationObserverInit][] => [[vp, { attributes: true, attributeFilter: ['class'] }]]
const sameValue = <T,>(a: T, b: T): boolean => a === b

/** 跟著播放器控制列顯示/隱藏(box:播放器掛在裡面的容器) */
export function useControlsShown(box: RefObject<HTMLElement | null>): boolean {
  return useVpState(box, readShown, watchClass, sameValue)
}

export function ControlPanel({ box, shell, children }: { box: RefObject<HTMLElement | null>; shell: () => Shell | undefined; children: ReactNode }) {
  const shown = useControlsShown(box)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={styles.controlPanel}
      data-hidden={shown ? undefined : ''}
      onPointerOver={() => shell()?.holdControls(true)}
      onPointerMove={() => shell()?.holdControls(true)}
      // 按了以後被按的東西可能直接消失(例如章節膠囊打開側欄就拿掉),不會再有 pointerout;先放開,滑鼠再動才重新保持
      onClickCapture={() => shell()?.holdControls(false)}
      onPointerOut={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) shell()?.holdControls(false)
      }}
      onFocus={() => shell()?.holdControls(true)}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) shell()?.holdControls(false)
      }}
    >
      {children}
    </div>
  )
}

type CcState = { shown: boolean; pressed: boolean; icon: string }
const readCc = (vp: HTMLElement | null): CcState => {
  const b = vp?.querySelector<HTMLButtonElement>('.vp-cc')
  return b ? { shown: !b.hidden, pressed: b.getAttribute('aria-pressed') === 'true', icon: b.innerHTML } : { shown: false, pressed: false, icon: '' }
}
const watchCc = (vp: HTMLElement): [Node | null, MutationObserverInit][] => [[vp.querySelector('.vp-cc'), { attributes: true, attributeFilter: ['hidden', 'aria-pressed'] }]]
const sameCc = (a: CcState, b: CcState): boolean => a.shown === b.shown && a.pressed === b.pressed && a.icon === b.icon

/**
 * 右上角的字幕鈕(手機才顯示,見 CSS 的 .ccTop):照播放器控制列上字幕鈕(.vp-cc)的狀態顯示,按了就按那一顆,
 * 字幕開關的邏輯仍然只在播放器裡(shell.ts)。這一課沒有字幕時不顯示。
 */
export function CaptionToggle({ box, className }: { box: RefObject<HTMLElement | null>; className?: string }) {
  const cc = useVpState(box, readCc, watchCc, sameCc)
  const t = useT()
  if (!cc.shown) return null
  return (
    <button
      type="button"
      className={className}
      aria-label={t.player.captions}
      aria-pressed={cc.pressed}
      onClick={() => box.current?.querySelector<HTMLButtonElement>('.vp-cc')?.click()}
      // 圖示沿用播放器自己的字幕圖示(shell.ts 產生的固定 SVG)
      dangerouslySetInnerHTML={{ __html: cc.icon }}
    />
  )
}

type RateState = { label: string; rates: number[] }
const readRate = (vp: HTMLElement | null): RateState => ({
  label: vp?.querySelector('.vp-rate')?.textContent ?? '',
  rates: vp ? [...vp.querySelectorAll<HTMLElement>('.vp-menu [data-rate]')].map((b) => Number(b.dataset.rate)) : [],
})
// 速度的文字由 shell 用 textContent 換掉(子節點換掉)
const watchRate = (vp: HTMLElement): [Node | null, MutationObserverInit][] => [[vp.querySelector('.vp-rate'), { childList: true, characterData: true, subtree: true }]]
const sameRate = (a: RateState, b: RateState): boolean => a.label === b.label && a.rates.length === b.rates.length

/**
 * 右上角的播放速度(手機才顯示,見 CSS 的 .rateTop):顯示播放器目前的速度(控制列上 .vp-rate 的文字),
 * 按了往下展開速度清單(速度選項沿用播放器的 .vp-menu),選了用 shell.setRate 設定。
 */
export function RateMenu({ box, shell, className, menuClassName }: { box: RefObject<HTMLElement | null>; shell: () => Shell | undefined; className?: string; menuClassName?: string }) {
  const rate = useVpState(box, readRate, watchRate, sameRate)
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // 點清單以外的地方就收起來
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  if (!rate.label) return null
  return (
    <div ref={ref} className={className}>
      <button type="button" aria-label={t.player.speed} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {rate.label}
      </button>
      {open && (
        <div className={menuClassName} role="menu">
          {rate.rates.map((r) => (
            <button
              key={r}
              type="button"
              role="menuitemradio"
              aria-checked={`${r}×` === rate.label}
              onClick={() => {
                shell()?.setRate(r)
                setOpen(false)
              }}
            >
              {r}×
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
