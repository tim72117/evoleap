import type { Messages } from '../zh'

export const kidsMode: Messages['kidsMode'] = {
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  nextWeekPrefix: 'Next ',
  simulatedChild: 'Test Kid',
  avatarFallback: 'K',
  thisWeek: 'This week’s classes',
  nextWeek: 'Next week’s classes',
  openUntil: (time: string) => `Class is open now until ${time}.`,
  notYet: (slot: string) => `It’s not class time yet. Your next class is ${slot}.`,
  noSlots: 'No class times yet. Ask a parent to set them up under “Kids” in the Member area.',
  laterByProgress: 'Picked later, based on progress',
  allDone: 'You’ve finished all the lessons so far!',
  startClass: 'Start class',
  state: { now: 'Now', next: 'Next', done: 'Done this week', later: '' },
  capsuleLabel: (name: string) => `Kids Mode: ${name}`,
  menuLabel: 'Kids Mode',
  active: 'In Kids Mode',
  leaving: 'Leaving…',
  leave: 'Leave Kids Mode',
  loggingOut: 'Signing out…',
  logout: 'Sign out',
}
