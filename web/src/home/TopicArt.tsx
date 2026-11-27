import { useId, type JSX } from 'react'

// 主題頁專用的插圖(特色介紹的圖、導覽影片的封面)。只用圖形不放字,顏色讀 --art-* (TopicFeatures.module.css、TopicTour.module.css 依淺色/深色設定)。
// 代號和序章圖卡(live/actors/picture-card/art.ts)共用;這裡沒有畫的代號,特色介紹會退回圖卡的圖。

const CARD = 'var(--art-card)'
const LINE = 'var(--art-line)'
const SOFT = 'var(--art-soft)'
const ACC = 'var(--art-accent)'
const TINT = 'var(--art-tint)'
const WARM = 'var(--art-warm)'
const ON = 'var(--art-on-accent)'

/** 打勾(中心在 x、y) */
const Check = ({ x, y, s = 1, color = ON }: { x: number; y: number; s?: number; color?: string }) => (
  <path d={`M${x - 4 * s} ${y + 0.5 * s} l${3 * s} ${3 * s} l${5.5 * s} ${-6.5 * s}`} fill="none" stroke={color} strokeWidth={2.2 * s} strokeLinecap="round" strokeLinejoin="round" />
)

/** 四角星 */
const Spark = ({ x, y, r, color = WARM }: { x: number; y: number; r: number; color?: string }) => {
  const k = r * 0.28
  return <path d={`M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k}Z`} fill={color} />
}

const Bar = ({ x, y, w, h = 7, color = SOFT }: { x: number; y: number; w: number; h?: number; color?: string }) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={color} />

/** 視窗左上的三個點 */
const Dots = ({ x, y }: { x: number; y: number }) => (
  <>
    <circle cx={x} cy={y} r="3.2" fill={WARM} opacity="0.75" />
    <circle cx={x + 11} cy={y} r="3.2" fill={SOFT} />
    <circle cx={x + 22} cy={y} r="3.2" fill={SOFT} />
  </>
)

/** 零基礎:跟著步驟一步步做,要打給 AI 的話可以直接複製 */
function Steps({ shadow }: { shadow: string }) {
  return (
    <>
      {/* 步驟視窗 */}
      <g filter={shadow}>
        <rect x="34" y="28" width="236" height="178" rx="16" fill={CARD} stroke={LINE} />
      </g>
      <Dots x={52} y={46} />
      <path d="M34 62 h236" stroke={LINE} />
      {[0, 1, 2].map((i) => {
        const y = 92 + i * 40
        const done = i < 2
        return (
          <g key={i}>
            {i < 2 && <path d={`M64 ${y + 13} v14`} stroke={done && i < 1 ? ACC : LINE} strokeWidth="2.5" strokeLinecap="round" />}
            {done ? <circle cx="64" cy={y} r="12" fill={ACC} /> : <circle cx="64" cy={y} r="10.75" fill={TINT} stroke={ACC} strokeWidth="2.5" />}
            {done ? <Check x={64} y={y} /> : <circle cx="64" cy={y} r="3.6" fill={ACC} />}
            <Bar x={90} y={y - 9} w={i === 2 ? 74 : 104 - i * 18} h={8} color={i === 2 ? ACC : SOFT} />
            <Bar x={90} y={y + 5} w={i === 2 ? 52 : 66 + i * 14} h={6} color={LINE} />
          </g>
        )
      })}
      {/* 可以直接複製的那段話 */}
      <g filter={shadow}>
        <rect x="196" y="122" width="176" height="108" rx="16" fill={CARD} stroke={LINE} />
      </g>
      <Bar x={214} y={142} w={96} h={8} />
      <Bar x={214} y={158} w={136} h={7} color={LINE} />
      <Bar x={214} y={172} w={112} h={7} color={LINE} />
      <rect x="214" y="192" width="78" height="24" rx="12" fill={ACC} />
      <rect x="226.5" y="200.5" width="8" height="9" rx="2" fill="none" stroke={ON} strokeWidth="1.8" />
      <path d="M229.5 198 h6 a2 2 0 0 1 2 2 v7" fill="none" stroke={ON} strokeWidth="1.8" strokeLinecap="round" />
      <Bar x={244} y={201} w={36} h={6} color={ON} />
      {/* 第一個檔案 */}
      <g filter={shadow}>
        <path d="M300 34 h38 l18 18 v44 a8 8 0 0 1 -8 8 h-48 a8 8 0 0 1 -8 -8 v-54 a8 8 0 0 1 8 -8z" fill={CARD} stroke={LINE} />
      </g>
      <path d="M338 34 v12 a6 6 0 0 0 6 6 h12" fill={TINT} stroke={LINE} strokeLinejoin="round" />
      <Bar x={304} y={64} w={30} h={6} color={ACC} />
      <Bar x={304} y={76} w={40} h={6} color={LINE} />
      <Bar x={304} y={88} w={26} h={6} color={LINE} />
      <Spark x={286} y={30} r={11} />
      <Spark x={372} y={112} r={6} color={ACC} />
    </>
  )
}

