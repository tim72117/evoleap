import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { WEB_OPEN_LESSONS, webLesson, webNeedsLogin } from '../content/webCourse'
import { WEB_TOPIC, webLessonDocTitle } from '../content/topics'
import { LoginGate } from '../courses/LoginGate'
import { clearGuestProgress, memberProgress } from '../courses/progress'
import { documentTitle } from '../site/siteInfo'
import { InteractiveScenePage } from '../studio/interactive/InteractiveScenePage'
import styles from '../studio/interactive/InteractiveScenePage.module.css'

// 「網頁怎麼運作」的一課:整個視窗都是互動舞台,右側是章節與步驟(InteractiveScenePage,和 L0 的互動課同一個外殼)。
// 第一課(0.1)可以直接預覽,其他課要登入(LoginGate)。播放進度只有登入的會員才記。每一課的頁面由 WEB_OPEN_LESSONS 產生(routes.tsx),SEO 在 seo/pages.ts。

const OPEN_IDS = Object.keys(WEB_OPEN_LESSONS)

export function WebLessonPage({ id }: { id: string }) {
  const { script, path, interaction } = WEB_OPEN_LESSONS[id]
  const title = webLesson(id)?.title ?? id
  const { status, user } = useAuth()
  const memberId = user?.id ?? null
  const location = useLocation()
  const progress = useMemo(() => (memberId ? memberProgress(`live:${script}`) : undefined), [memberId, script])
  useEffect(() => {
    if (status !== 'loading' && !memberId) clearGuestProgress()
  }, [status, memberId])

  const index = OPEN_IDS.indexOf(id)
  const prev = OPEN_IDS[index - 1]
  const next = OPEN_IDS[index + 1]

  const page = (
    <InteractiveScenePage
      key={`${id}:${status === 'loading' ? 'loading' : (memberId ?? 'guest')}`}
      script={script}
      pageTitle={title}
      interaction={interaction}
      course={{
        docTitle: documentTitle(webLessonDocTitle(id)),
        heading: title,
        back: { to: WEB_TOPIC.path, label: '← 課程地圖' },
        progress,
        ready: status !== 'loading',
        footer: (
          <>
            {status === 'guest' && (
              <p className={styles.panelLogin}>
                <Link to={loginHref(location.pathname)}>登入</Link>後會記住你看到哪裡，下次從這裡接著看。
              </p>
            )}
            <nav className={styles.panelFooter} aria-label="上一課與下一課">
              {prev ? <Link to={WEB_OPEN_LESSONS[prev].path}>← 上一課：{prev}</Link> : <span />}
              {next ? <Link to={WEB_OPEN_LESSONS[next].path}>下一課：{next} →</Link> : <Link to={`${WEB_TOPIC.path}#map`}>課程地圖 →</Link>}
            </nav>
          </>
        ),
      }}
    />
  )
  if (!webNeedsLogin(id)) return page
  return (
    <LoginGate
      key={path}
      kicker={`${WEB_TOPIC.name} · ${id}`}
      title={title}
      docTitle={webLessonDocTitle(id)}
      back={{ to: WEB_TOPIC.path, label: '回課程地圖' }}
      note="第一課可以直接預覽，之後的課程要登入才能觀看。登入後也會記錄你的播放進度。"
    >
      {page}
    </LoginGate>
  )
}
