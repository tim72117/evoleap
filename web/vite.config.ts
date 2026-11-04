import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { devGateDecision, gatedKind } from './src/site/devStudioGate'

// 開發時也提供 /sitemap.xml 與 /robots.txt(正式環境由 scripts/seo.mjs 在 build 時寫進 dist),
// 內容來自同一份 src/seo/build.ts,每次請求即時產生。
function seoDevFiles(): Plugin {
  return {
    name: 'seo-dev-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path !== '/sitemap.xml' && path !== '/robots.txt') return next()
        try {
          const seo = await server.ssrLoadModule('/src/seo/build.ts')
          const xml = path === '/sitemap.xml'
          res.setHeader('Content-Type', xml ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8')
          res.end(xml ? seo.sitemapXml() : seo.robotsTxt())
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

// 課程編排工具(/materials/course-map)的存檔:只在開發時存在,把編排寫進 repo 內的 JSON,讓 Claude 可以直接讀取。
// rev 是檔案內容的雜湊;存檔時比對,檔案在外部被改過就回 409,不會蓋掉別人的修改。
function courseMapFile(): Plugin {
  const file = path.resolve(import.meta.dirname, 'src/studio/materials/course-map.json')
  const revOf = (text: string) => createHash('sha1').update(text).digest('hex')
  const readText = () => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null)
  return {
    name: 'course-map-file',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__studio/course-map', (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(body))
        }
        if (req.method === 'GET') {
          const text = readText()
          if (text == null) return send(200, { rev: null, map: null })
          try {
            return send(200, { rev: revOf(text), map: JSON.parse(text) })
          } catch (e) {
            return send(500, { error: `course-map.json 不是有效的 JSON:${e instanceof Error ? e.message : e}` })
          }
        }
        // 只收 JSON:其他網站的表單送不了這種內容類型,也就無法改到這個檔案
        if (req.method !== 'PUT' || !req.headers['content-type']?.startsWith('application/json')) return send(405, { error: '只接受 PUT JSON' })
        let raw = ''
        req.setEncoding('utf8')
        req.on('data', (chunk) => (raw += chunk))
        req.on('end', () => {
          try {
            const body = JSON.parse(raw) as { rev: string | null; map: { levels?: unknown } }
            if (!Array.isArray(body.map?.levels)) return send(400, { error: '資料格式不對:缺少 levels' })
            const current = readText()
            if ((current == null ? null : revOf(current)) !== body.rev) return send(409, { error: '檔案在外部被改過' })
            const text = JSON.stringify(body.map, null, 2) + '\n'
            // 先寫暫存檔再改名:讀取的人不會讀到寫到一半的檔案
            fs.writeFileSync(`${file}.tmp`, text)
            fs.renameSync(`${file}.tmp`, file)
            send(200, { rev: revOf(text) })
          } catch (e) {
            send(500, { error: e instanceof Error ? e.message : String(e) })
          }
        })
      })
    },
  }
}

// 開發時也擋研發基地:向本機 Go server 確認登入的是不是管理員(判定條件與正式環境相同)。
// 例外:scripts/record-live.mjs 錄影時帶本機的 token(存在 node_modules/.cache,不進版控);
// 要在本機略過檢查時用 DEV_OPEN_STUDIO=1 npm run dev。
const STUDIO_TOKEN_COOKIE = 'studio_dev_token'
function studioDevToken(): string {
  const file = path.resolve(import.meta.dirname, 'node_modules/.cache/studio-dev-token')
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  const token = randomBytes(24).toString('hex')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, token, { mode: 0o600 })
  return token
}

function devStudioGate(): Plugin {
  return {
    name: 'dev-studio-gate',
    apply: 'serve',
    configureServer(server) {
      if (process.env.DEV_OPEN_STUDIO === '1') {
        server.config.logger.warn('DEV_OPEN_STUDIO=1:研發基地不檢查權限')
        return
      }
      const token = studioDevToken()
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/'
        const kind = gatedKind(url.split('?')[0])
        if (!kind) return next()
        const cookie = req.headers.cookie ?? ''
        if (cookie.split(/;\s*/).includes(`${STUDIO_TOKEN_COOKIE}=${token}`)) return next()

        let status: number | null = null
        try {
          status = (await fetch('http://127.0.0.1:8190/api/admin/me', { headers: { cookie } })).status
        } catch {
          server.config.logger.warn('連不上 Go server(8190),無法確認研發基地的權限,先擋下', { timestamp: true })
        }
        const decision = devGateDecision(kind, status)
        if (decision === 'pass' || decision === 'shell') return next()
        res.setHeader('Cache-Control', 'no-store')
        if (decision === 'login') {
          res.statusCode = 302
          res.setHeader('Location', `/login?next=${encodeURIComponent(url)}`)
        } else {
          res.statusCode = 404
        }
        res.end()
      })
    },
  }
}

