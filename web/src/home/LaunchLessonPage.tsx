import { useEffect, useMemo, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { useCourseMap, type MapLesson } from '../content/courseMap'
import { launchLesson } from '../content/launchCourse'
import { LAUNCH_TOPIC } from '../content/topics'
import { PageView } from '../courses/guestActivity'
import { LoginGate } from '../courses/LoginGate'
import { clearGuestProgress, memberProgress } from '../courses/progress'
import { documentTitle } from '../site/siteInfo'
import { SiteLayout } from '../site/SiteLayout'
import { InteractiveScenePage } from '../studio/interactive/InteractiveScenePage'
import styles from '../studio/interactive/InteractiveScenePage.module.css'
import page from './SoftwareTopicPage.module.css'
import { lessonPath } from './CourseMapUnits'

// 「從做好到上線」的一課(/topics/launch/0-1,LAUNCH_LESSON_PAGES 裡的課才有頁面):整個視窗都是互動舞台(InteractiveScenePage,和「網頁怎麼運作」的課程頁同一個外殼)。
// 能不能上、播哪個腳本都看課程地圖 API(GET /api/courses/launch/map)回傳的 status 與 script,
// 所以草稿(draft)只有管理員進得來,其他人看到「還沒開放」;API 讀不到時另外提示,可以重新載入。
// 免費預覽(access free)的課不用登入,其他要登入(LoginGate);播放進度只有登入的會員才記。
// 追蹤:打開課程頁由 InteractiveScenePage 記 live:<腳本>;看到提示頁的訪客記 page:<網址>(PageView),後台看得出有人想上還沒開放的課。
// 注意:腳本檔仍打包在公開的 JS 裡(src/content/live/launch/),這個閘口只擋課程頁,不是保密。

export function LaunchLessonPage({ id }: { id: string }) {
  const { status: auth } = useAuth()
  const map = useCourseMap('launch')
  const title = launchLesson(id)?.title ?? id
  // 等登入狀態確定後才判斷,免得管理員先閃過「還沒開放」
  if (map.status === 'loading' || auth === 'loading') return null
  // 讀不到不代表課沒開放(資料庫或網路暫時有問題),不要說成還沒開放
  if (map.status === 'error') {
    return (
      <Notice id={id} title={title} message="暫時讀不到課程資料，請稍後再試一次。">
        <button type="button" className={page.primary} onClick={() => location.reload()}>
          重新載入
        </button>
      </Notice>
    )
  }

  const playable: MapLesson[] = map.map.units.flatMap((u) => u.lessons).filter((l) => (l.status === 'open' || l.status === 'draft') && l.script)
  const lesson = playable.find((l) => l.id === id)
  if (!lesson) {
    return (
      <Notice id={id} title={title} message="這一課還沒開放，完成後會出現在課程地圖上。">
        <Link className={page.primary} to={{ pathname: LAUNCH_TOPIC.path, hash: 'map' }}>
          回課程地圖
        </Link>
      </Notice>
    )
  }
  const index = playable.indexOf(lesson)
  const player = <Player lesson={lesson} script={lesson.script!} title={title} prev={playable[index - 1]} next={playable[index + 1]} />
  if (lesson.access === 'free') return player
  return (
    <LoginGate
      key={id}
      kicker={`${LAUNCH_TOPIC.name} · ${id}`}
      title={title}
      docTitle={`${title}｜${LAUNCH_TOPIC.name}`}
      back={{ to: LAUNCH_TOPIC.path, label: '回課程地圖' }}
      note="第一課可以直接預覽，之後的課程要登入才能觀看。登入後也會記錄你的播放進度。"
    >
      {player}
    </LoginGate>
  )
}

function Player({ lesson, script, title, prev, next }: { lesson: MapLesson; script: string; title: string; prev?: MapLesson; next?: MapLesson }) {
  const { status, user } = useAuth()
  const memberId = user?.id ?? null
  const { pathname } = useLocation()
  const progress = useMemo(() => (memberId ? memberProgress(`live:${script}`) : undefined), [memberId, script])
  useEffect(() => {
    if (status !== 'loading' && !memberId) clearGuestProgress()
  }, [status, memberId])
  const heading = lesson.status === 'draft' ? `${title}（草稿）` : title
  return (
    <InteractiveScenePage
      key={`${lesson.id}:${memberId ?? 'guest'}`}
      script={script}
      pageTitle={heading}
      interaction="static"
      course={{
        docTitle: documentTitle(`${title}｜${LAUNCH_TOPIC.name}`),
        heading,
        back: { to: LAUNCH_TOPIC.path, label: '← 課程地圖' },
        progress,
        ready: status !== 'loading',
        footer: (
          <>
            {status === 'guest' && (
              <p className={styles.panelLogin}>
                <Link to={loginHref(pathname)}>登入</Link>後會記住你看到哪裡，下次從這裡接著看。
              </p>
            )}
            <nav className={styles.panelFooter} aria-label="上一課與下一課">
              {prev ? <Link to={lessonPath(LAUNCH_TOPIC.path, prev.id)}>← 上一課：{prev.id}</Link> : <span />}
              {next ? <Link to={lessonPath(LAUNCH_TOPIC.path, next.id)}>下一課：{next.id} →</Link> : <Link to={`${LAUNCH_TOPIC.path}#map`}>課程地圖 →</Link>}
            </nav>
          </>
        ),
      }}
    />
  )
}

function Notice({ id, title, message, children }: { id: string; title: string; message: string; children: ReactNode }) {
  return (
    <PageView>
      <SiteLayout title={`${title}｜${LAUNCH_TOPIC.name}`}>
        <section className={page.hero}>
          <div className={page.heroInner}>
            <p className={page.kicker}>
              {LAUNCH_TOPIC.name} · {id}
            </p>
            <h1>{title}</h1>
            <p className={page.pitch}>{message}</p>
            <div className={page.ctas}>{children}</div>
          </div>
        </section>
      </SiteLayout>
    </PageView>
  )
}
