import type { Messages } from '../zh'

/** 課程資料裡的中文標籤 → 英文;對照表沒有的照原文 */
const LEVELS: Record<string, string> = {
  起步: 'Starter',
  零基礎: 'Beginner',
  基礎: 'Foundations',
  中階: 'Intermediate',
  進階: 'Advanced',
  'AI 互動軟體 中階': 'Intermediate',
  'AI 互動軟體 進階': 'Advanced',
}
const ACCESS: Record<string, string> = { 免費: 'Free' }
const LESSON_NAMES: Record<string, string> = { 序章: 'Prologue' }

const duration = (total: number): string => {
  if (total < 60) return `${total} min`
  const m = total % 60
  return `${Math.floor(total / 60)} hr${m ? ` ${m} min` : ''}`
}

export const courses: Messages['courses'] = {
  levelName: (level) => LEVELS[level] ?? level,
  accessName: (label) => ACCESS[label] ?? label,
  lessonN: (n) => `Lesson ${n}`,
  lessonName: (label) => LESSON_NAMES[label] ?? label,
  chapterName: (label) =>
    String(label) === '期末專案'
      ? 'Final project'
      : String(label)
          .replace(/^單元 /, 'Unit ')
          .replace(/^主題 /, 'Topic '),
  lessonLength: (raw, minutes) => (minutes ? `About ${duration(Number(minutes))}` : raw),
  aboutMinutes: (total) => `About ${total} min`,
  aboutHours: (hours, minutes) => `About ${hours} hr${minutes ? ` ${minutes} min` : ''}`,
  lessonCount: (n) => `${n} ${Number(n) === 1 ? 'lesson' : 'lessons'}`,
  minutes: (n) => `${n} min`,
  progressLoadFailed: "Couldn't load your learning progress",

  breadcrumb: 'Breadcrumb',
  courseMap: 'Course map',
  planned: 'Coming soon',
  prevLesson: 'Previous lesson',
  nextLesson: 'Next lesson',
  nextChapter: 'Next chapter',
  nextCourse: 'Next course',
  prevChapter: 'Previous chapter',
  backTo: 'Back to',
  courseOverview: 'Course overview',
  backToOverview: 'Back to course overview',

  list: {
    intro: 'All courses, grouped by topic. Courses marked “Coming soon” are still being planned, so their names and content may change.',
    openN: (n) => `${n} ${Number(n) === 1 ? 'lesson' : 'lessons'} available`,
    demoVideosN: (n) => `${n} demo ${Number(n) === 1 ? 'video' : 'videos'}`,
    otherPlanned: 'More coming soon',
    viewMap: 'View course map',
    viewScenarios: 'View all scenarios',
  },

  overview: {
    start: 'Start learning',
    content: 'Course content',
    freePreview: 'Free preview',
    signInToLearn: 'Sign in to watch',
    interactive: 'Interactive',
  },

  plannedPages: {
    chapters: 'Chapters',
    chaptersPlannedOpen: ' (',
    chaptersPlannedClose: ')',
    chapterGoal: 'Goal of this chapter',
    afterDone: (result) => `When you're done: ${result}`,
    comingSoon: "The videos and steps for this chapter are in the works. They'll appear here once they're ready.",
    pager: 'Previous and next chapter',
  },

  aiAgent: {
    features: 'Course highlights',
    viewUnits: 'See course units',
    outcomesEyebrow: 'Outcomes',
    outcomesTitle: "What you'll learn",
    outcomesLead: "By the end of this course, you'll be able to:",
    audienceEyebrow: 'Who it’s for',
    audienceTitle: 'Is this course for you?',
    fit: 'Good fit',
    notFit: 'Not the best fit',
    prerequisites: 'What you should already know',
    unitsEyebrow: 'Units',
    unitsTitle: 'From your first tool to a full app that’s live',
    unitsLead: 'Each unit has a clear learning goal and hands-on practice. Unit content is still being planned and updated.',
    concepts: 'Concepts',
    practice: 'Practice',
    teachingEyebrow: 'How we teach',
    teachingTitle: 'Video plus practice, one idea at a time',
    teachingLead: 'Clip length, scripts, and recording follow production principles drawn from research on online course design.',
  },

  lesson: {
    prompt: 'Prompt',
    nowPlaying: 'Playing',
    playFromStep: 'Play from this step',
    stepInVideo: (n) => `This step is shown in video ${n}`,
    videoN: (n) => `Video ${n}`,
    noPrompt: 'This step happens in the app itself, so no prompt is needed.',
    expected: 'You should see',
    note: 'Note',
    nextStep: 'Next step',
    prevStep: 'Previous step',
    nextStepKey: 'Next step (→)',
    prevStepKey: 'Previous step (←)',
    guestHint: " and we'll remember where you left off so you can pick up from there next time. Progress isn't saved when you're signed out.",
    videos: 'Videos in this lesson',
    followSteps: 'Follow the steps',
    totalSteps: (n) => `${n} ${Number(n) === 1 ? 'step' : 'steps'}`,
    stepN: (n) => `Step ${n}`,
    ofSteps: (n) => `${n}`,
    goal: 'Goal',
    railFoot: 'Each step opens as the video reaches it. You can also open any step yourself.',
    wrapUpLink: 'Checklist ↓',
    lessonGoal: 'Goal of this lesson',
    wrapUp: 'Checklist',
    deliverable: "What you'll have at the end",
    materials: 'What you need',
    tryYourOwn: 'Try it with your own idea',
    pager: 'Previous and next lesson',
    finishCourse: 'Course complete',
    backToMap: 'Back to the course map',
  },

  interactive: {
    back: '← Course',
    guestHint: " and we'll remember where you left off so you can pick up from there next time.",
    prev: (label) => `← Previous: ${label}`,
    next: (label) => `Next: ${label} →`,
    nextChapter: (level) => `Next course: ${level} →`,
    courseMap: 'Course map →',
  },

  gate: {
    checkFailed: "We couldn't confirm whether you're signed in. Please refresh and try again.",
    reload: 'Refresh',
    signInOrUp: 'Sign in or sign up',
    note: 'You can preview the Prologue right away. Lesson 0 is free once you sign in, and later lessons need a subscription. Signing in also saves your progress.',
  },

  mock: {
    label: (title) => `Outline preview: ${title}`,
    badge: 'Outline preview · ',
    badgePlanned: 'Video coming soon',
    pressPlay: 'Press play to preview the outline',
    opening: 'Intro: goal → steps',
  },

  live: {
    cannotPlay: "Can't play this video: ",
  },
}
