import { Fragment, type ReactNode } from 'react'
import type { PageBlock, PageSection } from '../content/topicPage'
import type { CourseMapState } from '../content/courseMap'
import { LessonListStatus } from '../courses/LessonGroup'
import { useT } from '../i18n/I18nProvider'
import styles from './TopicSections.module.css'

// 主題頁的介紹區塊:卡片格(cards)、分組條列(lists)、課程單元(units)。區塊標題空的用介面內建的(依區塊種類)。

type Head = { eyebrow?: string; title?: string; lead?: string }

function Section({ section, alt, fallback, children }: { section: PageSection; alt: boolean; fallback: Head; children: ReactNode }) {
  const eyebrow = section.eyebrow || fallback.eyebrow
  const lead = section.lead || fallback.lead
  const headingId = `ai-${section.id}`
  return (
    <section className={alt ? `${styles.section} ${styles.alt}` : styles.section} id={section.id} aria-labelledby={headingId}>
      <div className={styles.container}>
        <header className={styles.sectionHead}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h2 id={headingId}>{section.title || fallback.title}</h2>
          {lead && <p className={styles.lead}>{lead}</p>}
        </header>
        {children}
      </div>
    </section>
  )
}

export function CardsSection({ section, alt }: { section: PageSection; alt: boolean }) {
  const a = useT().courses.aiAgent
  const numbered = section.variant === 'numbered'
  const fallback = numbered ? { eyebrow: a.outcomesEyebrow, title: a.outcomesTitle, lead: a.outcomesLead } : { eyebrow: a.teachingEyebrow, title: a.teachingTitle, lead: a.teachingLead }
  const blocks = section.blocks ?? []
  return (
    <Section section={section} alt={alt} fallback={fallback}>
      {numbered ? (
        <ol className={styles.outcomes}>
          {blocks.map((b, i) => (
            <li key={b.id} className={styles.card}>
              <span className={styles.outcomeNum}>{String(i + 1).padStart(2, '0')}</span>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.teaching}>
          {blocks.map((b) => (
            <div key={b.id} className={styles.card}>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

const Bullets = ({ block }: { block: PageBlock }) => (
  <ul>
    {(block.children ?? []).map((c) => (
      <li key={c.id}>{c.text}</li>
    ))}
  </ul>
)

export function ListsSection({ section, alt }: { section: PageSection; alt: boolean }) {
  const a = useT().courses.aiAgent
  const headings: Record<string, string> = { fit: a.fit, not_fit: a.notFit, requirement: a.prerequisites }
  const title = (b: PageBlock) => b.title || headings[b.variant ?? ''] || ''
  // variant=requirement 的群組接在前一張卡片裡
  const cards: PageBlock[][] = []
  for (const b of section.blocks ?? []) {
    if (b.variant === 'requirement' && cards.length) cards[cards.length - 1].push(b)
    else cards.push([b])
  }
  return (
    <Section section={section} alt={alt} fallback={{ eyebrow: a.audienceEyebrow, title: a.audienceTitle }}>
      <div className={styles.audience}>
        {cards.map(([head, ...rest]) => (
          <div key={head.id} className={`${styles.card} ${head.variant === 'fit' ? styles.fit : head.variant === 'not_fit' ? styles.notFit : ''}`}>
            <h3>{title(head)}</h3>
            <Bullets block={head} />
            {rest.map((b) => (
              <Fragment key={b.id}>
                <h3 className={styles.prereqHead}>{title(b)}</h3>
                <Bullets block={b} />
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </Section>
  )
}

export function UnitsSection({ section, alt, course }: { section: PageSection; alt: boolean; course: CourseMapState }) {
  const t = useT()
  const a = t.courses.aiAgent
  return (
    <Section section={section} alt={alt} fallback={{ eyebrow: a.unitsEyebrow, title: a.unitsTitle, lead: a.unitsLead }}>
      {course.status !== 'ready' && <LessonListStatus state={course.status} />}
      <ol className={styles.units}>
        {(course.status === 'ready' ? course.map.units.filter((u) => !u.hidden) : []).map((u) => {
          const copy = section.blocks?.find((b) => b.ref === u.id)
          return (
            <li key={u.id} className={`${styles.card} ${styles.unit}`}>
              <div className={styles.unitNum} aria-hidden="true">
                {copy?.label || u.id}
              </div>
              <div className={styles.unitBody}>
                <h3>
                  {u.title}
                  {copy?.variant === 'planned' && (
                    <span className={`${styles.badge} ${styles.badgePlanned}`}>
                      <span aria-hidden="true">🌱 </span>
                      {t.courses.planned}
                    </span>
                  )}
                </h3>
                <p className={styles.unitGoal}>{u.subtitle}</p>
                {copy && (
                  <dl>
                    <dt>{a.concepts}</dt>
                    <dd>{copy.text}</dd>
                    <dt>{a.practice}</dt>
                    <dd>{copy.note}</dd>
                  </dl>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}
