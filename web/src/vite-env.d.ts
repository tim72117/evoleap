/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GA4 評估 ID(如 G-XXXXXXXXXX)。留空則完全不載入 Google Analytics。 */
  readonly VITE_GA_MEASUREMENT_ID?: string
  /** AdSense 發布商 ID(如 ca-pub-XXXXXXXXXXXXXXXX)。和 VITE_ADSENSE_SLOT 都有值才顯示廣告。 */
  readonly VITE_ADSENSE_CLIENT?: string
  /** AdSense 廣告單元 ID */
  readonly VITE_ADSENSE_SLOT?: string
  /** 全站開啟的功能(feature flag,逗號分隔,如 practice);見 src/site/features.ts。留空則正式站預設關閉。 */
  readonly VITE_FEATURES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