/** 和 AI 協作:把需求說清楚、看懂確認提示、打開成果檢查 */
function Collaborate({ shadow }: { shadow: string }) {
  return (
    <>
      {/* 需求清單(對話泡泡) */}
      <g filter={shadow}>
        <path d="M44 26 h156 a16 16 0 0 1 16 16 v68 a16 16 0 0 1 -16 16 h-112 l-22 18 l4 -18 h-26 a16 16 0 0 1 -16 -16 v-68 a16 16 0 0 1 16 -16z" fill={CARD} stroke={LINE} />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="56" cy={52 + i * 25} r="8.5" fill={WARM} />
          <Check x={56} y={52 + i * 25} s={0.75} color={CARD} />
          <Bar x={74} y={48 + i * 25} w={[112, 88, 100][i]} h={8} color={i === 0 ? SOFT : LINE} />
        </g>
      ))}
      {/* 成果:打開網頁來看 */}
      <g filter={shadow}>
        <rect x="222" y="58" width="150" height="118" rx="14" fill={CARD} stroke={LINE} />
      </g>
      <Dots x={238} y={74} />
      <path d="M222 88 h150" stroke={LINE} />
      <rect x="236" y="100" width="122" height="34" rx="8" fill={TINT} />
      <Bar x={246} y={112} w={54} h={8} color={ACC} />
      <Bar x={236} y={144} w={84} h={6} color={LINE} />
      <Bar x={236} y={156} w={60} h={6} color={LINE} />
      {/* 放大鏡:親眼檢查 */}
      <g filter={shadow}>
        <circle cx="352" cy="170" r="24" fill={CARD} stroke={ACC} strokeWidth="4" />
      </g>
      <path d="M369 188 l14 15" stroke={ACC} strokeWidth="7" strokeLinecap="round" />
      <Check x={352} y={170} s={1.5} color={ACC} />
      {/* 動手前的確認提示 */}
      <g filter={shadow}>
        <rect x="96" y="152" width="178" height="84" rx="16" fill={CARD} stroke={LINE} />
      </g>
      <circle cx="120" cy="176" r="10" fill={TINT} stroke={ACC} strokeWidth="2" />
      <path d="M120 171 v6" stroke={ACC} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="120" cy="181.2" r="1.5" fill={ACC} />
      <Bar x={138} y={168} w={92} h={7} />
      <Bar x={138} y={181} w={64} h={6} color={LINE} />
      <rect x="112" y="200" width="70" height="24" rx="12" fill={ACC} />
      <Check x={132} y={212} s={0.85} />
      <Bar x={143} y={209} w={26} h={6} color={ON} />
      <rect x="190.75" y="200.75" width="66.5" height="22.5" rx="11.25" fill="none" stroke={LINE} strokeWidth="1.5" />
      <Bar x={208} y={209} w={32} h={6} color={SOFT} />
      <Spark x={232} y={36} r={10} />
    </>
  )
}

const FEATURE_ART: Record<string, (p: { shadow: string }) => JSX.Element> = { next: Steps, speak: Collaborate }

export const hasTopicArt = (name: string | undefined): boolean => !!name && name in FEATURE_ART

/** svg 裡濾鏡的 id(useId 的冒號不能直接放進 url(#…)) */
const useArtId = (): string => `art${useId().replace(/[^a-zA-Z0-9]/g, '')}`

function Shadow({ id }: { id: string }) {
  return (
    <defs>
      <filter id={id} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="var(--art-shadow)" />
      </filter>
    </defs>
  )
}

/** 特色介紹的插圖;name 要先用 hasTopicArt 確認過 */
export function TopicArt({ name }: { name: string }) {
  const id = useArtId()
  const Art = FEATURE_ART[name]
  return (
    <svg viewBox="0 0 400 260" aria-hidden="true">
      <Shadow id={id} />
      <Art shadow={`url(#${id})`} />
    </svg>
  )
}

/** 導覽影片封面的底圖:左邊是自己寫的程式,右邊是說一句話、成果就出來 */
export function TourCoverArt() {
  const id = useArtId()
  const shadow = `url(#${id})`
  return (
    <svg viewBox="0 0 880 495" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Shadow id={id} />
      <g filter={shadow}>
        <rect x="70" y="92" width="330" height="300" rx="20" fill={CARD} stroke={LINE} />
      </g>
      <Dots x={94} y={116} />
      <path d="M70 138 h330" stroke={LINE} />
      {[150, 96, 190, 128, 170, 84, 140, 110].map((w, i) => (
        <g key={i}>
          <Bar x={96} y={162 + i * 27} w={10} h={8} color={LINE} />
          <Bar x={118 + (i % 3 === 1 ? 20 : i % 3 === 2 ? 40 : 0)} y={162 + i * 27} w={w} h={8} color={i === 2 ? WARM : i % 2 ? LINE : SOFT} />
        </g>
      ))}
      <g filter={shadow}>
        <path d="M506 70 h252 a20 20 0 0 1 20 20 v62 a20 20 0 0 1 -20 20 h-30 l6 22 l-30 -22 h-198 a20 20 0 0 1 -20 -20 v-62 a20 20 0 0 1 20 -20z" fill={ACC} />
      </g>
      <Bar x={512} y={102} w={196} h={11} color={ON} />
      <Bar x={512} y={126} w={132} h={10} color={ON} />
      <g filter={shadow}>
        <rect x="480" y="226" width="330" height="200" rx="20" fill={CARD} stroke={LINE} />
      </g>
      <Dots x={504} y={250} />
      <path d="M480 272 h330" stroke={LINE} />
      <rect x="504" y="292" width="282" height="56" rx="12" fill={TINT} />
      <Bar x={522} y={314} w={120} h={12} color={ACC} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={504 + i * 98} y="364" width="86" height="42" rx="10" fill={i === 0 ? SOFT : LINE} />
      ))}
      <Spark x={440} y={86} r={18} />
      <Spark x={826} y={214} r={11} color={ACC} />
      <Spark x={44} y={410} r={9} color={ACC} />
    </svg>
  )
}
