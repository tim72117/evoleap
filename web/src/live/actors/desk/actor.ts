// 演員 desk:寫實情境「你自己的電腦」。牆、窗、木頭桌、螢幕、鍵盤、滑鼠、馬克杯、盆栽;螢幕上是桌面(資料夾與檔案)、Dock 與 AI 程式助手的視窗。
// 用來演出沒有對應介面的觀念:助手會在你的電腦上讀檔、改檔、執行指令,所以動手前先跳出確認提示;按允許/拒絕會造成什麼結果。
// 也演出安裝(安裝視窗的進度條)、打開與登入。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// 畫面大小:場景固定 16:9,寬度跟著 place 的 w(1em = 寬度的 1/96),高度 = 寬 × 9/16;place 請給 16:9 的大小(例如 full,或 { w: 880, h: 495 })。
//
// props(登場設定,只描述起始狀態):
//   tree       桌面上的東西:{ "文件": { "工作報告.docx": "" }, "下載": { … }, "旅行照片": {} };物件是資料夾、字串是檔案
//   app        助手的名稱(預設「AI 程式助手」)
//   installed  一開始就裝好了(Dock 上有它,預設 false)
//   running    一開始助手視窗就開著(要 installed,預設 false)
//   account    一開始就登入的帳號(要 running;預設沒登入)
//   open       一開始就打開的資料夾視窗(桌面上的資料夾名稱)
//   label      標籤,例如「按了允許」(並排對照兩種結果時用);全景時貼在右上角的牆面,近景(close)時放在演員框的正上方、畫面外
//              (所以 close 搭配 label 時,place 上方要留大約寬度 7% 的空間);省略則不顯示
//   clock      螢幕右上角的時間(預設「週六 15:10」)
//   close      true:近景,螢幕填滿畫面(桌子、植物在畫面外),螢幕裡的介面放大 15%;並排對照、place 比較小時用,字才看得清楚
//
// 寫實繪製:房間與桌上物件在 room.ts(靜態 SVG)與 actor.css;木桌、牆面貼 CC0 材質圖(textures/README.md)。
//
// 動作(依序操作;對不上狀態時載入就報錯並指出第幾步):
//   { "open": "下載" }                 (滑鼠)點兩下桌面上的資料夾,打開資料夾視窗(同時只開一個)
//   { "close": true }                  關掉資料夾視窗
//   { "install": true }                打開下載好的安裝檔:安裝視窗的進度條跑完,Dock 多一個助手的圖示。已經裝了會報錯
//   { "launch": true }                 (滑鼠)點 Dock 上助手的圖示,助手視窗打開。還沒裝、已經開著會報錯
//   { "signin": "you@example.com" }    (滑鼠)按助手視窗的「用瀏覽器登入」,完成後右上角顯示帳號。助手沒開、已登入會報錯
//   { "user": "幫我…" }                在助手視窗輸入一句話送出(對話泡泡,只留最後兩句);會清掉上一輪的讀取/修改標記與結果
//   { "read": "文件/工作報告.docx" }    助手去讀這個檔案:一條線從助手連到檔案,檔案旁標「讀取」
//   { "edit": "文件/工作報告.docx" }    同上,標「修改」
//   { "run": "ls ~/下載" }              助手執行一個指令:助手視窗裡出現這一行指令
//   { "ask": "rm -rf ~/下載/*", "say": "刪除「下載」裡的 6 個檔案", "will": { "empty": "下載" } }
//        助手跳出確認提示,停住等 answer。say 是白話說明;will 是「允許後實際會發生的事」,演員照它改動桌面:
//        { "empty": "資料夾" }(清空)、{ "delete": "路徑" }(刪掉一個檔案或資料夾)、{ "mkdir": "名稱" }(桌面多一個資料夾);省略表示沒有看得到的改變
//   { "answer": "deny" | "once" | "always" }
//        (滑鼠)按確認提示的「拒絕」「允許一次」「一律允許」。允許時照 will 改動(檔案淡出、新資料夾彈出);
//        拒絕時什麼都不動。助手視窗底下留一行結果;一律允許之後,助手視窗標題列多一個「一律允許」的警示
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window(整個場景)、screen(螢幕)、app(助手視窗)、dialog(確認提示)、option:deny|once|always、folder(資料夾視窗)、
//   item:<路徑>(桌面上的東西,或打開的資料夾裡的檔案,例如 item:下載、item:下載/旅行照片.zip)、dock、launcher(Dock 上助手的圖示)、
//   installer(安裝視窗)、signin(登入按鈕)、result(助手視窗底下的結果)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields, type CursorPlan } from '../../types'
import './actor.css'
import { keyboardSvg, MOUSE_SVG, MUG_SVG, PHOTO_SVG, plantSvg, scopeIds } from './room'

