import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KIDS_OPEN_LESSONS, kidsLessonTitle, kidsNeedsLogin } from '../content/kidsCourse'
import { KIDS_TOPIC, kidsLessonDocTitle } from '../content/topics'
import { LoginGate } from '../courses/LoginGate'
import { KidsPlayer } from '../kids/KidsPlayer'
import { documentTitle } from '../site/siteInfo'
import site from '../site/SiteLayout.module.css'
import own from './KidsTopicPage.module.css'

// 兒童課的一課:整個視窗都是兒童版的互動播放器(沒有網站標頭與頁尾),給孩子自己上:大按鈕、不能跳過還沒回答的題目。
// 參考一般版的互動課程頁:「回課程地圖」浮在左上角,課名、「給家長」(打開一個說明框)與切換段落浮在右上角的側欄,可以收起來(窄螢幕段落留在播放器下方);按鈕放大給孩子用。配色沿用網站的 --site-* 變數(套上 SiteLayout 的 .site)。
// 第一課可以直接預覽,之後的課要登入(LoginGate)。每一課的頁面由 KIDS_OPEN_LESSONS 產生(routes.tsx),SEO 在 seo/pages.ts。

/** 視窗夠寬,放得下右側欄(和 KidsTopicPage.module.css 的 .side 斷點一致) */
function useWide(): boolean {
  const query = '(min-width: 900px)'
  const [wide, setWide] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export function KidsLessonPage({ id }: { id: string }) {
  const lesson = KIDS_OPEN_LESSONS[id]
  const [parents, setParents] = useState(false)
  // 切換段落放在右側欄(寬螢幕);窄螢幕沒有側欄,段落留在播放器下方
  const [side, setSide] = useState<HTMLElement | null>(null)
  const wide = useWide()
  // 段落面板一開始收起來,按「☰ 段落」才打開
  const [sideOpen, setSideOpen] = useState(false)

  // 沒有 SiteLayout,頁面標題自己設(和 seo/pages.ts 一致)
  useEffect(() => {
    document.title = documentTitle(kidsLessonDocTitle(id))
  }, [id])

  const page = (
    <div className={`${site.site} ${own.whole}`} lang="zh-Hant">
      <main className={own.wholePlayer}>
        <KidsPlayer script={lesson.script} layout="page" floating chaptersSlot={wide ? side : null} />
      </main>

      {/* 浮在左上角:回課程地圖(大按鈕,孩子點得到) */}
      <Link className={own.floatBack} to={KIDS_TOPIC.path}>
        ← 課程地圖
      </Link>

      {/* 浮在右上角的側欄:課名、給家長、這一課的段落(可以收起來);窄螢幕只留按鈕,段落在播放器下方 */}
      <aside className={own.side} data-open={sideOpen && wide ? 'true' : 'false'} aria-label="這一課">
        <div className={own.sideHead}>
          {/* 課名一直都在(頁面的標題);側欄收起來或窄螢幕時只是看不到 */}
          <h1 className={wide && sideOpen ? undefined : own.srOnly}>
            <small>{id}</small>
            {kidsLessonTitle(id)}
          </h1>
          <div className={own.sideButtons}>
            <button type="button" className={own.bigButton} aria-expanded={parents} onClick={() => setParents(!parents)}>
              給家長
            </button>
            {wide && (
              <button type="button" className={own.bigButton} aria-expanded={sideOpen} aria-label={sideOpen ? '收起段落' : '打開段落'} onClick={() => setSideOpen(!sideOpen)}>
                {sideOpen ? '收起 ▴' : '☰ 段落'}
              </button>
            )}
          </div>
        </div>
        {wide && <div ref={setSide} hidden={!sideOpen} />}
      </aside>

      {parents && (
        <div className={own.parentsLayer} role="dialog" aria-label="給家長" onClick={() => setParents(false)}>
          <section className={own.parentsCard} onClick={(e) => e.stopPropagation()}>
            <h2>給家長</h2>
            {lesson.parents.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <button type="button" className={own.bigButton} onClick={() => setParents(false)}>
              知道了
            </button>
          </section>
        </div>
      )}
    </div>
  )
  if (!kidsNeedsLogin(id)) return page
  return (
    <LoginGate
      kicker={`${KIDS_TOPIC.name} · ${id}`}
      title={kidsLessonTitle(id)}
      docTitle={kidsLessonDocTitle(id)}
      back={{ to: KIDS_TOPIC.path, label: '回課程地圖' }}
      note="第一課可以直接預覽，之後的課登入後就能學習，也會記錄孩子上到哪裡。"
    >
      {page}
    </LoginGate>
  )
}
