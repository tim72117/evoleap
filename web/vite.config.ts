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

// 開發時 /api 轉發到本機 Go server(go run ./cmd/server,預設 :8190),
// 正式環境前端由 Go server 以 go:embed 提供,同源不需要 proxy。
export default defineConfig({
  plugins: [react(), seoDevFiles()],
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
