import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { COURSES, coursePath, isPreviewLesson, lessonPath, openLessonsOf } from '../content/catalog'
import { LEVELS } from '../content/levels'
import { HOME_INTRO, KIDS_TOPIC, PLANNED_TOPICS, SOFTWARE_TOPIC, type PlannedTopic } from '../content/topics'
import { KidsPlayer } from '../kids/KidsPlayer'
import { SiteLayout } from '../site/SiteLayout'
import { InteractiveScenePage } from '../studio/interactive/InteractiveScenePage'
import bakerySite from './assets/bakery-site.jpg'
import styles from './HomePage.module.css'

// 首頁:先列出主題,再進入各主題。有內容的主題佔整排,直接看得到教學畫面與做出來的成品;
// 規劃中的主題縮小,只寫預計做出的成果。課數、連結與示範提示詞都取自課程資料,主題文案在 content/topics.ts。

const tools = COURSES.find((c) => c.slug === 'tools')!
// 展示影片一律播序章(不用登入就能看),從頭開始;「開始第一課」也從序章開始
const openLessons = openLessonsOf(tools)
const introLesson = tools.lessons.find(isPreviewLesson)!
const sitePrompt = tools.lessons.find((l) => l.id === '0.2')!.steps[0].prompt!

// 這個主題的等級(起步、零基礎、基礎);中階、進階在主題「打造 AI 互動軟體」
const LADDER = COURSES.filter((c) => LEVELS.some((l) => l.link === coursePath(c))).map((c) => ({
  name: c.level,
  open: c.lessons.some((l) => l.videos.some((v) => v.live)),
}))

const TOPIC_ICONS = {
  terminal: (
    <svg className={styles.themeIcon} viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="16" rx="3" />
      <path d="m7 9.5 3 2.5-3 2.5" />
      <path d="M12.5 15H17" />
    </svg>
  ),
}

