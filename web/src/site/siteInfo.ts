// 站台層級的基本資料:SiteLayout(畫面、document.title)與 SEO(src/seo/)共用。

export const SITE_NAME = 'Vibe Coding 實戰'
/** 站台副標(多等級課程地圖) */
export const SITE_TAGLINE = '從零開始的 AI 課程地圖'
/** 正式站網址:canonical、og:url、sitemap 用的絕對網址都以這裡為準。 */
export const SITE_ORIGIN = 'https://evoleap.io'

/** 頁面的 <title>:「<頁名> · Vibe Coding 實戰」;首頁(不給頁名)為「Vibe Coding 實戰：<副標>」。 */
export function documentTitle(page?: string): string {
  return page ? `${page} · ${SITE_NAME}` : `${SITE_NAME}：${SITE_TAGLINE}`
}
