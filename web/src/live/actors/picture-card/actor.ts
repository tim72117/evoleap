// 演員 picture-card:附插圖的圖卡(取代只有文字的字卡)。插圖在上、標題在下,換下一張時淡入上移。
//
// 動作:
//   { "picture": "translate", "title": "…", "eyebrow": "…", "sub": "…" }
//   picture 是插圖代號(art.ts):translate、chat、speak、confirm、inspect、next
// 目標:window、art、title
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import { ART, type ArtName } from './art'
import './actor.css'

export type PictureStep = CommonStepFields & { picture?: string; title?: string; eyebrow?: string; sub?: string }
type Target = 'window' | 'art' | 'title'

const actor = defineActor<'picture', PictureStep, Record<string, never>, undefined, Target>({
  name: 'picture-card',
  kinds: ['picture'],

  duration() {
    return 2800
  },
  autoFocus() {
    return false
  },

  mount(root) {
    root.classList.add('A-picture-card')
    root.innerHTML = `<div class="pc-box"><div class="pc-art" data-t="art"></div><div class="pc-text" data-t="title"><span class="pc-eyebrow"></span><h2></h2><p></p></div></div>`
    const q = <E extends Element = HTMLElement>(sel: string): E => root.querySelector<E>(sel)!
    const art = q('.pc-art')
    const body = q('.pc-text')
    const eyebrow = q('.pc-eyebrow')
    const title = q('h2')
    const sub = q('.pc-text p')

    return {
      render(f) {
        const ev = f.events.at(-1)
        // 還沒演到第一張(剛出場)時先畫第一張的樣子是空白
        const step = (ev?.step ?? {}) as PictureStep
        const local = ev ? Math.max(0, ev.local) : 0
        if (step.picture && !(step.picture in ART)) throw new Error(`picture 要寫插圖代號(${Object.keys(ART).join('、')})`)
        kit.setIf(art, 'html', step.picture ? `<svg viewBox="0 0 400 260" aria-hidden="true">${ART[step.picture as ArtName]}</svg>` : '')
        kit.setIf(eyebrow, 'text', step.eyebrow ?? '')
        kit.setIf(title, 'text', step.title ?? '')
        kit.setIf(sub, 'text', step.sub ?? '')
        const p = ev ? kit.ease.outCubic(kit.progress(local, 0, 500)) : 0
        kit.css(art, { opacity: p.toFixed(3), transform: `translateY(${((1 - p) * 3).toFixed(2)}cqh) scale(${(0.96 + 0.04 * p).toFixed(3)})` })
        const t = ev ? kit.ease.outCubic(kit.progress(local, 200, 500)) : 0
        kit.css(body, { opacity: t.toFixed(3), transform: `translateY(${((1 - t) * 2).toFixed(2)}cqh)` })
      },

      target(name) {
        if (name === 'window') return q('.pc-box')
        if (name === 'art') return art
        if (name === 'title') return body
        return null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
