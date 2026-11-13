// 兒童版的旁白:有錄好的語音(scripts/voice.mjs 產生、腳本旁的 .voice.json)就播音檔,
// 沒有的句子才用瀏覽器的語音念(聲音依裝置不同)。念之前先停掉正在念的,標籤的 < > 不念出來。

let audio: HTMLAudioElement | null = null

/** 播一段錄好的語音(音檔網址) */
export function playClip(url: string) {
  hush()
  audio ??= new Audio()
  audio.src = url
  // 瀏覽器擋自動播放(還沒點過頁面)時不念,畫面照常
  void audio.play().catch(() => {})
}

/** 要念的一段:文字與語言(BCP 47,例如 zh-TW、en-US) */
export type SpeechPart = { text: string; lang: string }

/**
 * 用瀏覽器的語音念。字串一律用中文念(課程內容);介面文字跟著介面語言時,
 * 傳好幾段、各自帶語言,依序念完(例如英文的 "Try again!" 接著中文的題目)
 */
export function speak(text: string | SpeechPart[]) {
  hush()
  if (!('speechSynthesis' in window)) return
  const parts = typeof text === 'string' ? [{ text, lang: 'zh-TW' }] : text
  for (const p of parts) {
    if (!p.text.trim()) continue
    const u = new SpeechSynthesisUtterance(p.text.replace(/[<>]/g, ' '))
    u.lang = p.lang
    u.rate = 0.95
    speechSynthesis.speak(u)
  }
}

/** 停掉正在念的旁白(音檔與瀏覽器語音都停) */
export function hush() {
  audio?.pause()
  window.speechSynthesis?.cancel()
}
