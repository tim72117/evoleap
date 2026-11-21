// 演員 bobo 的圖:四個場景(公園、家裡餐桌、浴室、臥室)與小熊波波的身體、五官。全部是 SVG 字串,
// 座標是 1920×1080 的「世界」(直式只看中間 480–1440 那一條,所以會互動的東西都放在這一條裡,兩旁只放裝飾)。
// 小熊的座標原點在兩腳中間的地面,往上是負的(頭頂約 -460)。

export const FUR = '#b97c4c'
export const FUR_WET = '#946139'
export const LIGHT = '#f3d6ab'
export const DARK = '#4a2e1f'
export const INK = '#2b1d14'
export const MUD = '#7a5233'
export const SAND = '#e6c47c'

/** 世界的範圍:橫式看整張,直式看中間一條 */
export const VIEW = {
  landscape: [0, 0, 1920, 1080] as const,
  portrait: [480, -260, 960, 1707] as const,
}

// ---------- 場景 ----------

const tree = (x: number, y: number, k = 1) =>
  `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-22" y="-210" width="44" height="220" rx="16" fill="#9a6a45"/>` +
  `<circle cx="0" cy="-260" r="120" fill="#7fbf63"/><circle cx="-90" cy="-200" r="80" fill="#74b45a"/><circle cx="92" cy="-205" r="84" fill="#86c66a"/>` +
  `<circle cx="-30" cy="-330" r="70" fill="#8fce72"/><circle cx="40" cy="-300" r="26" fill="#ff8f7a"/><circle cx="-60" cy="-240" r="20" fill="#ff8f7a"/></g>`

const flower = (x: number, y: number, c: string) =>
  `<g transform="translate(${x} ${y})"><path d="M0 0 L0 26" stroke="#5f9e47" stroke-width="5"/>` +
  [0, 72, 144, 216, 288].map((a) => `<circle cx="${(Math.cos((a * Math.PI) / 180) * 10).toFixed(1)}" cy="${(Math.sin((a * Math.PI) / 180) * 10).toFixed(1)}" r="8" fill="${c}"/>`).join('') +
  `<circle r="6" fill="#ffd34d"/></g>`

const cloud = (cls: string, k: number) =>
  `<g class="${cls}"><g transform="scale(${k})"><ellipse cx="0" cy="0" rx="90" ry="38" fill="#fff"/><circle cx="-40" cy="-22" r="40" fill="#fff"/><circle cx="26" cy="-34" r="50" fill="#fff"/></g></g>`

export function parkSvg(id: string): string {
  return (
    `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3f4"/><stop offset="1" stop-color="#e7f7ef"/></linearGradient></defs>` +
    `<rect x="-600" y="-900" width="3120" height="1700" fill="url(#${id}-sky)"/>` +
    `<g class="bb-sun" transform="translate(620 120)"><circle r="96" fill="#ffe79a" opacity=".55"/><circle r="66" fill="#ffd45e"/></g>` +
    cloud('bb-cloud1', 1.1) + cloud('bb-cloud2', 0.8) + cloud('bb-cloud3', 0.9) +
    `<ellipse cx="300" cy="820" rx="760" ry="230" fill="#b6df8c"/><ellipse cx="1650" cy="830" rx="820" ry="250" fill="#a5d67c"/>` +
    `<rect x="-600" y="770" width="3120" height="1200" fill="#9bcf6c"/>` +
    `<path d="M-600 1060 C 400 990 1500 1130 2520 1040 L2520 1980 L-600 1980 Z" fill="#8fc562"/>` +
    tree(250, 800, 1.1) + tree(1690, 790, 1.2) + tree(1420, 780, 0.55) +
    flower(560, 1010, '#ff9ab3') + flower(620, 1040, '#ffffff') + flower(1340, 1020, '#b49cff') + flower(1390, 1050, '#ff9ab3') + flower(520, 880, '#ffffff') +
    // 水坑
    `<g class="bb-puddle"><ellipse cx="800" cy="948" rx="170" ry="36" fill="${MUD}"/><ellipse cx="800" cy="944" rx="150" ry="28" fill="#8e6a48"/>` +
    `<ellipse cx="770" cy="938" rx="80" ry="10" fill="#b9d8e6" opacity=".55"/></g>` +
    // 沙坑
    `<g class="bb-sandbox"><rect x="1040" y="880" width="290" height="62" rx="10" fill="#c58c55"/><rect x="1052" y="874" width="266" height="20" rx="8" fill="#d9a46b"/>` +
    `<path d="M1060 884 C1110 846 1180 850 1210 870 C1240 852 1290 856 1310 884 Z" fill="${SAND}"/>` +
    `<g transform="translate(1290 860)"><path d="M-16 -20 L16 -20 L12 14 L-12 14 Z" fill="#ff7a6b"/><path d="M-16 -20 Q0 -44 16 -20" stroke="#d95b4d" stroke-width="4" fill="none"/></g></g>`
  )
}

