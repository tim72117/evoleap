import { Link, Navigate, useLocation } from 'react-router-dom'
import { COURSES, coursePath, lessonPath } from '../content/catalog'
import { LEVELS } from '../content/levels'
import { HOME_INTRO, PLANNED_TOPICS, SOFTWARE_TOPIC } from '../content/topics'
import { LivePlayer } from '../courses/LivePlayer'
import { SiteLayout } from '../site/SiteLayout'
import bakerySite from './assets/bakery-site.jpg'
import styles from './HomePage.module.css'

// 首頁:先列出主題,再進入各主題。有內容的主題佔整排,直接看得到教學畫面與做出來的成品;
// 規劃中的主題縮小,只寫預計做出的成果。課數、連結與示範提示詞都取自課程資料,主題文案在 content/topics.ts。

const tools = COURSES.find((c) => c.slug === 'tools')!
// 主打的是第 0 課(封面章節、提示詞都是它的);序章只是短短的導覽,不當主打
const openLessons = tools.lessons.filter((l) => !l.label && l.videos.some((v) => v.live))
const firstLesson = openLessons[0]
const firstScript = firstLesson.videos[0].live!
const sitePrompt = tools.lessons.find((l) => l.id === '0.2')!.steps[0].prompt!

// 這個主題的等級(L0–L2);中階、進階在主題「打造 AI 互動軟體」
const LADDER = COURSES.filter((c) => LEVELS.some((l) => l.link === coursePath(c))).map((c) => ({
  name: c.level.split(' ')[1],
  open: c.lessons.some((l) => l.videos.some((v) => v.live)),
}))

/** 教學畫面開始前的封面:AI 動手前的確認提示,比空白的開場更看得出課程在做什麼 */
const PLAYER_POSTER = { chapter: '看懂確認提示', after: 2500 }

export function HomePage() {
  // 課程地圖以前在首頁:舊連結(/#map、/#level-tools)導到主題頁的同一個位置
  const { hash } = useLocation()
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
              <p className={`${styles.badge} ${styles.badgeOpen}`}>開放中</p>
              <h2 id="theme-software">{SOFTWARE_TOPIC.name}</h2>
              <p className={styles.slogan}>{SOFTWARE_TOPIC.slogan}</p>
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
                <Link className={styles.primary} to={lessonPath(tools, firstLesson)}>
                  開始第一課
                </Link>
                <Link className={styles.secondary} to={SOFTWARE_TOPIC.path}>
                  看全部課程
                </Link>
              </div>
            </div>
            <div className={styles.player}>
              <LivePlayer script={firstScript} title={firstLesson.title} onTime={() => {}} poster={PLAYER_POSTER} />
            </div>
          </div>

          <div className={styles.result}>
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
        </article>

        <section className={styles.next} aria-labelledby="next-themes">
          <h2 id="next-themes">接下來的主題</h2>
          <div className={styles.nextGrid}>
            {PLANNED_TOPICS.map((t) => (
              <article className={styles.theme} key={t.name}>
                <p className={styles.badge}>規劃中</p>
                <h3>{t.name}</h3>
                <p className={styles.themeSlogan}>{t.slogan}</p>
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
                <h4>你會做出</h4>
                <ul className={styles.outcomes}>
                  {t.outcomes.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                {t.path && (
                  <Link className={styles.themeLink} to={t.path}>
                    看課程規劃 <span aria-hidden="true">→</span>
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </SiteLayout>
  )
}