export type Tree = { [name: string]: Tree | string }
export type Will = { empty: string } | { delete: string } | { mkdir: string }
export type Answer = 'deny' | 'once' | 'always'
export type DeskKind = 'open' | 'close' | 'install' | 'launch' | 'signin' | 'user' | 'read' | 'edit' | 'run' | 'ask' | 'answer'
export type DeskStep = CommonStepFields & {
  open?: string
  close?: boolean
  install?: boolean
  launch?: boolean
  signin?: string
  user?: string
  read?: string
  edit?: string
  run?: string
  ask?: string
  say?: string
  will?: Will
  answer?: Answer
}
export interface DeskProps {
  tree?: Tree
  app?: string
  installed?: boolean
  running?: boolean
  account?: string
  open?: string
  label?: string
  clock?: string
  close?: boolean
}
type Touch = 'read' | 'edit'
export interface DeskState {
  tree: Tree
  installed: boolean
  running: boolean
  account: string | null
  /** 打開的資料夾視窗 */
  open: string | null
  /** 對話泡泡(最後兩句) */
  chat: string[]
  /** 助手最近做的一件事(讀、改、執行) */
  activity: { kind: 'read' | 'edit' | 'run'; text: string } | null
  /** 這一輪讀過、改過的檔案 */
  marks: Record<string, Touch>
  pending: { cmd: string; say: string; will: Will | null } | null
  result: { answer: Answer; text: string } | null
  always: boolean
  temp: Record<string, never>
}
type DeskTarget = 'window' | 'screen' | 'app' | 'dialog' | 'folder' | 'dock' | 'launcher' | 'installer' | 'signin' | 'result' | `option:${string}` | `item:${string}`

const KINDS: readonly DeskKind[] = ['open', 'close', 'install', 'launch', 'signin', 'user', 'read', 'edit', 'run', 'ask', 'answer']
const ANSWERS: readonly Answer[] = ['deny', 'once', 'always']
const OPTION_TEXT: Record<Answer, string> = { deny: '拒絕', once: '允許一次', always: '一律允許' }
const DEFAULT_APP = 'AI 程式助手'
/** 虛擬滑鼠:動作開始後 100ms 出發,約 550ms 到達並按下 */
const CLICK = 650
const CPS = 16
const INSTALL_END = 3100
/** 每個演員一個編號,給 SVG 漸層 id 加前綴 */
let uid = 0

// ---------- 目錄樹(純函式) ----------

const isDir = (n: Tree | string | undefined): n is Tree => typeof n === 'object' && n !== null
const parts = (path: string): string[] => path.split('/').filter(Boolean)

function nodeAt(tree: Tree, path: string): Tree | string | undefined {
  let n: Tree | string | undefined = tree
  for (const p of parts(path)) {
    if (!isDir(n)) return undefined
    n = n[p]
  }
  return n
}

/** 換掉 path 那一個節點(undefined 表示刪掉),回傳新的樹 */
function replaceAt(tree: Tree, path: string[], next: Tree | string | undefined): Tree {
  const [head, ...rest] = path
  const out: Tree = { ...tree }
  if (!rest.length) {
    if (next === undefined) delete out[head]
    else out[head] = next
    return out
  }
  const child = tree[head]
  if (!isDir(child)) throw new Error(`「${head}」不是資料夾`)
  out[head] = replaceAt(child, rest, next)
  return out
}

function checkWill(tree: Tree, will: Will): void {
  if ('empty' in will) {
    if (!isDir(nodeAt(tree, will.empty))) throw new Error(`will.empty:桌面上沒有「${will.empty}」這個資料夾`)
  } else if ('delete' in will) {
    if (nodeAt(tree, will.delete) === undefined) throw new Error(`will.delete:找不到「${will.delete}」`)
  } else if ('mkdir' in will) {
    if (!will.mkdir || will.mkdir.includes('/')) throw new Error('will.mkdir 要寫一個資料夾名稱(放在桌面上)')
    if (tree[will.mkdir] !== undefined) throw new Error(`will.mkdir:桌面上已經有「${will.mkdir}」`)
  } else throw new Error('will 只能是 { empty }、{ delete } 或 { mkdir }')
}

