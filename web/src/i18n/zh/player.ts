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
    loadError: '無法載入場景：',
    actorLoadError: '無法載入演員：',
    shrink: '縮小播放器',
    progress: '課程進度',
    progressPill: (label: string) => `課程進度:${label},打開側欄`,
    checkpoints: '互動點',
    rotateBack: '把手機轉成直的，就會回到直式',
    panel: '課程章節與步驟',
    yourTurnOn: (title: string) => `換你回答 · ${title}`,
    /** 側欄分頁與步驟清單上的互動點標籤 */
    interact: '互動',
    interactDone: '互動 ✓',
    steps: '步驟',
    backToCheckpoint: '回到互動點',
    answerAgain: '重新回答',
    sidebar: '側欄',
    closeSidebar: '收合側欄',
    openSidebar: '打開側欄',
    pullUp: '拉起課程進度',
    courseInfo: '課程資訊',
    submit: '送出',
    yourTurn: '換你回答',
    yourTurnHands: '換你動手',
    skip: '略過，繼續看',
    momentsHelp: '播到互動點會自動暫停，在這裡回答，演員會當場回應；你的回答會加進時間軸。',
    answered: (label: string) => `你的回答：${label}`,
    chose: (label: string) => `已選擇：${label}`,
    skipped: '已略過',
    notAnswered: (at: string) => `還沒回答 · ${at}`,
    afterPrevious: '回答上一題後才會出現',
    jumpHere: '跳到這裡',
  },
}
