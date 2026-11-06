import { Link } from 'react-router-dom'
import { KIDS_OPEN_LESSONS, kidsLessonTitle, kidsNeedsLogin } from '../content/kidsCourse'
import { KIDS_TOPIC, kidsLessonDocTitle } from '../content/topics'
import { LoginGate } from '../courses/LoginGate'
import { KidsPlayer } from '../kids/KidsPlayer'
import { SiteLayout } from '../site/SiteLayout'
import own from './KidsTopicPage.module.css'

// 兒童課的一課:給孩子自己上,用兒童版的全頁互動播放器(撐滿網站標頭以下的畫面、大按鈕、不能跳過還沒回答的題目)。
// 「給家長」放在播放器下面,往下捲才看到。
// 第一課可以直接預覽,之後的課要登入(LoginGate)。每一課的頁面由 KIDS_OPEN_LESSONS 產生(routes.tsx),SEO 在 seo/pages.ts。

export function KidsLessonPage({ id }: { id: string }) {
  const lesson = KIDS_OPEN_LESSONS[id]
  const page = (
    <SiteLayout title={kidsLessonDocTitle(id)}>
      <div className={own.full}>
        <div className={own.fullHead}>
          <Link className={own.back} to={KIDS_TOPIC.path}>
            ← 課程地圖
          </Link>
          <h1>
            {id}　{kidsLessonTitle(id)}
          </h1>
        </div>
        <div className={own.fullPlayer}>
          <KidsPlayer script={lesson.script} layout="page" />
        </div>
      </div>
      <section className={own.parents}>
        <h2>給家長</h2>
        {lesson.parents.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>
    </SiteLayout>
  )
  if (!kidsNeedsLogin(id)) return page
  return (
    <LoginGate
      kicker={`${KIDS_TOPIC.name} · ${id}`}
      title={kidsLessonTitle(id)}
      docTitle={kidsLessonDocTitle(id)}
      back={{ to: KIDS_TOPIC.path, label: '回課程地圖' }}
      note="第一課可以直接預覽，之後的課要登入才能上，也會記錄孩子上到哪裡。"
    >
      {page}
    </LoginGate>
  )
}
