// then-now 的「自己寫」範例(task: write):週末工作坊的報名系統。比一頁靜態網頁複雜:場次名額、表單、扣名額與名單。
import { kit } from '../../kit'

/** 四段程式:每按一次寫一段 */
/** at 是測到網頁的哪裡(previewHtml 標的 data-v;bar 是瀏覽器網址列),畫面上游標移過去點 */
export type TestItem = { name: string; ok: boolean; why?: string; /** 沒寫的是不開畫面的測試(單元測試) */ at?: string }
/** 一次測試的結果:怎麼跑的、每一項通過或失敗、最後的結論 */
/** each 是畫面上測一項要多久(毫秒);stopOnFail:失敗就停,後面的不跑 */
/** 測試失敗後修改的那幾行:before、after 是不變的上下文,remove 劃掉、add 一個字一個字打上;done 是重跑全過後的結論 */
export type TestFix = { file: string; how: string; before: readonly string[]; remove: string; add: readonly string[]; after: readonly string[]; done: string }
export type TestRun = { how: string; items: readonly TestItem[]; summary: string; each: number; stopOnFail?: boolean; fix?: TestFix }
/** lines 是要打的程式;有 tests 的那一段是測試(不打字,列出一項一項的結果) */
export const CHUNKS: readonly { name: string; lines: readonly string[]; tests?: TestRun; /** 打這一段最多花多久(毫秒),沒寫用預設 */ ms?: number }[] = [
  // 最後一段是測試
  {
    name: '寫程式',
    // 以前整頁自己寫:頁面、表單、送出後的處理一口氣打完
    ms: 2600,
    lines: ['<h1>週末工作坊報名</h1>', '<p>每場名額有限，額滿為止</p>', '<ul id="list"></ul>', '<script>', 'const sessions = [', '  { name: "手沖咖啡", left: 3 },', '  { name: "陶藝入門", left: 0 },', '  { name: "植栽組盆", left: 8 }', ']', 'document.body.insertAdjacentHTML("beforeend", `', '  <form id="form">', '    <input name="who" placeholder="姓名" required>', '    <input name="tel" placeholder="電話" required>', '    <select name="pick"></select>', '    <button>送出報名</button>', '  </form>', '  <ol id="people"></ol>`)', 'form.onsubmit = (e) => {', '  e.preventDefault()', '  const s = sessions[form.pick.selectedIndex]', '  if (s.left <= 0) return alert("額滿了")', '  s.left -= 1', '  people.innerHTML += `<li>${form.who.value}｜${s.name}</li>`', '  draw()', '}', 'function draw() {', '  list.innerHTML = sessions.map(', '    (s) => `<li>${s.name}　剩 ${s.left} 位</li>`).join("")', '  form.pick.innerHTML = sessions.map(', '    (s) => `<option>${s.name}</option>`).join("")', '}', 'draw()', '</script>'],
  },
  {
    name: '單元測試',
    lines: [],
    tests: {
      how: '人工測試：打開主控台，一個函式一個函式自己輸入、用眼睛對答案',
      each: 1000,
      items: [
        { name: '輸入 take(3)，看到的是 2 嗎', ok: true },
        { name: '輸入 add("王小明")，名單多一筆嗎', ok: true },
        { name: '輸入 take(0)，回的是「額滿」嗎', ok: false, why: '看到的是 -1' },
      ],
      summary: '2 項對、1 項錯。要自己找出是哪一行有問題。',
      fix: {
        file: 'signup.html',
        how: '自己找到那一行，手動改',
        before: ['function take(s) {'],
        remove: '  s.left -= 1',
        add: ['  if (s.left <= 0) return "額滿"', '  s.left -= 1'],
        after: ['  return s.left', '}'],
        done: '改完再手動試一次，3 項都對。每改一次都要重打、重看。',
      },
    },
  },
  {
    name: '人工點擊測試',
    lines: [],
    tests: {
      how: '自己打開網頁，用滑鼠一項一項點、用眼睛看',
      each: 1100,
      items: [
        { name: '看三個場次有沒有出現', ok: true, at: 'list' },
        { name: '填姓名電話，按送出', ok: true, at: 'submit' },
        { name: '名單有沒有出現新的人', ok: true, at: 'people' },
        { name: '重新整理頁面，名單還在嗎', ok: false, why: '名單不見了', at: 'people' },
      ],
      summary: '3 項通過、1 項失敗。要自己找原因、改程式，再全部點一次。',
    },
  },
]

