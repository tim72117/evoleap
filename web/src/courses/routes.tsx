import type { JSX } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { COURSES, coursePath, courseMapId, lessonUrl, plannedChapterPath, plannedLabel, plannedSlug, type Course, type PlannedChapter } from '../content/catalog'
import { useCourseMap, useCourseName, useLessonTitle } from '../content/courseMap'
import { lessonDocTitle, lessonKicker, lessonLabelOf } from '../content/lessonDisplay'
import { CourseListPage } from './CourseListPage'
import { CourseOverviewPage } from './CourseOverviewPage'
import { CLAUDE_CODE_ANCHORS, COURSE_LIST, TOPIC_PATHS } from '../content/topics'
import { stageAnchor } from '../content/levels'
import { useKidsMode } from '../kidsMode/KidsModeContext'
import { KidsSchedulePanel } from '../kidsMode/KidsSchedulePanel'
import { useT } from '../i18n/I18nProvider'
import { lazyPage } from '../site/lazyPage'
import { safeDecodeURIComponent } from '../site/safeDecode'
import { NotFoundPage } from '../site/NotFoundPage'
import { SiteLayout } from '../site/SiteLayout'
import { LessonListStatus } from './LessonGroup'
import { PageView } from './guestActivity'
import { LessonGate } from './LessonGate'
import { PlannedChapterPage } from './PlannedPages'
import { LessonRoute } from './LessonRoute'

// 上課頁(播放器、舞台引擎與演員)用到才下載,不放進課程總覽、課程地圖就要下載的主程式
const InteractiveLessonPage = lazyPage(() => import('./InteractiveLessonPage').then((m) => m.InteractiveLessonPage))

/** 課程地圖還在讀、讀不到時的單課頁:一張佔位卡或「無法讀取」(不用前端寫死的課程資料頂替) */
function LessonInfoStatus({ state }: { state: 'loading' | 'error' }) {
  return (
    <SiteLayout title={null}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px', minHeight: '60vh' }}>
        <LessonListStatus state={state} />
      </div>
    </SiteLayout>
  )
}

/**
 * 還沒開放的單課:規劃中的章節頁(不載入播放器);同一個單元的規劃中章節互為上一章、下一章。
 * 課名、一句話與哪些課還在規劃中都照課程地圖 API(LessonGate 擋下時地圖已讀好);地圖裡沒有這一課時只顯示課號
 */
function PlannedLesson({ course, id }: { course: Course; id: string }) {
  const state = useCourseMap(courseMapId(course))
  const unit = state.status === 'ready' ? state.map.units.find((u) => u.lessons.some((l) => l.id === id)) : undefined
  // 麵包屑的階段名稱:這一課在地圖上的單元(階段)
  const level = unit?.label || unit?.title
  const chapters: PlannedChapter[] = (unit?.lessons ?? []).map((l) => ({ slug: lessonUrl(course.slug, l.id).split('/').pop()!, label: l.id, id: l.id, level, title: l.title, summary: l.summary }))
  const chapter = chapters.find((c) => c.id === id) ?? { slug: lessonUrl(course.slug, id).split('/').pop()!, label: id, id, title: id, summary: '' }
  // 規劃中章節與 chapters 是同一批物件(PlannedChapterPage 用它在清單裡的位置找上一章、下一章)
  const planned = chapters.filter((_, i) => unit!.lessons[i].status === 'planned')
  return <PlannedChapterPage course={course} chapter={chapter} siblings={planned} />
}

/** 進階課的規劃中章節:名稱讀資料庫的單元;讀取中顯示佔位卡,讀不到或資料庫沒有這個單元顯示「無法讀取」 */
function PlannedUnit({ course, unitId }: { course: Course; unitId: string }) {
  const state = useCourseMap(courseMapId(course))
  const t = useT()
  if (state.status !== 'ready') return <LessonInfoStatus state={state.status} />
  const chapters: PlannedChapter[] = course.planned.flatMap((id) => {
    const unit = state.map.units.find((u) => u.id === id)
    // 先不公開的單元不列進前後章(直接打開自己的網址仍看得到)
    if (!unit || (unit.hidden && id !== unitId)) return []
    return [{ slug: plannedSlug(id), label: plannedLabel(id), title: unit.title, summary: t.courses.plannedPages.unitSummary(state.map.title, unit.title) }]
  })
  const chapter = chapters.find((c) => c.slug === plannedSlug(unitId))
  // 地圖讀到了但沒有這個單元(刪掉了):和 server 的 404 一致
  if (!chapter) return <NotFoundPage />
  const hidden = state.map.units.find((u) => u.id === unitId)?.hidden
  return <PlannedChapterPage course={course} chapter={chapter} siblings={hidden ? [chapter] : chapters} />
}

