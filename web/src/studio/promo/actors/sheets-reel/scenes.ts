// sheets-reel 的各段畫面:全是純函式(時間進來、SVG 字串出去),不用亂數、不讀時鐘。
// 功能說明:用圖形模擬 Claude Sheets 的操作(游標點按、打字、修改框線與復原、分享、匯出);試算表裡的內容是示意資料,合計是真的加總。
// 版面在直式 Reels 安全區內(x 70–940、y 250–1500)。
import { INK, MONO, SANS, clamp, cursor, esc, mix, n2, outBack, outCubic, path2, seg, type SceneOut } from '../archify-reel/draw'

const CX = 505 // 安全區的中線
const BG = '#f4efe8'
const ACCENT = '#c8643c'
const GRID = '#d9d2c6'
const PAPER = '#fffdf9'
const MUTED = '#6b6155'
const GREEN = '#2f9e5f'

const txt = (x: number, y: number, s: string, size: number, fill = INK, o: { anchor?: string; weight?: number; font?: string; op?: number } = {}): string =>
  `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${o.anchor ?? 'start'}" font-family="${o.font ?? SANS}" font-size="${size}" font-weight="${o.weight ?? 600}" fill="${fill}" opacity="${n2(o.op ?? 1)}">${esc(s)}</text>`

const pill = (cx: number, cy: number, w: number, h: number, label: string, fill: string, color: string, op = 1, fs = 30): string =>
  `<g opacity="${n2(op)}"><rect x="${n2(cx - w / 2)}" y="${n2(cy - h / 2)}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>${txt(cx, cy + fs * 0.36, label, fs, color, { anchor: 'middle', weight: 700 })}</g>`

const typed = (s: string, p: number): string => s.slice(0, Math.floor(s.length * clamp(p)))
/** 某個時間點起 250ms 內算按下 */
const pressAt = (l: number, t: number): number => (l >= t && l < t + 250 ? 1 : 0)

// ---------- 版面 ----------
const CARD = { x: 70, y: 360, w: 870, h: 1120 }
const BAR_Y = 405 // 上方列的中線
const BTN = { new: [820, BAR_Y] as const, share: [700, BAR_Y] as const, export: [840, BAR_Y] as const }
const ASK_Y = 1350

/** 步驟說明(卡片上方)與 App 視窗外框 */
function frame(step: string, label: string, bar: string): string {
  let s = txt(70, 320, step, 40, ACCENT, { weight: 800 }) + txt(70 + step.length * 40 + 24, 320, label, 40, INK, { weight: 800 })
  s += `<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="34" fill="${PAPER}" stroke="${GRID}" stroke-width="3"/>`
  s += `<line x1="${CARD.x}" y1="${BAR_Y + 45}" x2="${CARD.x + CARD.w}" y2="${BAR_Y + 45}" stroke="${GRID}" stroke-width="2"/>`
  s += txt(110, BAR_Y + 12, bar, 34, INK, { weight: 800 })
  return s
}

const button = (c: readonly [number, number], w: number, label: string, hot: number, primary = false): string =>
  `<g><rect x="${n2(c[0] - w / 2)}" y="${c[1] - 31}" width="${w}" height="62" rx="18" fill="${primary ? mix(ACCENT, '#ffffff', hot * 0.15) : mix('#ffffff', '#efe7da', 0.4 + hot * 0.6)}" stroke="${primary ? ACCENT : GRID}" stroke-width="3"/>${txt(c[0], c[1] + 11, label, 28, primary ? '#fff' : INK, { anchor: 'middle', weight: 700 })}</g>`

// ---------- 試算表 ----------
export const HEAD = ['項目', '負責人', '預算', '狀態']
export const ROWS: string[][] = [
  ['場地', '小安', '12,000', '進行中'],
  ['講師', '小林', '8,000', '已確認'],
  ['宣傳', '小宇', '5,000', '待辦'],
  ['餐點', '小美', '6,500', '進行中'],
]
export const sum = (rows: string[][]): number => rows.reduce((n, r) => n + Number(r[2].replace(',', '')), 0)
export const money = (n: number): string => n.toLocaleString('en-US')
const COLW = [0.26, 0.24, 0.24, 0.26]
export const SHEET = { x: 90, w: 830, rowH: 92, y0: 480 }
const colX = (c: number): number => SHEET.x + COLW.slice(0, c).reduce((a, b) => a + b, 0) * SHEET.w
const cellRect = (r: number, c: number): { x: number; y: number; w: number; h: number } => ({ x: colX(c), y: SHEET.y0 + r * SHEET.rowH, w: COLW[c] * SHEET.w, h: SHEET.rowH })

