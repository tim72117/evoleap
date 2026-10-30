/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GA4 評估 ID(如 G-XXXXXXXXXX)。留空則完全不載入 Google Analytics。 */
  readonly VITE_GA_MEASUREMENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
