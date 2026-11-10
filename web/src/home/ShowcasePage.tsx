import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { COURSES, isPreviewLesson, lessonPath } from '../content/catalog'
import { KIDS_TOPIC, SOFTWARE_TOPIC } from '../content/topics'
import { KidsPlayer } from '../kids/KidsPlayer'
import { SiteLayout } from '../site/SiteLayout'
import { InteractiveScenePage } from '../studio/interactive/InteractiveScenePage'
import { ThemeCard } from './HomePage'
import styles from './HomePage.module.css'

// 展示頁(/showcase):原本放在首頁的兩支影片預覽搬到這裡,當獨立的行銷頁用。
// 站內沒有任何連結連過來(要投放或分享時直接給網址);和其他公開頁一樣列入 sitemap、可被收錄(seo/pages.ts 的 SHOWCASE_PAGE)。
// 播放器的 track="home":按下播放才記一筆展示影片的紀錄(home:…,後台標成「展示影片」),和打開課程分開算。版面沿用首頁的樣式(HomePage.module.css)。


const tools = COURSES.find((c) => c.slug === 'tools')!
// 展示影片一律播序章(不用登入就能看),從頭開始;「開始第一課」也從序章開始
const introLesson = tools.lessons.find(isPreviewLesson)!

export function ShowcasePage() {
  const [shrinkSlot, setShrinkSlot] = useState<HTMLElement | null>(null)
  /** 兒童主題預覽的環節選單放在卡片左欄的這個位置(窄螢幕時左欄排在預覽上面,一樣顯示) */
  const [kidsMenu, setKidsMenu] = useState<HTMLElement | null>(null)

  return (
    <SiteLayout title="課程展示">
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1>看看上課的樣子</h1>
          <p>不用登入，直接按播放，體驗互動課程。</p>
        </div>
      </section>

      <div className={styles.container}>
        <article className={styles.featured} aria-labelledby="showcase-software">
          <div className={styles.featuredMain}>
            <div className={styles.featuredText}>
              <h2 id="showcase-software">{SOFTWARE_TOPIC.name}</h2>
              <p className={styles.slogan}>{SOFTWARE_TOPIC.slogan}</p>
              <p className={styles.lede}>{SOFTWARE_TOPIC.lede}</p>
              <div className={styles.ctas}>
                <Link className={styles.primary} to={lessonPath(tools, introLesson)}>
                  開始第一課
                </Link>
                <Link className={styles.secondary} to={{ pathname: SOFTWARE_TOPIC.path, hash: 'map' }}>
                  課程地圖
                </Link>
                <div ref={setShrinkSlot} className={styles.shrinkSlot} />
              </div>
            </div>
            <div className={styles.player}>
              <InteractiveScenePage
                key={introLesson.id}
                script={introLesson.videos[0].live!}
                pageTitle={introLesson.title}
                interaction="static"
                embed
                track="home"
                shrinkSlot={shrinkSlot}
              />
            </div>
          </div>
        </article>

        <section className={styles.kids} aria-label={KIDS_TOPIC.name}>
          {/* 課程預覽:第一課(0.1)的試做,用兒童版播放器直接上,放在標題右側。
              這張卡片給家長看:左欄先介紹哪些環節可互動,再列出環節(點了跳過去);播放控制留在影片下方 */}
          <ThemeCard
            t={KIDS_TOPIC}
            aside={
              KIDS_TOPIC.preview && (
                <NearViewport placeholder={<div className={styles.kidsPlaceholder} aria-hidden="true" />}>
                  <KidsPlayer
                    script={KIDS_TOPIC.preview.script}
                    size="compact"
                    freeJump
                    track="home"
                    chaptersSlot={kidsMenu}
                    chapterInfo={KIDS_TOPIC.preview.sections}
                  />
                </NearViewport>
              )
            }
            below={
              KIDS_TOPIC.preview && (
                <>
                  <h4>課程環節</h4>
                  {KIDS_TOPIC.preview.intro && <p className={styles.kidsIntro}>{KIDS_TOPIC.preview.intro}</p>}
                  <div ref={setKidsMenu} />
                </>
              )
            }
          />
        </section>
        <div className={styles.showcaseEnd} />
      </div>
    </SiteLayout>
  )
}

/**
 * 捲到附近(上下 400px 內)才放上 children,之前先放 placeholder;放上之後就一直留著。
 * 兒童版播放器一掛上就會建舞台、載腳本,訪客沒捲到那裡就不用做這些事。
 * 不支援 IntersectionObserver 的瀏覽器直接放上
 */
function NearViewport({ children, placeholder }: { children: ReactNode; placeholder: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (near || !el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  return <div ref={ref}>{near ? children : placeholder}</div>
}
