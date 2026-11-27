// narrationLines.mjs — voice.mjs 的純函式:腳本裡哪些句子要有語音、哪些沿用舊音檔(不讀寫任何東西,可單獨測試)。

// 互動點自動示範的台詞欄位:demo 是扁平的項目清單(台詞在 say,沒台詞的略過;live/README.md);
// demoNarration 是「示範段落 → 台詞」,也收清單寫法(每項是字串或帶台詞的物件)
const DEMO_KEYS = ['demoNarration', 'demo']
const LINE_KEYS = ['narration', 'line', 'say', 'text']

/** 一個步驟(或子腳本)上的示範台詞 */
export function demoLines(step) {
  const out = []
  for (const key of DEMO_KEYS) {
    const v = step?.[key]
    if (!v || typeof v !== 'object') continue
    // demoNarration 的物件是「段落 → 台詞或項目」;demo 只收清單,免得誤收別的設定物件
    if (!Array.isArray(v) && key !== 'demoNarration') continue
    for (const item of Object.values(v)) {
      // 清單的一項除了自己的台詞,還可以有 lines:同一步裡後面接著講的句子
      for (const one of [item, ...(Array.isArray(item?.lines) ? item.lines : [])]) {
        const line = typeof one === 'string' ? (key === 'demoNarration' ? one : null) : LINE_KEYS.map((k) => one?.[k]).find((x) => typeof x === 'string')
        if (line) out.push(line)
      }
    }
  }
  return out
}

// 兒童版的互動寫在步驟裡面(互動點的 options[].steps、子腳本的 interact.spots / done),也要有語音:整份往下找所有 narration;
// 停下來等孩子點時念的題目(有選項的 checkpoint、子腳本的 interact.prompt)、拖曳完成任務念的話(say、else)也是
function deepNarrations(v, out = []) {
  if (Array.isArray(v)) v.forEach((x) => deepNarrations(x, out))
  else if (v && typeof v === 'object') {
    const demo = demoLines(v)
    for (const [k, x] of Object.entries(v)) {
      if (DEMO_KEYS.includes(k) && demo.length) continue
      if (typeof x === 'string' && (k === 'narration' || k === 'prompt' || (k === 'checkpoint' && v.options))) out.push(x)
      else if (k === 'say' && x && typeof x === 'object' && !Array.isArray(x)) out.push(...Object.values(x).filter((s) => typeof s === 'string'))
      else if (k === 'else' && typeof x === 'string') out.push(x)
      else deepNarrations(x, out)
    }
    out.push(...demo)
  }
  return out
}

// 其他腳本:最外層步驟的 narration;互動點(有 id 的 checkpoint)再加選項回應與示範(skip);任何步驟的示範台詞。
// 自己打字的回應(free)內容不固定,不產生
const topLevel = (steps) =>
  (steps || []).flatMap((s) => [
    s.narration,
    ...demoLines(s),
    ...(s.id && s.checkpoint ? [...(s.options || []).flatMap((o) => (o.steps || []).map((x) => x.narration)), ...(s.skip?.steps || []).map((x) => x.narration)] : []),
  ])

/** 一份腳本要有語音的句子(依出現順序、不重複)。teacher 是 src/live/teacher.json */
export function narrationLines(script, { kids = false, teacher = {} } = {}) {
  const intro = script.teacher ? [script.teacher.greeting ?? teacher.greeting, script.teacher.line] : []
  const all = [...intro, ...(kids ? deepNarrations({ steps: script.steps, interact: script.interact }) : topLevel(script.steps))]
  return [...new Set(all.filter(Boolean))]
}

/**
 * 這一句可沿用的舊音檔項目:自己清單裡同一個音檔的項目整個沿用(手動改短的 ms、levels 都保留),
 * 手動接過來的項目(isHandEdited)也沿用,否則用同資料夾其他腳本的;都沒有回 undefined(要產生)
 */
export function reusableClip(text, file, oldClips, shared, handEdited = () => false) {
  const prev = oldClips?.[text]
  if (prev && (prev.file === file || handEdited(prev))) return prev
  return shared?.[file]
}

/**
 * 手動接過來的項目:音檔剪短(ms 改小)後掛到改短的句子上,檔名還是原句的雜湊,和現在這句對不上。
 * 只在清單的聲音設定和現在相同、不是整段錄(take)時才認;ownFiles 是這句在各種旗標下本工具會取的檔名(對得上代表是設定變了,要重錄)
 */
export function isHandEdited(clip, { manifest, cfg, prefix, ownFiles }) {
  if (!manifest || manifest.take || manifest.model !== cfg.model || manifest.voice !== cfg.voice || manifest.style !== cfg.style) return false
  const name = clip.file.startsWith(`${prefix}/`) ? clip.file.slice(prefix.length + 1) : ''
  return /^[0-9a-f]{12}\.mp3$/.test(name) && !ownFiles.includes(clip.file)
}
