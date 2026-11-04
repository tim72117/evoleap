import type { JSX } from 'react'
import type { CourseArt } from '../content/levels'

/* Simple inline SVG illustrations for the course-map cards (no external images).
   Colours are fixed tints of the site's leaf-green palette; DEEP is the warm-brown highlight (sparkles, key bars). */

const W = '#ffffff'
const SOFT = '#e2ecd2'
const MID = '#a3c46e'
const ACC = '#4d7c1f'
const DEEP = '#9a6238'

function Tools() {
  return (
    <>
      {/* project folder */}
      <path d="M22 50 h34 l8 9 h44 a8 8 0 0 1 8 8 v58 a8 8 0 0 1 -8 8 h-78 a8 8 0 0 1 -8 -8 v-67 a8 8 0 0 1 8 -8z" fill={SOFT} />
      <rect x="30" y="76" width="52" height="6" rx="3" fill={MID} />
      <rect x="30" y="90" width="40" height="6" rx="3" fill={W} />
      <rect x="30" y="104" width="46" height="6" rx="3" fill={W} />
      {/* generated one-page site */}
      <rect x="96" y="24" width="104" height="118" rx="10" fill={W} />
      <rect x="96" y="24" width="104" height="16" rx="10" fill={ACC} />
      <rect x="96" y="32" width="104" height="8" fill={ACC} />
      <rect x="106" y="48" width="60" height="8" rx="4" fill={DEEP} />
      <rect x="106" y="62" width="40" height="6" rx="3" fill={MID} />
      <rect x="106" y="78" width="26" height="22" rx="4" fill={SOFT} />
      <rect x="137" y="78" width="26" height="22" rx="4" fill={SOFT} />
      <rect x="168" y="78" width="22" height="22" rx="4" fill={SOFT} />
      <rect x="106" y="108" width="84" height="6" rx="3" fill={SOFT} />
      <rect x="106" y="120" width="64" height="6" rx="3" fill={SOFT} />
      {/* sparkle: AI did it */}
      <path d="M84 22 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill={DEEP} />
    </>
  )
}

function Chat() {
  return (
    <>
      {/* user bubble */}
      <rect x="22" y="26" width="104" height="40" rx="14" fill={W} />
      <path d="M40 66 l-6 12 l18 -12z" fill={W} />
      <rect x="36" y="38" width="62" height="6" rx="3" fill={MID} />
      <rect x="36" y="50" width="40" height="6" rx="3" fill={SOFT} />
      {/* AI bubble */}
      <rect x="74" y="80" width="124" height="52" rx="14" fill={ACC} />
      <path d="M180 132 l8 12 l-22 -12z" fill={ACC} />
      <rect x="88" y="94" width="84" height="6" rx="3" fill={W} opacity="0.95" />
      <rect x="88" y="106" width="64" height="6" rx="3" fill={W} opacity="0.7" />
      <rect x="88" y="118" width="74" height="6" rx="3" fill={W} opacity="0.5" />
      {/* sparkle */}
      <path d="M176 30 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4z" fill={DEEP} />
      <circle cx="158" cy="56" r="4" fill={MID} />
    </>
  )
}

function Build() {
  return (
    <>
      {/* browser window */}
      <rect x="20" y="22" width="150" height="112" rx="12" fill={W} />
      <rect x="20" y="22" width="150" height="22" rx="12" fill={SOFT} />
      <rect x="20" y="34" width="150" height="10" fill={SOFT} />
      <circle cx="34" cy="33" r="4" fill={MID} />
      <circle cx="46" cy="33" r="4" fill={MID} />
      <circle cx="58" cy="33" r="4" fill={MID} />
      {/* small app inside */}
      <rect x="34" y="56" width="70" height="8" rx="4" fill={ACC} />
      <rect x="34" y="72" width="122" height="22" rx="6" fill={SOFT} />
      <rect x="34" y="102" width="52" height="20" rx="6" fill={DEEP} />
      {/* code brackets badge */}
      <circle cx="176" cy="112" r="28" fill={ACC} />
      <path d="M166 102 l-10 10 l10 10 M186 102 l10 10 l-10 10" stroke={W} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

function Agent() {
  return (
    <>
      {/* links */}
      <g stroke={W} strokeWidth="4" strokeLinecap="round" opacity="0.85">
        <line x1="110" y1="80" x2="40" y2="36" />
        <line x1="110" y1="80" x2="182" y2="36" />
        <line x1="110" y1="80" x2="40" y2="126" />
        <line x1="110" y1="80" x2="182" y2="126" />
      </g>
      {/* tool nodes */}
      <rect x="20" y="18" width="40" height="36" rx="10" fill={W} />
      <path d="M30 44 v-8 M38 44 v-14 M46 44 v-10" stroke={ACC} strokeWidth="4" strokeLinecap="round" />
      <rect x="162" y="18" width="40" height="36" rx="10" fill={W} />
      <path d="M172 36 h20 M172 28 h14 M172 44 h18" stroke={ACC} strokeWidth="4" strokeLinecap="round" />
      <rect x="20" y="108" width="40" height="36" rx="10" fill={W} />
      <circle cx="40" cy="126" r="9" fill="none" stroke={ACC} strokeWidth="4" />
      <rect x="162" y="108" width="40" height="36" rx="10" fill={W} />
      <path d="M172 130 l8 -10 l6 6 l8 -10" stroke={ACC} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* agent core */}
      <circle cx="110" cy="80" r="34" fill={DEEP} stroke={W} strokeWidth="5" />
      <rect x="92" y="66" width="36" height="28" rx="9" fill={W} />
      <circle cx="102" cy="80" r="4" fill={DEEP} />
      <circle cx="118" cy="80" r="4" fill={DEEP} />
      <line x1="110" y1="66" x2="110" y2="58" stroke={W} strokeWidth="4" strokeLinecap="round" />
      <circle cx="110" cy="55" r="4" fill={W} />
    </>
  )
}

function Advanced() {
  return (
    <>
      {/* stacked layers */}
      <path d="M110 112 l70 -26 l-70 -26 l-70 26z" fill={SOFT} opacity="0.7" />
      <path d="M110 96 l70 -26 l-70 -26 l-70 26z" fill={W} opacity="0.85" />
      <path d="M110 80 l70 -26 l-70 -26 l-70 26z" fill={W} />
      <path d="M110 70 l42 -16 l-42 -16 l-42 16z" fill={ACC} />
      {/* rising arrow */}
      <path d="M110 150 v-36" stroke={W} strokeWidth="5" strokeLinecap="round" />
      <path d="M100 124 l10 -12 l10 12" stroke={W} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="44" cy="134" r="5" fill={W} opacity="0.7" />
      <circle cx="178" cy="132" r="7" fill={W} opacity="0.5" />
      <path d="M182 16 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill={W} />
    </>
  )
}

const ART: Record<CourseArt, () => JSX.Element> = { tools: Tools, chat: Chat, build: Build, agent: Agent, advanced: Advanced }

export function LevelArt({ art }: { art: CourseArt }) {
  const Art = ART[art]
  return (
    <svg viewBox="0 0 220 160" role="presentation" aria-hidden="true" focusable="false">
      <Art />
    </svg>
  )
}