function applyWill(tree: Tree, will: Will): Tree {
  if ('empty' in will) return replaceAt(tree, parts(will.empty), {})
  if ('delete' in will) return replaceAt(tree, parts(will.delete), undefined)
  return { ...tree, [will.mkdir]: {} }
}

const baseName = (path: string): string => parts(path).at(-1) ?? path

// ---------- 圖示(SVG,沒有商標) ----------

const FOLDER = `<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M2 8a4 4 0 0 1 4-4h12l5 5h19a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="#5aa0e6"/><path d="M2 14h44v20a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="#7cb8f2"/></svg>`
function fileIcon(name: string): string {
  // 名稱裡有「安裝檔」的當成安裝程式(不寫副檔名,Windows、macOS 都適用)
  const ext = name.includes('安裝檔') ? 'exe' : (/\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '')
  const color = ext === 'xlsx' || ext === 'csv' ? '#2f9b62' : ext === 'docx' || ext === 'txt' || ext === 'md' ? '#3a6fd1' : ext === 'jpg' || ext === 'png' ? '#d8822f' : ext === 'pdf' ? '#d14b3a' : ext === 'zip' ? '#8a7b66' : ext === 'dmg' || ext === 'exe' || ext === 'msi' ? '#6a5acd' : '#8f99a8'
  const mark =
    ext === 'xlsx' || ext === 'csv'
      ? `<path d="M12 22h20M12 28h20M12 34h20M19 18v20M26 18v20" stroke="#fff" stroke-width="2"/>`
      : ext === 'jpg' || ext === 'png'
        ? `<path d="M11 36l8-10 6 7 4-4 6 7z" fill="#fff"/><circle cx="28" cy="22" r="3" fill="#fff"/>`
        : ext === 'zip'
          ? `<path d="M22 10v4M22 16v4M22 22v4" stroke="#fff" stroke-width="3"/><rect x="18" y="27" width="8" height="8" rx="2" fill="#fff"/>`
          : ext === 'dmg' || ext === 'exe' || ext === 'msi'
            ? `<path d="M22 16v14M16 25l6 6 6-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
            : `<path d="M12 20h20M12 26h20M12 32h14" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`
  return `<svg viewBox="0 0 44 48" aria-hidden="true"><path d="M6 2h22l12 12v30a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="${color}"/><path d="M28 2v10a2 2 0 0 0 2 2h10z" fill="rgba(255,255,255,.45)"/>${mark}</svg>`
}
const iconOf = (name: string, node: Tree | string): string => (isDir(node) ? FOLDER : fileIcon(name))
/** 助手的圖示:圓角方塊裡的星芒(通用符號,不是任何產品的標誌) */
const SPARK = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#e9774b"/><path d="M20 8c1.2 6.4 5.6 10.8 12 12-6.4 1.2-10.8 5.6-12 12-1.2-6.4-5.6-10.8-12-12 6.4-1.2 10.8-5.6 12-12z" fill="#fff8f0"/></svg>`
const DOCK_APPS = [
  `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#4c8be8"/><circle cx="20" cy="20" r="11" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M9 20h22M20 9c-5 6-5 16 0 22M20 9c5 6 5 16 0 22" fill="none" stroke="#fff" stroke-width="2"/></svg>`,
  `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#f1f3f6"/>${FOLDER.replace('<svg viewBox="0 0 48 40" aria-hidden="true">', '<g transform="translate(6 9) scale(.58)">').replace('</svg>', '</g>')}</svg>`,
  `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#f6d55c"/><path d="M11 13h18M11 20h18M11 27h12" stroke="#7a6418" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#8e9aab"/><circle cx="20" cy="20" r="8" fill="none" stroke="#fff" stroke-width="3"/><path d="M20 6v5M20 29v5M6 20h5M29 20h5M10 10l3.5 3.5M26.5 26.5L30 30M10 30l3.5-3.5M26.5 13.5L30 10" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
]

// ---------- 演員 ----------

/** 動作進行中的那一個動作(show/hide 帶的動作也算) */
function actingKind(ev: { kind: string; step: unknown } | null): DeskKind | null {
  if (!ev) return null
  if (ev.kind === 'show' || ev.kind === 'hide') return KINDS.find((k) => k in (ev.step as object)) ?? null
  return (KINDS as readonly string[]).includes(ev.kind) ? (ev.kind as DeskKind) : null
}

const actor = defineActor<DeskKind, DeskStep, DeskProps, DeskState, DeskTarget>({
  name: 'desk',
  kinds: KINDS,

  init(props) {
    const tree = props.tree ?? {}
    if (!isDir(tree)) throw new Error('tree 要是物件(資料夾名稱 → 內容)')
    const installed = !!props.installed
    const running = !!props.running
    if (running && !installed) throw new Error('running 要先 installed')
    if (props.account && !running) throw new Error('account 要先 running')
    if (props.open !== undefined && !isDir(tree[props.open])) throw new Error(`open:桌面上沒有「${props.open}」這個資料夾`)
    return { tree, installed, running, account: props.account ?? null, open: props.open ?? null, chat: [], activity: null, marks: {}, pending: null, result: null, always: false, temp: {} }
  },

  apply(st, kind, s) {
    const needApp = (what: string) => {
      if (!st.running) throw new Error(`${what}:助手還沒打開(先 launch)`)
    }
    const needIdle = (what: string) => {
      if (st.pending) throw new Error(`${what}:確認提示還在等回答(先 answer)`)
    }
    switch (kind) {
      case 'open': {
        const name = s.open ?? ''
        if (!isDir(st.tree[name])) throw new Error(`open:桌面上沒有「${name}」這個資料夾`)
        return { ...st, open: name }
      }
      case 'close':
        if (!st.open) throw new Error('close:沒有打開的資料夾視窗')
        return { ...st, open: null }
      case 'install':
        if (st.installed) throw new Error('install:已經裝好了')
        return { ...st, installed: true }
      case 'launch':
        if (!st.installed) throw new Error('launch:還沒安裝(先 install)')
        if (st.running) throw new Error('launch:助手已經開著')
        return { ...st, running: true }
      case 'signin':
        needApp('signin')
        if (st.account) throw new Error('signin:已經登入了')
        if (!s.signin) throw new Error('signin 要寫帳號')
        return { ...st, account: s.signin }
      case 'user':
        needApp('user')
        needIdle('user')
        if (!s.user) throw new Error('user 要寫一句話')
        return { ...st, chat: [...st.chat, s.user].slice(-2), activity: null, marks: {}, result: null }
      case 'read':
      case 'edit': {
        needApp(kind)
        needIdle(kind)
        const path = s[kind] ?? ''
        if (nodeAt(st.tree, path) === undefined) throw new Error(`${kind}:找不到「${path}」`)
        return { ...st, activity: { kind, text: path }, marks: { ...st.marks, [path]: kind } }
      }
      case 'run':
        needApp('run')
        needIdle('run')
        if (!s.run) throw new Error('run 要寫指令')
        return { ...st, activity: { kind: 'run', text: s.run } }
      case 'ask': {
        needApp('ask')
        needIdle('ask')
        if (!s.ask) throw new Error('ask 要寫助手想執行的指令')
        if (s.will) checkWill(st.tree, s.will)
        return { ...st, pending: { cmd: s.ask, say: s.say ?? '', will: s.will ?? null }, result: null }
      }
      case 'answer': {
        const a = s.answer as Answer
        if (!ANSWERS.includes(a)) throw new Error(`answer 只能是 ${ANSWERS.join('、')}`)
        const p = st.pending
        if (!p) throw new Error('answer:沒有等待回答的確認提示(先 ask)')
        if (a === 'deny') return { ...st, pending: null, result: { answer: a, text: '已拒絕：沒有動到任何檔案' } }
        const tree = p.will ? applyWill(st.tree, p.will) : st.tree
        // 被刪掉的資料夾正開著:視窗跟著關掉
        const open = st.open && isDir(tree[st.open]) ? st.open : null
        const text = a === 'always' ? `已一律允許：${p.say || p.cmd}（之後同類的操作不再詢問）` : `已允許一次：${p.say || p.cmd}`
        return { ...st, tree, open, pending: null, result: { answer: a, text }, always: st.always || a === 'always' }
      }
    }
  },

  duration(kind, s) {
    switch (kind) {
      case 'open': return CLICK + 500
      case 'close': return 450
      case 'install': return INSTALL_END + 700
      case 'launch': return CLICK + 650
      case 'signin': return 2900
      case 'user': return 250 + kit.typeDuration(s.user ?? '', CPS) + 450
      case 'read': case 'edit': return 2000
      case 'run': return 300 + kit.typeDuration(s.run ?? '', 24) + 600
      case 'ask': return 900
      case 'answer': return CLICK + 1100
    }
  },

  autoFocus(kind) {
    return kind === 'close' ? undefined : 'screen'
  },

  cursor(kind, s): CursorPlan | null {
    if (kind === 'open') return { moves: [{ at: 100, target: `item:${s.open}` }], clickAt: CLICK }
    if (kind === 'launch') return { moves: [{ at: 100, target: 'launcher' }], clickAt: CLICK }
    if (kind === 'signin') return { moves: [{ at: 100, target: 'signin' }], clickAt: CLICK }
    if (kind === 'answer') return { moves: [{ at: 100, target: `option:${s.answer}` }], clickAt: CLICK }
    return null
  },

  mount(root, props) {
    const app = props.app ?? DEFAULT_APP
    root.classList.add('A-desk')
    if (props.close) root.dataset.close = '1'
    const p = `dk${++uid}-`
    root.innerHTML = `<div class="dk-clip"><div class="dk-scene">
  <div class="dk-wall"></div>
  <div class="dk-win"><div class="dk-win-out"><i class="dk-out-sky"></i><i class="dk-out-trees"></i><i class="dk-out-bloom"></i></div><div class="dk-win-bar"></div><div class="dk-win-glass"></div></div>
  <div class="dk-sill"></div>
  <div class="dk-curtain"></div>
  <div class="dk-frame">${scopeIds(PHOTO_SVG, p)}</div>
  <div class="dk-desk"><div class="dk-wood"></div><div class="dk-desk-light"></div></div>
  <div class="dk-desk-front"></div>
  <div class="dk-vignette"></div>
  <div class="dk-plant"><i class="dk-shadow"></i>${scopeIds(plantSvg(), p)}</div>
  <div class="dk-monitor">
    <i class="dk-base-shadow"></i><div class="dk-neck"></div><div class="dk-base"></div>
    <div class="dk-bezel"><div class="dk-screen">
      <div class="dk-paper"></div>
      <div class="dk-topbar"><span class="dk-dot"></span><span class="dk-clock">${kit.esc(props.clock ?? '週六 15:10')}</span></div>
      <div class="dk-icons"></div>
      <div class="dk-folder"><div class="dk-fhead"><span class="dk-lights"><i></i><i></i><i></i></span><span class="dk-ftitle"></span><span class="dk-fcount"></span></div><div class="dk-flist"></div></div>
      <div class="dk-app">
        <div class="dk-ahead"><span class="dk-aicon">${SPARK}</span><span class="dk-aname">${kit.esc(app)}</span><span class="dk-always">一律允許</span><span class="dk-acct"></span></div>
        <div class="dk-abody">
          <div class="dk-signin"><span class="dk-sbig">${SPARK}</span><p>登入 ${kit.esc(app)}</p><span class="dk-signbtn">用瀏覽器登入</span><span class="dk-signwait">正在等瀏覽器完成登入…</span></div>
          <div class="dk-chat"></div>
          <div class="dk-activity"></div>
          <div class="dk-result"></div>
        </div>
        <div class="dk-ainput">描述你要做的事…</div>
      </div>
      <div class="dk-dialog"><p class="dk-dq">${kit.esc(app)} 想要執行這個指令</p><code class="dk-dcmd"></code><p class="dk-dsay"></p><div class="dk-dopts">${ANSWERS.map((a) => `<span data-o="${a}">${OPTION_TEXT[a]}</span>`).join('')}</div></div>
      <div class="dk-installer"><span class="dk-ibig">${SPARK}</span><p class="dk-iname">安裝 ${kit.esc(app)}</p><div class="dk-ibar"><i></i></div><p class="dk-istate"></p></div>
      <svg class="dk-wire"><path d=""/></svg>
      <div class="dk-dock">${DOCK_APPS.map((s) => `<span class="dk-app-icon">${s}</span>`).join('')}<span class="dk-app-icon dk-mine" data-app="assistant">${SPARK}</span></div>
      <i class="dk-glare"></i>
    </div></div>
  </div>
  <div class="dk-sticky"><i class="dk-shadow"></i><span>備份<br>星期日</span></div>
  <div class="dk-mug"><i class="dk-shadow"></i>${scopeIds(MUG_SVG, p)}</div>
  <div class="dk-keyboard"><i class="dk-shadow"></i><div class="dk-kb-top">${scopeIds(keyboardSvg(), p)}</div><i class="dk-kb-front"></i></div>
  <div class="dk-mouse"><i class="dk-shadow"></i><div class="dk-ms-top">${scopeIds(MOUSE_SVG, p)}</div></div>
</div></div>
  ${props.label ? `<div class="dk-label">${kit.esc(props.label)}</div>` : ''}`
    const $ = <E extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as E
    const scene = $('.dk-scene')
    const screen = $('.dk-screen')
    const icons = $('.dk-icons')
    const folder = $('.dk-folder')
    const ftitle = $('.dk-ftitle')
    const fcount = $('.dk-fcount')
    const flist = $('.dk-flist')
    const appWin = $('.dk-app')
    const acct = $('.dk-acct')
    const always = $('.dk-always')
    const signin = $('.dk-signin')
    const signbtn = $('.dk-signbtn')
    const signwait = $('.dk-signwait')
    const chat = $('.dk-chat')
    const activity = $('.dk-activity')
    const result = $('.dk-result')
    const dialog = $('.dk-dialog')
    const dcmd = $('.dk-dcmd')
    const dsay = $('.dk-dsay')
    const installer = $('.dk-installer')
    const ibar = $('.dk-ibar i')
    const istate = $('.dk-istate')
    const wire = $<SVGSVGElement>('.dk-wire')
    const wirePath = $<SVGPathElement>('.dk-wire path')
    const mine = $('.dk-mine')

    /** 一列東西(桌面或資料夾視窗):prev 與 state 合在一起,剛出現的淡入、剛消失的淡出 */
    function rows(before: Tree, after: Tree, base: string, fx: number, marks: Record<string, Touch>, folderOpen: string | null): string {
      const names = [...Object.keys(before), ...Object.keys(after).filter((n) => !(n in before))]
      return names
        .filter((n) => fx < 1 || n in after)
        .map((n) => {
          const node = (after[n] ?? before[n]) as Tree | string
          const path = base ? `${base}/${n}` : n
          // 資料夾沒打開時,裡面的檔案被讀、被改,標在資料夾上
          const mark = marks[path] ?? (folderOpen !== path ? Object.entries(marks).find(([p]) => p.startsWith(`${path}/`))?.[1] : undefined)
          const state = !(n in before) ? 'in' : !(n in after) ? 'out' : ''
          return `<div class="dk-item" data-path="${kit.esc(path)}" data-st="${state}"><span class="dk-glyph">${iconOf(n, node)}</span><span class="dk-name">${kit.esc(n)}</span>${mark ? `<span class="dk-mark" data-m="${mark}">${mark === 'read' ? '讀取' : '修改'}</span>` : ''}</div>`
        })
        .join('')
    }

    function itemEl(path: string, st: DeskState | null): HTMLElement | null {
      const find = (box: HTMLElement, p: string) => ([...box.children] as HTMLElement[]).find((el) => el.dataset.path === p) ?? null
      const ps = parts(path)
      if (st?.open && ps.length > 1 && ps[0] === st.open) return find(flist, path) ?? find(icons, ps[0])
      return find(icons, ps[0] ?? '')
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev
        const kind = actingKind(ev)
        const local = ev?.local ?? 0
        const st = view.state
        const pv = ev ? view.prev : st
        const tFx = kind === 'answer' ? kit.progress(local, CLICK + 150, 650) : 1

        // ---- 桌面上的東西 ----
        const marksNow = kind === 'read' || kind === 'edit' ? (local > 900 ? st.marks : pv.marks) : st.marks
        kit.setIf(icons, 'html', rows(pv.tree, st.tree, '', tFx, marksNow, st.open))
        for (const el of [...icons.children] as HTMLElement[]) itemAnim(el, tFx)

        // ---- 資料夾視窗 ----
        const fname = st.open ?? (kind === 'close' || kind === 'answer' ? pv.open : null)
        let fOp = fname ? 1 : 0
        if (kind === 'open') fOp = pv.open === st.open ? 1 : kit.progress(local, CLICK + 50, 300)
        if (kind === 'close') fOp = 1 - kit.progress(local, 0, 350)
        if (kind === 'answer' && pv.open && !st.open) fOp = 1 - kit.progress(local, CLICK + 800, 300)
        kit.css(folder, { opacity: fOp.toFixed(3), transform: `scale(${kit.lerp(0.94, 1, kit.ease.outCubic(fOp)).toFixed(3)})`, visibility: fOp > 0 ? 'visible' : 'hidden' })
        if (fname) {
          const before = (nodeAt(pv.tree, fname) as Tree | undefined) ?? {}
          const after = (nodeAt(st.tree, fname) as Tree | undefined) ?? {}
          kit.setIf(ftitle, 'text', fname)
          const n = Object.keys(tFx >= 0.5 ? after : before).length
          kit.setIf(fcount, 'text', n ? `${n} 個項目` : '空的')
          kit.setIf(flist, 'html', rows(before, after, fname, tFx, marksNow, fname) || '<p class="dk-empty">這個資料夾是空的</p>')
          for (const el of [...flist.children] as HTMLElement[]) itemAnim(el, tFx)
        }

        // ---- 安裝視窗與 Dock ----
        const installing = kind === 'install'
        const iOp = installing ? Math.min(kit.progress(local, 0, 300), 1 - kit.progress(local, INSTALL_END + 200, 400)) : 0
        kit.css(installer, { opacity: iOp.toFixed(3), visibility: iOp > 0 ? 'visible' : 'hidden', transform: `scale(${kit.lerp(0.94, 1, kit.ease.outCubic(kit.progress(local, 0, 300))).toFixed(3)})` })
        if (installing) {
          const ip = kit.ease.inOutQuad(kit.progress(local, 400, INSTALL_END - 600))
          kit.css(ibar, { width: `${(ip * 100).toFixed(1)}%` })
          kit.setIf(istate, 'text', ip >= 1 ? '安裝完成' : `正在安裝… ${Math.round(ip * 100)}%`)
        }
        const dockIn = st.installed ? (installing ? kit.ease.outBack(kit.progress(local, INSTALL_END, 450)) : 1) : 0
        kit.css(mine, { opacity: kit.clamp(dockIn).toFixed(3), transform: `scale(${dockIn.toFixed(3)})`, width: `${(kit.clamp(dockIn) * 2.6).toFixed(3)}em`, marginLeft: `${(kit.clamp(dockIn) * 0.5).toFixed(3)}em` })

        // ---- 助手視窗 ----
        const running = st.running || (kind !== null && pv.running)
        let aOp = running ? 1 : 0
        if (kind === 'launch') aOp = kit.progress(local, CLICK + 50, 400)
        kit.css(appWin, { opacity: aOp.toFixed(3), visibility: aOp > 0 ? 'visible' : 'hidden', transform: `translateY(${((1 - kit.ease.outCubic(aOp)) * 1.2).toFixed(3)}em) scale(${kit.lerp(0.96, 1, kit.ease.outCubic(aOp)).toFixed(3)})` })
        const signDone = kind === 'signin' ? local >= 2300 : !!st.account
        const account = signDone ? st.account : null
        kit.setIf(acct, 'text', account ?? '未登入')
        acct.dataset.on = account ? '1' : '0'
        always.dataset.on = st.always && !(kind === 'answer' && local < CLICK + 150) ? '1' : '0'
        const sOp = account ? (kind === 'signin' ? 1 - kit.progress(local, 2300, 300) : 0) : 1
        kit.css(signin, { opacity: sOp.toFixed(3), visibility: sOp > 0 ? 'visible' : 'hidden' })
        signbtn.dataset.down = kind === 'signin' && local >= CLICK && local < CLICK + 200 ? '1' : '0'
        kit.css(signwait, { opacity: (kind === 'signin' ? kit.progress(local, CLICK + 150, 250) : 0).toFixed(3) })

        // 對話:送出中的那一句逐字出現
        const msgs = st.chat
        const typing = kind === 'user' ? kit.typewriter(st.chat[st.chat.length - 1], local, { start: 250, cps: CPS }).text : null
        kit.setIf(chat, 'html', msgs.map((m, i) => `<p class="dk-bubble">${kit.esc(typing !== null && i === msgs.length - 1 ? typing : m)}</p>`).join(''))
        const act = st.activity
        if (act) {
          const verb = act.kind === 'read' ? '讀取' : act.kind === 'edit' ? '修改' : '執行'
          const shown = act.kind === 'run' && kind === 'run' ? kit.typewriter(act.text, local, { start: 300, cps: 24 }).text : act.text
          kit.setIf(activity, 'html', `<span class="dk-verb" data-k="${act.kind}">${verb}</span>${act.kind === 'run' ? `<code>${kit.esc(shown)}</code>` : `<span>${kit.esc(baseName(act.text))}</span>`}`)
          kit.css(activity, { opacity: (kind === act.kind ? kit.progress(local, 100, 250) : 1).toFixed(3) })
        } else kit.css(activity, { opacity: '0' })
        const res = st.result && (kind !== 'answer' || local >= CLICK + 150) ? st.result : null
        kit.setIf(result, 'text', res?.text ?? '')
        result.dataset.a = res?.answer ?? ''
        kit.css(result, { opacity: (res ? (kind === 'answer' ? kit.progress(local, CLICK + 150, 300) : 1) : 0).toFixed(3) })

        // ---- 確認提示 ----
        const pend = st.pending ?? (kind === 'answer' ? pv.pending : null)
        let dOp = pend ? 1 : 0
        if (kind === 'ask') dOp = kit.progress(local, 0, 350)
        if (kind === 'answer') dOp = 1 - kit.progress(local, CLICK + 150, 300)
        kit.css(dialog, { opacity: dOp.toFixed(3), visibility: dOp > 0 ? 'visible' : 'hidden', transform: `translateY(${((1 - kit.ease.outCubic(kind === 'ask' ? dOp : 1)) * 1).toFixed(3)}em)` })
        if (pend) {
          kit.setIf(dcmd, 'text', pend.cmd)
          kit.setIf(dsay, 'text', pend.say)
          dsay.style.display = pend.say ? '' : 'none'
        }
        const chosen = kind === 'answer' ? (ev!.step as DeskStep).answer : null
        for (const o of [...dialog.querySelectorAll<HTMLElement>('[data-o]')]) o.dataset.down = chosen === o.dataset.o && local >= CLICK && local < CLICK + 250 ? '1' : '0'

        // ---- 助手伸手去讀/改檔案:一條線從助手連到檔案 ----
        const reach = kind === 'read' || kind === 'edit' ? (ev!.step as DeskStep)[kind] ?? '' : ''
        const target = reach ? itemEl(reach, st) : null
        for (const el of [...root.querySelectorAll<HTMLElement>('.dk-item')]) el.dataset.hot = el === target && local > 700 && local < 1700 ? '1' : '0'
        if (target && running) {
          const a = kit.rectIn(appWin, screen)
          const b = kit.rectIn(target, screen)
          wire.setAttribute('viewBox', `0 0 ${screen.offsetWidth || 1} ${screen.offsetHeight || 1}`)
          const d = kit.arrowPath([a.x, a.y + a.h * 0.35], [b.x + b.w / 2, b.y + b.h / 2], 0.18)
          if (wirePath.getAttribute('d') !== d) wirePath.setAttribute('d', d)
          wirePath.dataset.k = kind!
          const len = typeof wirePath.getTotalLength === 'function' ? wirePath.getTotalLength() : 600
          kit.css(wirePath, kit.drawPath(kit.ease.inOutCubic(kit.progress(local, 150, 650)), len))
          kit.css(wire, { opacity: (1 - kit.progress(local, 1500, 400)).toFixed(3) })
        } else kit.css(wire, { opacity: '0' })
      },

      target(name, view) {
        const st = view?.state ?? null
        switch (name) {
          case 'window': return scene
          case 'screen': return screen
          case 'app': return appWin
          case 'dialog': return dialog
          case 'folder': return folder
          case 'dock': return $('.dk-dock')
          case 'launcher': return mine
          case 'installer': return installer
          case 'signin': return signbtn
          case 'result': return result
        }
        const opt = /^option:(.+)$/.exec(name)
        if (opt) return dialog.querySelector<HTMLElement>(`[data-o="${opt[1]}"]`)
        const item = /^item:(.+)$/.exec(name)
        if (item) return itemEl(item[1], st)
        return null
      },
    }
  },
})

/** 剛出現的東西彈出、剛消失的淡出(fx 是改動的進度) */
function itemAnim(el: HTMLElement, fx: number): void {
  const s = el.dataset.st
  if (s === 'in') kit.css(el, { opacity: kit.clamp(fx * 1.5).toFixed(3), transform: `scale(${kit.ease.outBack(fx).toFixed(3)})` })
  else if (s === 'out') kit.css(el, { opacity: (1 - fx).toFixed(3), transform: `scale(${kit.lerp(1, 0.6, fx).toFixed(3)})`, filter: `grayscale(${fx.toFixed(2)})` })
}

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
