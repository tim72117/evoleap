// art/characters:白色人形機器人與旁邊的人(SVG 字串)+ 機器人手臂的繪製。座標是 1920×1080 舞台的 px。
// SVG 部分是純函式;會動的元素帶 class(`<前綴>-r-…`、`<前綴>-m-…`),由場景在每格改它們的屬性(見 drawRobotArm)。
// 預設值等於 agent-office 的版面;前綴預設 "ao"。
import { kit } from '../kit'
import { attr, fx } from './dom'
import { capsule, capsuleShine, solveArm, type Pt } from './geometry'
import { DEFAULT_DESK_Y } from './office'

/** 機器人的位置:頭的中心、半徑,脖子的轉軸,兩邊肩膀 */
export interface BotLayout {
  head: Pt
  rx: number
  ry: number
  neck: Pt
  nearShoulder: Pt
  farShoulder: Pt
}
export const DEFAULT_BOT: BotLayout = { head: { x: 1236, y: 438 }, rx: 108, ry: 118, neck: { x: 1244, y: 548 }, nearShoulder: { x: 1352, y: 652 }, farShoulder: { x: 1178, y: 628 } }

export interface BotOpts {
  prefix?: string
  bot?: BotLayout
  /** 桌面上緣(影子的位置) */
  deskY?: number
}
export interface ManOpts {
  prefix?: string
}

// ---------- 白色機器人 ----------
/**
 * 機器人的 SVG:椅背、遠側手臂、軀幹、脖子、頭(臉罩與耳燈會依轉頭的角度移動)、近側手臂。
 * 會動的元素帶 class(<前綴>-r-…),actor.ts 每格改它們的 d / transform。
 */
