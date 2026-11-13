import { Link } from 'react-router-dom'
import { useT } from '../i18n/I18nProvider'
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
  const t = useT()
  const a = t.courses.aiAgent

  return (
    <SiteLayout title={COURSE.title}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <nav className={styles.crumbs} aria-label={t.courses.breadcrumb}>
              <Link to={`${AI_APPS_TOPIC.path}#map`}>{AI_APPS_TOPIC.name}</Link>
              <span aria-hidden="true">/</span>
              <span>{t.courses.levelName(COURSE.level)}</span>
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
            <ul className={styles.tags} aria-label={a.features}>
              {COURSE.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <div className={styles.ctas}>
              <Link className={styles.primary} to={{ pathname: AI_AGENT_COURSE_PATH, hash: 'units' }}>
                {a.viewUnits}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="outcomes">
        <div className={styles.container}>
          <SectionHead eyebrow={a.outcomesEyebrow} title={a.outcomesTitle} lead={a.outcomesLead} />
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
          <SectionHead eyebrow={a.audienceEyebrow} title={a.audienceTitle} />
          <div className={styles.audience}>
            <div className={`${styles.card} ${styles.fit}`}>
              <h3>{a.fit}</h3>
              <ul>
                {AUDIENCE_FIT.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className={`${styles.card} ${styles.notFit}`}>
              <h3>{a.notFit}</h3>
              <ul>
                {AUDIENCE_NOT_FIT.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <h3 className={styles.prereqHead}>{a.prerequisites}</h3>
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
            eyebrow={a.unitsEyebrow}
            title={a.unitsTitle}
            lead={a.unitsLead}
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
                    {u.status === 'planned' && <span className={`${styles.badge} ${styles.badgePlanned}`}><span aria-hidden="true">🌱 </span>{t.courses.planned}</span>}
                  </h3>
                  <p className={styles.unitGoal}>{u.goal}</p>
                  <dl>
                    <dt>{a.concepts}</dt>
                    <dd>{u.concepts}</dd>
                    <dt>{a.practice}</dt>
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
            eyebrow={a.teachingEyebrow}
            title={a.teachingTitle}
            lead={a.teachingLead}
          />
          <div className={styles.teaching}>
            {TEACHING.map((x) => (
              <div key={x.title} className={styles.card}>
                <h3>{x.title}</h3>
                <p>{x.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
