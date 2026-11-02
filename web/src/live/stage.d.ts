// stage.js 的型別宣告(腳本格式見 stage.js 開頭與 README.md「舞台腳本」)。
/** 舞台腳本(JSON);欄位依演員而定,這裡只宣告舞台會讀的頂層欄位 */
export type StageScript = {
  title: string
  lesson?: string
  camera?: 'auto'
  cast: Record<string, { actor: string; props?: Record<string, unknown>; place?: unknown; hidden?: boolean }>
  steps: Record<string, unknown>[]
}

/** 章節;step 是腳本裡標的 lessonStep(對應課程的第幾步) */
export type StageChapter = { at: number; label: string; step?: number }
export type StageCaption = { from: number; to: number; text: string }
export type StageStop = { at: number; title: string; body: string }

export interface Stage {
  /** 載入腳本與演員,回傳總長度(毫秒);腳本有錯會丟出含「第幾步」的錯誤 */
  load(script: StageScript, opts?: { voice?: Record<string, number> }): Promise<number>
  /** 畫出 ms 時的畫面(同一個時間點一定畫出同一個畫面) */
  renderAt(ms: number): void
  readonly duration: number
  readonly captions: StageCaption[]
  readonly chapters: StageChapter[]
  readonly stops: StageStop[]
  /** 每段旁白開始的時間(毫秒)與文字 */
  readonly narrations: { at: number; text: string }[]
}

/** 在 root 裡建立 1920×1080 的舞台 */
export declare function createStage(root: HTMLElement): Stage
