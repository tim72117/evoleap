import { useCourseMap } from '../content/courseMap'
import { useAuth } from '../auth/AuthContext'
import { LessonGroup, LessonGroups, LessonListStatus } from '../courses/LessonGroup'
import { lessonPath } from './CourseMapUnits'

// 主題頁的課程地圖(單元 → 每一堂課),網頁怎麼運作與 launch 用:資料從資料庫讀(content/courseMap.ts,GET /api/courses/{id}/map)。
// 讀取中顯示佔位卡、讀不到顯示「無法讀取」(courses/LessonGroup.tsx 的 LessonListStatus),不用前端寫死的課程資料頂替。
// 一個單元一組,畫法與課程總覽頁的課程清單同一個元件(courses/LessonGroup.tsx)。兒童版是另一種畫法(CourseMapUnits)。
// 開放的課與草稿(只有管理員會拿到)整列連到課程頁(課號 0.1 → {topicPath}/0-1),規劃中的不連。

export function TopicCourseMap({ course, topicPath }: { course: string; topicPath: string }) {
  const { status } = useAuth()
  const map = useCourseMap(course)
  if (map.status !== 'ready') return <LessonListStatus state={map.status} />
  return (
    <LessonGroups>
      {map.map.units.map((unit) => (
        <LessonGroup
          key={unit.id}
          title={unit.title}
          subtitle={unit.subtitle}
          lessons={unit.lessons}
          pathOf={(l) => (l.status === 'open' || l.status === 'draft' ? lessonPath(topicPath, l.id) : null)}
          labelOf={(l) => l.id}
          guest={status === 'guest'}
        />
      ))}
    </LessonGroups>
  )
}
