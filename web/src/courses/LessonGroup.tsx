import { Link } from 'react-router-dom'
import type { MapLesson } from '../content/courseMap'
import { useT } from '../i18n/I18nProvider'
import { LockIcon } from '../site/LockIcon'
import { INTERACTIVE_ICON } from '../studio/interactive/scene'
import styles from './LessonGroup.module.css'

// 課程清單的共用元件:課程總覽頁(整門課一組)與各主題頁的課程地圖(一個單元一組)用同一個畫法。兒童版有自己的畫法,不用這個。
// 群組可以收合,標題是 h3(單元標題下可放小字)。每一列:播放圖示、課號與課名、一句話、右側標籤與時長。
// 右側標籤:還沒開放的課「🌱 規劃中」、草稿(只有管理員拿到)「草稿」、
//   未登入且開放的課「免費預覽」或鎖頭(登入後學習);確認登入狀態前(guest 為 false)不標,已登入的人不會閃過標籤;
//   有腳本的課標「互動」,有估時間的課標分鐘數。
// 連結由呼叫端決定(pathOf 回傳 null 就不連):總覽頁每一課都連到課程頁(規劃中的章節也有說明頁),主題頁只連開放的課與草稿。

export const CLOCK = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2'
export const PLAY = 'M8 5.5v13l10.5-6.5z'
const CHEVRON = 'M9 6l6 6-6 6'

export const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg className={styles.icon} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

/**
 * 課程清單讀取中、讀不到時的畫面:一張佔位卡(讀取中是幾列灰色骨架,讀不到是一句說明),不用前端寫死的資料頂替。
 * 讀取中標成 role=status、aria-busy(螢幕閱讀器與測試看得到);讀不到用 role=alert。
 */
export function LessonListStatus({ state }: { state: 'loading' | 'error' }) {
  const c = useT().courses.overview
  return state === 'loading' ? (
    <div className={`${styles.group} ${styles.placeholder}`} role="status" aria-busy="true" aria-label={c.listLoading} data-testid="lesson-list-loading">
      {[0, 1, 2].map((i) => (
        <div className={styles.skeletonRow} key={i} aria-hidden="true">
          <span className={styles.skeletonDot} />
          <span className={styles.skeletonLines}>
            <span />
            <span />
          </span>
        </div>
      ))}
    </div>
  ) : (
    <div className={`${styles.group} ${styles.placeholder}`} role="alert" data-testid="lesson-list-error">
      <p className={styles.placeholderText}>{c.listError}</p>
    </div>
  )
}

export function LessonGroups({ children }: { children: React.ReactNode }) {
  return <div className={styles.groups}>{children}</div>
}

export function LessonGroup({
  title,
  subtitle,
  lessons,
  pathOf,
  labelOf,
  guest,
  open = true,
}: {
  title: string
  /** 標題下的小字(單元回答的問題、比喻) */
  subtitle?: string
  lessons: MapLesson[]
  /** 一堂課的連結;null 不連 */
  pathOf: (l: MapLesson) => string | null
  /** 課號的顯示文字(「序章」「第 1 課」「1.2」) */
  labelOf: (l: MapLesson) => string
  /** 確定是未登入的訪客(還在確認登入狀態時是 false) */
  guest: boolean
  open?: boolean
}) {
  const t = useT()
  const c = t.courses
  return (
    <details className={styles.group} open={open}>
      <summary>
        <svg className={`${styles.icon} ${styles.chevron}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={CHEVRON} />
        </svg>
        <h3 className={styles.groupTitle}>
          {title}
          {subtitle && <small>{subtitle}</small>}
        </h3>
        <span className={styles.groupCount}>{c.lessonCount(lessons.length)}</span>
      </summary>
      <ol className={styles.rows}>
        {lessons.map((l) => {
          const ready = l.status === 'open'
          const draft = l.status === 'draft'
          const to = pathOf(l)
          const minutes = l.minutes ?? 0
          const body = (
            <>
              <span className={styles.play} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path d={PLAY} fill="currentColor" />
                </svg>
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>
                  <span className={styles.rowNum}>{labelOf(l)}</span>
                  {l.title}
                </span>
                {l.summary && <span className={styles.rowGoal}>{l.summary}</span>}
              </span>
              <span className={styles.rowMeta}>
                {draft && <span className={styles.badge}>{t.home.map.draft}</span>}
                {!ready && !draft && (
                  <span className={styles.badge}>
                    <span aria-hidden="true">🌱 </span>
                    {c.planned}
                  </span>
                )}
                {guest && ready && (l.access === 'free' ? <span className={`${styles.badge} ${styles.badgePreview}`}>{c.overview.freePreview}</span> : <LockIcon label={c.overview.signInToLearn} />)}
                {(ready || draft) && l.script && (
                  <span className={styles.chip}>
                    <Icon d={INTERACTIVE_ICON} size={16} />
                    {c.overview.interactive}
                  </span>
                )}
                {minutes > 0 && (
                  <span className={styles.time}>
                    <Icon d={CLOCK} size={18} />
                    {c.minutes(minutes)}
                  </span>
                )}
              </span>
            </>
          )
          return (
            <li key={l.id}>
              {to ? (
                <Link className={styles.row} to={to}>
                  {body}
                </Link>
              ) : (
                <div className={styles.row}>{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </details>
  )
}