export function robotSvg(o: BotOpts = {}): string {
  const k = o.prefix ?? 'ao'
  const BOT = o.bot ?? DEFAULT_BOT
  const DESK_Y = o.deskY ?? DEFAULT_DESK_Y
  const h = BOT.head
  return (
    `<svg class="${k}-robotsvg" viewBox="0 0 1920 1080" aria-hidden="true">` +
    `<defs>` +
    `<radialGradient id="${k}-shell" cx=".3" cy=".25" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#eef3f8"/><stop offset=".8" stop-color="#c3cfdc"/><stop offset="1" stop-color="#8a9aac"/></radialGradient>` +
    `<radialGradient id="${k}-shell2" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e1e8ef"/><stop offset="1" stop-color="#93a3b5"/></radialGradient>` +
    `<linearGradient id="${k}-limb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#dfe6ee"/><stop offset="1" stop-color="#97a7b8"/></linearGradient>` +
    `<linearGradient id="${k}-limbfar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6dee7"/><stop offset="1" stop-color="#7f90a3"/></linearGradient>` +
    `<linearGradient id="${k}-joint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5d6b7b"/><stop offset=".5" stop-color="#2c3643"/><stop offset="1" stop-color="#151b23"/></linearGradient>` +
    `<radialGradient id="${k}-visor" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#3a4d66"/><stop offset=".5" stop-color="#121b29"/><stop offset="1" stop-color="#05080e"/></radialGradient>` +
    `<radialGradient id="${k}-eyeglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#bff4ff" stop-opacity="1"/><stop offset=".35" stop-color="#41c8ff" stop-opacity=".8"/><stop offset="1" stop-color="#1a7dff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${k}-ear" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d9f8ff"/><stop offset=".45" stop-color="#3cc2ff"/><stop offset=".7" stop-color="#1b6fd6"/><stop offset="1" stop-color="#1b6fd6" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${k}-chair" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c3ccd6"/><stop offset=".5" stop-color="#8a97a6"/><stop offset="1" stop-color="#5a6676"/></linearGradient>` +
    `<filter id="${k}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6"/></filter>` +
    `<filter id="${k}-glow2" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14"/></filter>` +
    `<filter id="${k}-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>` +
    `</defs>` +
    // 機器人落在桌上的影子
    `<ellipse cx="1210" cy="${DESK_Y + 120}" rx="250" ry="70" fill="#1d2a3a" opacity=".22" filter="url(#${k}-soft)"/>` +
    // 椅背(淺灰的網布椅,大半被機器人擋住)
    `<path d="M1340 640 C 1380 626 1430 632 1446 664 L 1452 960 C 1430 984 1376 986 1356 968 Z" fill="url(#${k}-chair)"/>` +
    `<path d="M1352 660 C 1384 650 1420 654 1436 676 L 1440 950" stroke="#e8eef4" stroke-width="4" fill="none" opacity=".5"/>` +
    // 遠側手臂(在軀幹後面,偏暗)
    `<g class="${k}-r-far">` +
    `<path class="${k}-r-farup" fill="url(#${k}-limbfar)"/>` +
    `<circle class="${k}-r-farelbow" r="27" fill="url(#${k}-joint)"/>` +
    `<path class="${k}-r-farfore" fill="url(#${k}-limbfar)"/>` +
    `<g class="${k}-r-farhand">${handSvg(true, k)}</g>` +
    `</g>` +
    // 軀幹
    `<g class="${k}-r-body">` +
    // 腰部的關節(深色)
    `<path d="M1180 880 C 1196 940 1330 948 1352 892 L 1360 1080 L 1170 1080 Z" fill="url(#${k}-joint)"/>` +
    `<g stroke="#5d6b7b" stroke-width="3" opacity=".7">${[920, 960, 1000, 1040].map((y) => `<path d="M1176 ${y} C 1220 ${y + 18} 1320 ${y + 18} 1358 ${y - 4}"/>`).join('')}</g>` +
    // 胸殼
    `<path d="M1150 640 C 1150 590 1236 566 1316 576 C 1376 584 1404 620 1404 676 C 1404 770 1390 850 1356 900 C 1320 950 1214 952 1184 906 C 1156 860 1146 740 1150 640 Z" fill="url(#${k}-shell)"/>` +
    // 胸殼的分件線
    `<path d="M1176 700 C 1220 724 1300 726 1376 702" stroke="#9fb0c2" stroke-width="2.5" fill="none"/>` +
    `<path d="M1236 724 C 1232 790 1240 860 1262 930" stroke="#9fb0c2" stroke-width="2.5" fill="none"/>` +
    `<path d="M1186 820 C 1220 842 1300 846 1366 822" stroke="#b4c3d2" stroke-width="2" fill="none"/>` +
    // 胸口的藍色燈條(會呼吸)
    `<g class="${k}-r-core"><rect x="1172" y="744" width="46" height="14" rx="7" fill="#46c8ff" filter="url(#${k}-glow)"/><rect x="1176" y="747" width="38" height="8" rx="4" fill="#d6f7ff"/></g>` +
    // 窗光打在胸殼左緣的高光
    `<path d="M1158 640 C 1160 600 1220 582 1270 582 C 1214 596 1176 624 1170 676 C 1166 740 1170 820 1186 880 C 1162 840 1152 720 1158 640Z" fill="#ffffff" opacity=".75"/>` +
    // 右側的藍色反光(全息面板的顏色)
    `<path d="M1398 660 C 1404 740 1392 830 1360 890" stroke="#7ad7ff" stroke-width="6" fill="none" opacity=".5" stroke-linecap="round"/>` +
    // 遠側肩膀
    `<circle cx="${BOT.farShoulder.x}" cy="${BOT.farShoulder.y}" r="40" fill="url(#${k}-shell2)"/>` +
    // 脖子
    `<path d="M1206 520 L1282 520 L1290 604 C 1262 616 1226 616 1200 604Z" fill="url(#${k}-joint)"/>` +
    `<g stroke="#6c7a8a" stroke-width="3">${[540, 560, 580].map((y) => `<path d="M1206 ${y} Q1246 ${y + 8} 1286 ${y}"/>`).join('')}</g>` +
    `</g>` +
    // 頭
    `<g class="${k}-r-head">` +
    `<ellipse class="${k}-r-halo" cx="${h.x}" cy="${h.y}" rx="${BOT.rx + 26}" ry="${BOT.ry + 26}" fill="none" stroke="#5fd4ff" stroke-width="3" opacity="0"/>` +
    `<ellipse cx="${h.x}" cy="${h.y}" rx="${BOT.rx}" ry="${BOT.ry}" fill="url(#${k}-shell)"/>` +
    // 頭頂的分件線(跟著臉的方向)
    `<path class="${k}-r-seam" fill="none" stroke="#a7b7c8" stroke-width="2.5"/>` +
    // 兩邊的耳燈
    `<g class="${k}-r-earR"><ellipse rx="30" ry="40" fill="#cfd8e2"/><ellipse rx="24" ry="33" fill="url(#${k}-joint)"/><ellipse class="${k}-r-earglow" rx="36" ry="44" fill="url(#${k}-ear)" filter="url(#${k}-glow)"/><ellipse rx="11" ry="15" fill="#e6fbff"/></g>` +
    `<g class="${k}-r-earL"><ellipse rx="30" ry="40" fill="#cfd8e2"/><ellipse rx="24" ry="33" fill="url(#${k}-joint)"/><ellipse class="${k}-r-earglow" rx="36" ry="44" fill="url(#${k}-ear)" filter="url(#${k}-glow)"/><ellipse rx="11" ry="15" fill="#e6fbff"/></g>` +
    // 臉罩(深色亮面)與眼睛
    `<g class="${k}-r-face">` +
    `<ellipse rx="86" ry="66" fill="#e6edf4"/>` +
    `<ellipse rx="80" ry="60" fill="url(#${k}-visor)"/>` +
    `<g class="${k}-r-eyes">` +
    `<ellipse class="${k}-r-eyeglow" cx="-30" cy="-2" rx="34" ry="24" fill="url(#${k}-eyeglow)" filter="url(#${k}-glow)"/>` +
    `<ellipse class="${k}-r-eyeglow" cx="30" cy="-2" rx="34" ry="24" fill="url(#${k}-eyeglow)" filter="url(#${k}-glow)"/>` +
    `<rect class="${k}-r-eye" x="-46" y="-11" width="32" height="18" rx="9" fill="#bdf3ff"/>` +
    `<rect class="${k}-r-eye" x="14" y="-11" width="32" height="18" rx="9" fill="#bdf3ff"/>` +
    `</g>` +
    // 思考時臉罩上掃過的光
    `<rect class="${k}-r-scan" x="-4" y="-56" width="8" height="112" rx="4" fill="#7fe3ff" opacity="0" filter="url(#${k}-glow)"/>` +
    // 臉罩的反光
    `<path d="M-62 -34 C -40 -54 10 -58 44 -48" stroke="#ffffff" stroke-width="7" fill="none" opacity=".35" stroke-linecap="round"/>` +
    `<ellipse cx="-44" cy="-36" rx="14" ry="6" fill="#ffffff" opacity=".55" transform="rotate(-18 -44 -36)"/>` +
    `</g>` +
    // 頭殼的高光(光從左上)
    `<ellipse cx="${h.x - 46}" cy="${h.y - 70}" rx="44" ry="26" fill="#ffffff" opacity=".85" transform="rotate(-24 ${h.x - 46} ${h.y - 70})" filter="url(#${k}-glow)"/>` +
    `<path d="M${h.x - 100} ${h.y - 10} C ${h.x - 104} ${h.y - 70} ${h.x - 60} ${h.y - 112} ${h.x} ${h.y - 118}" stroke="#ffffff" stroke-width="5" fill="none" opacity=".8" stroke-linecap="round"/>` +
    `</g>` +
    // 近側手臂
    `<g class="${k}-r-near">` +
    `<circle cx="${BOT.nearShoulder.x}" cy="${BOT.nearShoulder.y}" r="56" fill="url(#${k}-shell2)"/>` +
    `<path d="M${BOT.nearShoulder.x - 40} ${BOT.nearShoulder.y - 26} C ${BOT.nearShoulder.x - 20} ${BOT.nearShoulder.y - 50} ${BOT.nearShoulder.x + 20} ${BOT.nearShoulder.y - 52} ${BOT.nearShoulder.x + 40} ${BOT.nearShoulder.y - 30}" stroke="#ffffff" stroke-width="6" fill="none" opacity=".9" stroke-linecap="round"/>` +
    `<path class="${k}-r-up" fill="url(#${k}-limb)"/>` +
    `<path class="${k}-r-upshine" stroke="#ffffff" stroke-width="6" fill="none" opacity=".8" stroke-linecap="round"/>` +
    `<circle class="${k}-r-elbow" r="32" fill="url(#${k}-joint)"/>` +
    `<circle class="${k}-r-elbowlight" r="7" fill="#7fe3ff" filter="url(#${k}-glow)"/>` +
    `<path class="${k}-r-fore" fill="url(#${k}-limb)"/>` +
    `<path class="${k}-r-foreshine" stroke="#ffffff" stroke-width="5" fill="none" opacity=".85" stroke-linecap="round"/>` +
    `<g class="${k}-r-hand">${handSvg(false, k)}</g>` +
    `</g>` +
    `</svg>`
  )
}