export function homeSvg(id: string): string {
  const planks = [0, 1, 2, 3, 4, 5].map((i) => `<path d="M-600 ${900 + i * 60} L2520 ${900 + i * 60}" stroke="#c69466" stroke-width="3"/>`).join('')
  return (
    `<defs><linearGradient id="${id}-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d5ba6"/><stop offset=".55" stop-color="#f08a6b"/><stop offset="1" stop-color="#ffc98a"/></linearGradient></defs>` +
    `<rect x="-600" y="-900" width="3120" height="1780" fill="#f7e5c9"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => `<rect x="${-600 + i * 200}" y="-900" width="70" height="1500" fill="#f2dcbc"/>`).join('') +
    `<rect x="-600" y="600" width="3120" height="280" fill="#ecc99d"/><rect x="-600" y="596" width="3120" height="14" fill="#dcb07c"/>` +
    // 窗戶:傍晚
    `<g><rect x="500" y="150" width="300" height="300" rx="14" fill="#fff"/><rect x="516" y="166" width="268" height="268" rx="6" fill="url(#${id}-dusk)"/>` +
    `<circle cx="700" cy="380" r="36" fill="#ffe3a3"/><path d="M650 166 L650 434 M516 300 L784 300" stroke="#fff" stroke-width="12"/>` +
    `<rect x="486" y="446" width="328" height="20" rx="6" fill="#e8d2b4"/></g>` +
    // 牆上的畫:一顆蜂蜜罐
    `<g transform="translate(1320 250)"><rect x="-80" y="-70" width="160" height="140" rx="8" fill="#ffffff" stroke="#c99a6a" stroke-width="10"/>` +
    `<path d="M-30 -20 L30 -20 L36 40 L-36 40 Z" fill="#ffc94a"/><rect x="-34" y="-34" width="68" height="16" rx="5" fill="#d98b3a"/></g>` +
    `<rect x="-600" y="880" width="3120" height="1100" fill="#d9aa7a"/>` + planks +
    // 椅背(在小熊後面)
    `<rect x="860" y="530" width="200" height="250" rx="40" fill="#b7784a"/><rect x="884" y="556" width="152" height="200" rx="30" fill="#c98d5c"/>`
  )
}

/** 餐桌與食物(在小熊前面) */
export function homeFrontSvg(): string {
  return (
    `<g class="bb-table"><rect x="620" y="738" width="680" height="34" rx="12" fill="#c58a57"/>` +
    `<path d="M640 770 L1280 770 L1268 900 L652 900 Z" fill="#fbf6ee"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${660 + i * 78}" y="770" width="38" height="130" fill="#f6a8a0" opacity=".55"/>`).join('') +
    `<rect x="640" y="770" width="640" height="16" fill="#f3d8c8"/>` +
    `<rect x="670" y="900" width="26" height="120" rx="8" fill="#a8703f"/><rect x="1224" y="900" width="26" height="120" rx="8" fill="#a8703f"/></g>` +
    // 盤子、鬆餅、玉米
    `<g class="bb-plate"><ellipse cx="1060" cy="744" rx="100" ry="20" fill="#ffffff" stroke="#e5ddd0" stroke-width="4"/>` +
    `<g class="bb-pancake"><ellipse cx="1040" cy="722" rx="56" ry="14" fill="#e3a65c"/><ellipse cx="1040" cy="708" rx="56" ry="14" fill="#eeb56b"/><ellipse cx="1040" cy="694" rx="56" ry="14" fill="#f2c27a"/>` +
    `<path d="M1010 690 C1020 700 1030 712 1028 726 M1060 688 C1066 700 1064 712 1070 722" stroke="#f7a823" stroke-width="7" stroke-linecap="round" fill="none"/></g>` +
    `<g class="bb-corn"><ellipse cx="1112" cy="728" rx="40" ry="16" transform="rotate(-12 1112 728)" fill="#ffd54a"/>` +
    [0, 1, 2, 3].map((i) => `<circle cx="${1088 + i * 16}" cy="${734 - i * 3}" r="4" fill="#f2b632"/>`).join('') +
    `<path d="M1148 718 L1172 702 L1166 726 Z" fill="#8fc562"/></g></g>` +
    // 蜂蜜罐
    `<g transform="translate(800 712)"><path d="M-26 -30 L26 -30 L32 30 L-32 30 Z" fill="#ffc94a" opacity=".9"/><rect x="-30" y="-44" width="60" height="16" rx="5" fill="#d98b3a"/><path d="M-14 -4 L14 -4" stroke="#fff" stroke-width="5" opacity=".6"/></g>`
  )
}

