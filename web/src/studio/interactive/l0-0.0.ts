// L0 第 0 課的互動版:腳本和語音都用課程原本的 l0/0.0-tools.json,只把三個操作換成互動點。
// 原本的示範就是互動點的 skip:學員沒回答直接播放時,演的就是原本的內容,原本的旁白語音也都用得上;
// 學員選其他選項時,新寫的旁白還沒有語音,只顯示字幕。原本的腳本調整順序或改文字時,找不到位置會直接丟錯。
import type { ScriptStep, StageScript } from '../../live/types'
import { stepFinder } from './scene'

type Loose = Record<string, unknown>

const PROMPT = '建立 hello.txt，寫一句問候'
const on = (step: Loose): ScriptStep => ({ on: 'claude', ...step }) as ScriptStep

export function withL0Moments(base: StageScript): StageScript {
  const steps = base.steps as Loose[]
  const find = stepFinder(steps, 'l0-0.0.ts')
  const start = find('建立檔案的指令', (s) => s.user === PROMPT)
  const askAt = find('建立檔案的確認提示', (s) => s.ask === 'hello.txt', start)
  const allow = find('允許建立', (s) => s.choose === 1, askAt)
  const practice = find('換你試試', (s) => s.checkpoint === '換你試試', allow)
  const remove = find('刪除的指令', (s) => s.user === '刪除 hello.txt', practice)
  const reject = find('拒絕刪除', (s) => s.choose === 0, remove)
  const refuseSay = find('拒絕後的回覆', (s) => typeof s.say === 'string', reject)
  const recap = find('回顧', (s) => 'card' in s, refuseSay)

  const { chapter, lessonStep, ...firstPrompt } = steps[start]
  const confirm = steps.slice(askAt, allow) // 確認提示與「先看三件事」的聚光燈
  const created = steps.slice(allow + 1, practice) // 建立完成、到 Finder 確認
  const card = steps[recap]
  const allowedDelete = (choose: number, narration: string): ScriptStep[] => [
    on({ choose, narration }),
    on({ tool: 'Bash', arg: 'rm hello.txt', result: '已刪除' }),
    on({ say: '已刪除 `hello.txt`。' }),
    { show: 'finder', delete: 'hello.txt', narration: '回到 Finder，hello.txt 不見了。這是練習資料夾所以沒關係，換成重要的檔案就麻煩了。' } as ScriptStep,
    { hide: 'finder' } as ScriptStep,
    {
      ...card,
      sub: '✓ 建好 practice　✓ 工具已登入　✓ 看過刪除的後果；想練習拒絕，可以在右側重新回答',
      narration: '工具裝好了，練習資料夾準備好了，你也看過允許刪除的後果。想練習拒絕，可以在右側重新回答。下一課，我們來看 AI 工作的範圍：專案與工作目錄。',
    } as ScriptStep,
  ]

  return {
    ...base,
    steps: [
      ...steps.slice(0, start),
      {
        checkpoint: '請 Claude 建立 hello.txt，你要送出哪一句？',
        body: '點一句送出，看看 Claude 的反應有什麼不同。',
        chapter,
        lessonStep,
        id: 'prompt',
        stage: { focus: 'claude:composer', choices: 'claude:input' },
        options: [
          { label: PROMPT, steps: [firstPrompt, ...steps.slice(start + 1, allow)] },
          {
            label: '建立一個檔案',
            steps: [
              on({ user: '建立一個檔案' }),
              on({ thinking: true, ms: 1300 }),
              on({ say: '你沒有說檔名和內容，我先用 hello.txt，寫一句問候。不合適可以拒絕。', narration: '沒說檔名和內容，Claude 只好自己猜。所以指令要講清楚，也要看它打算做什麼。' }),
              ...confirm,
            ],
          },
          {
            label: '幫我打個招呼',
            steps: [
              on({ user: '幫我打個招呼' }),
              on({ thinking: true, ms: 1300 }),
              on({ say: '哈囉！如果要我建立檔案，請告訴我檔名和內容。', narration: 'Claude 只回了一句話，沒有建立檔案，因為你沒有這樣要求。我們講清楚再試一次。' }),
              on({ user: PROMPT }),
              on({ thinking: true, ms: 1000 }),
              on({ say: '好的，我會在目前的資料夾建立 hello.txt。' }),
              ...confirm,
            ],
          },
        ],
        skip: { label: '先看示範', steps: [firstPrompt, ...steps.slice(start + 1, allow)] },
      },
      {
        checkpoint: 'Claude 想建立檔案，你要允許嗎？',
        body: '按下去之前先看三件事：哪個檔案、在哪個資料夾、內容是什麼。',
        id: 'create',
        stage: { focus: 'claude:ask' },
        options: [
          { label: '允許一次', target: 'claude:option:1', steps: [on({ choose: 1, narration: '三件事都沒問題，選「允許一次」。' }), ...created] },
          {
            label: '拒絕',
            target: 'claude:option:0',
            steps: [
              on({ choose: 0, narration: '你拒絕了，它就不會動手。這個練習還需要這個檔案，我們再請它建立一次。' }),
              on({ say: '好的，我不會建立這個檔案。' }),
              on({ user: PROMPT }),
              on({ thinking: true, ms: 1000 }),
              on({ say: '好的，我會在目前的資料夾建立 hello.txt。' }),
              steps[askAt],
              on({ choose: 1, narration: '這次允許。' }),
              ...created,
            ],
          },
          { label: '一律允許', target: 'claude:option:2', steps: [on({ choose: 2, narration: '一律允許之後，同類的動作它就不會再問你。剛開始學，建議每次都先確認。' }), ...created] },
        ],
        skip: { label: '先看示範', steps: steps.slice(allow, practice) },
      },
      ...steps.slice(practice, reject),
      {
        checkpoint: 'Claude 想刪除檔案，你要允許嗎？',
        body: '這次是刪除。想一想：這個動作做了還能復原嗎？',
        id: 'delete',
        stage: { focus: 'claude:ask' },
        options: [
          {
            label: '拒絕',
            target: 'claude:option:0',
            steps: [on({ choose: 0, narration: '對，刪除檔案這種動作，先停下來確認再說。' }), ...steps.slice(refuseSay, recap), card],
          },
          { label: '允許一次', target: 'claude:option:1', steps: allowedDelete(1, '你允許了，它就真的動手刪除。') },
          { label: '一律允許', target: 'claude:option:2', steps: allowedDelete(2, '一律允許之後，它再刪除檔案也不會問你，所以刪除這種動作不要選這個。') },
        ],
        skip: { label: '先看示範', steps: steps.slice(reject) },
      },
    ] as ScriptStep[],
  }
}