/**
 * 機械手:手腕在原點、手指朝 -x(往左);指節是白色殼片 + 深色關節,關節有藍色小燈。
 * 四根手指的第二節各在 <g class="<前綴>-f"> 裡,actor.ts 依打字的節奏把它往下壓。
 */
function handSvg(far: boolean, k: string): string {
  const shell = far ? `url(#${k}-limbfar)` : `url(#${k}-limb)`
  const fingers = [-26, -10, 6, 20]
    .map((y, i) => {
      const len = [44, 50, 48, 40][i]
      return (
        `<g class="${k}-f" data-y="${y}">` +
        `<rect x="${-74 - len * 0.5}" y="${y - 7}" width="${len * 0.5 + 4}" height="14" rx="7" fill="${shell}"/>` +
        `<circle cx="${-74 - len * 0.5}" cy="${y}" r="6" fill="url(#${k}-joint)"/>` +
        `<g class="${k}-f2"><rect x="${-74 - len}" y="${y - 6}" width="${len * 0.5}" height="12" rx="6" fill="${shell}"/><circle cx="${-74 - len + 3}" cy="${y}" r="3" fill="#ffffff" opacity=".7"/></g>` +
        `</g>`
      )
    })
    .join('')
  return (
    // 手腕關節
    `<circle cx="0" cy="0" r="20" fill="url(#${k}-joint)"/>` +
    // 手掌
    `<path d="M-6 -30 C -30 -36 -66 -36 -78 -30 C -84 -12 -84 14 -76 30 C -56 36 -24 34 -6 26 C 4 10 4 -14 -6 -30Z" fill="${shell}"/>` +
    `<path d="M-14 -24 C -36 -28 -60 -28 -72 -24" stroke="#ffffff" stroke-width="4" fill="none" opacity="${far ? 0.3 : 0.8}" stroke-linecap="round"/>` +
    `<path d="M-30 -20 L -34 20 M-52 -22 L -54 22" stroke="#9fb0c2" stroke-width="2" opacity=".6"/>` +
    fingers +
    // 拇指(朝鏡頭這側)
    `<g class="${k}-thumb"><rect x="-58" y="24" width="34" height="14" rx="7" fill="${shell}" transform="rotate(28 -24 30)"/><circle cx="-24" cy="30" r="6" fill="url(#${k}-joint)"/></g>` +
    (far ? '' : `<circle cx="-40" cy="2" r="5" fill="#7fe3ff" filter="url(#${k}-glow)"/><circle cx="-40" cy="2" r="2.5" fill="#e6fbff"/>`)
  )
}

