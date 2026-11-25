// 英文版頁面的 SEO 資料(路徑 /en/...):搜尋引擎用路徑區分語言,所以英文頁有自己的網址、<title>、description、canonical 與 hreflang。
// 只收錄「內文整頁都是英文」的頁面:課程清單(/en/courses)與每門課的總覽(/en/courses/<課程>),
// 它們的課名、簡介、單元與課的標題都來自翻譯檔 server/internal/store/i18n_en.json。
// 注意:執行時 GET /api/...?lang=en 的譯文已經搬進資料庫(以資料庫為準),i18n_en.json 現在只是「初稿種子」(課程同步工作只補缺地補進資料庫)。
// 所以改資料庫的譯文(evoleap i18n set)不會更新這些靜態英文頁,建置時仍讀這個 JSON;之後需要一個「由資料庫重產」的機制。
// 其他頁(首頁、主題頁、單課)內文還是中文,不收錄英文版:伺服器回中文頁並標 noindex(見 server/cmd/server/static.go)。
// 新增要收錄英文版的頁面:在這裡加一筆,同時把 i18n/locale.ts 的 hasEnglishPage 改成涵蓋它。
import en from '../../../server/internal/store/i18n_en.json'
import { COURSES, courseMapId, coursePath } from '../content/catalog'
import { SITE_NAME } from '../site/siteInfo'
import type { PageMeta } from './pages'

type EnCourse = { title: string; summary?: string; seoTitle?: string; description?: string }
const EN_COURSES = en.courses as Record<string, EnCourse>

export const EN_PREFIX = '/en'
const title = (name: string) => `${name} · ${SITE_NAME}`

const COURSE_LIST_EN: PageMeta = {
  path: `${EN_PREFIX}/courses`,
  lang: 'en',
  title: title('All Courses: From Zero to Interactive AI Software'),
  description:
    'Every AI course by topic: build your own website and tools from scratch, understand how the web works, web programming for kids, and building interactive AI software. See which courses are open and which are planned.',
  sitemapPriority: 0.9,
}

const COURSE_PAGES_EN: PageMeta[] = COURSES.flatMap((c): PageMeta[] => {
  const t = EN_COURSES[courseMapId(c)]
  if (!t) return []
  return [
    {
      path: EN_PREFIX + coursePath(c),
      lang: 'en',
      title: title(t.seoTitle || t.title),
      description: t.description || t.summary || t.title,
      sitemapPriority: 0.8,
    },
  ]
})

export const EN_PAGES: PageMeta[] = [COURSE_LIST_EN, ...COURSE_PAGES_EN]

/** 有英文版的頁面:中文網址 → 英文網址 */
export const EN_ALTERNATES = new Map(EN_PAGES.map((p) => [p.path.slice(EN_PREFIX.length), p.path]))
