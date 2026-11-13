import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCourseMap } from '../content/courseMap'
import { LessonListStatus } from '../courses/LessonGroup'
import { useT } from '../i18n/I18nProvider'
import { LockIcon } from '../site/LockIcon'
import styles from './SoftwareTopicPage.module.css'
import own from './KidsTopicPage.module.css'

// 兒童版主題頁的課程地圖(單元 → 每一堂課):從資料庫讀(content/courseMap.ts,GET /api/courses/{id}/map)。
// 其他主題(網頁怎麼運作、launch)與課程總覽頁用另一種畫法,同一個元件(TopicCourseMap、courses/LessonGroup.tsx);這裡只留兒童版的畫法。
// 讀取中顯示佔位卡、讀不到(伺服器沒接資料庫、網路錯誤)顯示「無法讀取」,不用前端寫死的資料頂替。
// 已開放的課(status open)整列連到課程頁(課號 0.1 → {topicPath}/0-1)。狀態:登入後是「開始學習」;
// 沒登入時 access 是 free 的標「免費預覽」,其他開放的只放鎖頭(登入後學習);還沒開放的標「規劃中」。
// 草稿(status draft,只有管理員會拿到)也整列連到課程頁,標「草稿」。

/** 一堂課的課程頁網址(課號 0.1 → /topics/kids/0-1) */
export const lessonPath = (topicPath: string, id: string): string => `${topicPath}/${id.replace('.', '-')}`

export function CourseMapUnits({ course, topicPath }: { course: string; topicPath: string }) {
  const { status } = useAuth()
  const signedIn = status === 'user' || status === 'disabled'
  const map = useCourseMap(course)
  const t = useT()
  // 讀取中顯示佔位卡、讀不到顯示「無法讀取」,不用前端寫死的課程資料頂替
  if (map.status !== 'ready') return <LessonListStatus state={map.status} />
  return (
    <div className={own.units}>
      {map.map.units.map((unit) => (
        <div className={styles.group} key={unit.id}>
          <h3 className={`${styles.groupHead} ${own.unitHead}`}>
            {unit.title}
            <small>{unit.subtitle}</small>
          </h3>
          <ul className={styles.rows}>
            {unit.lessons.map((l) => {
              const path = l.status === 'open' || l.status === 'draft' ? lessonPath(topicPath, l.id) : null
              // 還在確認登入狀態(null)時先不標,免得已登入的人閃過鎖頭
              const state = l.status === 'draft' ? 'draft' : !path ? 'planned' : signedIn ? 'start' : status === 'loading' ? null : l.access === 'free' ? 'free' : 'login'
              return (
                <li key={l.id}>
                  <div className={path ? `${styles.row} ${styles.rowPlayable}` : styles.row}>
                    <span className={`${styles.rowIcon} ${own.lessonNo}`} aria-hidden="true">
                      {l.id}
                    </span>
                    <div className={styles.rowText}>
                      {/* 可以上的課整列都能點(rowButton 的 ::after 蓋住整列),標題不畫成底線連結 */}
                      <h4>
                        {path ? (
                          <Link className={`${styles.rowButton} ${own.lessonLink}`} to={path}>
                            {l.title}
                          </Link>
                        ) : (
                          l.title
                        )}
                      </h4>
                      <p>{l.summary}</p>
                    </div>
                    <div className={styles.rowMeta}>
                      {/* 開始學習與免費預覽(綠)、登入後學習(單色鎖頭)、規劃中(淡色)、草稿(虛線強調色) */}
                      {state === 'login' ? (
                        <LockIcon label={t.home.map.signInToLearn} />
                      ) : (
                        state && (
                          <span className={own.status} data-state={state}>
                            <span className={own.statusIcon} aria-hidden="true">
                              {{ start: '▶', free: '▶', planned: '🌱', draft: '✎' }[state]}
                            </span>
                            {{ start: t.home.map.start, free: t.home.map.freePreview, planned: t.home.map.planned, draft: t.home.map.draft }[state]}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
