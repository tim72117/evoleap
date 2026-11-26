// 英文版(路徑 /en/...)的 SEO:搜尋引擎用路徑區分語言,所以英文頁有自己的網址、<title>、description、canonical 與 hreflang。
// 只收錄「內文整頁都是英文」的頁面:
//   - 課程清單 /en/courses:標題與描述不靠課程資料,寫在這裡,build 時產生
//   - 每門課的總覽 /en/courses/<課程>(coursePages.ts 的 EN_COURSE_PAGES):課名、簡介等來自資料庫的譯文,
//     由 server 在請求時組出來(server/cmd/server/courseseo.go),這門課有沒有英文版也看資料庫(沒有的回中文頁並 noindex)
// 其他頁(首頁、主題頁、單課)內文還是中文,不收錄英文版:伺服器回中文頁並標 noindex(見 server/cmd/server/static.go)。
// 新增要收錄英文版的頁面:在這裡加一筆,同時把 i18n/locale.ts 的 hasEnglishPage 改成涵蓋它。
import { EN_PREFIX } from '../i18n/locale'
import { SITE_NAME } from '../site/siteInfo'
import { EN_COURSE_PAGES } from './coursePages'
import type { PageMeta } from './pages'

export { EN_PREFIX }

const COURSE_LIST_EN: PageMeta = {
  path: `${EN_PREFIX}/courses`,
  lang: 'en',
  title: `All Courses: From Zero to Interactive AI Software · ${SITE_NAME}`,
  description:
    'Every AI course by topic: build your own website and tools from scratch, understand how the web works, web programming for kids, and building interactive AI software. See which courses are open and which are planned.',
  sitemapPriority: 0.9,
}

/** 內容在 build 就決定的英文頁 */
export const EN_PAGES: PageMeta[] = [COURSE_LIST_EN]

/** 可能有英文版的頁面:中文網址 → 英文網址(課程總覽實際有沒有英文版看資料庫,server 沒有時拿掉 hreflang) */
export const EN_ALTERNATES = new Map([...EN_PAGES, ...EN_COURSE_PAGES].map((p) => [p.path.slice(EN_PREFIX.length), p.path]))
