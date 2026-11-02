// shell.js 的型別宣告(行為說明見 shell.js 開頭)。
export type ShellChapter = { at: number; label: string }
export type ShellStop = { at: number; title: string; body: string }

export type ShellOptions = {
  title?: string
  /** 總長度(毫秒) */
  duration?: number
  /** 畫出 ms 時的畫面 */
  renderAt?: (ms: number) => void
  /** 1920×1080 的內容,外殼負責縮放 */
  stage: HTMLElement
  chapters?: ShellChapter[]
  captions?: (ms: number) => string
  /** 練習點:播放經過時自動暫停 */
  stops?: ShellStop[]
  audio?: string
  /** 分段旁白音檔:播到 at(毫秒)時開始播放,跟著外殼的時鐘同步 */
  clips?: { at: number; ms: number; url: string }[]
  /** 記住看到哪裡(localStorage 的鍵) */
  resumeKey?: string
  /** 頁面沒有其他焦點時也接收快捷鍵 */
  globalKeys?: boolean
  onFullscreenRequest?: (on: boolean) => void
  autoLandscape?: boolean
}

export interface Shell {
  play(): void
  pause(): void
  seek(ms: number): void
  setRate(rate: number): void
  toggleFullscreen(): void
  update(next: Partial<ShellOptions>): void
  setExternalFullscreen(on: boolean): void
  /** 目前時間(毫秒) */
  readonly time: number
  readonly playing: boolean
  destroy(): void
}

export declare function mountShell(container: HTMLElement, opts: ShellOptions): Shell