export function bathSvg(): string {
  const tiles: string[] = []
  for (let r = 0; r < 8; r++) for (let c = 0; c < 26; c++) tiles.push(`<rect x="${-600 + c * 120 + (r % 2) * 60}" y="${300 + r * 70}" width="114" height="64" rx="6" fill="#d3ecea"/>`)
  return (
    `<rect x="-600" y="-900" width="3120" height="1780" fill="#e9f6f3"/>` +
    `<rect x="-600" y="296" width="3120" height="584" fill="#c4e2df"/>` + tiles.join('') +
    `<rect x="-600" y="860" width="3120" height="1100" fill="#bcd6db"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => `<path d="M${-600 + i * 240} 860 L${-900 + i * 240} 1980" stroke="#aac7cd" stroke-width="4"/>`).join('') +
    // 蓮蓬頭
    `<g class="bb-shower"><path d="M590 -300 L590 220 Q590 250 620 250 L700 250" stroke="#a9b8bd" stroke-width="16" fill="none" stroke-linecap="round"/>` +
    `<path d="M664 250 L736 250 L752 286 L648 286 Z" fill="#c3d0d4"/><ellipse cx="700" cy="288" rx="54" ry="10" fill="#9fb0b5"/></g>` +
    // 毛巾架
    `<g><rect x="930" y="400" width="150" height="12" rx="6" fill="#a9b8bd"/><g class="bb-rack-towel"><path d="M950 406 L1060 406 L1056 560 L954 560 Z" fill="#ff9e8a"/>` +
    `<path d="M954 520 L1056 520" stroke="#ffffff" stroke-width="8" opacity=".7"/></g></g>` +
    // 浴缸後緣
    `<ellipse cx="700" cy="700" rx="214" ry="30" fill="#e3edf0"/>` +
    // 洗手台與鏡子
    `<g class="bb-mirror"><rect x="1216" y="214" width="208" height="292" rx="30" fill="#ffffff" stroke="#b3d1d4" stroke-width="8"/>` +
    `<rect x="1230" y="228" width="180" height="264" rx="22" fill="#cfe8ef"/></g>` +
    `<g class="bb-sink"><rect x="1290" y="660" width="60" height="220" rx="16" fill="#f4f8f9"/>` +
    `<path d="M1206 608 L1434 608 Q1430 676 1320 680 Q1210 676 1206 608 Z" fill="#ffffff" stroke="#d6e3e6" stroke-width="5"/>` +
    `<path d="M1320 608 L1320 570 Q1320 556 1338 556 L1362 556" stroke="#a9b8bd" stroke-width="12" fill="none" stroke-linecap="round"/>` +
    `<g transform="translate(1410 586)"><rect x="-16" y="-24" width="32" height="44" rx="8" fill="#9fd0ff" opacity=".85"/>` +
    `<g class="bb-holder-brush"><rect x="-2" y="-62" width="7" height="50" rx="3" fill="#ff7aa8"/><rect x="-4" y="-74" width="11" height="16" rx="3" fill="#ffffff"/></g></g></g>`
  )
}

/** 浴缸前面、洗衣籃(在小熊前面) */
export function bathFrontSvg(): string {
  return (
    `<ellipse class="bb-water" cx="700" cy="712" rx="196" ry="22" fill="#a9daf0" opacity=".8"/>` +
    `<g class="bb-tub"><path d="M478 700 L922 700 Q918 880 820 890 L580 890 Q482 880 478 700 Z" fill="#ffffff" stroke="#d6e3e6" stroke-width="6"/>` +
    `<path d="M500 730 L900 730" stroke="#eef4f6" stroke-width="10"/>` +
    `<path d="M540 888 L524 930 M860 888 L876 930" stroke="#c8a24a" stroke-width="16" stroke-linecap="round"/></g>` +
    `<ellipse cx="700" cy="960" rx="150" ry="22" fill="#9fd0c8" opacity=".7"/>` +
    `<g class="bb-basket" transform="translate(940 960)"><g class="bb-basket-cloth" opacity="0"><path d="M-40 -84 L40 -84 L34 -40 L-34 -40 Z" fill="#f2b84b"/><circle cx="-18" cy="-70" r="6" fill="#c98a1b"/></g>` +
    `<path d="M-70 -60 L70 -60 L56 0 L-56 0 Z" fill="#d9b07a"/>` +
    [0, 1, 2].map((i) => `<path d="M-66 ${-46 + i * 16} L66 ${-46 + i * 16}" stroke="#c0935a" stroke-width="4"/>`).join('') +
    `<rect x="-76" y="-66" width="152" height="14" rx="6" fill="#c99a5f"/></g>`
  )
}

export function bedSvg(id: string): string {
  return (
    `<defs><radialGradient id="${id}-glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".8"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>` +
    `<rect x="-600" y="-900" width="3120" height="1820" fill="#47528a"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((i) => `<circle cx="${-560 + i * 170}" cy="${-200 + (i % 3) * 260}" r="5" fill="#6b76ad"/>`).join('') +
    // 窗戶:夜空、月亮、星星
    `<g><rect x="500" y="140" width="280" height="280" rx="16" fill="#e8dcc6"/><rect x="516" y="156" width="248" height="248" rx="8" fill="#1d2550"/>` +
    `<path d="M690 210 A46 46 0 1 0 734 280 A36 36 0 1 1 690 210 Z" fill="#fff0b8"/>` +
    `<g class="bb-stars"><circle cx="560" cy="200" r="5" fill="#fff"/><circle cx="600" cy="330" r="4" fill="#fff"/><circle cx="660" cy="250" r="3" fill="#fff"/><circle cx="560" cy="380" r="3" fill="#fff"/></g>` +
    `<path d="M640 156 L640 404 M516 280 L764 280" stroke="#e8dcc6" stroke-width="10"/></g>` +
    // 床頭櫃與小燈
    `<circle cx="1390" cy="640" r="200" fill="url(#${id}-glow)"/>` +
    `<rect x="1330" y="760" width="120" height="140" rx="10" fill="#9b6b4b"/><rect x="1376" y="690" width="12" height="70" fill="#d8c3a5"/>` +
    `<path d="M1340 690 L1424 690 L1404 640 L1360 640 Z" fill="#ffd98a"/>` +
    `<rect x="-600" y="900" width="3120" height="1100" fill="#7d6352"/><ellipse cx="960" cy="1030" rx="380" ry="56" fill="#c98f8f"/><ellipse cx="960" cy="1030" rx="320" ry="40" fill="#d9a3a0"/>` +
    // 床:床頭板、床墊、枕頭
    `<g class="bb-bed"><rect x="590" y="560" width="54" height="340" rx="20" fill="#b97b4f"/><rect x="1280" y="690" width="44" height="210" rx="16" fill="#b97b4f"/>` +
    `<rect x="620" y="752" width="690" height="70" rx="20" fill="#fbf7ef"/>` +
    `<ellipse cx="722" cy="742" rx="86" ry="34" fill="#ffffff" stroke="#e3dccd" stroke-width="4"/></g>` +
    `<g class="bb-sheet-sand">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => `<circle cx="${820 + ((i * 97) % 440)}" cy="${770 + ((i * 37) % 30)}" r="${3 + (i % 3)}" fill="${SAND}"/>`).join('')}</g>` +
    // 沒睡在床上時,被子摺在床尾
    `<g class="bb-blanket-back"><path d="M1060 742 L1300 742 Q1312 790 1300 826 L1060 826 Q1048 784 1060 742 Z" fill="#7fa3d9"/>` +
    `<path d="M1080 760 L1290 760" stroke="#a9c3ea" stroke-width="6"/></g>`
  )
}

/** 蓋在身上的被子與床框(在小熊前面) */
export function bedFrontSvg(): string {
  const stars = [0, 1, 2, 3, 4, 5].map((i) => `<path transform="translate(${900 + i * 70} ${760 + (i % 2) * 34}) scale(.9)" d="M0 -10 L3 -3 L10 -3 L4 2 L6 10 L0 5 L-6 10 L-4 2 L-10 -3 L-3 -3 Z" fill="#fff3b0"/>`).join('')
  return (
    `<g class="bb-blanket"><path d="M828 704 Q1060 668 1306 712 Q1320 790 1306 846 L838 846 Q818 774 828 704 Z" fill="#7fa3d9"/>` +
    `<path d="M836 716 Q1060 684 1302 724" stroke="#a9c3ea" stroke-width="10" fill="none"/>${stars}</g>` +
    `<rect x="606" y="820" width="712" height="64" rx="14" fill="#a8704a"/><rect x="620" y="880" width="20" height="40" fill="#8c5a3a"/><rect x="1280" y="880" width="20" height="40" fill="#8c5a3a"/>`
  )
}

// ---------- 小熊 ----------

/** 身上泥巴的位置(身體座標);依序出現 */
export const BODY_MUD: readonly (readonly [number, number, number])[] = [
  [-50, -40, 1.1], [52, -66, 0.9], [-70, -120, 0.8], [36, -24, 0.7], [70, -150, 0.9], [-24, -86, 0.6], [10, -190, 0.7], [-84, -180, 0.6],
]
export const HEAD_MUD: readonly (readonly [number, number, number])[] = [
  [-74, 34, 0.75], [58, -64, 0.6], [86, 20, 0.5],
]

const splat = (x: number, y: number, k: number, i: number) =>
  `<g transform="translate(${x} ${y}) rotate(${(i * 47) % 360}) scale(${k})"><ellipse rx="20" ry="14" fill="${MUD}"/><circle cx="16" cy="-9" r="7" fill="${MUD}"/><circle cx="-18" cy="7" r="6" fill="${MUD}"/><circle cx="4" cy="14" r="4" fill="${MUD}"/></g>`

export const mudSvg = (list: readonly (readonly [number, number, number])[], cls: string) =>
  list.map(([x, y, k], i) => `<g class="${cls}" data-i="${i}" opacity="0">${splat(x, y, k, i)}</g>`).join('')

export const sandDots = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${3 + (i % 3)}" fill="${SAND}" stroke="#c9a05a" stroke-width="1"/>`).join('')