/** 試算表:rows 是已顯示的列數(可帶小數,最後一列淡入);outline 是 Claude 剛改過、要框起來的格子 [列, 欄] */
function sheet(rows: number, o: { data?: string[][]; outline?: [number, number][]; outlineOp?: number } = {}): string {
  const data = o.data ?? ROWS
  const all = [HEAD, ...data, ['合計', '', money(sum(data)), '']]
  const y0 = SHEET.y0
  let s = ''
  all.forEach((row, r) => {
    const a = clamp(rows - r)
    const y = y0 + r * SHEET.rowH
    // 還沒填的列留淡淡的格線
    s += `<line x1="${SHEET.x}" y1="${y + SHEET.rowH}" x2="${SHEET.x + SHEET.w}" y2="${y + SHEET.rowH}" stroke="${GRID}" stroke-width="2" opacity="${a > 0 ? 1 : 0.5}"/>`
    if (a <= 0) return
    if (r === 0) s += `<rect x="${SHEET.x}" y="${y}" width="${SHEET.w}" height="${SHEET.rowH}" fill="#efe7da" opacity="${n2(a)}"/>`
    row.forEach((v, c) => {
      const num = c === 2 && r > 0
      const isStatus = c === 3 && r > 0 && r < all.length - 1
      const k = cellRect(r, c)
      if (isStatus && v) {
        const fill = v === '已確認' ? '#dcefdc' : v === '待辦' ? '#f6e2d6' : '#e3e9f7'
        s += pill(k.x + 90, y + SHEET.rowH / 2, 150, 50, v, fill, INK, a, 26)
      } else s += txt(num ? k.x + k.w - 24 : k.x + 24, y + SHEET.rowH / 2 + 11, v, 31, r === 0 ? MUTED : INK, { anchor: num ? 'end' : 'start', weight: r === 0 || r === all.length - 1 ? 800 : 600, font: num ? MONO : SANS, op: a })
    })
  })
  for (let c = 1; c < 4; c++) s += `<line x1="${n2(colX(c))}" y1="${y0}" x2="${n2(colX(c))}" y2="${y0 + all.length * SHEET.rowH}" stroke="${GRID}" stroke-width="2"/>`
  for (const [r, c] of o.outline ?? []) {
    const k = cellRect(r, c)
    s += `<rect x="${n2(k.x + 3)}" y="${n2(k.y + 3)}" width="${n2(k.w - 6)}" height="${k.h - 6}" rx="8" fill="${ACCENT}" fill-opacity="${n2(0.14 * (o.outlineOp ?? 1))}" stroke="${ACCENT}" stroke-width="5" stroke-opacity="${n2(o.outlineOp ?? 1)}"/>`
  }
  return s
}

/** 下方的「Ask Claude」輸入列;text 是已打的字,send 是送出鈕亮起的程度 */
function askBar(text: string, send = 0): string {
  let s = `<rect x="90" y="${ASK_Y}" width="830" height="110" rx="32" fill="#fff" stroke="${ACCENT}" stroke-width="4"/>`
  s += text ? txt(130, ASK_Y + 68, text, 34, INK) : txt(130, ASK_Y + 68, 'Ask Claude…', 34, '#a89d8e', { weight: 500 })
  s += `<circle cx="868" cy="${ASK_Y + 55}" r="34" fill="${mix('#e8dfd2', ACCENT, send)}"/><path d="M868 ${ASK_Y + 74} V${ASK_Y + 38} M853 ${ASK_Y + 52} L868 ${ASK_Y + 36} L883 ${ASK_Y + 52}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`
  return s
}

