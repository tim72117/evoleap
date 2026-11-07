// 影片開頭的老師介紹(所有課程共用):腳本頂層寫
//   "teacher": { "say": "今天做一張訂購單", "line": "今天要來幫小森烘焙的網站，加上一張訂購單。" }
// 載入腳本時(scripts.ts 的 loadScript)展開成:老師 Lena 登場 → 打招呼(共用的一句,每支影片同一個音檔)
// → 說這一課要做什麼(say 是對話泡泡,line 是旁白)→ 退場;一開始就在畫面上的演員,在老師退場(和開頭的章節卡)之後才出場。老師的名字、造型、位置、招呼語都在 teacher.json,
// scripts/voice.mjs 也讀同一份產生旁白語音。
import type { CastEntry, ScriptStep, StageScript } from './types'
import TEACHER from './teacher.json'

export const TEACHER_ID = 'teacher'

export function withTeacher(script: StageScript): StageScript {
  const t = script.teacher
  if (!t) return script
  if (script.cast[TEACHER_ID]) throw new Error(`腳本有 teacher 開場時,演員表不能再用「${TEACHER_ID}」這個代號`)
  const cast: CastEntry = {
    actor: 'person',
    props: { name: TEACHER.name, look: TEACHER.look },
    place: TEACHER.place,
    hidden: true,
  }
  // 一開始就在畫面上的演員:老師說話時先藏著(不然老師被蓋在後面),老師退場後再出場
  const onStage = Object.keys(script.cast).filter((id) => !script.cast[id].hidden)
  const intro = [
    { show: TEACHER_ID },
    { on: TEACHER_ID, say: t.greetingSay ?? TEACHER.greetingSay, mood: TEACHER.mood, narration: t.greeting ?? TEACHER.greeting },
    { on: TEACHER_ID, say: t.say, mood: TEACHER.mood, narration: t.line },
    { hide: TEACHER_ID },
  ] as ScriptStep[]
  const rest = Object.fromEntries(Object.entries(script.cast).map(([id, c]) => [id, onStage.includes(id) ? { ...c, hidden: true } : c]))
  // 這些演員在腳本開頭的章節卡之後才出場(不要在老師退場和章節卡之間閃一下)
  const cards = script.steps.findIndex((st) => !('card' in st))
  const at = cards < 0 ? script.steps.length : cards
  const shows = onStage.map((id) => ({ show: id })) as ScriptStep[]
  return { ...script, cast: { [TEACHER_ID]: cast, ...rest }, steps: [...intro, ...script.steps.slice(0, at), ...shows, ...script.steps.slice(at)] }
}
