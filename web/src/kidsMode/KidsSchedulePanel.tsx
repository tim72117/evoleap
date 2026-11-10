import { Link } from 'react-router-dom'
import { KIDS_OPEN_LESSONS, KIDS_RELEASED_LESSONS, kidsLessonTitle } from '../content/kidsCourse'
import type { KidsMode } from './api'
import { planWeek, taipeiNow } from './plan'
import { useKidsProgress } from './progress'
import { slotLabel } from './schedule'
import styles from './KidsSchedulePanel.module.css'

// 兒童模式畫面最上方:家長安排好的這週的課。現在能不能上、下一堂幾點(伺服器算的);只替最近的一次排課(第一個還沒看完的課,
// 看完了就換下一課),之後的時段到時候再依進度安排(plan.ts)。

const STATE_LABEL = {
  now: '現在上課',
  next: '下一堂',
  done: '本週已上過',
  later: '',
} as const

const hhmm = (iso?: string): string =>
  iso
    ? new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(iso))
    : ''

export function KidsSchedulePanel({ mode }: { mode: Extract<KidsMode, { active: true }> }) {
  const progress = useKidsProgress()
  const finished = progress?.finished ?? new Set<string>()

  const { child, schedule } = mode
  const plan = planWeek(child.slots, taipeiNow(new Date()), child.minutes, KIDS_RELEASED_LESSONS, finished)

  return (
    <section className={styles.panel} aria-labelledby="kids-plan-title">
      <div className={styles.inner}>
        <h1 id="kids-plan-title">
          <span className={styles.avatar} aria-hidden="true">
            {child.avatar}
          </span>
          {child.name} {plan[0]?.nextWeek ? '下週的課' : '這週的課'}
        </h1>
        {schedule.open ? (
          <p className={`${styles.status} ${styles.open}`}>現在可以上課，到 {hhmm(schedule.endsAt)} 結束。</p>
        ) : (
          <p className={styles.status}>
            {schedule.next
              ? `還沒到上課時間，下一堂是 ${slotLabel({ day: schedule.next.day, time: schedule.next.time as never })}。`
              : '家長還沒排上課時間，請家長到會員空間的「兒童」排課。'}
          </p>
        )}
        {plan.length ? (
          <ol className={styles.slots}>
            {plan.map((p) => (
              <li key={`${p.slot.day}-${p.slot.time}`} className={styles[p.state]}>
                {/* 這週的都過了時列的是下週的時段 */}
                <span className={styles.when}>
                  {p.nextWeek ? '下' : ''}
                  {slotLabel({ day: p.slot.day, time: p.slot.time as never })}
                </span>
                <span className={styles.lesson}>
                  {p.lessonId ? `${p.lessonId} ${kidsLessonTitle(p.lessonId)}` : p.state === 'done' ? '—' : p.state === 'later' ? '之後依進度安排' : '已開放的課都上完了'}
                </span>
                {/* 正在上課的那一列:開始上課就放在這一列上 */}
                {p.state === 'now' && schedule.open && p.lessonId ? (
                  <Link className={styles.go} to={KIDS_OPEN_LESSONS[p.lessonId].path}>
                    開始上課
                  </Link>
                ) : STATE_LABEL[p.state] ? (
                  <span className={styles.tag}>{STATE_LABEL[p.state]}</span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  )
}
