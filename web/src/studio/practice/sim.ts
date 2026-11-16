// 動手練習的模擬引擎:虛擬檔案系統加一個「聽得懂幾種中文指令」的規則比對,不接真的 AI。
// 純函式、不依賴畫面:把一句話變成「計畫」(說了什麼、要動哪些檔案),畫面再決定要不要先問使用者。
// 支援的動作很少(目前路徑、列出、讀取、建立、改名/移動、刪除),聽不懂就友善提示,不亂猜。

export type Dir = { kind: 'dir'; children: Record<string, Node> }
export type FileNode = { kind: 'file'; content: string }
export type Node = Dir | FileNode

export const dir = (children: Record<string, Node> = {}): Dir => ({ kind: 'dir', children })
export const file = (content = ''): FileNode => ({ kind: 'file', content })

export const parts = (p: string) => p.split('/').filter(Boolean)
export const basename = (p: string) => parts(p).pop() ?? ''
export const dirname = (p: string) => '/' + parts(p).slice(0, -1).join('/')

/** 相對於 cwd 解析成絕對路徑(處理 . 和 ..);跑出根目錄回傳 null */
export function resolve(cwd: string, p: string): string | null {
  const out: string[] = p.startsWith('/') ? [] : parts(cwd)
  for (const seg of parts(p)) {
    if (seg === '.') continue
    if (seg === '..') {
      if (!out.length) return null
      out.pop()
    } else out.push(seg)
  }
  return '/' + out.join('/')
}

/** 絕對路徑 → 相對於 cwd 的寫法(在 cwd 之外時回傳完整路徑) */
export function relative(cwd: string, abs: string): string {
  if (abs === cwd) return '.'
  return abs.startsWith(cwd + '/') ? abs.slice(cwd.length + 1) : abs
}

export const inside = (cwd: string, abs: string) => abs === cwd || abs.startsWith(cwd === '/' ? '/' : cwd + '/')

export function get(root: Dir, path: string): Node | undefined {
  let n: Node = root
  for (const seg of parts(path)) {
    if (n.kind !== 'dir') return undefined
    const next: Node | undefined = n.children[seg]
    if (!next) return undefined
    n = next
  }
  return n
}

/** 放進節點(缺的上層資料夾一併建立);不改動原本的樹 */
export function put(root: Dir, path: string, node: Node): Dir {
  const segs = parts(path)
  if (!segs.length) return root
  const walk = (d: Dir, i: number): Dir => {
    const seg = segs[i]
    if (i === segs.length - 1) return { kind: 'dir', children: { ...d.children, [seg]: node } }
    const child = d.children[seg]
    return { kind: 'dir', children: { ...d.children, [seg]: walk(child?.kind === 'dir' ? child : dir(), i + 1) } }
  }
  return walk(root, 0)
}

export function del(root: Dir, path: string): Dir {
  const segs = parts(path)
  if (!segs.length) return root
  const walk = (d: Dir, i: number): Dir => {
    const seg = segs[i]
    if (i === segs.length - 1) {
      const { [seg]: _gone, ...rest } = d.children
      void _gone
      return { kind: 'dir', children: rest }
    }
    const child = d.children[seg]
    return child?.kind === 'dir' ? { kind: 'dir', children: { ...d.children, [seg]: walk(child, i + 1) } } : d
  }
  return walk(root, 0)
}

/** 這個路徑底下(含自己)所有的絕對路徑,資料夾在前 */
export function paths(root: Dir, base: string): string[] {
  const n = get(root, base)
  if (!n) return []
  if (n.kind === 'file') return [base]
  return [base, ...Object.keys(n.children).sort().flatMap((k) => paths(root, `${base === '/' ? '' : base}/${k}`))]
}

export type Op =
  | { t: 'write'; path: string; content: string; overwrite: boolean }
  | { t: 'mkdir'; path: string }
  | { t: 'move'; from: string; to: string }
  | { t: 'rm'; path: string; recursive: boolean; isDir: boolean }

export function applyOp(root: Dir, op: Op): Dir {
  switch (op.t) {
    case 'write':
      return put(root, op.path, file(op.content))
    case 'mkdir':
      return get(root, op.path) ? root : put(root, op.path, dir())
    case 'move': {
      const n = get(root, op.from)
      return n ? put(del(root, op.from), op.to, n) : root
    }
    case 'rm':
      return del(root, op.path)
  }
}

/** 動手前會讓人看到的指令寫法(仿終端機) */
export function commandOf(op: Op, cwd: string): string {
  const r = (p: string) => relative(cwd, p)
  switch (op.t) {
    case 'write':
      return `echo "…" > ${r(op.path)}`
    case 'mkdir':
      return `mkdir -p ${r(op.path)}`
    case 'move':
      return `mv ${r(op.from)} ${r(op.to)}`
    case 'rm':
      return op.recursive ? `rm -rf ${r(op.path)}` : op.isDir ? `rmdir ${r(op.path)}` : `rm ${r(op.path)}`
  }
}

