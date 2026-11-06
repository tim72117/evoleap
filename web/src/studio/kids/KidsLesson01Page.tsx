import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'
import { Say as SayChips } from '../../kids/say'
import { hush, speak } from '../../kids/speech'
import { PET_BLOCKS, blockOf, type BlockId, type KidsBlockDef } from './blocks'
import s from './KidsLesson.module.css'

// 兒童網頁課 0.1「翻到網頁的背面」試做:看(自動播放的展示)→ 做(點網頁或積木,找出對應)→ 找找看(三題)。
// 互動不打語法:每個標籤是一塊印著 <h1> 這類名字的大積木。大綱在 ../proposal/kidsWeb.ts。
// 試做直接用 React 畫,不是 live 舞台引擎,所以可以用 CSS 轉場與計時器。

type PartState = 'idle' | 'on' | 'dim' | 'wrong'
type View = 'front' | 'back' | 'split'

const stateOf = (id: BlockId, focus: BlockId | null): PartState => (focus === null ? 'idle' : focus === id ? 'on' : 'dim')
const colorVars = (b: KidsBlockDef) => ({ '--c': b.color, '--d': b.shade }) as CSSProperties

/** 把句子裡的「<h1>」換成和積木同色的小標籤(配色在 src/kids/tags.ts,和積木同一份) */
const Say = ({ text }: { text: string }) => <SayChips text={text} chip={s.chip} />

/** 一塊積木:有 onPick 時是可以按的按鈕 */
function Block({ def, state, onPick }: { def: KidsBlockDef; state: PartState; onPick?: (id: BlockId) => void }) {
  const inner = (
    <>
      <span className={s.studs} aria-hidden="true">
        <i />
        <i />
      </span>
      <span className={s.tag}>
        {def.tag}
        <small>{def.name}</small>
      </span>
      <span className={s.content}>{def.content}</span>
    </>
  )
  return onPick ? (
    <button type="button" className={s.block} data-state={state} style={colorVars(def)} aria-pressed={state === 'on'} onClick={() => onPick(def.id)}>
      {inner}
    </button>
  ) : (
    <div className={s.block} data-state={state} style={colorVars(def)}>
      {inner}
    </div>
  )
}

/** 網頁的正面:一頁卡通網頁 */
function PetPage({ focus = null, onPick }: { focus?: BlockId | null; onPick?: (id: BlockId) => void }) {
  const part = (id: BlockId, label: string, children: ReactNode) => {
    const st = stateOf(id, focus)
    return onPick ? (
      <button type="button" className={s.part} data-state={st} style={colorVars(blockOf(id))} aria-label={label} aria-pressed={st === 'on'} onClick={() => onPick(id)}>
        {children}
      </button>
    ) : (
      <div className={s.part} data-state={st} style={colorVars(blockOf(id))}>
        {children}
      </div>
    )
  }
  return (
    <div className={s.browser}>
      <div className={s.bar} aria-hidden="true">
        <span className={s.lights}>
          <i />
          <i />
          <i />
        </span>
        <span className={s.url}>小花的家</span>
      </div>
      <div className={s.page}>
        {part('h1', '標題：小花的家', <span className={s.h1}>小花的家</span>)}
        {part('img', '小花的照片', <span className={s.photo}>🐱</span>)}
        {part('p', '文字：小花是一隻愛睡午覺的橘貓', <span className={s.text}>小花是一隻愛睡午覺的橘貓。</span>)}
        {part('button', '按鈕：摸摸小花', <span className={s.fakeBtn}>摸摸小花</span>)}
      </div>
    </div>
  )
}

/** 網頁的背面:一塊一塊的積木 */
function BlockStack({ states, onPick }: { states: (id: BlockId) => PartState; onPick?: (id: BlockId) => void }) {
  return (
    <div className={s.back}>
      <p className={s.backLabel}>網頁的背面</p>
      <div className={s.stack}>
        {PET_BLOCKS.map((b) => (
          <Block key={b.id} def={b} state={states(b.id)} onPick={onPick} />
        ))}
      </div>
    </div>
  )
}

// ── 看:展示 ─────────────────────────────────────────

type DemoStep = { view: View; focus: BlockId | null; say: string; ms: number }

