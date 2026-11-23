import { useT } from '../i18n/I18nProvider'
import { AUDIENCE_FIT, AUDIENCE_NOT_FIT, OUTCOMES, PREREQUISITES, TEACHING, UNITS } from '../content/aiAgent'
import styles from './AiAgentIntro.module.css'

// 「打造 AI 互動軟體」主題頁的課程介紹(中階課「打造你的第一個 AI Agent 整合應用」):學習成果、適合對象、課程單元、教學方式。
// 外觀文案,資料在 content/aiAgent.ts,不進資料庫(資料庫只有課名、單元、課)。單元是說明用的卡片,沒有各自的頁面。

function SectionHead({ id, eyebrow, title, lead }: { id: string; eyebrow: string; title: string; lead?: string }) {
  return (
    <header className={styles.sectionHead}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {lead && <p className={styles.lead}>{lead}</p>}
    </header>
  )
}

export function AiAgentIntro() {
  const t = useT()
  const a = t.courses.aiAgent
  return (
    <>
      <section className={styles.section} id="outcomes" aria-labelledby="ai-outcomes">
        <div className={styles.container}>
          <SectionHead id="ai-outcomes" eyebrow={a.outcomesEyebrow} title={a.outcomesTitle} lead={a.outcomesLead} />
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

      <section className={`${styles.section} ${styles.alt}`} id="audience" aria-labelledby="ai-audience">
        <div className={styles.container}>
          <SectionHead id="ai-audience" eyebrow={a.audienceEyebrow} title={a.audienceTitle} />
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

      <section className={styles.section} id="units" aria-labelledby="ai-units">
        <div className={styles.container}>
          <SectionHead id="ai-units" eyebrow={a.unitsEyebrow} title={a.unitsTitle} lead={a.unitsLead} />
          <ol className={styles.units}>
            {UNITS.map((u) => (
              <li key={u.num} className={`${styles.card} ${styles.unit}`}>
                <div className={styles.unitNum} aria-hidden="true">
                  {u.num}
                </div>
                <div className={styles.unitBody}>
                  <h3>
                    {u.title}
                    {u.status === 'planned' && (
                      <span className={`${styles.badge} ${styles.badgePlanned}`}>
                        <span aria-hidden="true">🌱 </span>
                        {t.courses.planned}
                      </span>
                    )}
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

      <section className={`${styles.section} ${styles.alt}`} id="teaching" aria-labelledby="ai-teaching">
        <div className={styles.container}>
          <SectionHead id="ai-teaching" eyebrow={a.teachingEyebrow} title={a.teachingTitle} lead={a.teachingLead} />
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
    </>
  )
}
