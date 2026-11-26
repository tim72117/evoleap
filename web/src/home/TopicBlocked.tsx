import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCourseName } from '../content/courseMap'
import { lessonDocTitle, lessonKicker, lessonLabelOf } from '../content/lessonDisplay'
import { PageView } from '../courses/guestActivity'
import type { LessonBlock } from '../courses/LessonGate'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import page from './SoftwareTopicPage.module.css'

// 主題課程(網頁怎麼運作、從做好到上線、兒童、Claude Code)的一課不能看時的畫面(LessonGate 的 blocked):
// 讀取中什麼都不畫;讀不到說「讀不到」並給重新整理(不說成還沒開放);不能上說「還沒開放」並連回課程地圖。
// 看到這個提示頁的訪客記 page:<網址>(PageView),後台看得出有人想上還沒開放的課。

type Topic = { name: string; path: string }

export function TopicBlocked({ reason, course, topic, id, title }: { reason: LessonBlock; /** 課程 slug(web、launch、kids、claude-code),決定標籤 */ course: string; topic: Topic; id: string; title: string }) {
  const t = useT()
  if (reason === 'loading') return null
  const error = reason === 'error'
  return (
    <Notice course={course} topic={topic} id={id} title={title} message={error ? t.home.gate.loadError : t.home.gate.notOpen}>
      {error ? (
        <button type="button" className={page.primary} onClick={() => location.reload()}>
          {t.home.gate.reload}
        </button>
      ) : (
        <Link className={page.primary} to={{ pathname: topic.path, hash: 'map' }}>
          {t.home.gate.backToMap}
        </Link>
      )}
    </Notice>
  )
}

function Notice({ course, topic, id, title, message, children }: { course: string; topic: Topic; id: string; title: string; message: string; children: ReactNode }) {
  const courseName = useCourseName(course, topic.name)
  return (
    <PageView>
      <SiteLayout title={lessonDocTitle(title, courseName)}>
        <section className={page.hero}>
          <div className={page.heroInner}>
            <p className={page.kicker}>
              {lessonKicker(topic.name, lessonLabelOf(course, id))}
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