/** 一行狀態(Claude 做了什麼),可帶右側按鈕 */
const status = (y: number, msg: string, op: number, btn?: { label: string; hot: number }): string =>
  `<g opacity="${n2(op)}" transform="translate(0 ${n2((1 - op) * 24)})"><rect x="90" y="${y}" width="830" height="90" rx="22" fill="#fbeee6" stroke="${ACCENT}" stroke-width="3"/>${txt(124, y + 57, msg, 32, INK)}${btn ? button([820, y + 45], 150, btn.label, btn.hot) : ''}</g>`

// ---------- 各段 ----------
/** 開場:名稱與這支片要講的事 */
export function intro(l: number): SceneOut {
  const p = outBack(seg(l, 0, 900))
  const g = 18
  let s = `<g transform="translate(${CX} 720) scale(${n2(p)})">`
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) s += `<rect x="${(c - 2) * (g + 36) + g / 2}" y="${(r - 2) * (g + 36) + g / 2}" width="36" height="36" rx="8" fill="${(r + c) % 3 === 0 ? ACCENT : mix(ACCENT, '#ffffff', 0.7)}"/>`
  s += '</g>'
  s += txt(CX, 1010, 'Claude Sheets', 100, INK, { anchor: 'middle', weight: 800, op: seg(l, 500, 1200) })
  s += pill(CX, 1110, 170, 62, 'BETA', ACCENT, '#fff', seg(l, 1100, 1700), 32)
  s += txt(CX, 1230, '最值得看的三個功能', 44, MUTED, { anchor: 'middle', op: seg(l, 1700, 2400) })
  return { bg: BG, body: s }
}

/** 步驟 1:在 Artifacts 頁面新增 Sheets */
export function open(l: number): SceneOut {
  let s = frame('步驟 1', '新增 Sheets', 'Artifacts')
  const showSheet = seg(l, 3700, 4300)
  // 既有項目(灰色卡片)
  if (showSheet < 1) {
    s += `<g opacity="${n2(1 - showSheet)}">`
    for (let i = 0; i < 3; i++) s += `<rect x="110" y="${510 + i * 150}" width="790" height="120" rx="24" fill="#f6f1e8" stroke="${GRID}" stroke-width="2"/><rect x="146" y="${548 + i * 150}" width="${[320, 260, 380][i]}" height="22" rx="11" fill="${GRID}"/><rect x="146" y="${584 + i * 150}" width="200" height="16" rx="8" fill="#e7e0d4"/>`
    s += button(BTN.new, 190, '＋ 新增', l > 1500 && l < 3500 ? 1 : 0, true)
    // 選單
    const m = outCubic(seg(l, 1750, 2150))
    if (m > 0) {
      s += `<g opacity="${n2(m)}" transform="translate(0 ${n2((1 - m) * -16)})"><rect x="600" y="455" width="320" height="280" rx="22" fill="#fff" stroke="${GRID}" stroke-width="3"/>`
      ;[['Whiteboard', 'Beta'], ['Sheets', 'Beta'], ['文件', '']].forEach(([name, tag], i) => {
        if (i === 1 && l > 2700) s += `<rect x="612" y="${470 + i * 86}" width="296" height="76" rx="16" fill="#fbeee6"/>`
        s += txt(640, 520 + i * 86, name, 32, INK, { weight: 700 })
        if (tag) s += pill(850, 508 + i * 86, 80, 38, tag, '#efe7da', MUTED, 1, 22)
      })
      s += '</g>'
    }
    s += '</g>'
  }
  // 新增好的空白試算表
  if (showSheet > 0) s += `<g opacity="${n2(showSheet)}">${sheet(0)}</g>`
  const [x, y] = path2(l, [{ at: 0, x: 480, y: 1000 }, { at: 1500, x: BTN.new[0] - 10, y: BTN.new[1] + 6 }, { at: 2700, x: 760, y: 562 }, { at: 3700, x: 780, y: 700 }])
  s += cursor(x, y, Math.max(pressAt(l, 1600), pressAt(l, 3300)))
  return { bg: BG, body: s }
}

