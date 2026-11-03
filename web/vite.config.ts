import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

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

// 開發時 /api 轉發到本機 Go server(go run ./cmd/server,預設 :8190),
// 正式環境前端由 Go server 以 go:embed 提供,同源不需要 proxy。
export default defineConfig({
  plugins: [react(), seoDevFiles(), courseMapFile()],
  server: {
    // 5190/8190:避開其他本機專案常用的 5173-5179、8080-8082;
    // strictPort 讓 port 被占用時直接報錯,不會默默換 port 造成 proxy 對不上。
    port: 5190,
    strictPort: true,
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
