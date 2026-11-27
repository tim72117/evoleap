// 執行:node --test scripts/lib/voice.test.mjs(不呼叫任何 API)
import assert from 'node:assert/strict'
import test from 'node:test'
import { addLevels, levelsOf, rmsFrames } from './levels.mjs'
import { isHandEdited, narrationLines, reusableClip } from './narrationLines.mjs'

const script = {
  steps: [
    { narration: '甲', checkpoint: '點', id: 'a', demoNarration: { x: '示範一', y: '示範二' }, options: [{ steps: [{ narration: '回應' }] }], skip: { steps: [{ narration: '略過' }] } },
    { narration: '甲' },
    { demo: [{ cue: 'x', narration: '清單一' }, { cue: 'y' }, { cue: 'z', say: '清單二' }] },
  ],
}

test('收集步驟、互動點回應與示範台詞', () => {
  const want = ['甲', '示範一', '示範二', '回應', '略過', '清單一', '清單二']
  assert.deepEqual(narrationLines(script), want)
  assert.deepEqual(new Set(narrationLines(script, { kids: true })), new Set([...want, '點']))
})

test('互動示範的扁平清單:只收 say,順序照清單', () => {
  const demo = [{ id: 'a-1', segment: 'a', section: 1, say: '一', do: { go: true, at: 5 } }, { id: 'a-2', ms: 100 }, { id: 'b-1', segment: 'b', reset: false, say: '二' }]
  assert.deepEqual(narrationLines({ steps: [{ id: 'p', checkpoint: '點', narration: '一', demo }] }), ['一', '二'])
})

test('老師開場', () => {
  assert.deepEqual(narrationLines({ teacher: { line: '這一課' }, steps: [] }, { teacher: { greeting: '嗨' } }), ['嗨', '這一課'])
})

test('同一個音檔的舊項目整個沿用(手動改短的 ms 保留)', () => {
  const old = { 甲: { file: 'l0/a.mp3', ms: 100, levels: '9' } }
  assert.equal(reusableClip('甲', 'l0/a.mp3', old, { 'l0/a.mp3': { file: 'l0/a.mp3', ms: 999 } }), old.甲)
  assert.equal(reusableClip('甲', 'l0/b.mp3', old, {}), undefined)
})

test('剪短後掛到改短句子上的項目要沿用;聲音設定改了則重錄', () => {
  const cfg = { model: 'm', voice: 'v', style: 's' }
  const clip = { file: 'l0/0123456789ab.mp3', ms: 100 }
  const ctx = { manifest: cfg, cfg, prefix: 'l0', ownFiles: ['l0/ffffffffffff.mp3'] }
  const edited = (c) => isHandEdited(c, ctx)
  assert.equal(reusableClip('甲', 'l0/ffffffffffff.mp3', { 甲: clip }, {}, edited), clip)
  assert.equal(isHandEdited(clip, { ...ctx, cfg: { ...cfg, voice: '別的' } }), false)
  assert.equal(isHandEdited(clip, { ...ctx, ownFiles: [clip.file] }), false)
  assert.equal(isHandEdited({ file: 'l0/0123456789ab-01234567.mp3' }, ctx), false)
})

test('levels:0..9、已有的保留、依 ms 截短', async () => {
  assert.equal(rmsFrames(new Int16Array(1000).fill(10)).length, 3)
  assert.deepEqual(levelsOf({ a: [0, 100, 100] }), { a: '099' })
  const clips = { 舊: { file: 'a', ms: 100, levels: '12' }, 新: { file: 'b', ms: 100 } }
  const opts = { ffmpeg: () => true, decodePcm: () => new Int16Array(1600).fill(1000) }
  const out = await addLevels(clips, async () => null, opts)
  assert.equal(out.舊, clips.舊)
  assert.equal(out.新.levels, '99')
  const warned = []
  assert.equal(await addLevels(clips, async () => null, { ffmpeg: () => false, warn: (m) => warned.push(m) }), clips)
  assert.equal(warned.length, 1)
})
