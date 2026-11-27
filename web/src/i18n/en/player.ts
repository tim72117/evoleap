import type { Messages } from '../zh'

/** 腳本裡固定的章節名稱 → 英文;其他章節名稱是課程內容,照原文 */
const CHAPTERS: Record<string, string> = { 你的回答: 'Your answer' }

export const player: Messages['player'] = {
  region: (title) => `Video player: ${title}`,
  play: 'Play',
  pause: 'Pause',
  replay: 'Replay',
  progress: 'Playback position',
  mute: 'Mute',
  unmute: 'Unmute',
  captions: 'Captions',
  speed: 'Playback speed',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  rotateHint: 'Turn your phone sideways for a better view',
  seekBy: (sign, seconds) => `${sign}${seconds}s`,
  stopEyebrow: 'Quick pause',
  stopTitle: 'Your turn',
  stopBack: 'Watch this part again',
  stopGo: "Done, let's continue",
  chapterName: (label) => CHAPTERS[label] ?? label,

  copy: 'Copy',
  copied: 'Copied ✓',
  copyFailed: "Couldn't copy. Please select the text and copy it yourself.",

  scene: {
    playingMark: 'Playing',
    playingHere: (label: string) => `${label} (now playing, tap to resume)`,
    loadError: "Couldn't load this lesson: ",
    actorLoadError: "Couldn't load this part: ",
    shrink: 'Shrink player',
    rotateBack: 'Turn your phone upright to go back to portrait view',
    prompts: 'Prompts',
    closePrompts: 'Close prompts',
    submit: 'Send',
    yourTurn: 'Your turn',
    yourTurnHands: 'Your turn to try',
    skip: 'Skip and keep watching',
  },
}