export function HomePage() {
  // 課程地圖以前在首頁:舊連結(/#map、/#level-tools)導到主題頁的同一個位置
  const { hash } = useLocation()
  const [shrinkSlot, setShrinkSlot] = useState<HTMLElement | null>(null)
  /** 兒童主題預覽的環節選單放在卡片左欄的這個位置(窄螢幕時左欄排在預覽上面,一樣顯示) */
  const [kidsMenu, setKidsMenu] = useState<HTMLElement | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const featured = introLesson
  if (/^#(map|level-)/.test(hash)) return <Navigate replace to={{ pathname: SOFTWARE_TOPIC.path, hash }} />

  return (
    <SiteLayout>
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1>{HOME_INTRO.title}</h1>
          <p className={styles.pitch}>{HOME_INTRO.pitch}</p>
        </div>
      </section>

      <div className={styles.container}>
        <article className={styles.featured} aria-labelledby="theme-software">
          <div className={styles.featuredMain}>
            <div className={styles.featuredText}>
              <h2 id="theme-software">{SOFTWARE_TOPIC.name}</h2>
              <p className={styles.slogan}>{SOFTWARE_TOPIC.slogan}</p>
              <p className={styles.lede}>{SOFTWARE_TOPIC.lede}</p>
              <ul className={styles.facts}>
                <li>
                  <strong>免費</strong>開始
                </li>
                <li>
                  已開放 <strong>{openLessons.length} 課</strong>
                </li>
                <li>
                  不用先學<strong>程式</strong>
                </li>
              </ul>
              <ol className={styles.ladder} aria-label="課程順序">
                {LADDER.map((s) => (
                  <li key={s.name} className={s.open ? styles.ladderOpen : undefined}>
                    {s.name}
                  </li>
                ))}
              </ol>
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
                key={featured.id}
                script={featured.videos[0].live!}
                pageTitle={featured.title}
                interaction="static"
                embed
                track="home"
                shrinkSlot={shrinkSlot}
              />
            </div>
          </div>

          <div id="home-result" className={styles.result} data-open={resultOpen}>
            <div className={styles.resultPrompt}>
              <h3>第 2 課就能做出這個網站</h3>
              <p className={styles.resultNote}>一開始，你只要這樣告訴 AI：</p>
              <blockquote>{sitePrompt}</blockquote>
              <p className={styles.resultNote}>再一個區塊一個區塊調整，就完成了。</p>
            </div>
            <figure className={styles.resultShot}>
              <img src={bakerySite} alt="課程做出的小森烘焙一頁式網站，有導覽、主視覺與本週商品" width={1520} height={1040} loading="lazy" />
              <figcaption>小森烘焙（課程虛構案例）的參考成品</figcaption>
            </figure>
          </div>
          {/* 手機版預設收起「第 2 課就能做出這個網站」:卡片下緣的展開條,展開後內容出現在上方、這條變成「收起」;桌機不顯示 */}
          <button
            type="button"
            className={styles.resultToggle}
            aria-expanded={resultOpen}
            aria-controls="home-result"
            onClick={(e) => {
              const bar = e.currentTarget
              setResultOpen((o) => !o)
              // 收起時上方內容消失、展開條往上跳:收起後把展開條捲回畫面中,不會突然看到下一個區塊
              if (resultOpen) requestAnimationFrame(() => bar.scrollIntoView({ block: 'nearest' }))
            }}
          >
            {resultOpen ? '收起' : '第 2 課就能做出這個網站'}
            <svg className={styles.resultChevron} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
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

        <section className={styles.next} aria-labelledby="next-themes">
          <h2 id="next-themes">更多主題課程</h2>
          <div className={styles.nextGrid}>
            {PLANNED_TOPICS.map((t) => (
              <ThemeCard t={t} key={t.name} />
            ))}
          </div>
        </section>
      </div>
    </SiteLayout>
  )
}

/**
 * 捲到附近(上下 400px 內)才放上 children,之前先放 placeholder;放上之後就一直留著。
 * 首頁的兒童版播放器一掛上就會建舞台、載腳本,訪客沒捲到那裡就不用做這些事。
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

/**
 * 規劃中(或已開放、t.open)主題的卡片:名稱、標語、步驟或整理前後示意、預計做出的成果或涵蓋的情境。
 * aside 放在標題與內容的右側(窄螢幕排到下面);below 接在步驟下面。
 * 有 aside 的卡片,「你會做出」另起一段橫跨整張卡片,放在標題與預覽下面(仿照「做出自己的軟體」的成果段)
 */
function ThemeCard({ t, aside, below }: { t: PlannedTopic; aside?: ReactNode; below?: ReactNode }) {
  const outcomes = t.outcomes && (
    <>
      <h4>你會做出</h4>
      <ul className={styles.outcomes}>
        {t.outcomes.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
    </>
  )
  const body = (
    <>
      {/* 首頁不標「開放中」:有主色標籤的主題放標籤;規劃中的主題在標題右邊標小樹苗(和兒童課的「規劃中」一樣) */}
      {t.tag && <p className={`${styles.badge} ${styles.badgeOpen}`}>{t.tag}</p>}
      <div className={styles.themeHead}>
        <h3>
          {t.icon && TOPIC_ICONS[t.icon]}
          {t.name}
        </h3>
        {!t.open && (
          <p className={styles.planned}>
            <span className={styles.plannedIcon} aria-hidden="true">
              🌱
            </span>
            規劃中
          </p>
        )}
      </div>
      <p className={styles.themeSlogan}>{t.slogan}</p>
      {t.intro && <p className={styles.themeIntro}>{t.intro}</p>}
      {t.learn && (
        <>
          <h4>學完你會</h4>
          <ul className={styles.outcomes}>
            {t.learn.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {t.flow && (
        <ol className={styles.flow} aria-label="會經歷的步驟">
          {t.flow.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      {t.sample && (
        <div className={styles.sample}>
          <p className={styles.sampleCaption}>{t.sample.caption}</p>
          <div className={styles.sampleGrid}>
            <div>
              <h4>整理前</h4>
              <ul>
                {t.sample.before.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <span aria-hidden="true">→</span>
            <div>
              <h4>整理後</h4>
              <ul>
                {t.sample.after.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {t.start && (
        // 已經可以上第一課的主題:按鈕放在步驟下面,和「做出自己的軟體」的位置一樣
        <div className={styles.ctas}>
          <Link className={styles.primary} to={t.start.path}>
            {t.start.label}
          </Link>
          {t.path && (
            <Link className={styles.secondary} to={{ pathname: t.path, hash: 'map' }}>
              課程地圖
            </Link>
          )}
        </div>
      )}
      {below}
      {!aside && outcomes}
      {t.scenarios && (
        <>
          <h4>涵蓋的情境</h4>
          <ul className={styles.outcomes}>
            {t.scenarios.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {!t.start && t.path && (
        <Link className={styles.themeLink} to={t.path}>
          看課程規劃 <span aria-hidden="true">→</span>
        </Link>
      )}
    </>
  )
  const cls = t.open ? `${styles.theme} ${styles.themeOpen}` : styles.theme
  if (!aside) return <article className={cls}>{body}</article>
  return (
    <article className={`${cls} ${styles.themeAside}`}>
      <div>{body}</div>
      {aside}
      {t.outcomes && (
        <div className={styles.themeResult}>
          <h3>你會做出</h3>
          <ol>
            {t.outcomes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}
