// liveScripts.mjs — 本機工具(voice、mix、record-live、canvas)取得與上傳即時教學畫面腳本的唯一入口。
// 腳本以線上資料庫為準:預設向 https://evoleap.io 取(--api 或環境變數 EVOLEAP_API 改成別台,例如 http://127.0.0.1:8190)。
// 一律透過 evoleap CLI(server/cmd/evoleap)的子程序,登入 token 由 CLI 自己管,工具不碰帳密。先登入一次:evoleap login。
// 取不到就報錯,不會默默退回 repo 裡的檔案;要用本機檔案(例如還沒上傳的草稿)明確給 --dir <資料夾>(或 EVOLEAP_SCRIPT_DIR)。
//
// 產生的檔(.voice.json、.mix.json):API 模式寫在 web/recordings/live/<主機>/(不進版控),加 --push 上傳成功後刪掉;
// --dir 模式寫在該資料夾裡腳本旁邊。上傳時沿用腳本的歸屬(課程的掛在同一課、研發基地的留在研發基地),不搬移已經存在的檔。

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REPO = path.resolve(WEB, '..')

export const DEFAULT_API = 'https://evoleap.io'
export const isManifest = (rel) => /\.(voice|mix)\.json$/.test(rel)

// ---------- evoleap CLI ----------
let binary = null
/** CLI 執行檔:EVOLEAP_CLI 指定的,否則用目前原始碼編一份(每個程序編一次,免得用到舊版的 ~/go/bin/evoleap) */
function cliBinary() {
  if (process.env.EVOLEAP_CLI) return Promise.resolve(process.env.EVOLEAP_CLI)
  binary ??= (async () => {
    const out = path.join(WEB, 'node_modules/.cache/evoleap-cli', process.platform === 'win32' ? 'evoleap.exe' : 'evoleap')
    try {
      await run('go', ['build', '-C', path.join(REPO, 'server'), '-o', out, './cmd/evoleap'])
    } catch (e) {
      binary = null
      throw new Error(`編譯 evoleap CLI 失敗(需要 Go,或用 EVOLEAP_CLI 指定執行檔):${e.stderr || e.message}`)
    }
    return out
  })()
  return binary
}

async function cli(api, args) {
  const bin = await cliBinary()
  try {
    return (await run(bin, ['-api', api, ...args], { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 })).stdout
  } catch (e) {
    const why = String(e.stderr || e.message).trim()
    const hint = /HTTP 404|沒有登入/.test(why) ? `(沒登入時草稿與研發基地的腳本也當作不存在;先 evoleap -api ${api} login)` : ''
    const what = args[2] === '-path' ? ` ${args[3]}` : ''
    throw new Error(`evoleap ${args.slice(0, 2).join(' ')}${what} 失敗(${api}):${why}${hint}`)
  }
}

// ---------- 參數 ----------
/** 取出共用旗標 --api、--dir、--push;rest 是其餘參數(順序不變) */
export function sourceArgs(argv) {
  const out = { api: undefined, dir: undefined, push: false, rest: [] }
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--(api|dir)(?:=(.*))?$/)
    if (m) {
      const v = m[2] ?? argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`--${m[1]} 要給值`)
      out[m[1]] = v
    } else if (argv[i] === '--push') out.push = true
    else out.rest.push(argv[i])
  }
  return out
}

/** 腳本路徑一律是「相對於 content/live/」的形式;舊習慣貼上 src/content/live/ 開頭的也收 */
export function normalizeRel(p) {
  const rel = String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^((web\/)?src\/content\/live\/)/, '')
  if (!rel.endsWith('.json') || rel.startsWith('/') || rel.split('/').includes('..')) throw new Error(`腳本路徑要像 l0/0.0-tools.json:${p}`)
  return rel
}

// ---------- 來源 ----------
const stable = (v) =>
  Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v)