/** 後來用框架:同一個報名系統,拆成元件、由框架更新畫面;程式不一定比較少,但要先建專案、懂元件和狀態 */
export const FRAME_CHUNKS: typeof CHUNKS = [
  {
    name: '寫程式',
    // 建專案、裝套件、元件、狀態一口氣打完
    ms: 2600,
    lines: ['npm create vite@latest signup -- --template react', 'cd signup', 'npm install', 'npm run dev', 'function Sessions({ list }) {', '  return <ul>{list.map((s) =>', '    <li key={s.name}>{s.name}　剩 {s.left} 位</li>)}', '  </ul>', '}', 'function Form({ list, onSubmit }) {', '  return <form onSubmit={onSubmit}>', '    <input name="who" placeholder="姓名" required />', '    <input name="tel" placeholder="電話" required />', '    <select name="pick">', '      {list.map((s) => <option key={s.name}>{s.name}</option>)}', '    </select>', '    <button>送出報名</button>', '  </form>', '}', 'export default function App() {', '  const [list, setList] = useState(sessions)', '  const [people, setPeople] = useState([])', '  const submit = (e) => {', '    e.preventDefault()', '    const pick = e.target.pick.value', '    setList(list.map((s) => s.name === pick', '      ? { ...s, left: s.left - 1 } : s))', '    setPeople([...people, e.target.who.value])', '  }', '  return <><Sessions list={list} />', '    <Form list={list} onSubmit={submit} /></>', '}'],
  },
  {
    name: '單元測試',
    lines: [],
    tests: {
      how: '$ npm test（單元測試：只測函式和元件，不開畫面；測試自己寫）',
      each: 450,
      items: [
        { name: '扣名額的函式：3 變 2', ok: true },
        { name: '名單加一人的函式', ok: true },
        { name: '名額 0 的時候不能再扣', ok: false, why: '預期 0，拿到 -1' },
      ],
      summary: '2 passed、1 failed。',
      fix: {
        file: 'App.jsx',
        how: '看錯誤訊息，自己找到那一行改',
        before: ['    setList(list.map((s) => s.name === pick'],
        remove: '      ? { ...s, left: s.left - 1 } : s))',
        add: ['      ? { ...s, left: Math.max(0, s.left - 1) } : s))'],
        after: ['    setPeople([...people, e.target.who.value])'],
        done: '改完重跑：3 passed。零件對了，整頁接起來還不知道。',
      },
    },
  },
  {
    name: '自動畫面測試',
    lines: [],
    tests: {
      how: '$ npx playwright test（腳本也是自己寫的）',
      each: 750,
      stopOnFail: true,
      items: [
        { name: '打開頁面，看到三個場次', ok: true, at: 'list' },
        { name: '填表單送出，名單新增一人', ok: true, at: 'submit' },
        { name: '額滿的場次不能報名', ok: false, why: '函式擋住了，畫面卻照樣送出成功。測試停在這裡', at: 'card:1' },
        { name: '匯出與搜尋', ok: true, at: 'people' },
      ],
      summary: '2 passed、1 failed、1 未執行。要自己看截圖、改程式，再跑一次。',
    },
  },
]

export type Era = 'then' | 'frame'
export const chunksOf = (era: Era): typeof CHUNKS => (era === 'frame' ? FRAME_CHUNKS : CHUNKS)
export const chunkText = (era: Era, n: number): string => chunksOf(era)[n - 1].lines.join('\n')
const typedChunks = (era: Era, n = Infinity): typeof CHUNKS => chunksOf(era).slice(0, n).filter((c) => !c.tests)
export const writtenLines = (era: Era, n: number): number => typedChunks(era, n).reduce((m, c) => m + c.lines.length, 0)
export const writtenChars = (era: Era, n: number): number => typedChunks(era, n).reduce((m, c) => m + kit.graphemes(c.lines.join('')).length, 0)
export const symbolCount = (era: Era): number => [...typedChunks(era).flatMap((c) => c.lines).join('')].filter((c) => '<>/=(){}[]"`$.,'.includes(c)).length
/** 寫到第幾段時預覽長到哪裡(previewHtml 的 parts):第一段就有標題和場次;兩個寫程式的時代一樣 */
export const framePreview = (n: number): number => (n >= 1 ? 4 : 0)
/** 「以前」只有一段程式:寫完就是整個網頁 */
export const thenPreview = (n: number): number => (n >= 1 ? 4 : 0)

