import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCourseMap, type MapUnit } from '../content/courseMap'
import styles from './SoftwareTopicPage.module.css'
import own from './KidsTopicPage.module.css'

// 主題頁的課程地圖(單元 → 每一堂課):從資料庫讀(content/courseMap.ts,GET /api/courses/{id}/map),兒童課與網頁怎麼運作共用。
// 讀到之前與讀不到時(伺服器沒接資料庫、網路錯誤)用前端內建的同一份資料(fallback);兩邊一致由 content/courseMap.test.ts 檢查。
// 已開放的課(status open)整列連到課程頁(課號 0.1 → {topicPath}/0-1)。狀態:登入後是「開始學習」;
// 沒登入時 access 是 free 的標「免費預覽」,其他開放的標「登入後學習」;還沒開放的標「規劃中」。
// 草稿(status draft,只有管理員會拿到)也整列連到課程頁,標「草稿」。

/** 一堂課的課程頁網址(課號 0.1 → /topics/kids/0-1) */
export const lessonPath = (topicPath: string, id: string): string => `${topicPath}/${id.replace('.', '-')}`

export function CourseMapUnits({ course, topicPath, fallback }: { course: string; topicPath: string; fallback: MapUnit[] }) {
  const { status } = useAuth()
  const signedIn = status === 'user' || status === 'disabled'
  const map = useCourseMap(course)
  return (
    <div className={own.units}>
      {(map.status === 'ready' ? map.map.units : fallback).map((unit) => (
        <div className={styles.group} key={unit.id}>
          <h3 className={`${styles.groupHead} ${own.unitHead}`}>
            {unit.title}
            <small>{unit.subtitle}</small>
          </h3>
          <ul className={styles.rows}>
            {unit.lessons.map((l) => {
              const path = l.status === 'open' || l.status === 'draft' ? lessonPath(topicPath, l.id) : null
              // 還在確認登入狀態(null)時先不標,免得已登入的人閃過「登入後學習」
              const state =
                l.status === 'draft' ? 'draft' : !path ? 'planned' : signedIn ? 'start' : status === 'loading' ? null : l.access === 'free' ? 'free' : 'login'
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
                      {/* 開始學習與免費預覽(綠)、登入後學習(暖色,鎖頭)、規劃中(淡色)、草稿(虛線強調色) */}
                      {state && (
                        <span className={own.status} data-state={state}>
                          <span className={own.statusIcon} aria-hidden="true">
                            {{ start: '▶', free: '▶', login: '🔒', planned: '🌱', draft: '✎' }[state]}
                          </span>
                          {{ start: '開始學習', free: '免費預覽', login: '登入後學習', planned: '規劃中', draft: '草稿' }[state]}
                        </span>
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
