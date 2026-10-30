// 單課資料的型別：提案頁（/proposal）與之後的學員課程頁共用同一份資料。
//
// 每一課的進行方式固定為三段：
//   1. 目標（goal）：這一課要完成的一件具體成果。
//   2. 步驟拆解（steps）：把目標拆成編號步驟，每一步對應一段提示詞。
//   3. 實際操作展示：講師依步驟現場操作；影片進行到哪一步，畫面就顯示該步的提示詞，
//      學員可複製提示詞，一步一步跟著做。
// 每課第一支影片固定以「目標 → 步驟拆解」開場，再進入操作展示。

export type LessonStep = {
  /** 這一步要做的事 */
  title: string
  /** 學員複製貼上的提示詞（繁體中文，可直接貼進 ChatGPT、Claude、Gemini）。
   *  【】標示學員要自行替換的部分；後面的步驟可接續前一步的回答。
   *  純介面操作的步驟（例如建立帳號、刪除對話）沒有提示詞。 */
  prompt?: string
  /** 送出後應該看到的結果，或學員此時要確認的事 */
  expected: string
  /** 注意事項，例如隱私（貼上前遮蔽）或查證（對照原文、官方來源） */
  note?: string
}

export type LessonVideo = {
  title: string
  /** 預估長度（分鐘），目標 6–9 */
  minutes: number
  /** 這支影片操作展示的步驟編號（1 起算，對應 steps） */
  steps: number[]
  /** 結尾：回顧，或接下一支影片／下一課的過場 */
  wrap: string
  /** YouTube 影片 ID（網址 watch?v= 後面那段）；尚未上傳時留空，課程頁顯示「影片製作中」 */
  youtubeId?: string
  /** 播放進度對應的步驟：影片播到 at 秒時，課程頁自動展開第 step 步（step 1 起算，對應 steps） */
  cues?: { step: number; at: number }[]
}

export type CourseLesson = {
  /** 課號，例如「1.1」 */
  id: string
  title: string
  /** 預估學習時間（含影片與跟做），例如「約 30 分」 */
  length: string
  /** 目標：這一課結束時完成的具體成果 */
  goal: string
  /** 示範情境：一件生活或工作中的具體任務 */
  scenario: string
  /** 步驟拆解，與提示詞一對一 */
  steps: LessonStep[]
  /** 影片切分：每支影片展示哪些步驟 */
  videos: LessonVideo[]
  /** 學員完成後手上會有的東西 */
  deliverable: string
  /** 學員需要的素材 */
  materials: string[]
  /** 完成檢核：學員自己（與我們）怎麼知道做到了 */
  checkpoint: string[]
  /** 換成自己的資料再做一次的建議 */
  tryYourOwn?: string
}