// 清單內容的指紋(不存在是 'null');暫存清單旁的 .base 記著產生當時伺服器版本的指紋
const fingerprint = (body) => createHash('sha256').update(stable(body ? JSON.parse(body) : null)).digest('hex')
const readIf = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null)

/**
 * 開一個腳本來源。讀到的內容在這個物件裡快取(要拿最新的就重新開一個)。
 * dir 有值是本機資料夾模式;否則是 API 模式。dir 模式要上傳時,上傳對象仍是 api(預設正式站)。
 */
export function openSource({ api, dir } = {}) {
  const server = (api || process.env.EVOLEAP_API || DEFAULT_API).replace(/\/+$/, '')
  const local = dir || (api ? undefined : process.env.EVOLEAP_SCRIPT_DIR)
  const root = local ? path.resolve(local) : null
  if (root && !fs.existsSync(root)) throw new Error(`--dir 指定的資料夾不存在:${root}`)
  const outDir = root ?? path.join(WEB, 'recordings/live', server.replace(/^https?:\/\//, '').replace(/[^\w.-]/g, '_'))
  const label = root ? `本機資料夾 ${root}` : server
  const cache = new Map()
  let pathsRequest = null
  // 這次寫出或上傳的檔:伺服器的清單只查一次,後面的腳本也要看得到前面剛產生的旁白清單
  const written = new Set()

  const outPath = (rel) => path.join(outDir, normalizeRel(rel))

  /** 檔案原始內容;選用的清單(.voice.json、.mix.json)不存在回 null,腳本不存在就丟錯 */
  async function get(p) {
    const rel = normalizeRel(p)
    if (!cache.has(rel)) {
      let body
      if (root) {
        body = readIf(path.join(root, rel))
        if (body === null && !isManifest(rel)) throw new Error(`找不到腳本:${path.join(root, rel)}`)
      } else {
        body = await cli(server, ['script', 'get', '-path', rel])
        if (isManifest(rel) && body.trim() === 'null') body = null
      }
      cache.set(rel, body)
    }
    return cache.get(rel)
  }
  async function json(p) {
    const body = await get(p)
    if (body === null) return null
    try {
      return JSON.parse(body)
    } catch (e) {
      throw new Error(`${p} 不是有效的 JSON(${label}):${e.message}`)
    }
  }

  /** 所有腳本檔的路徑(含清單檔、這次寫出的與還沒上傳的暫存清單)。API 模式只有管理員拿得到,沒登入會報錯 */
  async function paths() {
    const list = (dir) =>
      fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map((f) => String(f).replace(/\\/g, '/')).filter((f) => f.endsWith('.json')) : []
    if (root) return list(root).sort()
    pathsRequest ??= cli(server, ['script', 'list']).then((out) => JSON.parse(out).paths ?? [])
    return [...new Set([...(await pathsRequest), ...written, ...list(outDir)])].sort()
  }

  /** 暫存清單的內容(不檢查新舊);沒有回 null */
  const draft = (rel) => (root ? null : readIf(outPath(rel)))
  /** 伺服器現在的內容(不用快取) */
  const fresh = (rel) => {
    cache.delete(rel)
    return get(rel)
  }
  /** 伺服器在暫存清單產生之後改過了(或不知道產生時的版本):不能拿舊的蓋掉新的 */
  function assertCurrent(rel, remote) {
    const body = draft(rel)
    if (body === null || fingerprint(body) === fingerprint(remote)) return
    if (readIf(outPath(rel) + '.base') !== fingerprint(remote))
      throw new Error(`${server} 上的 ${rel} 在暫存清單產生之後改過了,不能覆蓋。確認不需要暫存的內容後刪掉再重跑:${outPath(rel)}`)
  }

  /** 產生了但還沒上傳的清單(API 模式);沒有回 null。要先讀過伺服器版本(json),伺服器改過就丟錯 */
  function pending(rel) {
    const r = normalizeRel(rel)
    const body = draft(r)
    if (body === null) return null
    if (cache.has(r)) assertCurrent(r, cache.get(r))
    return JSON.parse(body)
  }
  /** 只讀伺服器版本的工具(mix、record-live、canvas)提醒:本機有還沒上傳、而且不一樣的清單 */
  async function pendingNote(rel) {
    const body = draft(rel)
    return body !== null && stable(JSON.parse(body)) !== stable(await json(rel)) ? `注意:${outPath(rel)} 還沒上傳,這次用的是伺服器的版本` : null
  }

  function write(rel, data) {
    const r = normalizeRel(rel)
    const file = outPath(r)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
    written.add(r)
    if (root) cache.delete(r)
    else if (cache.has(r)) fs.writeFileSync(file + '.base', fingerprint(cache.get(r)))
    return file
  }

  /** 伺服器上每個檔的歸屬:路徑 → { source: 'lesson'|'studio', courseId, lessonId } */
  async function owners() {
    const out = await cli(server, ['script', 'list', '-owners'])
    return new Map((JSON.parse(out).files ?? []).map((f) => [f.path, f]))
  }

  /** 上傳這個清單檔要用的 CLI 參數,沿用腳本的歸屬 */
  async function pushArgs(p) {
    const rel = normalizeRel(p)
    const baseRel = rel.replace(/\.(voice|mix)\.json$/, '.json')
    const all = await owners()
    const base = all.get(baseRel)
    if (!base) throw new Error(`${server} 上還沒有腳本 ${baseRel}:先用 evoleap script push 上傳腳本(決定它屬於哪一課),再上傳清單`)
    const target = all.get(rel)
    const args = ['script', 'push', '-file', outPath(rel), '-path', rel]
    // 已經存在的檔不給 -course:伺服器只換內容、位置不動。新檔才跟著腳本掛到同一課(簡介影片的檔伺服器自己掛)
    if (!target && base.source === 'lesson' && base.lessonId) args.push('-course', base.courseId, '-lesson', base.lessonId)
    if (target?.source === 'studio' && base.source === 'lesson') console.warn(`  注意:${rel} 目前在研發基地,腳本屬於 ${base.courseId} ${base.lessonId};只更新內容,不搬移`)
    return args
  }

  const quote = (s) => (/^[\w./:@=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`)
  const command = (args) => `(cd ${quote(path.join(REPO, 'server'))} && go run ./cmd/evoleap -api ${quote(server)} ${args.map(quote).join(' ')})`

  /**
   * 清單寫好之後:push 為 true 就上傳(成功後刪掉暫存檔),否則印出怎麼上傳。
   * 和伺服器內容一樣時不用上傳,API 模式順手清掉暫存檔。
   */
  async function publish(p, push) {
    const rel = normalizeRel(p)
    const file = outPath(rel)
    if (!root) {
      const remote = await json(rel)
      if (remote && stable(remote) === stable(JSON.parse(fs.readFileSync(file, 'utf8')))) {
        fs.rmSync(file)
        fs.rmSync(file + '.base', { force: true })
        console.log(`  ${rel}:和 ${server} 上的內容相同,不用上傳`)
        return
      }
    }
    if (!push) {
      console.log(`  已寫到 ${file}(還沒上傳)`)
      try {
        console.log(`  上傳到 ${server}:重跑時加 --push,或執行\n    ${command(await pushArgs(rel))}`)
      } catch (e) {
        console.log(`  現在查不到上傳方式:${e.message}`)
      }
      return
    }
    // 上傳前再讀一次伺服器:跑的期間別人改過也不能蓋掉
    if (!root) assertCurrent(rel, await fresh(rel))
    await cli(server, await pushArgs(rel))
    written.add(rel)
    if (!root) {
      cache.set(rel, fs.readFileSync(file, 'utf8'))
      fs.rmSync(file)
      fs.rmSync(file + '.base', { force: true })
    }
    console.log(`  已上傳 ${rel} → ${server}`)
  }

  return { server, root, label, outDir, outPath, get, json, paths, pending, pendingNote, write, publish }
}
