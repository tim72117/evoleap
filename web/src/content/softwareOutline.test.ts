import { describe, expect, it } from 'vitest'
import { seedCourse } from './courseSeed'
import { SOFTWARE_LESSON_IDS, SOFTWARE_OUTLINE } from './softwareOutline'

// 執行期主程式只帶這份小骨架,不帶整份種子;這裡保證兩者一致
describe('SOFTWARE_OUTLINE 與種子(courses_seed.json)一致', () => {
  const seed = seedCourse('software')
  it('階段 id、名稱、先不公開占位、課號與順序都一樣', () => {
    expect(SOFTWARE_OUTLINE).toEqual(seed.units.map((u) => ({ id: u.id, label: u.label, ...(u.hidden ? { hidden: true } : {}), lessons: u.lessons.map((l) => l.id) })))
  })
  it('SOFTWARE_LESSON_IDS 是全部課號', () => {
    expect(SOFTWARE_LESSON_IDS).toEqual(seed.units.flatMap((u) => u.lessons.map((l) => l.id)))
  })
})