/** 步驟 2:用 Ask Claude 描述要的表格,Claude 一次填好分頁、公式、格式 */
export function ask(l: number): SceneOut {
  const text = '幫我做一份活動追蹤表，含負責人與預算'
  const p = seg(l, 200, 1000)
  const rows = seg(l, 1300, 3500) * 6
  let s = frame('特色 1', '一句話做出表格', 'Sheets')
  s += sheet(rows)
  s += status(1090, '已建立「活動追蹤」：2 個分頁、公式與下拉選單', seg(l, 3600, 4100))
  s += askBar(rows > 0 ? '' : typed(text, p), rows > 0 ? 0 : seg(l, 1000, 1150))
  if (rows === 0 && p < 1 && Math.floor(l / 400) % 2 === 0) s += `<rect x="${n2(130 + typed(text, p).length * 34)}" y="${ASK_Y + 36}" width="4" height="46" fill="${ACCENT}"/>`
  // 公式
  s += `<g opacity="${n2(seg(l, 3800, 4300))}"><rect x="90" y="1200" width="830" height="80" rx="20" fill="#14213d"/>${txt(130, 1252, '=SUM(C2:C5)', 36, '#ffd9a8', { font: MONO })}${txt(880, 1252, money(sum(ROWS)), 36, '#fff', { anchor: 'end', font: MONO })}</g>`
  return { bg: BG, body: s }
}

/** 步驟 3:請 Claude 修改,改過的範圍框起來、顯示更新幾格,不滿意按復原 */
export function edit(l: number): SceneOut {
  const text = '把宣傳的預算改成 7,000'
  const changed = l >= 1200 && l < 4200
  const data = changed ? ROWS.map((r, i) => (i === 2 ? [r[0], r[1], '7,000', r[3]] : r)) : ROWS
  const outlineOp = changed ? outCubic(seg(l, 1200, 1500)) : 0
  const sending = l < 1200
  let s = frame('特色 2', '修改看得見，可復原', 'Sheets')
  s += sheet(6, { data, outline: [[3, 2], [5, 2]], outlineOp })
  s += status(1090, '已更新 2 個儲存格（框線處）', changed ? outCubic(seg(l, 1500, 2000)) : 0, { label: '復原', hot: l > 3600 && l < 4200 ? 1 : 0 })
  s += askBar(sending ? typed(text, seg(l, 200, 900)) : '', sending ? seg(l, 900, 1050) : 0)
  const [x, y] = path2(l, [{ at: 0, x: 620, y: 1200 }, { at: 3000, x: 620, y: 1200 }, { at: 3700, x: 812, y: 1100 }, { at: 5000, x: 620, y: 1250 }])
  s += cursor(x, y, pressAt(l, 3900))
  return { bg: BG, body: s }
}

/** 步驟 4:分享給團隊,大家和 Claude 一起編輯 */
export function share(l: number): SceneOut {
  let s = frame('特色 3', '和 Claude 一起編輯', '活動追蹤')
  s += sheet(6)
  s += button(BTN.share, 130, '分享', l > 400 && l < 3000 ? 1 : 0, true)
  const d = outCubic(seg(l, 700, 1000))
  if (d > 0 && l < 3000) {
    s += `<g opacity="${n2(d)}" transform="translate(0 ${n2((1 - d) * 24)})"><rect x="170" y="600" width="670" height="480" rx="32" fill="#fff" stroke="${GRID}" stroke-width="4"/>${txt(210, 676, '邀請團隊成員', 38, INK, { weight: 800 })}`
    ;['小安', '小林', '小宇'].forEach((n, i) => {
      const a = clamp(outBack(seg(l, 1100 + i * 350, 1500 + i * 350)))
      s += `<g opacity="${n2(a)}" transform="translate(${n2((1 - a) * 40)} 0)"><circle cx="250" cy="${770 + i * 100}" r="32" fill="${['#3b6fd4', GREEN, ACCENT][i]}"/>${txt(250, 782 + i * 100, n[0], 30, '#fff', { anchor: 'middle', weight: 800 })}${txt(310, 782 + i * 100, n, 34, INK)}${pill(700, 770 + i * 100, 150, 50, '可編輯', '#efe7da', MUTED, 1, 24)}</g>`
    })
    s += '</g>'
  }
  // 分享之後:團隊成員與 Claude 的游標一起出現在表格上
  if (l >= 3100) {
    s += `<g opacity="${n2(seg(l, 3100, 3500))}">`
    ;[
      ['小安', '#3b6fd4', 3, 1],
      ['小林', GREEN, 5, 3],
      ['Claude', ACCENT, 4, 2],
    ].forEach(([n, c, r, k], i) => {
      const cell = cellRect(Number(r), Number(k))
      const dx = Math.sin((l + i * 700) / 500) * 14
      const px = cell.x + cell.w * 0.5 + dx
      const py = cell.y + cell.h * 0.55
      s += cursor(px, py) + pill(px + 64, py + 62, n === 'Claude' ? 124 : 92, 38, String(n), String(c), '#fff', 1, 22)
    })
    s += '</g>'
  }
  const [x, y] = path2(l, [{ at: 0, x: 500, y: 1000 }, { at: 500, x: BTN.share[0] - 10, y: BTN.share[1] + 6 }, { at: 2900, x: BTN.share[0] - 10, y: BTN.share[1] + 6 }, { at: 3300, x: 700, y: 1300 }])
  if (l < 3000) s += cursor(x, y, pressAt(l, 600))
  return { bg: BG, body: s }
}