// 研發基地的內容(只有管理員能下載,見 server/cmd/server/static.go):輸出到 assets/internal/。
// src/studio/interactive 是公開互動課程也會用到的引擎,不算內部內容。
const INTERNAL_MODULE = /\/src\/studio\/(?!interactive\/)|\/src\/seo\/internalPages|\/src\/content\/live\/(lab|promo)\//
const isInternalChunk = (moduleIds: string[]) => moduleIds.some((id) => INTERNAL_MODULE.test(id))

// build 時確認內部內容沒有混進公開檔案;公開頁面誤引用內部模組時,與其默默外流或讓公開頁壞掉,不如讓 build 失敗。
function internalBundleGuard(): Plugin {
  return {
    name: 'internal-bundle-guard',
    apply: 'build',
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).flatMap((f) => (f.type === 'chunk' ? [f] : []))
      const leaked = chunks.filter((c) => !c.fileName.startsWith('assets/internal/') && isInternalChunk(c.moduleIds))
      if (leaked.length) this.error(`內部內容混進公開檔案:${leaked.map((c) => c.fileName).join(', ')}`)
      // 從入口靜態 import 得到的檔案每個訪客都要下載,不能放在受保護的路徑。
      const byName = new Map(chunks.map((c) => [c.fileName, c]))
      const seen = new Set<string>()
      const walk = (name: string) => {
        if (seen.has(name)) return
        seen.add(name)
        byName.get(name)?.imports.forEach(walk)
      }
      chunks.filter((c) => c.isEntry).forEach((c) => walk(c.fileName))
      const blocked = [...seen].filter((n) => n.startsWith('assets/internal/'))
      if (blocked.length) this.error(`公開入口依賴了內部檔案(可能有公開頁面 import 了 src/studio):${blocked.join(', ')}`)
      if (!chunks.some((c) => c.fileName.startsWith('assets/internal/StudioApp-'))) {
        this.error('找不到 assets/internal/StudioApp-*.js:研發基地沒有拆成獨立 chunk')
      }
    },
  }
}

// 開發時 /api 轉發到本機 Go server(go run ./cmd/server,預設 :8190),
// 正式環境前端由 Go server 以 go:embed 提供,同源不需要 proxy。
export default defineConfig({
  plugins: [react(), seoDevFiles(), devStudioGate(), courseMapFile(), internalBundleGuard()],
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: (chunk) =>
          isInternalChunk(chunk.moduleIds) ? 'assets/internal/[name]-[hash].js' : 'assets/[name]-[hash].js',
        assetFileNames: (asset) =>
          asset.names.some((n) => n.startsWith('StudioApp')) ? 'assets/internal/[name]-[hash][extname]' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    // 5190/8190:避開其他本機專案常用的 5173-5179、8080-8082;
    // strictPort 讓 port 被占用時直接報錯,不會默默換 port 造成 proxy 對不上。
    port: 5190,
    strictPort: true,
    // 預設只聽本機。要從 Tailscale 上的其他裝置連(例如用手機測旁白):npm run dev:tailscale,
    // 只綁在這台機器的 Tailscale IP,區網上的其他人連不到(dev server 有寫檔的端點,不開放給區網)。
    host: process.env.DEV_HOST || 'localhost',
    // 用 MagicDNS 名稱(xxx.tailnet.ts.net)連時,Vite 預設會擋掉不認得的 Host
    allowedHosts: ['.ts.net'],
    // src/studio/docs/registry.ts 以 ?raw 讀取 web/ 外層的 Markdown 文件,dev server 需放行上一層目錄。
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://127.0.0.1:8190',
    },
  },
  // 單元測試(npm test):src 內的 *.test.ts(x);E2E 測試在 e2e/,由 Playwright 執行。
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
