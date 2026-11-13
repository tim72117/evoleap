import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCourseMap, type MapLesson } from '../content/courseMap'
import { PageView } from '../courses/guestActivity'
import { LoginGate } from '../courses/LoginGate'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import page from './SoftwareTopicPage.module.css'

// 主題課程(網頁怎麼運作、給孩子的網頁程式、從做好到上線)的一課要不要給看,全部照課程地圖 API(GET /api/courses/{id}/map):
// 能上的是 status open 或 draft(草稿只有管理員拿得到)且有腳本的課;access free 的不用登入,其他要登入(LoginGate)。
// 通過後把資料庫裡的這一課(腳本在 lesson.script)與前後能上、也有課程頁的課交給 children 畫出課程頁。
// 腳本檔本身由伺服器依同樣的規則把關(GET /api/scripts,見 live/scripts.ts)。

type Topic = { name: string; path: string }

export function TopicLessonGate({
  course,
  pages,
  topic,
  id,
  title,
  docTitle,
  loginNote,
  children,
}: {
  /** 課程 id(courses_seed.json),例如 web */
  course: string
  /** 有課程頁(路由)的課號;上一課、下一課只連到這些課 */
  pages: string[]
  topic: Topic
  id: string
  title: string
  docTitle: string
  loginNote: string
  children: (lesson: MapLesson, prev?: MapLesson, next?: MapLesson) => ReactNode
}) {
  const { status: auth } = useAuth()
  const map = useCourseMap(course)
  const t = useT()
  // 等登入狀態確定後才判斷,免得管理員先閃過「還沒開放」
  if (map.status === 'loading' || auth === 'loading') return null
  // 讀不到不代表課沒開放(資料庫或網路暫時有問題),不要說成還沒開放
  if (map.status === 'error') {
    return (
      <Notice topic={topic} id={id} title={title} message={t.home.gate.loadError}>
        <button type="button" className={page.primary} onClick={() => location.reload()}>
          {t.home.gate.reload}
        </button>
      </Notice>
    )
  }
  const playable = map.map.units.flatMap((u) => u.lessons).filter((l) => (l.status === 'open' || l.status === 'draft') && l.script && pages.includes(l.id))
  const lesson = playable.find((l) => l.id === id)
  if (!lesson) {
    return (
      <Notice topic={topic} id={id} title={title} message={t.home.gate.notOpen}>
        <Link className={page.primary} to={{ pathname: topic.path, hash: 'map' }}>
          {t.home.gate.backToMap}
        </Link>
      </Notice>
    )
  }
  const index = playable.indexOf(lesson)
  const content = children(lesson, playable[index - 1], playable[index + 1])
  if (lesson.access === 'free') return content
  return (
    <LoginGate key={id} kicker={`${topic.name} · ${id}`} title={title} docTitle={docTitle} back={{ to: topic.path, label: t.home.gate.backToMap }} note={loginNote}>
      {content}
    </LoginGate>
  )
}

function Notice({ topic, id, title, message, children }: { topic: Topic; id: string; title: string; message: string; children: ReactNode }) {
  const t = useT()
  return (
    <PageView>
      <SiteLayout title={t.home.lesson.docTitle(title, topic.name)}>
        <section className={page.hero}>
          <div className={page.heroInner}>
            <p className={page.kicker}>
              {topic.name} · {id}
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
