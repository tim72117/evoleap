// 情境開場的簡版預覽腳本：把單課資料的 opening 轉成只用舞台字卡的即時教學腳本（src/live）。
// 正式的開場會用人物、聊天畫面、紙條等演員演出；這裡先用字卡與旁白（字幕）檢查節奏與內容。
import type { CourseLesson } from '../../content/lessonTypes'
import type { ScriptStep, StageScript } from '../../live/types'

/** 分鏡摘要切成一句一張字卡（以「。」「；」斷句，保留標點；句號後面的右引號、右括號跟著前一句） */
export function sceneBeats(scene: string): string[] {
  return (scene.match(/[^。；]+(?:[。；][」』）)]*)?/g) ?? []).map((s) => s.trim()).filter(Boolean)
}

export function openingScript(course: CourseLesson): StageScript {
  const { scene, pain, task, payoff } = course.opening
  const beats = sceneBeats(scene)
  const steps: ScriptStep[] = [
    ...beats.map((b, i) => ({
      card: b,
      eyebrow: `情境 · ${i + 1}／${beats.length}`,
      narration: b,
      ...(i === 0 ? { chapter: '情境開場' } : {}),
    })),
    { card: pain, eyebrow: '痛點', narration: pain },
    { card: task, eyebrow: '這一課的任務', narration: `這一課的任務：${task}`, chapter: '任務卡' },
    { card: payoff, eyebrow: '回到情境（課程最後）', narration: payoff, chapter: '回到情境' },
  ]
  // 舞台要求至少一個演員；簡版只用字卡，放一個不出場的演員
  const cast = { idle: { actor: 'finder', props: { tree: { practice: {} }, open: 'practice' }, hidden: true } }
  return { title: `${course.id} 情境開場（簡版預覽）`, lesson: course.id, cast, steps }
}
