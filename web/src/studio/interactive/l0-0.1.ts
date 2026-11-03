// L0 第 1 課的互動版:腳本和語音都用課程原本的 l0/0.1-project.json,只把五個操作換成互動點。
// 做法同 l0-0.0.ts:原本的示範就是互動點的 skip;新寫的旁白還沒有語音,只顯示字幕。
// 每個選項最後都要回到原本的狀態,後面的演出才接得上(只有刪除 drafts 可以不同,後面不會再用到它)。
import type { ScriptStep, StageScript } from '../../live/types'
import { stepFinder } from './scene'

type Loose = Record<string, unknown>

const ASK_WORKDIR = '目前的工作目錄是哪裡？'
const BASE_FILES = '產生網頁專案基本檔案：index.html 和 styles.css'
const NOTE = '在 drafts/idea.txt 記下：首頁要有預約按鈕'
const MOVE = '把 drafts/idea.txt 改名為 homepage-idea.txt，移到 notes 資料夾'

export function withL01Moments(base: StageScript): StageScript {
  const steps = base.steps as Loose[]
  const find = stepFinder(steps, 'l0-0.1.ts')
  const askDir = find('問工作目錄', (s) => s.user === ASK_WORKDIR)
  const dirCallout = find('工作目錄的聚光燈', (s) => s.callout === 'claude:say', askDir)
  const files = find('產生基本檔案', (s) => s.user === BASE_FILES, dirCallout)
  const filesAsk = find('建立 index.html 的確認提示', (s) => s.ask === 'index.html', files)
  const note = find('相對路徑的指令', (s) => s.user === NOTE, filesAsk)
  const noteAsk = find('建立筆記的確認提示', (s) => s.ask === 'drafts/idea.txt', note)
  const move = find('改名與移動的指令', (s) => s.user === MOVE, noteAsk)
  const moveAsk = find('改名與移動的確認提示', (s) => typeof s.ask === 'string' && s.ask.startsWith('mkdir notes'), move)
  const moveDo = moveAsk + 1
  const removeAsk = find('刪除的確認提示', (s) => s.ask === 'rmdir drafts', moveDo)
  const removeDo = find('允許刪除', (s) => s.choose === 1, removeAsk)
  const removeEnd = find('刪除後的換你試試', (s) => s.checkpoint === '換你試試', removeDo)

  // 互動點接手原本這一步的章節與課程步驟,步驟本身不再重複標章節
  const lift = (i: number): { head: Loose; first: Loose } => {
    const { chapter, lessonStep, ...first } = steps[i]
    return { head: { chapter, lessonStep }, first }
  }
  const dir = lift(askDir)
  const file = lift(files)
  const noted = lift(note)
  const demo = { label: '先看示範' }
  const chooseAt = { focus: 'claude:composer', choices: 'claude:input' }

  return {
    ...base,
    steps: [
      ...steps.slice(0, askDir),
      {
        ...dir.head,
        checkpoint: '想確認 Claude 在哪個資料夾工作，你要問哪一句？',
        body: '點一句送出，看看它怎麼回答。',
        id: 'workdir',
        stage: chooseAt,
        options: [
          { label: ASK_WORKDIR, steps: [dir.first, ...steps.slice(askDir + 1, dirCallout + 1)] },
          {
            label: '這裡是哪個資料夾？',
            steps: [{ user: '這裡是哪個資料夾？', narration: '換個說法也可以，它一樣聽得懂。' }, ...steps.slice(askDir + 1, dirCallout + 1)],
          },
          {
            label: '幫我做小森烘焙的網站',
            steps: [
              { user: '幫我做小森烘焙的網站' },
              { thinking: true, ms: 1000 },
              { say: '好的。開始之前想先確認：要在目前的資料夾 `bakery` 裡建立嗎？', narration: '它還不知道你想確認工作目錄。想知道什麼，就直接問。' },
              { user: ASK_WORKDIR },
              ...steps.slice(askDir + 1, dirCallout + 1),
            ],
          },
        ],
        skip: { ...demo, steps: [dir.first, ...steps.slice(askDir + 1, dirCallout + 1)] },
      },
      ...steps.slice(dirCallout + 1, files),
      {
        ...file.head,
        checkpoint: '要建立網頁的基本檔案，你要送出哪一句？',
        body: '下一課要接著用這些檔案。哪一句最不用讓 Claude 猜？',
        id: 'files',
        stage: chooseAt,
        options: [
          { label: BASE_FILES, steps: [file.first, ...steps.slice(files + 1, filesAsk)] },
          {
            label: '建立一個網頁',
            steps: [
              { user: '建立一個網頁' },
              { thinking: true, ms: 1300 },
              { say: '我會建立 `index.html`（網頁內容）和 `styles.css`（網頁樣式）。', narration: '這次檔名是它自己決定的。下一課要接著用，最好把檔名寫清楚。' },
            ],
          },
          {
            label: '幫我把整個網站做好',
            steps: [
              { user: '幫我把整個網站做好' },
              { thinking: true, ms: 1300 },
              { say: '這需要好幾個步驟。我先建立 `index.html`（網頁內容）和 `styles.css`（網頁樣式）。', narration: '目標太大，它只能先猜第一步。一次交代一件事，結果比較好確認。' },
            ],
          },
        ],
        skip: { ...demo, steps: [file.first, ...steps.slice(files + 1, filesAsk)] },
      },
      ...steps.slice(filesAsk, note),
      {
        ...noted.head,
        checkpoint: '筆記要放進工作目錄的 drafts 資料夾，哪一句寫對了？',
        body: '路徑是從工作目錄 bakery 開始算的。',
        id: 'path',
        stage: chooseAt,
        options: [
          { label: NOTE, steps: [noted.first, ...steps.slice(note + 1, noteAsk)] },
          {
            label: '在 idea.txt 記下：首頁要有預約按鈕',
            steps: [
              { user: '在 idea.txt 記下：首頁要有預約按鈕' },
              { thinking: true, ms: 1000 },
              { say: '這樣檔案會放在工作目錄最外層，不在 drafts 裡。你要放在哪裡？', narration: '只寫檔名，就是放在工作目錄最外層。要放進 drafts，路徑就要寫出來。' },
              { user: NOTE },
              ...steps.slice(note + 1, noteAsk),
            ],
          },
          {
            label: '在桌面的 idea.txt 記下：首頁要有預約按鈕',
            steps: [
              { user: '在桌面的 idea.txt 記下：首頁要有預約按鈕' },
              { thinking: true, ms: 1000 },
              { say: '桌面不在這次的工作目錄 `bakery` 裡，建議放在專案裡面。', narration: '桌面在專案外面。專案的東西，就放在專案的資料夾裡。' },
              { user: NOTE },
              ...steps.slice(note + 1, noteAsk),
            ],
          },
        ],
        skip: { ...demo, steps: [noted.first, ...steps.slice(note + 1, noteAsk)] },
      },
      ...steps.slice(noteAsk, moveDo),
      {
        checkpoint: 'Claude 要建立資料夾並搬移檔案，你要允許嗎？',
        body: '這次是執行指令。看下面的說明：它會動到哪些東西？',
        id: 'move',
        stage: { focus: 'claude:ask' },
        options: [
          { label: '允許一次', target: 'claude:option:1', steps: [steps[moveDo]] },
          {
            label: '拒絕',
            target: 'claude:option:0',
            steps: [
              { choose: 0, narration: '你拒絕了，檔案都沒有動。這個練習還要整理筆記，我們再送一次。' },
              { say: '好的，我不會動這些檔案。' },
              { user: MOVE },
              { thinking: true, ms: 1000 },
              steps[moveAsk],
              { choose: 1, narration: '這次允許。' },
            ],
          },
          { label: '一律允許', target: 'claude:option:2', steps: [{ choose: 2, narration: '一律允許之後，同樣的指令它就不會再問你。剛開始學，建議每次都先確認。' }] },
        ],
        skip: { ...demo, steps: [steps[moveDo]] },
      },
      ...steps.slice(moveDo + 1, removeDo),
      {
        checkpoint: 'Claude 想刪除 drafts 資料夾，你要允許嗎？',
        body: '先看清楚範圍：只有這個空資料夾嗎？',
        id: 'remove',
        stage: { focus: 'claude:ask' },
        options: [
          { label: '允許一次', target: 'claude:option:1', steps: steps.slice(removeDo, removeEnd) },
          {
            label: '拒絕',
            target: 'claude:option:0',
            steps: [
              { choose: 0, narration: '你拒絕了，drafts 還在。空資料夾留著也不影響專案，不確定時先拒絕就對了。' },
              { say: '好的，`drafts` 資料夾先留著。' },
              { show: 'finder', highlight: 'drafts' },
              { hide: 'finder' },
            ],
          },
          {
            label: '一律允許',
            target: 'claude:option:2',
            steps: [{ choose: 2, narration: '一律允許之後，它再刪除也不會問你，所以刪除這種動作不要選這個。' }, ...steps.slice(removeDo + 1, removeEnd)],
          },
        ],
        skip: { ...demo, steps: steps.slice(removeDo, removeEnd) },
      },
      ...steps.slice(removeEnd),
    ] as ScriptStep[],
  }
}