/** 步驟 5:要完整功能,匯出成 .xlsx 或 CSV */
export function exportScene(l: number): SceneOut {
  let s = frame('步驟 5', '匯出到 Excel', '活動追蹤')
  s += sheet(6)
  s += button(BTN.export, 130, '匯出', l > 600 && l < 2200 ? 1 : 0)
  const m = outCubic(seg(l, 900, 1300))
  if (m > 0) {
    s += `<g opacity="${n2(m)}"><rect x="600" y="455" width="320" height="190" rx="22" fill="#fff" stroke="${GRID}" stroke-width="3"/>`
    ;['.xlsx', '.csv'].forEach((e, i) => {
      if (i === 0 && l > 1900) s += `<rect x="612" y="470" width="296" height="76" rx="16" fill="#e4f3e8"/>`
      s += txt(650, 520 + i * 86, e, 34, i ? '#3b6fd4' : GREEN, { weight: 800, font: MONO })
    })
    s += '</g>'
  }
  // 下載好的檔案
  const f = outBack(seg(l, 2500, 3300))
  if (f > 0) s += `<g transform="translate(${CX} 1210) scale(${n2(f)})"><rect x="-300" y="-80" width="600" height="160" rx="28" fill="#fff" stroke="${GREEN}" stroke-width="5"/>${txt(0, -4, '活動追蹤.xlsx', 44, INK, { anchor: 'middle', weight: 800 })}${txt(0, 46, '用 Excel 打開，繼續做進階的事', 28, MUTED, { anchor: 'middle' })}</g>`
  const [x, y] = path2(l, [{ at: 0, x: 500, y: 1000 }, { at: 600, x: BTN.export[0] - 10, y: BTN.export[1] + 6 }, { at: 1500, x: 700, y: 500 }, { at: 2000, x: 720, y: 508 }])
  if (l < 2800) s += cursor(x, y, Math.max(pressAt(l, 700), pressAt(l, 2200)))
  return { bg: BG, body: s }
}

/** 收尾:哪裡用得到、目前是基本功能 */
export function outro(l: number): SceneOut {
  let s = txt(CX, 560, 'Claude Sheets', 96, INK, { anchor: 'middle', weight: 800, op: seg(l, 0, 600) })
  s += pill(CX, 660, 170, 62, 'BETA', ACCENT, '#fff', seg(l, 300, 900), 32)
  const dev = [{ n: '網頁', w: 300, h: 210 }, { n: '桌面', w: 260, h: 190 }, { n: '行動', w: 130, h: 230 }]
  dev.forEach((d, i) => {
    const a = seg(l, 800 + i * 300, 1500 + i * 300)
    s += `<g opacity="${n2(a)}" transform="translate(${220 + i * 320} ${n2(1000 + (1 - a) * 40)})"><rect x="${-d.w / 2}" y="${-d.h / 2}" width="${d.w}" height="${d.h}" rx="22" fill="${PAPER}" stroke="${INK}" stroke-width="5"/>${txt(0, d.h / 2 + 64, d.n, 40, INK, { anchor: 'middle' })}</g>`
  })
  s += txt(CX, 1350, '目前是基本功能，之後陸續擴充', 40, MUTED, { anchor: 'middle', op: seg(l, 1800, 2500) })
  return { bg: BG, body: s }
}