/** 這個動作會動到哪些檔案(刪除資料夾會連裡面的一起算);確認提示用它標出範圍 */
export function scopeOf(root: Dir, op: Op): string[] {
  if (op.t === 'rm') return paths(root, op.path)
  if (op.t === 'move') return [op.from]
  return [op.path]
}

export type PlanKind = 'info' | 'change' | 'delete' | 'unknown' | 'refuse'
export type Plan = {
  kind: PlanKind
  /** AI 說的話 */
  say: string
  /** 唯讀指令(pwd、ls、cat)的輸出 */
  output?: string
  ops: Op[]
}

const HELP = '這個練習只支援：看目前的工作目錄、列出檔案、讀取檔案，以及建立、改名、移動、刪除檔案或資料夾。換個說法試試，例如「建立 hello.txt，寫一句問候」。'

const SKIP = new Set(['rm', 'ls', 'mv', 'cat', 'pwd', 'mkdir', 'touch', 'html', 'css', 'txt', 'AI', 'ai'])

const CJK = /[㐀-鿿]/
/** 黏在中文路徑前面的動詞(「刪除首頁.html」→「首頁.html」) */
const LEAD = /^(?:把|在|將|請|幫我|刪除|移除|刪掉|清掉|建立|新增|產生|讀取|讀|打開|開啟|看看|看)+/

/**
 * 句子裡看起來像路徑的詞:有副檔名、有斜線、後面接「資料夾」,或剛好是 cwd 裡存在的名稱。
 * 先用空白與中文標點切成一段一段;含中文的路徑(../報價單草稿/quote.xlsx、首頁.html)整段當一個路徑,
 * 其他段落照舊只取英數字的部分(「建立hello.txt」→ hello.txt)。
 */
