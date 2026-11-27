// picture-card 的插圖:同一套扁平畫法(圓角框、單一橘色重點、深色線條),都畫在 400×260 的畫布上。
const INK = '#2b2622'
const MUTE = '#b9b1a3'
const ACCENT = '#d97757'
const SOFT = '#fbe9e2'
const GREEN = '#3d7a4a'

const box = (x: number, y: number, w: number, h: number, fill = '#fff', stroke = '#e1dbce', r = 14): string => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`
const line = (x: number, y: number, w: number, color = MUTE, h = 8): string => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}"/>`
const text = (x: number, y: number, s: string, size = 16, color = INK, anchor = 'middle', weight = 700): string => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="${weight}">${s}</text>`
const arrow = (x1: number, y: number, x2: number): string => `<path d="M${x1} ${y}H${x2 - 6}M${x2 - 18} ${y - 12}L${x2 - 4} ${y}L${x2 - 18} ${y + 12}" fill="none" stroke="${ACCENT}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
const win = (x: number, y: number, w: number, h: number, bar = '#f4f1ea', fill = '#fff'): string =>
  `${box(x, y, w, h, fill)}<path d="M${x} ${y + 28}H${x + w}" stroke="#e1dbce" stroke-width="2"/><rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="25" rx="12" fill="${bar}"/>${[0, 1, 2].map((i) => `<circle cx="${x + 16 + i * 14}" cy="${y + 15}" r="4" fill="${MUTE}"/>`).join('')}`
const check = (cx: number, cy: number, r: number, color = GREEN): string => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/><path d="M${cx - r * 0.45} ${cy}l${r * 0.32} ${r * 0.34}l${r * 0.6} ${-r * 0.64}" fill="none" stroke="#fff" stroke-width="${r * 0.2}" stroke-linecap="round" stroke-linejoin="round"/>`
const person = (cx: number, cy: number): string => `<circle cx="${cx}" cy="${cy}" r="28" fill="#f2c7a8"/><path d="M${cx - 28} ${cy - 4}a28 28 0 0 1 56 0c-14-4-22-12-26-20c-6 10-16 18-30 20z" fill="${INK}"/><path d="M${cx - 48} ${cy + 90}a48 52 0 0 1 96 0z" fill="#3f5b7a"/><circle cx="${cx - 9}" cy="${cy + 4}" r="3" fill="${INK}"/><circle cx="${cx + 11}" cy="${cy + 4}" r="3" fill="${INK}"/><path d="M${cx - 7} ${cy + 15}q8 7 17 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`

export type ArtName = 'translate' | 'chat' | 'speak' | 'confirm' | 'inspect' | 'next'

export const ART: Record<ArtName, string> = {
  // 人話 → 電腦指令
  translate: `${box(18, 62, 142, 112, SOFT, ACCENT, 20)}<path d="M52 172l-6 28l34-28z" fill="${SOFT}" stroke="${ACCENT}" stroke-width="2.5" stroke-linejoin="round"/>${text(89, 108, '我想要', 22)}${text(89, 140, '一頁網站', 22)}${arrow(172, 118, 226)}${win(236, 54, 148, 150, '#33302c', '#1f1e1b')}${text(254, 112, '&lt;h1&gt;', 17, '#8fd3ff', 'start')}${line(300, 101, 56, '#e9e4da')}${text(254, 142, '&lt;p&gt;', 17, '#8fd3ff', 'start')}${line(296, 131, 66, '#8a857c')}${text(254, 172, '&lt;ul&gt;', 17, '#8fd3ff', 'start')}${line(302, 161, 44, '#8a857c')}`,
  // 聊天視窗裡有程式碼,但搬的手是你的
  chat: `${win(28, 26, 218, 208)}${box(110, 70, 118, 34, SOFT, SOFT, 17)}${line(128, 83, 82, ACCENT)}${box(46, 118, 172, 92, '#1f1e1b', '#1f1e1b', 12)}${line(60, 134, 92, '#8fd3ff')}${line(74, 154, 122, '#e9e4da')}${line(74, 174, 98, '#e9e4da')}${line(60, 192, 72, '#8fd3ff')}${arrow(232, 150, 288)}<g transform="translate(300 108)"><path d="M18 46V10a8 8 0 0 1 16 0v30V30a8 8 0 0 1 16 0v12v-6a8 8 0 0 1 16 0v10a8 8 0 0 1 14 4v22c0 24-14 38-36 38c-18 0-26-8-36-26L-4 62c-4-8 6-14 12-8z" fill="#f2c7a8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>${text(342, 84, '複製貼上', 18, ACCENT)}`,
  // 說清楚想要什麼
  speak: `${person(76, 108)}${box(150, 36, 222, 164, '#fff', ACCENT, 20)}<path d="M152 104l-26 14l26 10z" fill="#fff" stroke="${ACCENT}" stroke-width="2.5" stroke-linejoin="round"/>${['店名和標語', '三種麵包和價錢', '營業時間'].map((s, i) => `${check(180, 76 + i * 44, 12, ACCENT)}${text(202, 82 + i * 44, s, 18, INK, 'start')}`).join('')}`,
  // 看懂確認提示,決定允許或拒絕
  confirm: `${box(50, 26, 300, 208, '#fff', '#e1dbce', 18)}<path d="M92 52l22 40H70z" fill="#f6c453" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>${text(92, 85, '!', 18)}${text(132, 78, '要建立這個檔案嗎？', 18, INK, 'start')}${box(74, 106, 252, 48, '#f4f1ea', '#f4f1ea', 10)}${text(90, 136, '小森烘焙 / index.html', 16, '#55514a', 'start', 600)}${box(74, 174, 118, 40, '#fff', MUTE, 20)}${text(133, 200, '拒絕', 17, '#55514a')}${box(208, 174, 118, 40, ACCENT, ACCENT, 20)}${text(267, 200, '允許', 17, '#fff')}`,
  // 親眼打開來檢查
  inspect: `${win(34, 30, 258, 188)}${box(52, 72, 222, 44, '#5d7c55', '#5d7c55', 8)}${line(66, 90, 110, '#fff', 9)}${[0, 1, 2].map((i) => `${box(52 + i * 76, 128, 66, 66, '#fbf8f3', '#e1dbce', 8)}${line(62 + i * 76, 168, 46)}${line(62 + i * 76, 182, 30, ACCENT)}`).join('')}<circle cx="282" cy="150" r="52" fill="rgba(143,211,255,0.28)" stroke="${INK}" stroke-width="8"/><path d="M319 188l40 42" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>${check(282, 150, 22)}`,
  // 下一課:裝好工具,建立第一個檔案
  next: `<path d="M34 78a10 10 0 0 1 10-10h48l14 18h80a10 10 0 0 1 10 10v98a10 10 0 0 1-10 10H44a10 10 0 0 1-10-10z" fill="#f6d9a8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>${text(115, 152, '我的專案', 19)}${arrow(208, 140, 260)}<path d="M272 62h66l32 32v108a8 8 0 0 1-8 8h-90a8 8 0 0 1-8-8V70a8 8 0 0 1 8-8z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M338 62v32h32" fill="none" stroke="${INK}" stroke-width="2.5"/>${line(284, 112, 66)}${line(284, 132, 52)}${line(284, 152, 60)}<circle cx="358" cy="200" r="24" fill="${ACCENT}"/><path d="M358 188v24M346 200h24" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
}
