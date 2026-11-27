// 以前手寫程式的橋段:不是一口氣照順序打完。先打出一版草稿(漏了兩行、寫錯一行),
// 再用滑鼠點回那個位置補上、刪掉重打。畫面是進度 p(0..1)的純函式,p=1 時就是完整的程式。

/** 漏掉、之後回頭補的行(用內容的一部分指認) */
const MISSED = ['name="tel"', 'if (s.left <= 0)']
/** 先寫錯、之後回頭改的行 */
const WRONG = { find: 's.left -= 1', draft: '  s.left = s.left + 1', keep: '  s.left ' }
/** 各步驟花的時間(單位:打一個字) */
const COST = { move: 72, click: 36, erase: 7 }
/** 打字速度(每秒幾個字)與每個段落打完停多久(毫秒)的預設;腳本的示範清單可以寫 cps、pause 蓋掉 */
export const HAND_CPS = 92
export const HAND_PAUSE_MS = 600

/** 草稿裡哪幾行打完算一個段落:標題清單、場次資料、表單樣板、送出處理、重畫函式 */
function paragraphEnds(draft: readonly string[]): number[] {
  const at = (found: number) => (found >= 0 ? [found] : [])
  const draw = draft.findIndex((l) => l.startsWith('function draw'))
  const last = draft.lastIndexOf('draw()')
  return [...at(draft.findIndex((l) => l.includes('id="list"'))), ...at(draft.indexOf(']')), ...at(draft.findIndex((l) => l.includes('id="people"'))), ...(draw > 0 ? [draw - 1] : []), ...(last > 0 ? [last - 1] : [])]
}

function plan(final: readonly string[]) {
  const missed = MISSED.map((m) => final.findIndex((l) => l.includes(m))).filter((i) => i >= 0)
  const wrong = final.findIndex((l) => l.includes(WRONG.find))
  const lines = final.filter((_, i) => !missed.includes(i)).map((l) => (l === final[wrong] ? WRONG.draft : l))
  const edits = missed.reduce((n, i) => n + COST.move + COST.click + final[i].length + 1, 0)
  const fix = wrong < 0 ? 0 : COST.move + COST.click + (WRONG.draft.length - WRONG.keep.length) * COST.erase + final[wrong].length - WRONG.keep.length
  return { missed, wrong, lines, edits, fix, ends: paragraphEnds(lines) }
}

/** 整段手寫要演多久(毫秒) */
export function handMs(final: readonly string[], cps = HAND_CPS, pause = HAND_PAUSE_MS): number {
  const p = plan(final)
  return ((p.lines.join('\n').length + p.edits + p.fix) / cps) * 1000 + p.ends.length * pause
}

export type HandFrame = {
  /** 段落停頓中游標閃到暗的那一格 */
  blink?: boolean
  lines: string[]
  /** 游標所在:第幾行、第幾個字之後 */
  caret: { line: number; col: number }
  /** 滑鼠:正在移向 caret(away 從 1 到 0)或按下;打字時沒有 */
  mouse?: { away: number; press: boolean }
}

export function handFrame(final: readonly string[], p: number, cps = HAND_CPS, pauseMs = HAND_PAUSE_MS): HandFrame {
  const { missed, wrong, lines, edits, fix, ends } = plan(final)
  const draft = lines.join('\n')
  const pause = Math.round((pauseMs * cps) / 1000)
  let left = Math.round(Math.min(1, Math.max(0, p)) * (draft.length + ends.length * pause + edits + fix))
  const spend = (n: number) => {
    const used = Math.min(left, n)
    left -= used
    return used
  }
  const upTo = (text: string, blink = false): HandFrame => {
    const shown = text.split('\n')
    return { lines: shown, caret: { line: shown.length - 1, col: shown[shown.length - 1].length }, blink }
  }
  // 草稿:一段一段打,段落之間停一下(游標閃)
  let done = 0
  for (const end of ends) {
    const to = lines.slice(0, end + 1).join('\n').length
    done += spend(to - done)
    if (done < to) return upTo(draft.slice(0, done))
    const held = spend(pause)
    if (held < pause) return upTo(draft.slice(0, done), Math.floor(held / (cps * 0.25)) % 2 === 1)
  }
  done += spend(draft.length - done)
  if (done < draft.length || (p < 1 && left === 0)) return upTo(draft.slice(0, done))
  let caret = { line: lines.length - 1, col: lines[lines.length - 1].length }
  /** 滑鼠移過去再按下;時間用完就停在半路 */
  const point = (to: { line: number; col: number }): HandFrame | null => {
    const moved = spend(COST.move)
    if (moved < COST.move) return { lines, caret: to, mouse: { away: (1 - moved / COST.move) ** 2, press: false } }
    const held = spend(COST.click)
    caret = to
    return held < COST.click || !left ? { lines, caret, mouse: { away: 0, press: held < COST.click } } : null
  }
  for (const i of missed) {
    // 漏掉的行照原本的順序補:補到第 i 行時,它前面的行都齊了
    const stop = point({ line: i - 1, col: lines[i - 1].length })
    if (stop) return stop
    spend(1)
    const part = final[i].slice(0, spend(final[i].length))
    lines.splice(i, 0, part)
    caret = { line: i, col: part.length }
    if (part.length < final[i].length || !left) return { lines, caret }
  }
  if (wrong >= 0) {
    const stop = point({ line: wrong, col: WRONG.draft.length })
    if (stop) return stop
    const gone = Math.floor(spend((WRONG.draft.length - WRONG.keep.length) * COST.erase) / COST.erase)
    lines[wrong] = WRONG.draft.slice(0, WRONG.draft.length - gone)
    caret = { line: wrong, col: lines[wrong].length }
    if (lines[wrong] !== WRONG.keep) return { lines, caret }
    lines[wrong] = WRONG.keep + final[wrong].slice(WRONG.keep.length).slice(0, spend(final[wrong].length - WRONG.keep.length))
    caret = { line: wrong, col: lines[wrong].length }
  }
  return { lines, caret }
}