const DEMO: DemoStep[] = [
  { view: 'front', focus: null, say: '這是小花的網頁。上面有標題、照片、一段文字，還有一個按鈕。', ms: 4500 },
  { view: 'front', focus: null, say: '你知道嗎？網頁其實有一個背面。我們把它翻過來看看！', ms: 4000 },
  { view: 'back', focus: null, say: '哇！背面是一塊一塊的積木。', ms: 4000 },
  { view: 'back', focus: null, say: '每塊積木上都印著名字，告訴瀏覽器要畫出什麼。', ms: 4500 },
  { view: 'split', focus: 'h1', say: '印著 <h1> 的積木，畫出最大的標題。', ms: 4000 },
  { view: 'split', focus: 'img', say: '印著 <img> 的積木，放上一張圖片。', ms: 4000 },
  { view: 'split', focus: 'p', say: '印著 <p> 的積木，寫出一段文字。', ms: 4000 },
  { view: 'split', focus: 'button', say: '印著 <button> 的積木，變成一個可以按的按鈕。', ms: 4500 },
  { view: 'split', focus: null, say: '瀏覽器就是照著這些積木，一塊一塊把網頁畫出來的！', ms: 5000 },
]

function Scene({ view, focus }: { view: View; focus: BlockId | null }) {
  if (view === 'split') {
    return (
      <div className={s.split}>
        <PetPage focus={focus} />
        <BlockStack states={(id) => stateOf(id, focus)} />
      </div>
    )
  }
  return (
    <div className={s.flip} data-flipped={view === 'back'}>
      <div className={s.card}>
        <div className={s.face} aria-hidden={view === 'back'}>
          <PetPage />
        </div>
        <div className={`${s.face} ${s.backFace}`} aria-hidden={view !== 'back'}>
          <BlockStack states={() => 'idle'} />
        </div>
      </div>
    </div>
  )
}

function Demo() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [voice, setVoice] = useState(false)
  const last = DEMO.length - 1
  const step = DEMO[i]

  useEffect(() => {
    if (!playing || i >= last) return
    const t = window.setTimeout(() => {
      setI(i + 1)
      if (i + 1 >= last) setPlaying(false)
    }, DEMO[i].ms)
    return () => window.clearTimeout(t)
  }, [playing, i, last])

  useEffect(() => {
    if (voice) speak(DEMO[i].say)
  }, [voice, i])
  useEffect(() => hush, [])

  const go = (n: number) => {
    setPlaying(false)
    setI(Math.max(0, Math.min(last, n)))
  }
  const play = () => {
    if (playing) return setPlaying(false)
    if (i >= last) setI(0)
    setPlaying(true)
  }

  return (
    <div className={s.stageBox}>
      <Scene view={step.view} focus={step.focus} />
      <p className={s.say} aria-live="polite">
        <Say text={step.say} />
      </p>
      <div className={s.controls}>
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0}>
          ← 上一步
        </button>
        <button type="button" className={s.primary} onClick={play}>
          {playing ? '⏸ 暫停' : i >= last ? '↺ 再看一次' : '▶ 播放'}
        </button>
        <button type="button" onClick={() => go(i + 1)} disabled={i === last}>
          下一步 →
        </button>
        <button type="button" aria-pressed={voice} onClick={() => setVoice((v) => !v)}>
          {voice ? '🔊 旁白開' : '🔈 旁白關'}
        </button>
      </div>
      <div className={s.steps} aria-label="展示步驟">
        {DEMO.map((_, n) => (
          <button key={n} type="button" aria-label={`第 ${n + 1} 步`} aria-current={n === i ? 'step' : undefined} onClick={() => go(n)} />
        ))}
      </div>
    </div>
  )
}

// ── 做:點網頁或積木,找出對應 ───────────────────────────

function Explore() {
  const [pick, setPick] = useState<BlockId | null>(null)
  const [found, setFound] = useState<BlockId[]>([])
  const choose = (id: BlockId) => {
    setPick(id)
    setFound((f) => (f.includes(id) ? f : [...f, id]))
  }
  const def = pick ? blockOf(pick) : null
  const all = found.length === PET_BLOCKS.length
  return (
    <div className={s.stageBox}>
      <div className={s.split}>
        <PetPage focus={pick} onPick={choose} />
        <BlockStack states={(id) => stateOf(id, pick)} onPick={choose} />
      </div>
      <p className={s.say} aria-live="polite">
        {def ? (
          <>
            這是 <Say text={def.tag} /> 積木（{def.say}），它會{def.does}。
          </>
        ) : (
          '點網頁上的任何東西，看看是哪一塊積木畫出來的。也可以直接點積木喔！'
        )}
      </p>
      <p className={s.progress}>
        {PET_BLOCKS.map((b) => (found.includes(b.id) ? '⭐' : '☆')).join(' ')}　找到 {found.length} / {PET_BLOCKS.length} 塊積木
        {all && '，全部找到了！🎉'}
      </p>
    </div>
  )
}

