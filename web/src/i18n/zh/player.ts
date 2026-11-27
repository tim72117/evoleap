// player 的介面文字(繁中,基準)。英文在 ../en/player.ts,鍵要一模一樣。
// 教學畫面播放器的外框與控制列(live/shell.ts)、互動版上課頁(studio/interactive/)。
export const player = {
  // ---------- 播放器外框(live/shell.ts) ----------
  region: (title: string) => `影片播放器:${title}`,
  play: '播放',
  pause: '暫停',
  replay: '重播',
  progress: '播放進度',
  mute: '靜音',
  unmute: '取消靜音',
  captions: '字幕',
  speed: '播放速度',
  fullscreen: '全螢幕',
  exitFullscreen: '離開全螢幕',
  rotateHint: '把手機轉成橫向可以看得更清楚',
  /** 雙擊快轉/倒退時的提示:sign 是「+」或「−」 */
  seekBy: (sign: string, seconds: number) => `${sign}${seconds} 秒`,
  // 練習點(腳本的 stop)
  stopEyebrow: '停一下',
  stopTitle: '換你試試',
  stopBack: '再看一次這段',
  stopGo: '完成了，繼續',
  /** 章節名稱:學員回答後插進時間軸的段落(腳本裡的名稱固定是「你的回答」) */
  chapterName: (label: string) => label,

  // ---------- 複製提示詞 ----------
  copy: '複製',
  copied: '已複製 ✓',
  copyFailed: '複製失敗，請手動選取',

  // ---------- 互動版上課頁(studio/interactive/InteractiveScenePage.tsx 等) ----------
  scene: {
    playingMark: '播放中',
    playingHere: (label: string) => `${label}(正在播放,點回來繼續)`,
    loadError: '無法載入場景：',
    actorLoadError: '無法載入演員：',
    shrink: '縮小播放器',
    rotateBack: '把手機轉成直的，就會回到直式',
    prompts: '提示詞',
    closePrompts: '關閉提示詞',
    submit: '送出',
    yourTurn: '換你回答',
    yourTurnHands: '換你動手',
    skip: '略過，繼續看',
  },
}
