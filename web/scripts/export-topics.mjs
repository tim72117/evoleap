// npm run export:topics:把 src/content/topics.ts 的主題轉成資料庫的種子 server/internal/store/topics_seed.json
// (轉換在 src/content/topicSeed.ts;topicSeed.test.ts 檢查這個檔和那裡的結果一致)。
// 和 seo.mjs 一樣用 Vite 的 ssrLoadModule 載入 TS,不需要另外的 TS 執行工具,不會監聽任何 port。
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, '..', 'server', 'internal', 'store', 'topics_seed.json')
const vite = await createServer({ root, logLevel: 'warn', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
try {
  const { topicSeedRows } = await vite.ssrLoadModule('/src/content/topicSeed.ts')
  const rows = topicSeedRows()
  await writeFile(out, JSON.stringify(rows, null, 2) + '\n')
  console.log(`已寫入 ${rows.length} 個主題 → ${out}`)
} finally {
  await vite.close()
}
