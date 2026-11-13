import type { Messages } from '../zh'

export const kids: Messages['kids'] = {
  speechLang: 'en-US',
  sayAgain: 'Try again!',
  controls: {
    prev: '⏮ Back',
    pause: '⏸ Pause',
    replay: '↺ Watch again',
    play: '▶ Play',
    next: 'Next ⏭',
    restart: '↺ Start over',
    voiceOn: 'Voice on',
    voiceOff: 'Voice off',
    chapters: (cur: number, total: number) => `☰ Parts ${cur}/${total}`,
    exitFullscreen: '✕ Exit full screen',
    fullscreen: '⛶ Full screen',
    seek: 'Slide to pick a spot',
  },
  chaptersLabel: 'Parts',
  interactiveTag: 'Hands-on',
  stars: (got: number, of: number) => `Found ${got} of ${of}`,
  tryAgain: 'Try again: ',
  hintDrag: 'Hold and drag this',
  hintTap: 'Tap here!',
  quizHint: 'Tap the block you think is right',
  bigReplay: 'Watch again',
  bigPlay: 'Play',
  scriptError: (msg: string) => `Something went wrong with this lesson: ${msg}`,
  drag: {
    grab: (label: string) => `Drag “${label}”`,
    dropHere: 'Drop here',
  },
}
