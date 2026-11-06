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

/** 用瀏覽器的語音念 */
export function speak(text: string) {
  hush()
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text.replace(/[<>]/g, ' '))
  u.lang = 'zh-TW'
  u.rate = 0.95
  speechSynthesis.speak(u)
}

/** 停掉正在念的旁白(音檔與瀏覽器語音都停) */
export function hush() {
  audio?.pause()
  window.speechSynthesis?.cancel()
}
