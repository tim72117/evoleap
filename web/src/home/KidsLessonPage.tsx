import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KIDS_OPEN_LESSONS, kidsLessonTitle } from '../content/kidsCourse'
import { KIDS_TOPIC, kidsLessonDocTitle } from '../content/topics'
import { KidsPlayer } from '../kids/KidsPlayer'
import { useKidsMode } from '../kidsMode/KidsModeContext'
import { isLockedLesson, useKidsProgress } from '../kidsMode/progress'
import { slotLabel } from '../kidsMode/schedule'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import { documentTitle } from '../site/siteInfo'
import site from '../site/SiteLayout.module.css'
import own from './KidsTopicPage.module.css'
import { TopicLessonGate } from './TopicLessonGate'

// 兒童課的一課:整個視窗都是兒童版的互動播放器(沒有網站標頭與頁尾),給孩子自己上:大按鈕、不能跳過還沒回答的題目。
// 參考一般版的互動課程頁:「回課程地圖」浮在左上角,課名、「給家長」(打開一個說明框)與切換段落浮在右上角的側欄,可以收起來(手機、平板也一樣收在右上角);按鈕放大給孩子用。配色沿用網站的 --site-* 變數(套上 SiteLayout 的 .site)。
// 能不能上、播哪個腳本、要不要登入都照資料庫(TopicLessonGate);課名在 kidsCourse.ts,給家長的說明在 KIDS_OPEN_LESSONS。
// 有頁面的課(路由與 SEO)由 KIDS_OPEN_LESSONS 產生(routes.tsx、seo/pages.ts)。

export function KidsLessonPage({ id }: { id: string }) {
  const { mode } = useKidsMode()
  const progress = useKidsProgress(!!mode?.active)
  const t = useT()
  const m = t.home.kidsLesson
  // 兒童模式時段外:不載入播放器(伺服器也不會給腳本),直接告訴孩子下一堂什麼時候
  if (mode?.active && !mode.schedule.open) {
    const next = mode.schedule.next
    return (
      <SiteLayout title={kidsLessonDocTitle(id)} narrow>
        <section className={own.closed} role="status">
          <p className={own.closedIcon} aria-hidden="true">
            ⏰
          </p>
          <h1>{m.notYetTime}</h1>
          <p>{next ? m.nextSlot(slotLabel({ day: next.day, time: next.time as never }), kidsLessonTitle(id)) : m.noSchedule}</p>
          <Link className={own.closedBack} to={KIDS_TOPIC.path}>
            {m.backToMyLessons}
          </Link>
        </section>
      </SiteLayout>
    )
  }
  // 兒童模式:進度讀到之前先不載入播放器(免得還沒套上鎖頭就打開了;伺服器也會擋還沒到的課)
  if (mode?.active && !progress) {
    return (
      <SiteLayout title={kidsLessonDocTitle(id)} narrow>
        <section className={own.closed} role="status" aria-busy="true">
          <p>{m.preparing}</p>
        </section>
      </SiteLayout>
    )
  }
  // 兒童模式:還沒到的進度不能上(看完的與接下來要上的那一課才打得開)
  if (mode?.active && progress && isLockedLesson(progress, id)) {
    const next = progress.next
    return (
      <SiteLayout title={kidsLessonDocTitle(id)} narrow>
        <section className={own.closed} role="status">
          <p className={own.closedIcon} aria-hidden="true">
            🔒
          </p>
          <h1>{m.locked}</h1>
          <p>{next ? m.finishFirst(kidsLessonTitle(next)) : m.checkMap}</p>
          <Link className={own.closedBack} to={next ? KIDS_OPEN_LESSONS[next].path : KIDS_TOPIC.path}>
            {next ? m.goTo(kidsLessonTitle(next)) : m.backToMyLessons}
          </Link>
        </section>
      </SiteLayout>
    )
  }
  return (
    <TopicLessonGate
      course="kids"
      pages={Object.keys(KIDS_OPEN_LESSONS)}
      topic={KIDS_TOPIC}
      id={id}
      title={kidsLessonTitle(id)}
      docTitle={kidsLessonDocTitle(id)}
      loginNote={t.home.lesson.kidsLoginNote}
    >
      {(lesson) => <KidsLesson id={id} script={lesson.script!} />}
    </TopicLessonGate>
  )
}

function KidsLesson({ id, script }: { id: string; script: string }) {
  const parentsNotes = KIDS_OPEN_LESSONS[id]?.parents ?? []
  const [parents, setParents] = useState(false)
  // 切換段落放在右上角的側欄(各種寬度都一樣,手機、平板也收在右上角)
  const [side, setSide] = useState<HTMLElement | null>(null)
  // 段落面板一開始收起來,按「☰ 段落」才打開
  const [sideOpen, setSideOpen] = useState(false)
  const t = useT()
  const m = t.home.kidsLesson

  // 沒有 SiteLayout,頁面標題自己設(和 seo/pages.ts 一致)
  useEffect(() => {
    document.title = documentTitle(kidsLessonDocTitle(id))
  }, [id])

  const page = (
    <div className={`${site.site} ${own.whole}`} lang="zh-Hant">
      <main className={own.wholePlayer}>
        <KidsPlayer script={script} layout="page" floating chaptersSlot={side} track />
      </main>

      {/* 浮在左上角:回課程地圖(大按鈕,孩子點得到) */}
      <Link className={own.floatBack} to={KIDS_TOPIC.path}>
        {t.home.lesson.backToMap}
      </Link>

      {/* 浮在右上角的側欄:課名、給家長、這一課的段落(可以收起來) */}
      <aside className={own.side} data-open={sideOpen ? 'true' : 'false'} aria-label={m.thisLesson}>
        <div className={own.sideHead}>
          {/* 課名一直都在(頁面的標題);側欄收起來或窄螢幕時只是看不到 */}
          <h1 className={sideOpen ? undefined : own.srOnly}>
            <small>{id}</small>
            {kidsLessonTitle(id)}
          </h1>
          <div className={own.sideButtons}>
            <button type="button" className={own.bigButton} aria-expanded={parents} onClick={() => setParents(!parents)}>
              {m.forParents}
            </button>
            <button type="button" className={own.bigButton} aria-expanded={sideOpen} aria-label={sideOpen ? m.closeSections : m.openSections} onClick={() => setSideOpen(!sideOpen)}>
              {sideOpen ? m.closeButton : m.sectionsButton}
            </button>
          </div>
        </div>
        <div ref={setSide} hidden={!sideOpen} />
      </aside>

      {parents && (
        <div className={own.parentsLayer} role="dialog" aria-label={m.forParents} onClick={() => setParents(false)}>
          <section className={own.parentsCard} onClick={(e) => e.stopPropagation()}>
            <h2>{m.forParents}</h2>
            {parentsNotes.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <button type="button" className={own.bigButton} onClick={() => setParents(false)}>
              {m.gotIt}
            </button>
          </section>
        </div>
      )}
    </div>
  )
  return page
}
