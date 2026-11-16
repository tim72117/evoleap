import { describe, expect, it } from 'vitest'
import { applyOp, dir, file, get, paths, plan, relative, resolve, type Dir } from './sim'

const run = (root: Dir, cwd: string, text: string) => {
  const p = plan(text, cwd, root)
  return { p, root: p.ops.reduce(applyOp, root) }
}

const base = (): Dir => dir({ Documents: dir({ practice: dir({ bakery: dir() }), 桌面: dir({ 'a.html': file('x') }) }) })
const CWD = '/Documents/practice'

describe('路徑', () => {
  it('解析 . 和 ..,不能跑出根目錄', () => {
    expect(resolve('/a/b', '../c')).toBe('/a/c')
    expect(resolve('/a/b', './x/y')).toBe('/a/b/x/y')
    expect(resolve('/a', '../../x')).toBeNull()
    expect(relative('/a/b', '/a/b/c/d.txt')).toBe('c/d.txt')
  })
})

describe('工作目錄的界線', () => {
  const root = (): Dir => dir({ Documents: dir({ practice: dir({ 'a.txt': file('a') }), 報價單草稿: dir({ 'quote.xlsx': file('q') }), 'notes.txt': file('n') }) })

  it('提到工作目錄外的路徑一律拒絕,不管用什麼說法', () => {
    for (const t of ['touch ../evil.txt', 'rm ../notes.txt', 'cat ../notes.txt', '清掉 ../notes.txt', '存成 ../x.txt', 'mv ../notes.txt 改成 b.txt']) {
      const p = plan(t, CWD, root())
      expect(p.kind, t).toBe('refuse')
      expect(p.ops, t).toEqual([])
    }
  })

  it('中文路徑整段認得,拒絕訊息顯示正確的路徑', () => {
    const p = plan('刪除 ../報價單草稿/quote.xlsx', CWD, root())
    expect(p.kind).toBe('refuse')
    expect(p.say).toContain('「../報價單草稿/quote.xlsx」')
  })

  it('中文檔名可以刪除、改名,動詞黏著也認得', () => {
    const r = dir({ Documents: dir({ practice: dir({ '首頁.html': file('v1'), 草稿: dir() }) }) })
    expect(run(r, CWD, '刪除首頁.html').p.ops).toEqual([{ t: 'rm', path: `${CWD}/首頁.html`, recursive: false, isDir: false }])
    const mv = run(r, CWD, '把 首頁.html 改名為 首頁-舊.html')
    expect(get(mv.root, `${CWD}/首頁-舊.html`)?.kind).toBe('file')
    const into = run(r, CWD, '把 首頁.html 移到 草稿資料夾')
    expect(get(into.root, `${CWD}/草稿/首頁.html`)?.kind).toBe('file')
  })
})

describe('plan', () => {
  it('建立檔案:說明沒講檔名時先猜 hello.txt', () => {
    const { p, root } = run(base(), CWD, '建立一個檔案')
    expect(p.kind).toBe('change')
    expect(p.say).toContain('hello.txt')
    expect(get(root, `${CWD}/hello.txt`)?.kind).toBe('file')
  })

  it('一次建立兩個網頁檔,內容依副檔名', () => {
    const { root } = run(base(), `${CWD}/bakery`, '產生網頁專案基本檔案：index.html 和 styles.css')
    expect((get(root, `${CWD}/bakery/index.html`) as { content: string }).content).toContain('<html')
    expect(get(root, `${CWD}/bakery/styles.css`)).toBeDefined()
  })

  it('用相對路徑建立並自動補上層資料夾,內容取「記下：」之後', () => {
    const { root } = run(base(), `${CWD}/bakery`, '在 drafts/idea.txt 記下：首頁要有預約按鈕')
    expect((get(root, `${CWD}/bakery/drafts/idea.txt`) as { content: string }).content).toBe('首頁要有預約按鈕')
  })

  it('改名並移動', () => {
    const start = run(base(), `${CWD}/bakery`, '在 drafts/idea.txt 記下：x').root
    const { p, root } = run(start, `${CWD}/bakery`, '把 drafts/idea.txt 改名為 homepage-idea.txt，移到 notes 資料夾')
    expect(p.ops).toEqual([{ t: 'move', from: `${CWD}/bakery/drafts/idea.txt`, to: `${CWD}/bakery/notes/homepage-idea.txt` }])
    expect(get(root, `${CWD}/bakery/notes/homepage-idea.txt`)).toBeDefined()
    expect(get(root, `${CWD}/bakery/drafts/idea.txt`)).toBeUndefined()
  })

  it('刪除空資料夾不用遞迴,有東西的資料夾要遞迴', () => {
    expect(plan('刪除空的 bakery 資料夾', CWD, base()).ops).toEqual([{ t: 'rm', path: `${CWD}/bakery`, recursive: false, isDir: true }])
    const full = run(base(), CWD, '在 bakery/a.txt 記下：x').root
    const p = plan('刪除 bakery 資料夾', CWD, full)
    expect(p.ops[0]).toMatchObject({ t: 'rm', recursive: true })
    expect(paths(full, `${CWD}/bakery`).length).toBe(2)
  })

  it('工作目錄外的路徑一律拒絕,不產生動作', () => {
    const p = plan('刪除 ../桌面/a.html', CWD, base())
    expect(p.kind).toBe('refuse')
    expect(p.ops).toEqual([])
  })

  it('目前路徑、列出、讀取都是唯讀', () => {
    const root = run(base(), CWD, '建立 hello.txt，寫一句問候').root
    expect(plan('目前的工作目錄是哪裡？', CWD, root)).toMatchObject({ kind: 'info', output: CWD, ops: [] })
    expect(plan('列出檔案', CWD, root).output).toContain('hello.txt')
    expect(plan('讀取 hello.txt', CWD, root).output).toContain('哈囉')
  })

  it('聽不懂時回提示,不動任何東西', () => {
    const p = plan('今天天氣如何', CWD, base())
    expect(p.kind).toBe('unknown')
    expect(p.ops).toEqual([])
  })
})
