// 兒童模式畫面最上方「這週的課」:家長排的時段。只安排最近的一次(正在上的,沒有就是下一堂)要上哪一課:
// 照已開放的課的順序,第一個還沒看完的課;看完了就換下一課。之後的時段不先排,到時候再依進度安排。
import type { Slot } from './schedule'
import { currentLocale } from '../i18n/current'
import type { Locale } from '../i18n/locale'

export type PlannedSlot = {
  slot: Slot
  /** 這一堂要上的課號:只有最近的一次(now 或 next)有;已開放的課都上完了也是 null */
  lessonId: string | null
  /** now:正在上課的時段;next:下一堂;done:本週已經過了;later:本週之後的 */
  state: 'now' | 'next' | 'done' | 'later'
  /** 這週的時段都過了:改排下週的(第一堂是 next),這一堂在下週 */
  nextWeek?: boolean
}

/** 台灣時間的星期(0 是週一)與 HH:MM */
export function taipeiNow(t: Date): { day: number; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'))
  return { day, time: `${get('hour')}:${get('minute')}` }
}

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * 排出這週每一堂的狀態,只替最近的一次排課。lessons 是已開放的課(依順序),finished 是看完的課號。
 * 最近的一次是正在上的時段,沒有的話是下一堂;它要上第一個還沒看完的課,看完了就換下一課。其他時段不排。
 */
export function planWeek(slots: Slot[], now: { day: number; time: string }, slotMinutes: number, lessons: string[], finished: Set<string>): PlannedSlot[] {
  const plan = planFrom(slots, now.day * 24 * 60 + minutes(now.time), slotMinutes, lessons, finished)
  // 這週的時段都過了(例如週日晚上):最近的一次在下週,改列下週的時段
  if (plan.length && plan.every((p) => p.state === 'done')) return planFrom(slots, -1, slotMinutes, lessons, finished).map((p) => ({ ...p, nextWeek: true }))
  return plan
}

function planFrom(slots: Slot[], nowMin: number, slotMinutes: number, lessons: string[], finished: Set<string>): PlannedSlot[] {
  const upcoming = lessons.find((id) => !finished.has(id)) ?? null
  let nextMarked = false
  return [...slots]
    .sort((a, b) => a.day - b.day || minutes(a.time) - minutes(b.time))
    .map((slot) => {
      const start = slot.day * 24 * 60 + minutes(slot.time)
      const end = start + slotMinutes
      let state: PlannedSlot['state']
      if (nowMin >= end) state = 'done'
      else if (nowMin >= start) state = 'now'
      else if (!nextMarked) state = 'next'
      else state = 'later'
      if (state === 'next' || state === 'now') nextMarked = true
      return { slot, lessonId: state === 'now' || state === 'next' ? upcoming : null, state }
    })
}

/** 家長課表的一列:這週的一次上課(實際日期),上完的課與最近一次要上的課 */
export type WeekRow = {
  /** 這一次上課開始的時間 */
  start: Date
  slot: Slot
  state: PlannedSlot['state']
  /** 最近的一次(now、next)要上的課;其他是 null */
  lessonId: string | null
  /** 在這一次上課時間內看完的課 */
  finished: string[]
}

/**
 * 這週(台灣時間週一到週日)每一次上課的實際日期與狀態。records 是這個孩子的上課紀錄(看完的課與看完的時間,伺服器的 child_lessons),
 * 落在某一次上課的時間內就記在那一次;最近的一次要上第一個還沒看完的課(同 planWeek)。這週的都過了,最後多一列下週的第一堂。
 */
export function parentWeek(slots: Slot[], slotMinutes: number, now: Date, lessons: string[], records: { lessonId: string; at: Date }[]): WeekRow[] {
  const t = taipeiNow(now)
  // 這週一 00:00(台灣時間)
  const monday = new Date(now.getTime() - (t.day * 24 * 60 + minutes(t.time)) * 60_000)
  monday.setSeconds(0, 0)
  const finishedAll = new Set(records.map((r) => r.lessonId))
  let plan = planWeek(slots, t, slotMinutes, lessons, finishedAll)
  // 這週的時段都過了:這週的照樣列出(看得到上完的課),後面接下週的第一堂(下一堂)
  if (plan[0]?.nextWeek) plan = [...planFrom(slots, Infinity, slotMinutes, lessons, finishedAll), plan[0]]
  return plan.map((p) => {
    const start = new Date(monday.getTime() + ((p.nextWeek ? 7 : 0) * 24 * 60 + p.slot.day * 24 * 60 + minutes(p.slot.time)) * 60_000)
    const end = start.getTime() + slotMinutes * 60_000
    const finished = records.filter((r) => r.at.getTime() >= start.getTime() && r.at.getTime() < end).map((r) => r.lessonId)
    return { start, slot: p.slot, state: p.state, lessonId: p.lessonId, finished }
  })
}

/** 日期的寫法(台灣時間),依語言:中文「11/12（三）」、英文「Wed 11/12」 */
export function dateLabel(d: Date, locale: Locale = currentLocale()): string {
  const en = locale === 'en'
  const parts = new Intl.DateTimeFormat(en ? 'en-US' : 'zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', weekday: en ? 'short' : 'narrow' }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return en ? `${get('weekday')} ${get('month')}/${get('day')}` : `${get('month')}/${get('day')}（${get('weekday')}）`
}