const colored = (text: string): string => kit.esc(text).replace(/(&lt;\/?[a-z0-9]+|&gt;)/g, '<span class="tn-t">$1</span>')

/** 程式區:寫好的幾段,加上正在打的那一段打出的前 chars 個字 */
export function codeHtml(era: Era, written: number, typing: { chunk: number; chars: number } | null): string {
  const upto = typing ? typing.chunk : written
  if (!upto) return '<p class="tn-blank">還沒有任何程式</p>'
  let no = 0
  return typedChunks(era, upto)
    .map((c, i) => {
      const live = typing?.chunk === i + 1 && !c.tests
      const text = live ? kit.graphemes(c.lines.join('\n')).slice(0, typing.chars).join('') : c.lines.join('\n')
      return text
        .split('\n')
        .map((line, k, all) => `<div class="tn-src"><span class="tn-no tn-num">${++no}</span><code>${colored(line)}${live && k === all.length - 1 ? '<i class="tn-caret"></i>' : ''}</code></div>`)
        .join('')
    })
    .join('')
}

export type SignupWant = 'full' | 'search' | 'chart' | 'export'

/** 場次:圖示、名稱、時間、剩餘名額、總名額 */
const SESSIONS: readonly { icon: string; name: string; when: string; left: number; seats: number }[] = [
  { icon: '☕', name: '手沖咖啡', when: '週六 10:00', left: 3, seats: 12 },
  { icon: '🏺', name: '陶藝入門', when: '週六 14:00', left: 0, seats: 12 },
  { icon: '🌿', name: '植栽組盆', when: '週日 10:00', left: 8, seats: 12 },
]
const PEOPLE: readonly [string, string][] = [
  ['王小明', '手沖咖啡'],
  ['李美玲', '陶藝入門'],
]

/** 網頁預覽:寫到第幾段就長到哪裡(1 標題、2 場次、3 表單、4 名單);made 是 AI 加上的功能 */
export function previewHtml(parts: number, made: SignupWant | null, fresh: boolean): string {
  if (parts < 1) return '<div class="ws ws-empty">這裡還是空白的</div>'
  const mark = (w: SignupWant): string => (fresh && made === w ? ' tn-new' : '')
  const hero = '<header class="ws-hero"><span class="ws-kicker">WEEKEND STUDIO</span><p class="ws-title">週末工作坊報名</p><p class="ws-sub">每場 12 人，額滿為止</p></header>'
  const card = (x: (typeof SESSIONS)[number]): string => {
    const full = x.left === 0 && made === 'full'
    const badge = full
      ? `<span class="ws-badge full${mark('full')}">額滿</span>`
      : `<span class="ws-badge${x.left === 0 ? ' none' : x.left <= 3 ? ' few' : ''}">剩 ${x.left} 位</span>`
    return `<li class="ws-card${full ? ' closed' : ''}" data-v="card:${SESSIONS.indexOf(x)}"><span class="ws-icon">${x.icon}</span><div class="ws-info"><b>${x.name}</b><small>${x.when}</small><i class="ws-meter"><i style="width:${Math.round(((x.seats - x.left) / x.seats) * 100)}%"></i></i></div>${badge}</li>`
  }
  const list = parts >= 2 && made !== 'chart' ? `<ul class="ws-list" data-v="list">${SESSIONS.map(card).join('')}</ul>` : ''
  // 統計圖:換掉場次卡片,高度差不多,不會把下面擠出畫面
  const chart =
    made === 'chart'
      ? `<div class="ws-chart${mark('chart')}"><p>各場報名人數</p>${SESSIONS.map((x) => `<div><span>${x.icon} ${x.name}</span><i><i style="width:${Math.round(((x.seats - x.left) / x.seats) * 100)}%"></i></i><b>${x.seats - x.left}</b></div>`).join('')}</div>`
      : ''
  const form =
    parts >= 3
      ? '<div class="ws-form"><span class="ws-field">姓名</span><span class="ws-field">電話</span><span class="ws-field wide">☕ 手沖咖啡<em>▾</em></span><span class="ws-submit" data-v="submit">送出報名</span></div>'
      : ''
  const rows = made === 'search' ? PEOPLE.slice(0, 1) : PEOPLE
  const search = made === 'search' ? `<div class="ws-search${mark('search')}">🔍 王</div>` : ''
  const exported = made === 'export' ? `<span class="ws-export${mark('export')}">⤓ 匯出試算表</span>` : ''
  const people =
    parts >= 4
      ? `<section class="ws-people" data-v="people"><div class="ws-head"><b>最新報名</b>${exported}</div>${search}<ul>${rows.map(([who, what]) => `<li><span class="ws-avatar">${who[0]}</span><span>${who}</span><small>${what}</small></li>`).join('')}</ul></section>`
      : ''
  return `<div class="ws">${hero}${chart}${list}${form}${people}</div>`
}

