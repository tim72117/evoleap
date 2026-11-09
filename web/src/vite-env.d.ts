/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GA4 評估 ID(如 G-XXXXXXXXXX)。留空則完全不載入 Google Analytics。 */
  readonly VITE_GA_MEASUREMENT_ID?: string
  /** AdSense 發布商 ID(如 ca-pub-XXXXXXXXXXXXXXXX)。和 VITE_ADSENSE_SLOT 都有值才顯示廣告。 */
  readonly VITE_ADSENSE_CLIENT?: string
  /** AdSense 廣告單元 ID */
  readonly VITE_ADSENSE_SLOT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