// ── 找找看 ───────────────────────────────────────────

const QUIZ: { ask: string; answer: BlockId }[] = [
  { ask: '「摸摸小花」按鈕是哪一塊積木變出來的？', answer: 'button' },
  { ask: '小花的照片是哪一塊積木放上去的？', answer: 'img' },
  { ask: '最大的那行字「小花的家」，是哪一塊積木？', answer: 'h1' },
]

function Quiz() {
  const [q, setQ] = useState(0)
  const [tried, setTried] = useState<BlockId | null>(null)
  if (q >= QUIZ.length) {
    return (
      <div className={s.stageBox}>
        <p className={s.say}>三題都答對了！你已經會看網頁的背面了 🎉</p>
        <div className={s.controls}>
          <button type="button" onClick={() => (setQ(0), setTried(null))}>
            ↺ 再玩一次
          </button>
        </div>
      </div>
    )
  }
  const cur = QUIZ[q]
  const right = tried === cur.answer
  const states = (id: BlockId): PartState => (tried === id ? (right ? 'on' : 'wrong') : 'idle')
  const t = tried ? blockOf(tried) : null
  return (
    <div className={s.stageBox}>
      <p className={s.ask}>
        第 {q + 1} / {QUIZ.length} 題：{cur.ask}
      </p>
      <div className={s.split}>
        <PetPage focus={right ? cur.answer : null} />
        <BlockStack states={states} onPick={right ? undefined : setTried} />
      </div>
      <p className={s.say} aria-live="polite">
        {!t ? (
          '點一塊積木回答。'
        ) : right ? (
          <>
            答對了！<Say text={t.tag} /> 積木會{t.does}。
          </>
        ) : (
          <>
            這塊是 <Say text={t.tag} />，它會{t.does}。再試一次！
          </>
        )}
      </p>
      {right && (
        <div className={s.controls}>
          <button type="button" className={s.primary} onClick={() => (setQ(q + 1), setTried(null))}>
            {q + 1 < QUIZ.length ? '下一題 →' : '看結果 →'}
          </button>
        </div>
      )}
    </div>
  )
}

export function KidsLesson01Page() {
  return (
    <ProposalLayout title="兒童網頁課 0.1 試做" footer="試做 · 程式：src/studio/kids/ · 大綱：src/studio/proposal/kidsWeb.ts">
      <p>
        <Link to="/studio/kids-web">← 兒童網頁課大綱</Link>
      </p>
      <h1>0.1　翻到網頁的背面</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>試做 · 還沒找孩子試上</span>
      <p className={ui.lead}>
        序章第一課的展示與互動試做。孩子不打 &lt; &gt; / 這些符號：每個標籤都是一塊印著名字的大積木，例如印著 &lt;h1&gt; 的積木就是大標題。
      </p>

      <h2>看：網頁有背面</h2>
      <Demo />

      <h2>做：換你試試看</h2>
      <Explore />

      <h2>找找看</h2>
      <Quiz />

      <h2>學會</h2>
      <section className={ui.card}>
        <p>
          <strong>給孩子：</strong>網頁是用一塊一塊積木蓋出來的，積木上的名字告訴瀏覽器要畫出什麼。
        </p>
        <p>
          <strong>給家長：</strong>這一課不用打字，只要點點看。可以請孩子指著網頁上的東西，說說看是哪一塊積木畫出來的。
        </p>
      </section>

      <h2>試做說明</h2>
      <section className={ui.card}>
        <ul>
          <li>
            <strong>做法：</strong>直接用 React 畫，不是 live 舞台引擎。改用舞台腳本加 kid-web 演員的版本見 <Link to="/studio/kids-web/0-1/live">live 試做</Link>。
          </li>
          <li>
            <strong>積木：</strong>四塊積木的定義在 src/studio/kids/blocks.ts，單元 1 的拖拉積木可以沿用；之後再決定哪一課開始讓孩子看到真正的程式碼。
          </li>
          <li>
            <strong>旁白：</strong>用瀏覽器內建的語音念，聲音依裝置而不同；正式版要錄音。
          </li>
        </ul>
      </section>
    </ProposalLayout>
  )
}