// ---------- 旁邊的人 ----------
/** 西裝、白襯衫、短黑髮、鬍子,四分之三側臉朝左看螢幕;頭在 <g class="<前綴>-m-head"> 裡(點頭)。 */
export function manSvg(o: ManOpts = {}): string {
  const k = o.prefix ?? 'ao'
  return (
    `<svg class="${k}-mansvg" viewBox="0 0 1920 1080" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="${k}-suit" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a4a60"/><stop offset=".35" stop-color="#1f2a3a"/><stop offset="1" stop-color="#0e141d"/></linearGradient>` +
    `<linearGradient id="${k}-suit2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#465a74"/><stop offset="1" stop-color="#18212e"/></linearGradient>` +
    `<linearGradient id="${k}-skin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f1d0ba"/><stop offset=".45" stop-color="#d2a084"/><stop offset="1" stop-color="#8a5e4c"/></linearGradient>` +
    `<linearGradient id="${k}-neckskin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c88f71"/><stop offset="1" stop-color="#7d4e3b"/></linearGradient>` +
    `<linearGradient id="${k}-hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3a30"/><stop offset=".5" stop-color="#2a201b"/><stop offset="1" stop-color="#140f0c"/></linearGradient>` +
    `<linearGradient id="${k}-beard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a463a"/><stop offset=".5" stop-color="#33271f"/><stop offset="1" stop-color="#1c1511"/></linearGradient>` +
    `<linearGradient id="${k}-shirt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c6d2df"/></linearGradient>` +
    `<filter id="${k}-mblur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>` +
    `<filter id="${k}-mglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>` +
    `</defs>` +
    `<g class="${k}-m-body">` +
    // 外套
    `<path d="M1640 436 C 1586 452 1540 478 1516 528 C 1488 600 1478 760 1470 1100 L 1910 1100 C 1904 780 1890 610 1866 534 C 1846 478 1790 446 1730 436 Z" fill="url(#${k}-suit)"/>` +
    // 身體往下延伸到舞台外:視窗比 16:9 高時,下緣不會看到身體被切平(原本的輪廓不變)
    `<rect x="1470" y="1090" width="440" height="2600" fill="url(#${k}-suit)"/>` +
    // 白襯衫的 V 與領帶
    `<path d="M1626 448 L1712 446 L1662 660 Z" fill="url(#${k}-shirt)"/>` +
    `<path d="M1652 470 L1676 470 L1684 500 L1670 650 L1656 664 L1646 650 L1656 500Z" fill="#1d3354"/>` +
    `<path d="M1652 470 L1676 470 L1672 494 L1656 494Z" fill="#2b4a76"/>` +
    `<path d="M1660 520 L1680 540 M1656 570 L1676 590 M1652 620 L1670 638" stroke="#3a5f92" stroke-width="3" opacity=".7"/>` +
    // 西裝領(左前方看得到比較多)
    `<path d="M1626 446 C 1610 470 1598 520 1596 560 L 1632 548 L 1612 590 C 1630 640 1648 680 1660 700 L 1662 660 Z" fill="url(#${k}-suit2)"/>` +
    `<path d="M1712 446 C 1724 480 1726 520 1720 556 L 1700 552 L 1712 586 C 1700 630 1680 676 1662 700 L 1662 660Z" fill="#141c27"/>` +
    `<path d="M1626 446 C 1610 470 1598 520 1596 560" stroke="#6d84a2" stroke-width="3" fill="none" opacity=".8"/>` +
    // 領口
    `<path d="M1630 430 L1660 470 L1700 468 L1724 432 L1716 426 L1700 452 L1660 454 L1640 426Z" fill="url(#${k}-shirt)"/>` +
    // 口袋巾與鈕扣
    `<path d="M1560 600 L1600 594 L1602 604 L1562 610Z" fill="#dfe8f2" opacity=".9"/>` +
    `<circle cx="1668" cy="740" r="6" fill="#0b1018"/><circle cx="1666" cy="820" r="6" fill="#0b1018"/>` +
    // 肩膀與袖子的皺褶、窗光打在左肩
    `<path d="M1516 528 C 1540 478 1586 452 1640 436 C 1600 470 1560 500 1540 548Z" fill="#7d93b2" opacity=".55"/>` +
    `<path d="M1540 700 C 1550 800 1546 900 1536 1080" stroke="#0b1018" stroke-width="5" fill="none" opacity=".5"/>` +
    `<path d="M1820 620 C 1840 760 1846 900 1850 1080" stroke="#0b1018" stroke-width="6" fill="none" opacity=".5"/>` +
    `<path d="M1508 560 C 1494 640 1488 800 1484 1080" stroke="#8fd6ff" stroke-width="5" fill="none" opacity=".35"/>` +
    `</g>` +
    // 脖子
    `<path d="M1640 372 C 1650 404 1652 430 1644 446 C 1670 460 1700 458 1722 444 C 1716 420 1714 396 1716 370Z" fill="url(#${k}-neckskin)"/>` +
    `<g class="${k}-m-head">` +
    // 臉與頭形(額頭往後斜、後腦勺圓)
    `<path d="M1676 196 C 1730 196 1762 236 1762 292 C 1762 338 1744 372 1716 392 C 1700 404 1680 410 1660 410 C 1626 410 1604 396 1596 378 C 1590 364 1588 352 1590 344 C 1584 340 1582 336 1586 332 L 1572 322 C 1574 314 1580 304 1588 294 C 1590 288 1592 282 1594 276 C 1596 236 1626 198 1676 196 Z" fill="url(#${k}-skin)"/>` +
    // 窗光:額頭、鼻樑、臉頰
    `<path d="M1598 262 C 1604 236 1626 216 1652 210 C 1630 230 1616 252 1612 280Z" fill="#fff1e2" opacity=".6"/>` +
    `<path d="M1590 296 C 1584 306 1578 314 1576 320" stroke="#fff0e0" stroke-width="3" fill="none" opacity=".8"/>` +
    `<ellipse cx="1624" cy="328" rx="16" ry="10" fill="#e3a088" opacity=".4"/>` +
    // 頭髮:短、兩側推短,後面蓋到後頸,鬢角接到鬍子
    `<path d="M1594 258 C 1590 220 1622 184 1676 182 C 1736 180 1770 222 1768 284 C 1767 322 1758 352 1742 374 L 1728 374 C 1726 352 1724 336 1720 322 L 1708 320 L 1704 290 C 1696 278 1684 268 1668 262 C 1650 254 1630 250 1612 252 C 1604 252 1598 254 1594 258 Z" fill="url(#${k}-hair)"/>` +
    `<path d="M1708 290 C 1716 270 1736 262 1756 270 C 1760 300 1752 340 1740 368 L 1728 368 C 1726 340 1722 318 1712 312Z" fill="#6b5545" opacity=".35"/>` +
    `<g stroke="#7d6553" stroke-width="2" fill="none" opacity=".55" stroke-linecap="round">${Array.from({ length: 14 }, (_, i) => {
      const hx = 1612 + i * 10
      const hy = 206 - Math.sin((i / 13) * Math.PI) * 14 + (i % 3) * 3
      return `<path d="M${hx} ${hy} q8 -6 16 -2"/>`
    }).join('')}</g>` +
    `<path d="M1604 236 C 1626 206 1668 194 1712 200" stroke="#9a806b" stroke-width="3" fill="none" opacity=".55"/>` +
    // 耳朵
    `<ellipse cx="1716" cy="314" rx="13" ry="23" fill="#c48c70"/><path d="M1712 298 C 1722 302 1724 320 1714 330" stroke="#8d543f" stroke-width="3" fill="none"/><path d="M1706 300 C 1708 310 1708 320 1706 328" stroke="#e8b598" stroke-width="2" fill="none" opacity=".6"/>` +
    // 鼻子
    `<path d="M1596 288 C 1592 302 1582 314 1576 322 C 1582 328 1592 330 1600 326" stroke="#9e6550" stroke-width="2.5" fill="none" opacity=".75"/>` +
    `<path d="M1598 324 C 1602 322 1606 322 1608 326" stroke="#7d4a39" stroke-width="2.5" fill="none" opacity=".6"/>` +
    // 眼睛與眉毛
    `<path d="M1596 280 C 1608 272 1626 270 1640 276" stroke="#2a1f19" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    `<g class="${k}-m-eye"><path d="M1604 297 C 1612 290 1626 290 1632 298 C 1624 302 1612 302 1604 297Z" fill="#f7f1ec"/><circle cx="1611" cy="297" r="4.6" fill="#2b2019"/><circle cx="1610" cy="295.5" r="1.4" fill="#ffffff"/>` +
    `<path d="M1602 296 C 1612 288 1626 288 1634 297" stroke="#3b2a21" stroke-width="2.5" fill="none"/></g>` +
    `<path d="M1630 304 C 1636 310 1644 312 1650 310" stroke="#b07a63" stroke-width="2" fill="none" opacity=".6"/>` +
    `<path d="M1646 286 C 1660 300 1664 320 1660 336" stroke="#a46a54" stroke-width="2" fill="none" opacity=".35"/>` +
    // 鬍子(鬢角 → 兩頰 → 下巴)
    `<path d="M1712 316 C 1718 352 1706 388 1676 404 C 1648 416 1612 414 1596 396 C 1588 384 1586 368 1590 354 C 1596 348 1604 348 1612 352 C 1622 357 1638 357 1652 351 C 1666 344 1682 332 1692 318 C 1698 304 1702 294 1706 290 Z" fill="url(#${k}-beard)"/>` +
    `<path class="${k}-m-mouth" d="M1596 352 Q1606 356 1616 352" stroke="#5a2e26" stroke-width="3" fill="#5a2e26"/>` +
    `<path d="M1586 342 C 1596 334 1614 334 1626 342 C 1614 348 1598 348 1586 342Z" fill="#2a1f19"/>` +
    `<g stroke="#6b5444" stroke-width="1.6" opacity=".55" fill="none">${Array.from({ length: 20 }, (_, i) => {
      const bx = 1600 + (i % 10) * 10
      const by = 364 + Math.floor(i / 10) * 18 + ((i * 7) % 5)
      return `<path d="M${bx} ${by} l${-2 + (i % 3)} 7"/>`
    }).join('')}</g>` +
    // 全息面板的青色光打在臉的前緣
    `<path d="M1588 292 C 1578 306 1572 316 1574 324 M1588 336 C 1586 352 1590 372 1598 390" stroke="#8fe6ff" stroke-width="3" fill="none" opacity=".55" filter="url(#${k}-mblur)"/>` +
    `</g>` +
    `</svg>`
  )
}

// ---------- 機器人手臂 ----------
/** 手臂的可動零件(場景用 querySelector 找到) */
export interface ArmParts {
  up: SVGPathElement
  upShine?: SVGPathElement
  elbow: SVGCircleElement
  elbowLight?: SVGCircleElement
  fore: SVGPathElement
  foreShine?: SVGPathElement
  hand: SVGGElement
}
/**
 * 畫一隻手臂:肩膀 s 到手腕目標 target 做 IK,更新上臂/前臂/手肘/手的屬性;typing 0–1 時手指照節奏按。
 * len = [上臂, 前臂] 長度;r = [肩, 肘, 腕] 的半徑;scale 手的大小;ms 時間;seed 手指節奏的相位。
 */
export function drawRobotArm(parts: ArmParts, fingers: SVGGElement[], s: Pt, target: Pt, len: readonly [number, number], r: [number, number, number], scale: number, typing: number, ms: number, seed: number): void {
  const { elbow, wrist } = solveArm(s, target, len[0], len[1])
  attr(parts.up, 'd', capsule(s, elbow, r[0], r[1]))
  attr(parts.fore, 'd', capsule(elbow, wrist, r[1] * 0.92, r[2]))
  if (parts.upShine) attr(parts.upShine, 'd', capsuleShine(s, elbow, r[0], r[1]))
  if (parts.foreShine) attr(parts.foreShine, 'd', capsuleShine(elbow, wrist, r[1] * 0.92, r[2]))
  attr(parts.elbow, 'cx', fx(elbow.x, 1))
  attr(parts.elbow, 'cy', fx(elbow.y, 1))
  if (parts.elbowLight) {
    attr(parts.elbowLight, 'cx', fx(elbow.x, 1))
    attr(parts.elbowLight, 'cy', fx(elbow.y, 1))
  }
  const ang = (Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) * 180) / Math.PI - 180
  attr(parts.hand, 'transform', `translate(${fx(wrist.x, 1)} ${fx(wrist.y, 1)}) rotate(${fx(kit.clamp(ang * 0.7 - 6, -22, 18), 1)}) scale(${scale})`)
  fingers.forEach((g, i) => {
    const y = Number(g.dataset.y)
    const kx = -74 - [44, 50, 48, 40][i] * 0.5
    const press = typing * Math.max(0, Math.sin(ms / (62 + i * 11) + i * 1.9 + seed)) ** 4
    attr(g, 'transform', `rotate(${fx(-6 - press * 8, 1)} -74 ${y})`)
    const f2 = g.lastElementChild as SVGGElement
    attr(f2, 'transform', `rotate(${fx(-22 - press * 18, 1)} ${kx} ${y})`)
  })
}