/**
 * 軟體課單課頁的把關(LessonGate,和主題課同一份規則,照課程地圖 API):open 或 draft(草稿只有管理員拿得到)而且有腳本才給看,
 * free 直接給看,其他要登入;讀取中顯示佔位卡、讀不到顯示「無法讀取」;地圖沒有這一課、還沒開放或還沒有腳本顯示規劃中的章節頁。
 * 路由是參數化的(LessonRoute),CLI 新增課、改狀態都不用重新 build;課名也讀 API。文字在渲染時取目前語言(路由表是模組層級建好的)。
 */
function CourseLessonGate({ course, id }: { course: Course; id: string }) {
  const t = useT().courses
  const title = useLessonTitle(courseMapId(course))(id)
  const label = lessonLabelOf(course.slug, id)
  const courseName = useCourseName(courseMapId(course))
  return (
    <LessonGate
      course={courseMapId(course)}
      id={id}
      requireScript
      login={{ kicker: lessonKicker(courseName, label), title, docTitle: lessonDocTitle(title, courseName), back: { to: coursePath(course), label: t.backToOverview }, note: t.gate.note }}
      blocked={(reason) => (reason === 'closed' ? <PlannedLesson course={course} id={id} /> : <LessonInfoStatus state={reason} />)}
    >
      {(mapLesson, prev, next) => <InteractiveLessonPage key={mapLesson.id} course={course} lesson={mapLesson} prev={prev} next={next} />}
    </LessonGate>
  )
}

/** 分階段的軟體課的單課路由:/courses/software/:lesson,網址規則見 lessonUrl */
function softwareLessonRoute(course: Course): { path: string; element: JSX.Element } {
  return { path: `${coursePath(course)}/:lesson`, element: <LessonRoute course={course} render={(id) => <CourseLessonGate course={course} id={id} />} /> }
}

/**
 * 舊網址(三門課合併成「做出自己的軟體」之前):/courses/tools、/courses/ai-tools、/courses/vibe-coding 與底下的單課頁。
 * 伺服器(server/cmd/server/static.go 的 legacyCourseRedirects)直接 301,這裡讓站內舊連結、網頁內導覽也走新網址。單課的網址 slug 沒變,換掉前綴即可。
 */
export const LEGACY_COURSES: { slug: string; stage: string }[] = [
  { slug: 'tools', stage: 'tools' },
  { slug: 'ai-tools', stage: 'ai-tools' },
  { slug: 'vibe-coding', stage: 'vibe-coding-basics' },
]
function LegacyStageRedirect({ stage }: { stage: string }) {
  const { search } = useLocation()
  return <Navigate replace to={{ pathname: '/courses/software', search, hash: stageAnchor(stage) }} />
}
function LegacyLessonRedirect() {
  const { lesson } = useParams()
  const { search, hash } = useLocation()
  return <Navigate replace to={{ pathname: `/courses/software/${lesson}`, search, hash }} />
}

/** 舊網址(網頁怎麼運作、從做好到上線搬進課程頁之前):/topics/web、/topics/launch 與底下的單課頁(/topics/web/1-2)。伺服器同樣 301;單課網址的課號段沒變 */
function LegacyOverviewRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation()
  return <Navigate replace to={{ pathname: to, search, hash }} />
}
function LegacyWebLessonRedirect() {
  const { lesson } = useParams()
  const { search, hash } = useLocation()
  return <Navigate replace to={{ pathname: `/courses/web/${lesson}`, search, hash }} />
}

/** 舊網址 /topics/kids 與底下的單課頁(/topics/kids/0-1) */
function LegacyKidsLessonRedirect() {
  const { lesson } = useParams()
  const { search, hash } = useLocation()
  return <Navigate replace to={{ pathname: `/courses/kids/${lesson}`, search, hash }} />
}

/** 舊網址 /topics/launch 與底下的單課頁(/topics/launch/1-2) */
function LegacyLaunchLessonRedirect() {
  const { lesson } = useParams()
  const { search, hash } = useLocation()
  return <Navigate replace to={{ pathname: `/courses/launch/${lesson}`, search, hash }} />
}

/**
 * 舊的 Claude Code 工作術 /topics/claude-code:一頁列出所有情境、影片錨點(#remote、#fork)展開那一段。
 * 現在是課程總覽加上一個情境一頁:伺服器 301 到 /courses/claude-code(瀏覽器會保留 #錨點),這裡再看錨點,
 * 是某段影片的錨點就轉到那個情境的課頁(/courses/claude-code/2#remote),其他錨點(#scenarios 等)留在總覽頁。
 */
