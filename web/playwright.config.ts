import { defineConfig, devices } from '@playwright/test'

// E2E 測試(npm run test:e2e):對「正式 build」測試,不是 dev server。
// 先 npm run build 產生 dist/,再由 Go server 以 -dist 直接提供(含各頁 SEO HTML、404、sitemap),
// 資料庫用暫存 SQLite,每次測試都是乾淨的。port 8198 避開開發用的 8190/5190。
// 管理員必須用 Google 登入,E2E 做不到,所以測內部頁功能的 server(8198)加 -open-studio 不檢查權限;
// 權限本身由另一台照正式設定跑的 server(8199)測試,見 e2e/studio-access.spec.ts。
const PORT = 8198
const GATED_PORT = 8199
const tmpDb = (name: string) => `${process.env.RUNNER_TEMP ?? process.env.TEMP ?? '/tmp'}/shuttle-e2e-${name}-${Date.now()}.db`
const server = (port: number, flags: string, db: string) => ({
  command: `go run ./cmd/server -addr 127.0.0.1:${port} -dist ../web/dist -db "${db}"${flags}`,
  cwd: '../server',
  url: `http://127.0.0.1:${port}/api/health`,
  reuseExistingServer: false,
  timeout: 120_000,
})

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    // 本機直接用已安裝的 Chrome(免下載瀏覽器);CI 用 Playwright 內建的 Chromium。
    channel: process.env.CI ? undefined : 'chrome',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [server(PORT, ' -open-studio', tmpDb('open')), server(GATED_PORT, '', tmpDb('gated'))],
})
