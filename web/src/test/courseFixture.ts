// 前端測試用的假課程資料(形狀同 GET /api/courses/{id}/map),名稱都是假字,只放測試用得到的情境:
// 軟體課的三個階段(零基礎不公開)、有兩個以上單元的課、沒有課的單元、開放/草稿/規劃中。
// Go 測試與 e2e 的資料另外寫在 server/internal/store/fixture。
export type SeedLesson = { id: string; title: string; summary: string; access?: string; status: 'open' | 'draft' | 'planned'; script?: string }
export type SeedUnit = { id: string; title: string; subtitle: string; label?: string; hidden?: boolean; lessons: SeedLesson[] }
export type SeedCourse = { id: string; title: string; access: string; units: SeedUnit[] }

type Status = SeedLesson['status']
const lesson = (course: string, id: string, status: Status = 'open', script: string | undefined = `${course}/${id}.json`): SeedLesson => ({
  id,
  title: `測試單課 ${course}/${id}`,
  summary: `測試：${course}/${id}`,
  status,
  ...(status === 'planned' ? {} : { script }),
})
const unit = (id: string, lessons: SeedLesson[], extra: Partial<SeedUnit> = {}): SeedUnit => ({ id, title: `測試單元 ${id}`, subtitle: '', lessons, ...extra })
const course = (id: string, title: string, units: SeedUnit[]): SeedCourse => ({ id, title, access: 'login-free', units })

export const FIXTURE_COURSES: SeedCourse[] = [
  course('software', '測試課一', [
    unit('tools', [lesson('software', '0.intro'), lesson('software', '0.0'), lesson('software', '0.1'), lesson('software', '0.2'), lesson('software', '0.3')], { title: '起步・測試單元甲', label: '起步' }),
    unit('ai-tools', [lesson('software', '1.0'), lesson('software', '3.3', 'planned')], { title: '零基礎・測試單元乙', label: '零基礎', hidden: true }),
    unit('vibe-coding-basics', [lesson('software', '5.2', 'planned')], { title: '基礎・測試單元丙', label: '基礎' }),
  ]),
  course('advanced', '測試課三', [unit('1', []), unit('2', [])]),
  course('web', '測試課四', [
    unit('0', [lesson('web', '0.1'), lesson('web', '0.2')]),
    unit('1', [lesson('web', '1.1'), lesson('web', '1.2'), lesson('web', '1.3', 'draft')]),
  ]),
  course('launch', '測試課五', [unit('0', [lesson('launch', '0.1')]), unit('3', [lesson('launch', '3.1', 'planned')])]),
  course('claude-code', '測試課六', [unit('0', [lesson('claude-code', '1'), lesson('claude-code', '3', 'planned')])]),
  course('kids', '測試課七', [unit('0', [lesson('kids', '0.1')])]),
]

export function fixtureCourse(id: string): SeedCourse {
  const c = FIXTURE_COURSES.find((x) => x.id === id)
  if (!c) throw new Error(`測試資料沒有課程 ${id}`)
  return c
}