/** 吊帶褲(黃) */
export const OVERALL =
  `<path d="M-112 -110 C-110 -60 -100 -22 -60 -14 L60 -14 C100 -22 110 -60 112 -110 Z" fill="#f2b84b"/>` +
  `<rect x="-60" y="-196" width="120" height="96" rx="16" fill="#f2b84b"/>` +
  `<path d="M-52 -190 L-86 -246 M52 -190 L86 -246" stroke="#f2b84b" stroke-width="20" stroke-linecap="round"/>` +
  `<circle cx="-40" cy="-182" r="8" fill="#c98a1b"/><circle cx="40" cy="-182" r="8" fill="#c98a1b"/>` +
  `<path d="M-28 -150 L28 -150 L24 -118 L-24 -118 Z" fill="#e3a234"/><path d="M0 -110 L0 -24" stroke="#e3a234" stroke-width="5"/>`

/** 睡衣(淺藍、小星星) */
export const PAJAMAS =
  `<path d="M-110 -80 C-122 -190 -78 -262 0 -262 C78 -262 122 -190 110 -80 C102 -28 58 -12 0 -12 C-58 -12 -102 -28 -110 -80 Z" fill="#a9c8ef"/>` +
  `<path d="M-40 -258 L0 -222 L40 -258" stroke="#ffffff" stroke-width="10" fill="none" stroke-linejoin="round"/>` +
  [[-60, -150], [50, -190], [20, -90], [-30, -60], [70, -110], [-80, -210]].map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0 -9 L3 -3 L9 -3 L4 2 L6 9 L0 5 L-6 9 L-4 2 L-9 -3 L-3 -3 Z" fill="#fff3b0"/>`).join('') +
  `<circle cx="0" cy="-190" r="6" fill="#ffffff"/><circle cx="0" cy="-150" r="6" fill="#ffffff"/>`

