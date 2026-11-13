// studioToken.mjs — 開發時研發基地(/studio)的本機 token:vite.config.ts 的 devStudioGate 用它放行,
// scripts/record-live.mjs、scripts/canvas/stage.mjs 把它放進 cookie(studio_dev_token)才進得去。
// 存在 node_modules/.cache/studio-dev-token(不進版控),沒有就產生一個;三個地方共用這一份,免得閘門改了其中一處漏改。
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const STUDIO_TOKEN_COOKIE = 'studio_dev_token'

/** web/ 資料夾(webDir)底下的本機 token;沒有檔案就產生並存起來(權限 0600) */
export function studioDevToken(webDir) {
  const file = path.join(webDir, 'node_modules/.cache/studio-dev-token')
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  const token = randomBytes(24).toString('hex')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, token, { mode: 0o600 })
  return token
}
