// 課程資訊的種子資料(server/internal/store/courses_seed.json):資料庫的課程資料就是從這份檔案同步進去的。
// 只給 build 期與測試用:build 時產生的 SEO 靜態頁(seo/pages.ts:搜尋標題、描述、麵包屑、課程清單、先不公開的單元底下的課 noindex)沒有 API 可以問,讀這份。
// 執行期主程式不得 import 這個檔案(整份約 54KB 不該進主 bundle):畫面執行時一律讀 API(GET /api/courses/{id}/map,useCourseMap)——
// 課名、開放與否(status)、hidden、階段名稱、免費或登入、第一堂正課(廣告)都由資料庫決定,管理員用 CLI 改了立即生效、不用重新部署。
// 路由需要的靜態課號清單用小骨架 content/softwareOutline.ts(softwareOutline.test.ts 保證與這份種子一致)。
// seo/pages.ts 在 App.tsx 是用到才動態載入(seo/usePageMeta.ts),種子只在那個獨立 chunk 裡。
// 兩邊是同一份 repo 資料,所以標題、描述不會對不上;部署時前端 build 會複製這個檔案(見 Dockerfile)。
import courseSeed from '../../../server/internal/store/courses_seed.json'

export type SeedLesson = { id: string; title: string; summary: string; access?: string; status: 'open' | 'draft' | 'planned'; script?: string; files?: string[]; minutes?: number }
export type SeedUnit = { id: string; title: string; subtitle: string; label?: string; hidden?: boolean; lessons: SeedLesson[] }
export type SeedCourse = {
  id: string
  title: string
  access: string
  tier?: string
  summary?: string
  about?: string[]
  seoTitle?: string
  description?: string
  art?: string
  introScript?: string
  units: SeedUnit[]
}

export const SEED_COURSES: SeedCourse[] = courseSeed as SeedCourse[]

export function seedCourse(id: string): SeedCourse {
  const c = SEED_COURSES.find((x) => x.id === id)
  if (!c) throw new Error(`courses_seed.json 沒有課程 ${id}`)
  return c
}

/** 單元(階段) */
export function seedUnit(courseId: string, unitId: string): SeedUnit | undefined {
  return seedCourse(courseId).units.find((u) => u.id === unitId)
}