const arm = (side: 'L' | 'R') =>
  `<g class="bb-arm${side}"><rect x="-28" y="-16" width="56" height="134" rx="28" class="bb-fur" style="fill:var(--bb-fur)"/>` +
  `<rect x="-29" y="-18" width="58" height="70" rx="28" class="bb-sleeve" fill="#a9c8ef" opacity="0"/>` +
  `<ellipse cx="0" cy="108" rx="22" ry="16" fill="${LIGHT}"/>` +
  `<g class="bb-pawmud" opacity="0">${splat(-6, 100, 0.6, side === 'L' ? 3 : 5)}</g>` +
  `<g class="bb-pawsand" opacity="0">${sandDots([[-14, 118], [10, 122], [2, 110]])}</g>` +
  `<g class="bb-held"></g></g>`

const leg = (side: 'L' | 'R') =>
  `<g class="bb-leg${side}"><ellipse cx="0" cy="0" rx="42" ry="54" class="bb-fur" style="fill:var(--bb-fur)"/><ellipse cx="0" cy="0" rx="43" ry="55" class="bb-pant" fill="#a9c8ef" opacity="0"/>` +
  `<ellipse cx="0" cy="40" rx="34" ry="14" fill="${LIGHT}"/></g>`

/** 整隻小熊(不含五官;五官依表情每格換) */
export function bearSvg(): string {
  return (
    `<ellipse class="bb-shadow" cx="0" cy="0" rx="120" ry="18" fill="#000" opacity=".14"/>` +
    `<g class="bb-legs"><g transform="translate(-48 -50)">${leg('L')}</g><g transform="translate(48 -50)">${leg('R')}</g></g>` +
    `<path class="bb-fur" style="fill:var(--bb-fur)" d="M-110 -80 C-122 -190 -78 -262 0 -262 C78 -262 122 -190 110 -80 C102 -28 58 -12 0 -12 C-58 -12 -102 -28 -110 -80 Z"/>` +
    `<ellipse cx="0" cy="-128" rx="64" ry="74" fill="${LIGHT}"/>` +
    `<g class="bb-clothes"></g>` +
    `<g class="bb-bodymud">${mudSvg(BODY_MUD, 'bb-mb')}</g>` +
    `<g class="bb-foam-body"></g>` +
    `<g class="bb-head">` +
    `<circle class="bb-fur" style="fill:var(--bb-fur)" cx="-86" cy="-86" r="42"/><circle cx="-86" cy="-86" r="24" fill="#e9a98a"/>` +
    `<circle class="bb-fur" style="fill:var(--bb-fur)" cx="86" cy="-86" r="42"/><circle cx="86" cy="-86" r="24" fill="#e9a98a"/>` +
    `<circle class="bb-fur" style="fill:var(--bb-fur)" cx="0" cy="0" r="128"/>` +
    `<path d="M-40 -116 C-30 -134 -10 -138 0 -128 C10 -140 34 -136 40 -116" stroke="#a46a3e" stroke-width="10" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="0" cy="48" rx="64" ry="48" fill="${LIGHT}"/>` +
    `<ellipse cx="0" cy="24" rx="22" ry="15" fill="${DARK}"/><ellipse cx="-6" cy="19" rx="7" ry="4" fill="#ffffff" opacity=".6"/>` +
    `<g class="bb-face"></g>` +
    `<g class="bb-headmud">${mudSvg(HEAD_MUD, 'bb-hm')}</g>` +
    `<g class="bb-headsand" opacity="0">${sandDots([[-96, -70], [-80, -96], [-104, -90], [92, -74], [80, -100]])}</g>` +
    `<g class="bb-crumbs" opacity="0"><circle cx="34" cy="80" r="5" fill="#e9b85a"/><circle cx="44" cy="70" r="4" fill="#e9b85a"/><circle cx="-38" cy="84" r="4" fill="#e9b85a"/><circle cx="28" cy="94" r="3" fill="#f7a823"/></g>` +
    `<g class="bb-fluff" opacity="0">${[...Array(14)].map((_, i) => {
      const a = (i / 14) * Math.PI * 2
      const r = 128
      return `<path d="M${(Math.cos(a - 0.12) * r).toFixed(1)} ${(Math.sin(a - 0.12) * r).toFixed(1)} L${(Math.cos(a) * (r + 18)).toFixed(1)} ${(Math.sin(a) * (r + 18)).toFixed(1)} L${(Math.cos(a + 0.12) * r).toFixed(1)} ${(Math.sin(a + 0.12) * r).toFixed(1)} Z" class="bb-fur" style="fill:var(--bb-fur)"/>`
    }).join('')}</g>` +
    `<g class="bb-foam-head"></g>` +
    `<g class="bb-towel" opacity="0"><path d="M-140 -60 Q-150 -150 0 -150 Q150 -150 140 -60 L120 40 L90 -40 Q0 -70 -90 -40 L-120 40 Z" fill="#ff9e8a"/><path d="M-110 -100 Q0 -126 110 -100" stroke="#ffffff" stroke-width="8" fill="none" opacity=".7"/></g>` +
    `<rect class="bb-mouthbox" x="-70" y="30" width="140" height="90" fill="none"/>` +
    `</g>` +
    `<g class="bb-arms"><g class="bb-armLpos" transform="translate(-96 -228)">${arm('L')}</g><g class="bb-armRpos" transform="translate(96 -228)">${arm('R')}</g></g>`
  )
}