export function claudeCodeAnchorTarget(hash: string): string | undefined {
  const anchor = safeDecodeURIComponent(hash.replace(/^#/, ''))
  const id = Object.hasOwn(CLAUDE_CODE_ANCHORS, anchor) ? CLAUDE_CODE_ANCHORS[anchor] : undefined
  return id && `${lessonUrl('claude-code', id)}#${anchor}`
}
export function LegacyClaudeCodeRedirect() {
  const { search, hash } = useLocation()
  const target = claudeCodeAnchorTarget(hash)
  if (target) return <Navigate replace to={target} />
  return <Navigate replace to={{ pathname: '/courses/claude-code', search, hash: hash === '#scenarios' ? '#map' : hash }} />
}

/** /courses/claude-code#remote(伺服器轉址後保留了舊錨點)也轉到那個情境的課頁 */
function ClaudeCodeOverview({ course }: { course: Course }) {
  const { pathname, search, hash } = useLocation()
  const target = claudeCodeAnchorTarget(hash)
  if (target) return <Navigate replace to={target} />
  // 舊的 #scenarios(情境清單)現在是總覽頁的課程內容 #map
  if (hash === '#scenarios') return <Navigate replace to={{ pathname, search, hash: '#map' }} />
  return <CourseOverviewPage course={course} />
}

/** 兒童模式:/courses/kids 只有家長安排好的這週的課(不介紹課程、不放課程地圖);其他人看共用的課程總覽 */
function KidsOverview({ course }: { course: Course }) {
  const { mode } = useKidsMode()
  const state = useCourseMap(courseMapId(course))
  if (mode?.active) {
    return (
      <SiteLayout title={state.status === 'ready' ? state.map.seoTitle || state.map.title : null}>
        <KidsSchedulePanel mode={mode} />
      </SiteLayout>
    )
  }
  return <CourseOverviewPage course={course} />
}

/** 舊網址的轉址路由:不是頁面(沒有 SEO 資料、不進 sitemap),所以不放進 courseRoutes(App.tsx 另外掛上) */
export const legacyCourseRoutes: { path: string; element: JSX.Element }[] = [
  ...LEGACY_COURSES.flatMap((lc) => [
  { path: `/courses/${lc.slug}`, element: <LegacyStageRedirect stage={lc.stage} /> },
  { path: `/courses/${lc.slug}/:lesson`, element: <LegacyLessonRedirect /> },
  ]),
  { path: '/topics/web', element: <LegacyOverviewRedirect to="/courses/web" /> },
  { path: '/topics/web/:lesson', element: <LegacyWebLessonRedirect /> },
  { path: '/topics/launch', element: <LegacyOverviewRedirect to="/courses/launch" /> },
  { path: '/topics/launch/:lesson', element: <LegacyLaunchLessonRedirect /> },
  { path: '/topics/claude-code', element: <LegacyClaudeCodeRedirect /> },
  { path: '/topics/kids', element: <LegacyOverviewRedirect to="/courses/kids" /> },
  { path: '/topics/kids/:lesson', element: <LegacyKidsLessonRedirect /> },
  // AI Agent 中階課沒有自己的頁面(課程介紹在主題頁):/courses/ai-agent 與底下的單元頁都轉到主題頁
  { path: '/courses/ai-agent', element: <LegacyOverviewRedirect to={TOPIC_PATHS.aiApps} /> },
  { path: '/courses/ai-agent/:chapter', element: <LegacyOverviewRedirect to={TOPIC_PATHS.aiApps} /> },
]


/** 總覽頁原本是主題頁的課(網頁怎麼運作、從做好到上線、Claude Code 工作術):訪客打開時照樣記一筆 page:<網址> */
const PAGE_VIEW_COURSES = new Set(['web', 'launch', 'claude-code', 'kids'])

// 依 catalog.ts 產生每門課的總覽頁、規劃中章節頁的路由,和軟體課的單課路由(其他課的單課路由在 home/routes.tsx)。
export const courseRoutes: { path: string; element: JSX.Element }[] = [
  { path: COURSE_LIST.path, element: <CourseListPage /> },
  ...COURSES.flatMap((course) => [
  {
          path: coursePath(course),
          // 課頁在別處的課(網頁怎麼運作、從做好到上線、Claude Code 工作術)原本是主題頁,訪客打開時照樣記一筆 page:<網址>(後台「從首頁進來的路徑」)
          element: PAGE_VIEW_COURSES.has(course.slug) ? (
            <PageView>{course.slug === 'claude-code' ? <ClaudeCodeOverview course={course} /> : course.slug === 'kids' ? <KidsOverview course={course} /> : <CourseOverviewPage course={course} />}</PageView>
          ) : (
            <CourseOverviewPage course={course} />
          ),
  },
  ...(course.staged ? [softwareLessonRoute(course)] : []),
  ...course.planned.map((id) => ({
    path: plannedChapterPath(course, { slug: plannedSlug(id) }),
    element: <PlannedUnit key={id} course={course} unitId={id} />,
  })),
]),
]