function pathTokens(text: string, cwd: string, root: Dir): string[] {
  const out: string[] = []
  const exists = (t: string) => {
    const abs = resolve(cwd, t)
    return abs ? Boolean(get(root, abs)) : false
  }
  for (const chunk of text.matchAll(/[^\s，、。：:「」『』（）()！？!?,;；"']+/g)) {
    const c = chunk[0]
    const at = chunk.index ?? 0
    if (CJK.test(c) && (c.includes('/') || /\.[A-Za-z0-9]+$/.test(c) || exists(c))) {
      let t = c.replace(LEAD, '')
      if (!exists(t) && !t.includes('/')) {
        // 「刪除報價單.xlsx」這類:取存在的最長尾段
        for (let i = 1; i < t.length; i++) if (exists(t.slice(i))) { t = t.slice(i); break }
      }
      if (t) out.push(t)
      continue
    }
    for (const m of c.matchAll(/[A-Za-z0-9_\-./]+/g)) {
      const t = m[0].replace(/^[./]+$/, '')
      if (!t || SKIP.has(t)) continue
      const after = text.slice(at + (m.index ?? 0) + m[0].length)
      const looksFile = /\.[A-Za-z0-9]+$/.test(t) && !/^\d+(\.\d+)?$/.test(t)
      if (looksFile || t.includes('/') || /^\s*(資料夾|目錄)/.test(after) || exists(t)) out.push(t)
    }
  }
  return [...new Set(out)]
}

const hasExt = (p: string) => /\.[A-Za-z0-9]+$/.test(basename(p))

const SAMPLE: Record<string, string> = {
  html: '<!doctype html>\n<html lang="zh-Hant">\n<head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"><title>小森烘焙</title></head>\n<body>\n  <h1>小森烘焙</h1>\n</body>\n</html>\n',
  css: 'body { font-family: sans-serif; margin: 0; }\nh1 { color: #5a3e2b; }\n',
}

function contentFor(name: string, text: string): string {
  const said = /(?:記下|寫入|寫上|內容(?:是|為)?|寫)\s*[:：]\s*(.+)$/.exec(text) ?? /記下\s*(.+)$/.exec(text)
  if (said) return said[1].trim()
  const ext = /\.([A-Za-z0-9]+)$/.exec(name)?.[1]
  if (ext && SAMPLE[ext]) return SAMPLE[ext]
  return '哈囉！歡迎來到練習資料夾。\n'
}

/** 把一句話變成計畫。cwd 是工具開啟的資料夾(工作目錄),只能動它底下的東西 */
export function plan(text: string, cwd: string, root: Dir): Plan {
  const t = text.trim()
  if (!t) return { kind: 'unknown', say: HELP, ops: [] }

  if (/工作目錄|目前.*(資料夾|位置|路徑)|在哪(裡|個資料夾)|pwd/.test(t)) {
    return { kind: 'info', say: `目前的工作目錄是 ${cwd}。我只會在這個資料夾裡工作。`, output: cwd, ops: [] }
  }

  const tokens = pathTokens(t, cwd, root)
  const abs = tokens.map((x) => ({ raw: x, abs: resolve(cwd, x) }))
  // 只要提到工作目錄外面的路徑就不做,不看用了什麼動詞(touch、rm、cat、清掉、存成⋯都一樣)
  const outside = abs.find((x) => !x.abs || !inside(cwd, x.abs))
  if (outside) {
    return { kind: 'refuse', say: `「${outside.raw}」在工作目錄 ${cwd} 的外面，我不會去動它。想處理那裡的檔案，請從那個資料夾重新開啟工具。`, ops: [] }
  }

  if (/列出|有哪些|有什麼|\bls\b|目錄內容|檔案清單/.test(t)) {
    const list = paths(root, cwd).slice(1).map((p) => relative(cwd, p))
    return { kind: 'info', say: list.length ? '工作目錄裡目前有這些：' : '工作目錄裡目前是空的。', output: list.join('\n'), ops: [] }
  }

  if (/刪除|移除|刪掉|清掉|\brm\b/.test(t)) {
    const targets = abs.filter((x) => x.abs && get(root, x.abs))
    if (!targets.length) {
      const missing = tokens[0]
      return { kind: 'unknown', say: missing ? `找不到「${missing}」，沒有東西可以刪。` : '你想刪除哪個檔案或資料夾？請把名稱寫出來。', ops: [] }
    }
    const ops: Op[] = targets.map((x) => {
      const n = get(root, x.abs!)!
      return { t: 'rm', path: x.abs!, recursive: n.kind === 'dir' && Object.keys(n.children).length > 0, isDir: n.kind === 'dir' }
    })
    return { kind: 'delete', say: `好的，我會刪除 ${targets.map((x) => x.raw).join('、')}。`, ops }
  }

  if (/改名|重新命名|命名為|\bmv\b|移到|移動|搬到|放到|移至/.test(t)) {
    const src = abs.find((x) => x.abs && get(root, x.abs))
    if (!src) return { kind: 'unknown', say: tokens[0] ? `找不到「${tokens[0]}」。` : '你想改名或移動哪個檔案？請寫出它的路徑。', ops: [] }
    // 名稱可以是中文(首頁-舊.html);「notes資料夾」去掉後面的「資料夾」
    const name = (re: RegExp) => re.exec(t)?.[1].replace(/(資料夾|目錄)(裡|裡面|中)?$/, '') || undefined
    const newName = name(/(?:改名為|改名成|重新命名為|命名為|改成)\s*([^\s，、。：:「」（）()！？!?,;；]+)/)
    const destDir = name(/(?:移到|移動到|搬到|放到|移至)\s*([^\s，、。：:「」（）()！？!?,;；]+)/)
    let to = src.abs!
    if (newName) to = `${dirname(to)}/${newName}`.replace('//', '/')
    if (destDir) {
      const d = resolve(cwd, destDir)
      if (!d || !inside(cwd, d)) return { kind: 'refuse', say: `「${destDir}」在工作目錄外面，我不會動。`, ops: [] }
      to = hasExt(d) ? d : `${d}/${basename(to)}`
    }
    if (to === src.abs) return { kind: 'unknown', say: '名字和位置都沒變，沒有東西要做。', ops: [] }
    if (get(root, to)) return { kind: 'unknown', say: `${relative(cwd, to)} 已經存在，我不會蓋掉它。換個名字試試。`, ops: [] }
    return { kind: 'change', say: `好的，把 ${src.raw} ${destDir ? '移到' : '改名為'} ${relative(cwd, to)}。`, ops: [{ t: 'move', from: src.abs!, to }] }
  }

  if (/建立|新增|產生|建一|做一|寫|記下|存成|\btouch\b|\bmkdir\b/.test(t)) {
    const ops: Op[] = []
    const folders = tokens.filter((x) => !hasExt(x) && new RegExp(`${x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\s*(資料夾|目錄)`).test(t))
    const files = tokens.filter((x) => hasExt(x))
    for (const f of folders) {
      const a = resolve(cwd, f)
      if (a && !get(root, a)) ops.push({ t: 'mkdir', path: a })
    }
    let guessed = false
    if (!files.length && !folders.length) {
      files.push('hello.txt')
      guessed = true
    }
    for (const f of files) {
      const a = resolve(cwd, f)!
      ops.push({ t: 'write', path: a, content: contentFor(f, t), overwrite: Boolean(get(root, a)) })
    }
    if (!ops.length) return { kind: 'unknown', say: '那個資料夾已經存在了，不用再建立。', ops: [] }
    const names = ops.map((o) => relative(cwd, o.t === 'move' ? o.to : o.path)).join('、')
    const note = guessed ? '你沒有說檔名和內容，我先用 hello.txt，寫一句問候；不合適可以拒絕。' : `好的，我會建立 ${names}。`
    return { kind: 'change', say: note, ops }
  }

  if (/讀|打開|開啟|看看|內容|\bcat\b/.test(t)) {
    const f = abs.find((x) => x.abs && get(root, x.abs)?.kind === 'file')
    if (!f) return { kind: 'unknown', say: tokens[0] ? `找不到檔案「${tokens[0]}」。` : '你想讀哪個檔案？請寫出路徑。', ops: [] }
    const n = get(root, f.abs!) as FileNode
    return { kind: 'info', say: `${f.raw} 的內容是：`, output: n.content || '(空的)', ops: [] }
  }

  return { kind: 'unknown', say: HELP, ops: [] }
}
