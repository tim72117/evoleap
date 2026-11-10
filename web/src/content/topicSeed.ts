// 主題資料的種子:把 topics.ts 的每個主題轉成資料庫 topics 表的一列(server/internal/store/topics_seed.json,後端啟動與部署的課程同步時寫進資料庫)。
// 轉換寫在這裡(不是在腳本裡),vitest(topicSeed.test.ts)檢查 topics_seed.json 和這裡的結果一致;主題文案改了之後執行 npm run export:topics 重新產生。
// 只轉有主題頁(/topics/<主題>)的主題;還沒有主題頁的規劃中主題(PLANNED_TOPICS 裡沒有 id 的,例如 AI 變現術)先不放。
import { AI_APPS_TOPIC, CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC, IDEA_TOPIC, KIDS_TOPIC, LAUNCH_TOPIC, PLANNED_TOPICS, SOFTWARE_TOPIC, WEB_TOPIC } from './topics'

/** 資料庫 topics 表的一列(JSON 欄位名稱,後端 store/topics.go 的 topicSeed 與 GET /api/topics 用同一份) */
export interface TopicSeedRow {
  id: string
  name: string
  slogan: string
  description: string
  seoTitle: string
  /** 課程頁(/courses/<主題>) */
  coursePath: string
  /** 主題頁(/topics/<主題>) */
  topicPath: string
  /** 首頁與清單頁的順序(0 起) */
  position: number
  /** 其他文案與卡片資料(痛點、學完你會、流程、預期成果、情境、示範預覽…),各主題不同,後端原樣存成 JSON */
  content: Record<string, unknown>
}

type SourceTopic = { name: string; slogan: string; description: string; seoTitle: string; path: string; topicPath: string }

/** 主題 id → topics.ts 的主題,順序就是 position */
const SOURCES: [string, SourceTopic][] = [
  ['software', SOFTWARE_TOPIC],
  ['ai-apps', AI_APPS_TOPIC],
  ['web', WEB_TOPIC],
  ['launch', LAUNCH_TOPIC],
  ['kids', KIDS_TOPIC],
  ['claude-code', CLAUDE_CODE_TOPIC],
  ['idea', IDEA_TOPIC],
]

const SCALARS = ['name', 'slogan', 'description', 'seoTitle', 'path', 'topicPath']

/** 去掉 undefined(JSON 不存),照原樣深拷貝 */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))

export function topicSeedRows(): TopicSeedRow[] {
  return SOURCES.map(([id, topic], position) => {
    // 首頁卡片的資料(流程、預期成果、情境…)有些寫在 PLANNED_TOPICS 的展開裡:同名的合進來
    const planned = PLANNED_TOPICS.find((p) => p.name === topic.name) ?? {}
    const merged: Record<string, unknown> = { ...topic, ...planned }
    // Claude Code 的情境:PLANNED_TOPICS 只放標題,完整的情境(摘要、用到的功能、示範影片)存在這裡
    if (id === 'claude-code') merged.scenarios = CLAUDE_CODE_SCENARIOS
    const content = Object.fromEntries(Object.entries(merged).filter(([k]) => !SCALARS.includes(k)))
    return {
      id,
      name: topic.name,
      slogan: topic.slogan,
      description: topic.description,
      seoTitle: topic.seoTitle,
      coursePath: topic.path,
      topicPath: topic.topicPath,
      position,
      content: plain(content),
    }
  })
}