/** 測試結果清單:前 shown 項已經跑完,下一項正在跑;全部跑完才出結論 */
export function testsHtml(run: TestRun, shown: number): string {
  // 失敗就停的:停在第一個失敗那一項
  const stop = run.stopOnFail ? run.items.findIndex((t) => !t.ok) : -1
  const stopped = stop >= 0 && shown > stop
  const items = run.items
    .map((t, i) => {
      const state = stopped && i > stop ? 'skip' : i < shown ? (t.ok ? 'pass' : 'fail') : i === shown ? 'run' : 'wait'
      const mark = state === 'pass' ? '✓' : state === 'fail' ? '✗' : state === 'run' ? '…' : state === 'skip' ? '–' : '○'
      return `<li data-s="${state}"><b>${mark}</b><span>${kit.esc(t.name)}${state === 'fail' && t.why ? `<em>${kit.esc(t.why)}</em>` : ''}</span></li>`
    })
    .join('')
  return `<p class="tn-how">${kit.esc(run.how)}</p><ul class="tn-run">${items}</ul>${stopped || shown >= run.items.length ? `<p class="tn-sum" data-ok="${run.items.every((t) => t.ok) ? 1 : 0}">${kit.esc(run.summary)}</p>` : ''}`
}

/** 修改測試錯誤的畫面:typed 是新的幾行已經打出幾個字 */
export function fixHtml(fix: TestFix, typed: number): string {
  const row = (cls: string, mark: string, text: string): string => `<div class="tn-diff ${cls}"><b>${mark}</b><code>${text}</code></div>`
  const added = fix.add.join('\n')
  const shown = kit.graphemes(added).slice(0, typed).join('')
  const done = typed >= kit.graphemes(added).length
  const lines = shown.split('\n')
  return `<p class="tn-how">${kit.esc(fix.how)}</p>${fix.before.map((l) => row('', ' ', colored(l))).join('')}${row('del', '−', colored(fix.remove))}${lines
    .map((l, i) => row('add', '+', `${colored(l)}${!done && i === lines.length - 1 ? '<i class="tn-caret"></i>' : ''}`))
    .join('')}${done ? fix.after.map((l) => row('', ' ', colored(l))).join('') : ''}`
}

/** 各階段大概要花的時間(分鐘,示意值,不是動畫播放的長度):依序對應下方進度的每一格 */
export const MINUTES: Record<'then' | 'frame' | 'now', readonly number[]> = {
  then: [120, 30, 20],
  frame: [45, 10, 5],
  now: [1, 0.5, 1.5, 1],
}
/** 做完 done 個階段、目前這一個做到 part(0–1)時,累計花了幾分鐘 */
export const spent = (era: keyof typeof MINUTES, done: number, part = 0): number => Math.round(MINUTES[era].slice(0, done).reduce((m, x) => m + x, 0) + (MINUTES[era][done] ?? 0) * part)
export const timeText = (min: number): string => (min < 60 ? `${min} 分鐘` : `${Math.floor(min / 60)} 小時${min % 60 ? ` ${min % 60} 分` : ''}`)
