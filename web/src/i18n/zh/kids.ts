// kids 的介面文字(繁中,基準)。英文在 ../en/kids.ts,鍵要一模一樣。
// 兒童版播放器(kids/KidsPlayer.tsx)與拖曳層(kids/DragLayer.tsx)孩子看得到的字。
export const kids = {
  /** 瀏覽器語音念介面文字(例如「再試一次」)用的語言;課程內容一律用中文念 */
  speechLang: 'zh-TW',
  /** 答錯後念出來的「再試一次」(後面接著念題目) */
  sayAgain: '再試一次。',
  controls: {
    prev: '⏮ 上一段',
    pause: '⏸ 暫停',
    replay: '↺ 再看一次',
    play: '▶ 播放',
    next: '下一段 ⏭',
    restart: '↺ 從頭開始',
    voiceOn: '旁白開',
    voiceOff: '旁白關',
    chapters: (cur: number, total: number) => `☰ 段落 ${cur}/${total}`,
    exitFullscreen: '✕ 離開全螢幕',
    fullscreen: '⛶ 全螢幕',
    seek: '拉到要看的地方',
  },
  chaptersLabel: '段落',
  interactiveTag: '可互動',
  stars: (got: number, of: number) => `找到 ${got} / ${of}`,
  tryAgain: '再試一次：',
  hintDrag: '按住拉動這裡',
  hintTap: '點這裡試試看',
  quizHint: '點一塊你覺得對的積木',
  bigReplay: '再看一次',
  bigPlay: '播放',
  scriptError: (msg: string) => `腳本有錯：${msg}`,
  drag: {
    grab: (label: string) => `拖動「${label}」`,
    dropHere: '放這裡',
  },
}
