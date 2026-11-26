#!/usr/bin/env node
// 腳本的 GCS 備份與還原(Mac、Linux、CI;不支援 Windows;說明見同目錄 README.md)。需要 gcloud 已登入。
//   node server/backup/gcs.mjs export [--cli evoleap執行檔] [--api 網址] [--prefix _test/x/] [--manifest 檔]
//     唯讀匯出資料庫的 lesson_files / studio_files → 只上傳內容有變的檔 → 更新對照表 gcs-manifest.json。
//     沒給 --cli 時用 go run ./cmd/evoleap;要先 evoleap login。
//   node server/backup/gcs.mjs restore [--out 目錄] [--manifest 檔] [--force]
//     照對照表(含版本號)下載、核對 sha256,寫到 --out(預設 web/src/content/live)。
//     本機已有且內容不同的檔不覆蓋(結束碼 2),要覆蓋加 --force。
//   node server/backup/gcs.mjs init [--cli evoleap執行檔] [--api 網址] [--prefix _test/x/]
//     手動初始化:從 GCS 讀最新的課程資訊與腳本,經 API 寫進空資料庫(已有課程會拒絕)。
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BUCKET = 'gs://evoleap-backup'
const PROJECT = '--project=shuttle-045094509' // 一律明確帶專案,不用 gcloud 預設值
const JSON_TYPE = '--content-type=application/json; charset=utf-8'

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cli: { type: 'string' },
    api: { type: 'string' },
    prefix: { type: 'string', default: '' },
    manifest: { type: 'string', default: path.join(HERE, 'gcs-manifest.json') },
    out: { type: 'string', default: path.join(HERE, '../../web/src/content/live') },
    force: { type: 'boolean', default: false },
  },
})

const gcloud = (...args) =>
  execFileSync('gcloud', ['storage', ...args, PROJECT], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 })
const hash = (algo, buf, enc) => createHash(algo).update(buf).digest(enc)
const readManifest = () => (fs.existsSync(opt.manifest) ? JSON.parse(fs.readFileSync(opt.manifest, 'utf8')) : null)
const json = (v) => JSON.stringify(v, null, 2) + '\n'

/** 把 root 底下的相對路徑接起來,跑出 root 就中止(路徑來自伺服器或對照表) */
function inside(root, rel) {
  const p = path.resolve(root, rel)
  if (!p.startsWith(path.resolve(root) + path.sep)) throw new Error(`不合法的路徑:${rel}`)
  return p
}
function writeFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, data)
}

/** bucket 上 prefix 底下現有的物件:名稱 → {md5Hash, generation} */
function listRemote(prefix) {
  let out
  try {
    out = gcloud('ls', '--json', '-r', `${BUCKET}/${prefix}scripts/`)
  } catch (e) {
    if (String(e.stderr).includes('matched no objects')) return new Map()
    throw e
  }
  return new Map(JSON.parse(out).filter((o) => o.type === 'cloud_object').map((o) => [o.metadata.name, o.metadata]))
}

function exportScripts(work) {
  const [cmd, base] = opt.cli ? [path.resolve(opt.cli), []] : ['go', ['run', './cmd/evoleap']]
  const api = opt.api ? ['-api', opt.api] : []
  execFileSync(cmd, [...base, ...api, 'backup', 'export', '-out', work], { cwd: path.join(HERE, '..'), stdio: 'inherit' })
  const index = JSON.parse(fs.readFileSync(path.join(work, 'index.json'), 'utf8')).files

  const old = new Map((readManifest()?.files ?? []).map((f) => [f.object, f]))
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const remote = listRemote(opt.prefix)
  const stage = path.join(work, '_stage')
  const changed = new Set()
  for (const f of index) {
    const object = `${opt.prefix}scripts/${f.source}/${f.path}`
    const data = fs.readFileSync(inside(path.join(work, f.source), f.path))
    if (remote.get(object)?.md5Hash !== hash('md5', data, 'base64')) {
      writeFile(inside(path.join(stage, f.source), f.path), data)
      changed.add(object)
    }
  }
  // gcloud 啟動很慢,所以有變的檔先放暫存目錄,每個來源一次 cp -r 傳完
  for (const source of ['lesson', 'studio']) {
    const dir = path.join(stage, source)
    if (fs.existsSync(dir)) gcloud('cp', '-r', JSON_TYPE, dir, `${BUCKET}/${opt.prefix}scripts/`)
  }

  const uploaded = changed.size ? listRemote(opt.prefix) : remote
  const key = (f) => `${f.source}\n${f.path.toLowerCase()}`
  const files = [...index]
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
    .map((f) => {
      const object = `${opt.prefix}scripts/${f.source}/${f.path}`
      const studio = f.source === 'studio'
      const keep = !changed.has(object) && old.get(object)?.sha256 === f.sha256
      return {
        source: f.source,
        path: f.path,
        course: studio ? 'studio' : f.courseId ?? '',
        lesson: studio ? null : f.lessonId ?? '',
        bytes: f.bytes,
        sha256: f.sha256,
        object,
        generation: String(uploaded.get(object).generation),
        exportedAt: keep ? old.get(object).exportedAt : now,
      }
    })
  writeFile(opt.manifest, json({ bucket: BUCKET, files }))

  const tmp = path.join(work, 'manifest.json')
  const stamp = now.replace(/[-:]/g, '')
  // 清單記著同一次匯出的課程資訊,init 照它讀;manifest/latest 最後才換,中途失敗時舊的一組仍完整
  fs.writeFileSync(tmp, json({ exportedAt: now, bucket: BUCKET, catalog: `catalog/${stamp}.json`, files }))
  const catalog = path.join(work, 'catalog.json')
  for (const dst of [`catalog/${stamp}.json`, 'catalog/latest.json']) gcloud('cp', JSON_TYPE, catalog, `${BUCKET}/${opt.prefix}${dst}`)
  for (const dst of [`manifest/${stamp}.json`, 'manifest/latest.json']) gcloud('cp', JSON_TYPE, tmp, `${BUCKET}/${opt.prefix}${dst}`)
  console.log(`完成:${files.length} 個檔,本次上傳 ${changed.size} 個。對照表 ${opt.manifest}`)
}