// ---------- 五官 ----------

export type Face =
  | 'calm' | 'happy' | 'laugh' | 'grumpy' | 'sleepy' | 'sleep' | 'itchy' | 'tongue' | 'curious' | 'proud' | 'brush' | 'puff' | 'chew'

export interface FaceOpts {
  blink: boolean
  /** 說話時嘴巴開合 */
  talk: boolean
  /** 牙齒上那層黏黏的東西 0–1 */
  film: number
  /** 刷牙的泡泡 0–1 */
  foam: number
  /** 舌頭左右(tongue) */
  lick: number
  /** 咀嚼開合 0–1 */
  chew: number
}

const st = (w = 7) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"`

const eyeOpen = (x: number, k = 1) =>
  `<ellipse cx="${x}" cy="-12" rx="${(12 * k).toFixed(1)}" ry="${(15 * k).toFixed(1)}" fill="${INK}"/><circle cx="${x + 4}" cy="-18" r="${(4.5 * k).toFixed(1)}" fill="#ffffff"/>`

export function faceSvg(face: Face, o: FaceOpts): string {
  let eyes = o.blink ? `<path d="M-58 -12 L-34 -12" ${st()}/><path d="M34 -12 L58 -12" ${st()}/>` : eyeOpen(-46) + eyeOpen(46)
  let brows = `<path d="M-62 -48 Q-46 -58 -30 -48" ${st(6)}/><path d="M30 -48 Q46 -58 62 -48" ${st(6)}/>`
  let mouth = o.talk ? `<ellipse cx="0" cy="76" rx="15" ry="13" fill="#7a2e2a"/><ellipse cx="0" cy="84" rx="9" ry="5" fill="#e77b7b"/>` : `<path d="M-22 68 Q0 88 22 68" ${st(6)}/>`
  let cheeks = `<ellipse cx="-82" cy="40" rx="20" ry="12" fill="#f19a87" opacity=".5"/><ellipse cx="82" cy="40" rx="20" ry="12" fill="#f19a87" opacity=".5"/>`
  let extra = ''
  const arcs = (dy: number) => `<path d="M-60 -10 Q-46 ${-10 + dy} -32 -10" ${st()}/><path d="M32 -10 Q46 ${-10 + dy} 60 -10" ${st()}/>`
  switch (face) {
    case 'happy':
      eyes = arcs(-16)
      if (!o.talk) mouth = `<path d="M-26 64 Q0 96 26 64" ${st(6)}/>`
      cheeks = cheeks.replace(/opacity="\.5"/g, 'opacity=".85"')
      break
    case 'laugh':
    case 'proud':
      eyes = arcs(-16)
      mouth = `<path d="M-32 62 Q0 ${o.talk ? 112 : 104} 32 62 Z" fill="#7a2e2a"/><path d="M-14 92 Q0 ${o.talk ? 106 : 100} 14 92" fill="#e77b7b"/>`
      cheeks = cheeks.replace(/opacity="\.5"/g, 'opacity=".9"')
      if (face === 'proud') brows = `<path d="M-62 -54 Q-46 -66 -30 -54" ${st(6)}/><path d="M30 -54 Q46 -66 62 -54" ${st(6)}/>`
      break
    case 'grumpy':
      eyes = o.blink ? eyes : `<ellipse cx="-46" cy="-8" rx="12" ry="11" fill="${INK}"/><ellipse cx="46" cy="-8" rx="12" ry="11" fill="${INK}"/>`
      brows = `<path d="M-64 -40 L-30 -28" ${st(7)}/><path d="M30 -28 L64 -40" ${st(7)}/>`
      if (!o.talk) mouth = `<path d="M-18 82 Q0 68 18 82" ${st(6)}/>`
      cheeks = `<ellipse cx="-82" cy="40" rx="22" ry="14" fill="#f19a87" opacity=".75"/><ellipse cx="82" cy="40" rx="22" ry="14" fill="#f19a87" opacity=".75"/>`
      break
    case 'sleepy':
      eyes = `<path d="M-60 -10 Q-46 -2 -32 -10" ${st()}/><path d="M32 -10 Q46 -2 60 -10" ${st()}/>`
      if (!o.talk) mouth = `<ellipse cx="0" cy="78" rx="10" ry="9" fill="#7a2e2a"/>`
      break
    case 'sleep':
      eyes = `<path d="M-60 -12 Q-46 0 -32 -12" ${st()}/><path d="M32 -12 Q46 0 60 -12" ${st()}/>`
      mouth = `<path d="M-14 72 Q0 82 14 72" ${st(5)}/>`
      break
    case 'itchy':
      eyes = `<path d="M-60 -24 L-36 -12 L-60 0" ${st()}/><path d="M60 -24 L36 -12 L60 0" ${st()}/>`
      brows = `<path d="M-64 -46 L-32 -38" ${st(6)}/><path d="M32 -38 L64 -46" ${st(6)}/>`
      mouth = `<path d="M-24 78 L-12 70 L0 78 L12 70 L24 78" ${st(6)}/>`
      break
    case 'tongue': {
      const tx = (o.lick * 18).toFixed(1)
      eyes = `<ellipse cx="-40" cy="-12" rx="12" ry="15" fill="${INK}"/><ellipse cx="52" cy="-12" rx="12" ry="15" fill="${INK}"/><circle cx="-36" cy="-18" r="4" fill="#fff"/><circle cx="56" cy="-18" r="4" fill="#fff"/>`
      brows = `<path d="M-62 -52 Q-46 -62 -30 -52" ${st(6)}/><path d="M30 -46 Q46 -50 62 -46" ${st(6)}/>`
      mouth = `<ellipse cx="0" cy="74" rx="20" ry="12" fill="#7a2e2a"/><ellipse cx="${tx}" cy="84" rx="13" ry="11" fill="#e77b7b"/>`
      break
    }
    case 'curious':
      eyes = eyeOpen(-46, 1.15) + eyeOpen(46, 0.95)
      brows = `<path d="M-62 -60 Q-46 -72 -30 -60" ${st(6)}/><path d="M30 -48 Q46 -52 62 -48" ${st(6)}/>`
      if (!o.talk) mouth = `<ellipse cx="0" cy="78" rx="9" ry="11" fill="#7a2e2a"/>`
      break
    case 'chew': {
      eyes = arcs(-14)
      const h = 6 + o.chew * 12
      mouth = `<ellipse cx="0" cy="76" rx="${(16 + o.chew * 4).toFixed(1)}" ry="${h.toFixed(1)}" fill="#7a2e2a"/>`
      break
    }
    case 'puff':
      eyes = arcs(-10)
      cheeks = `<circle cx="-62" cy="56" r="34" fill="${LIGHT}"/><circle cx="62" cy="56" r="34" fill="${LIGHT}"/><ellipse cx="-74" cy="44" rx="18" ry="11" fill="#f19a87" opacity=".7"/><ellipse cx="74" cy="44" rx="18" ry="11" fill="#f19a87" opacity=".7"/>`
      mouth = `<ellipse cx="0" cy="78" rx="8" ry="6" fill="#7a2e2a"/>`
      break
    case 'brush': {
      eyes = o.blink ? eyes : eyeOpen(-46, 0.9) + eyeOpen(46, 0.9)
      // 張大嘴、露出上下排牙齒;牙齒上黏黏的那層依 film 顯示
      const teeth = (y: number, h: number) => [-24, -8, 8, 24].map((x) => `<rect x="${x - 7}" y="${y}" width="14" height="${h}" rx="3" fill="#ffffff"/>`).join('')
      const fuzz = o.film > 0.01
        ? `<g opacity="${(o.film * 0.85).toFixed(2)}"><rect x="-32" y="56" width="64" height="12" rx="4" fill="#d8cf6a"/><rect x="-32" y="86" width="64" height="12" rx="4" fill="#d8cf6a"/>` +
          [-26, -14, -2, 10, 22].map((x, i) => `<path d="M${x} ${i % 2 ? 58 : 88} q3 -5 6 0 q3 5 6 0" stroke="#b9ae45" stroke-width="2" fill="none"/>`).join('') + `</g>`
        : ''
      mouth = `<rect x="-38" y="52" width="76" height="50" rx="22" fill="#7a2e2a"/>${teeth(54, 14)}${teeth(86, 14)}${fuzz}`
      if (o.foam > 0) {
        extra += [[-40, 60], [40, 66], [-30, 100], [34, 98], [0, 106], [-46, 82], [46, 84]]
          .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${(5 + (i % 3) * 3) * o.foam}" fill="#ffffff" stroke="#d7eef7" stroke-width="2"/>`).join('')
      }
      break
    }
    default:
      break
  }
  return cheeks + brows + eyes + mouth + extra
}
