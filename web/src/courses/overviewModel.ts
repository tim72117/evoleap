// 課程總覽頁的版面邏輯(純函式,CourseOverviewPage 照這裡的結果畫):內容全部來自資料庫的課程地圖(GET /api/courses/{id}/map),
// 不分課程只有一條路:單元就是一組(跳過先不公開的),每個單元都有 #stage-<單元 id> 的錨點;整門課都還沒有課(例如進階)時,單元本身當成規劃中的項目列出。
import { lessonLabel, lessonUrl, plannedChapterPath, plannedLabel, plannedSlug, type Course } from '../content/catalog'
import { stageAnchor } from '../content/levels'
import type { CourseArtKind, CourseMap, MapLesson, MapUnit } from '../content/courseMap'

/** 課程沒有設定插圖時用的 */
export const DEFAULT_ART: CourseArtKind = 'tools'

export const artOf = (map: Pick<CourseMap, 'art'>): CourseArtKind => map.art || DEFAULT_ART

/** 單元在課程頁上的位置:每個單元一個錨點(#stage-<單元 id>) */
export const unitAnchor = stageAnchor

/** 單元標題:有簡短名稱(label,例如起步)是「起步・AI 工具介紹」(單元標題「起步・AI 工具介紹:說明」只取冒號前),沒有就是單元標題 */
export function unitGroupTitle(u: Pick<MapUnit, 'title' | 'label'>): string {
  if (!u.label) return u.title
  const rest = u.title.startsWith(`${u.label}・`) ? u.title.slice(u.label.length + 1) : u.title
  return `${u.label}・${rest.split('：')[0]}`
}

/** 一課連得過去的網址:有腳本、而且開放(管理員另外拿得到草稿)的課連到課程頁,網址規則見 lessonUrl;其他(規劃中)不連 */
export function lessonLink(courseSlug: string, l: Pick<MapLesson, 'id' | 'status' | 'script'>): string | null {
  return l.script && (l.status === 'open' || l.status === 'draft') ? lessonUrl(courseSlug, l.id) : null
}

export type OverviewGroup = {
  /** 單元 id(整門課規劃中的項目列表是 'planned') */
  id: string
  /** 頁內位置;規劃中的項目列表沒有 */
  anchor?: string
  title: string
  subtitle?: string
  lessons: MapLesson[]
  /** 這一組的每一列是規劃中的單元(整門課還沒有課) */
  plannedUnits?: boolean
}

/**
 * 課程總覽的分組:跳過先不公開(hidden)的單元,其餘單元各一組;
 * 公開的單元底下都還沒有課時,單元本身當成規劃中的項目,合成一組(組名是課程名稱)。
 */
export function overviewGroups(map: Pick<CourseMap, 'title' | 'access' | 'units'>): OverviewGroup[] {
  const units = map.units.filter((u) => !u.hidden)
  if (units.every((u) => u.lessons.length === 0)) {
    if (units.length === 0) return []
    return [
      {
        id: 'planned',
        title: map.title,
        plannedUnits: true,
        lessons: units.map((u) => ({ id: u.id, title: u.title, summary: u.subtitle, access: map.access, status: 'planned' as const })),
      },
    ]
  }
  return units.map((u) => ({ id: u.id, anchor: unitAnchor(u.id), title: unitGroupTitle(u), subtitle: u.subtitle || undefined, lessons: u.lessons }))
}

/**
 * 一列的連結:資料庫說開放(或草稿)且有腳本的課連到課程頁;規劃中的課,做出自己的軟體(每個種子課都有路由,沒開放的是規劃中章節頁)也連到單課網址。
 * 整門課規劃中的單元列表(plannedUnits)連到那個單元的規劃中章節頁。
 */
export function rowLink(course: Pick<Course, 'slug' | 'planned' | 'staged'>, group: OverviewGroup, l: MapLesson): string | null {
  if (group.plannedUnits) {
    // 這一列就是那個單元(隱藏或重排後列的順序和章節清單不一定對得上)
    return course.planned.includes(l.id) ? plannedChapterPath(course as Course, { slug: plannedSlug(l.id) }) : null
  }
  const to = lessonLink(course.slug, l)
  if (to) return to
  return course.staged && l.status === 'planned' ? lessonUrl(course.slug, l.id) : null
}

/** 開始學習:第一個已經開放而且連得過去的課;沒登入時先找不用登入就能看的課(免得一點就是登入畫面)。都沒有就不顯示 */
export function startLesson(courseSlug: string, groups: OverviewGroup[], guest: boolean): MapLesson | undefined {
  const playable = groups.filter((g) => !g.plannedUnits).flatMap((g) => g.lessons).filter((l) => l.status === 'open' && lessonLink(courseSlug, l))
  return (guest && playable.find((l) => l.access === 'free')) || playable[0]
}

/**
 * 課號的顯示文字:做出自己的軟體(分階段的課)是「序章」「第 1 課」(lessonLabel),整門課規劃中的單元是規劃中章節的編號(主題 1),
 * 其他課是資料庫的課號(1.2)
 */
export function rowLabel(course: Pick<Course, 'planned' | 'staged'>, group: OverviewGroup, l: MapLesson): string {
  if (group.plannedUnits) return course.planned.includes(l.id) ? plannedLabel(l.id) : l.id
  if (!course.staged) return l.id
  return lessonLabel(l)
}