function restoreScripts(work) {
  const manifest = readManifest()
  if (!manifest) throw new Error(`找不到對照表:${opt.manifest}`)

  // 同一路徑可能在 lesson 與 studio 各有一份;網站先看 lesson,所以以 lesson 為準
  const byPath = new Map()
  for (const f of manifest.files) {
    const prev = byPath.get(f.path)
    if (prev && prev.sha256 !== f.sha256) console.warn(`注意:${f.path} 的 lesson 與 studio 內容不同,用 lesson 的`)
    if (!prev || f.source === 'lesson') byPath.set(f.path, f)
  }
  const files = [...byPath.values()]

  // 先整批抓最新版(快),sha256 對不上的再照版本號單獨抓
  const bulk = path.join(work, 'bulk')
  fs.mkdirSync(bulk)
  const roots = new Set(files.map((f) => f.object.slice(0, f.object.length - f.path.length - 1)))
  for (const root of roots) {
    const dir = path.join(bulk, root)
    fs.mkdirSync(path.dirname(dir), { recursive: true })
    gcloud('cp', '-r', `${manifest.bucket}/${root}`, path.dirname(dir))
  }

  let written = 0
  let same = 0
  const kept = []
  for (const f of files) {
    let src = inside(bulk, f.object)
    const ok = (p) => fs.existsSync(p) && hash('sha256', fs.readFileSync(p), 'hex') === f.sha256
    if (!ok(src)) {
      src = path.join(work, 'one')
      gcloud('cp', `${manifest.bucket}/${f.object}#${f.generation}`, src)
      if (!ok(src)) throw new Error(`sha256 不符:${f.object}#${f.generation}`)
    }
    const dst = inside(opt.out, f.path)
    if (ok(dst)) same++
    else if (fs.existsSync(dst) && !opt.force) kept.push(f.path)
    else {
      writeFile(dst, fs.readFileSync(src))
      written++
    }
  }
  console.log(`完成:${files.length} 個檔 → ${opt.out}:寫入 ${written}、原本就相同 ${same}、內容不同未覆蓋 ${kept.length}`)
  if (kept.length) {
    console.log(kept.map((p) => `  ${p}`).join('\n'))
    process.exitCode = 2
  }
}

/** 手動初始化空資料庫:從 GCS 下載課程資訊與腳本,交給 evoleap init(經 API 寫入) */
function initFromGcs(work) {
  const root = `${BUCKET}/${opt.prefix}`
  const get = (name) => {
    const dst = path.join(work, path.basename(path.dirname(name)) + '.json')
    gcloud('cp', root + name, dst)
    return JSON.parse(fs.readFileSync(dst, 'utf8'))
  }
  const data = path.join(work, 'data')
  const { files, catalog } = get('manifest/latest.json')
  // 舊的清單沒記 catalog,用 latest
  writeFile(path.join(data, 'catalog.json'), json(get(catalog ?? 'catalog/latest.json')))
  const bulk = path.join(work, 'bulk')
  fs.mkdirSync(bulk)
  gcloud('cp', '-r', `${root}scripts`, bulk)
  for (const f of files) {
    let src = inside(bulk, f.object.slice(opt.prefix.length))
    const ok = (p) => fs.existsSync(p) && hash('sha256', fs.readFileSync(p), 'hex') === f.sha256
    if (!ok(src)) {
      src = path.join(work, 'one')
      gcloud('cp', `${BUCKET}/${f.object}#${f.generation}`, src)
      if (!ok(src)) throw new Error(`sha256 不符:${f.object}#${f.generation}`)
    }
    writeFile(inside(path.join(data, f.source), f.path), fs.readFileSync(src))
  }
  const index = files.map((f) => ({ source: f.source, path: f.path, courseId: f.source === 'lesson' ? f.course : '', lessonId: f.lesson ?? '' }))
  writeFile(path.join(data, 'index.json'), json({ files: index }))
  const [cmd, base] = opt.cli ? [path.resolve(opt.cli), []] : ['go', ['run', './cmd/evoleap']]
  const api = opt.api ? ['-api', opt.api] : []
  execFileSync(cmd, [...base, ...api, 'catalog', 'init', '-dir', data], { cwd: path.join(HERE, '..'), stdio: 'inherit' })
}

const run = { export: exportScripts, restore: restoreScripts, init: initFromGcs }[positionals[0]]
if (!run) {
  console.error('用法:node server/backup/gcs.mjs export|restore|init(參數見檔頭說明)')
  process.exit(1)
}
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'evoleap-backup-'))
try {
  run(work)
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}
