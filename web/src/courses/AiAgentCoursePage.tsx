import { Link } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { useHashScroll } from '../site/useHashScroll'
import {
  AI_AGENT_COURSE_PATH,
  AUDIENCE_FIT,
  AUDIENCE_NOT_FIT,
  COURSE,
  OUTCOMES,
  PREREQUISITES,
  TEACHING,
  UNITS,
} from '../content/aiAgent'
import styles from './AiAgentCoursePage.module.css'
import { AI_APPS_TOPIC } from '../content/topics'

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <header className={styles.sectionHead}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      {lead && <p className={styles.lead}>{lead}</p>}
    </header>
  )
}

export function AiAgentCoursePage() {
  useHashScroll()

  return (
    <SiteLayout title={COURSE.title}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <nav className={styles.crumbs} aria-label="麵包屑">
              <Link to={`${AI_APPS_TOPIC.path}#map`}>{AI_APPS_TOPIC.name}</Link>
              <span aria-hidden="true">/</span>
              <span>{COURSE.level}</span>
            </nav>
            <p className={styles.kicker}>{COURSE.kicker}</p>
            <h1>
              {COURSE.titleLines.map((line) => (
                <span key={line} className={styles.titleLine}>
                  {line}
                </span>
              ))}
            </h1>
            <p className={styles.pitch}>{COURSE.pitch}</p>
            <ul className={styles.tags} aria-label="課程特色">
              {COURSE.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className={styles.ctas}>
              <Link className={styles.primary} to={{ pathname: AI_AGENT_COURSE_PATH, hash: 'units' }}>
                查看課程單元
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="outcomes">
        <div className={styles.container}>
          <SectionHead eyebrow="學習成果" title="你會學到什麼" lead="完成這堂課後，你將能夠：" />
          <ol className={styles.outcomes}>
            {OUTCOMES.map((o, i) => (
              <li key={o.title} className={styles.card}>
                <span className={styles.outcomeNum}>{String(i + 1).padStart(2, '0')}</span>
                <h3>{o.title}</h3>
                <p>{o.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.section} ${styles.alt}`} id="audience">
        <div className={styles.container}>
          <SectionHead eyebrow="適合對象" title="這堂課適合誰" />
          <div className={styles.audience}>
            <div className={`${styles.card} ${styles.fit}`}>
              <h3>適合</h3>
              <ul>
                {AUDIENCE_FIT.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className={`${styles.card} ${styles.notFit}`}>
              <h3>較不適合</h3>
              <ul>
                {AUDIENCE_NOT_FIT.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <h3 className={styles.prereqHead}>需要具備的背景知識</h3>
              <ul>
                {PREREQUISITES.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="units">
        <div className={styles.container}>
          <SectionHead
            eyebrow="課程單元"
            title="從第一個工具到上線的整合應用"
            lead="每個單元都有明確的學習目標與動手實作。單元內容持續規劃與更新中。"
          />
          <ol className={styles.units}>
            {UNITS.map((u) => (
              <li key={u.num} className={`${styles.card} ${styles.unit}`}>
                <div className={styles.unitNum} aria-hidden="true">
                  {u.num}
                </div>
                <div className={styles.unitBody}>
                  <h3>
                    <Link to={`${AI_AGENT_COURSE_PATH}/${u.num === '★' ? 'capstone' : `unit-${u.num}`}`}>{u.title}</Link>
                    {u.status === 'planned' && <span className={styles.badge}>規劃中</span>}
                  </h3>
                  <p className={styles.unitGoal}>{u.goal}</p>
                  <dl>
                    <dt>對應概念</dt>
                    <dd>{u.concepts}</dd>
                    <dt>實作</dt>
                    <dd>{u.practice}</dd>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.section} ${styles.alt}`} id="teaching">
        <div className={styles.container}>
          <SectionHead
            eyebrow="教學方式"
            title="影片加實作，一次只講一個想法"
            lead="課程的切片長度、腳本與錄製方式，依據線上課程設計研究整理出的製作原則。"
          />
          <div className={styles.teaching}>
            {TEACHING.map((t) => (
              <div key={t.title} className={styles.card}>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
