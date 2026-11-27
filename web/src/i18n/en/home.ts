import type { Messages } from '../zh'

const LEVEL_NAMES: Record<string, string> = {
  起步: 'Starter',
  零基礎: 'Beginner',
  基礎: 'Foundations',
  中階: 'Intermediate',
  進階: 'Advanced',
}

export const home: Messages['home'] = {
  introTitle: 'Use AI to spend your time on what matters',
  introPitch: 'Pick a topic, follow along hands-on, and make something you can see.',
  courseMap: 'Course map',
  viewCourseMap: 'View course map',
  startFirstLesson: 'Start the first lesson',
  planned: 'Coming soon',
  openNow: 'Open now',
  levelName: (label) => LEVEL_NAMES[label] ?? label,

  home: {
    facts: {
      free: { pre: '', strong: 'Free', post: ' to start' },
      noCode: { pre: 'No ', strong: 'coding', post: ' experience needed' },
    },
    ladderLabel: 'Course order',
    learnTitle: 'What you’ll learn',
    moreTopics: 'More topics',
  },

  themeCard: {
    youWillMake: 'What you’ll build',
    stuck: 'Sound familiar?',
    learnDefault: 'What you’ll learn',
    flowLabel: 'What you’ll go through',
    before: 'Before',
    after: 'After',
    scenarios: 'Scenarios covered',
    seePlan: 'See the course plan',
    views: (n: number) => (n === 1 ? '1 view' : `${n.toLocaleString('en')} views`),
  },

  software: {
    free: 'Free',
    contentReady: 'Course available',
    listSep: ', ',
    openedLessons: (list) => `${list} available`,
    lessonContent: 'What’s inside',
    tentative: ' (tentative)',
    prerequisite: 'Prerequisite',
    viewCourse: 'View course',
    overviewLabel: 'Levels at a glance',
    tour: 'Quick tour',
    tourPlay: 'Play the tour',
    demoLabel: 'A short clip of the interactive prologue: the cursor switches approach, gives the AI agent one sentence, then watches it write the code and run the tests.',
    startLearning: 'Start learning',
    statLessons: (n) => (n === 1 ? 'lesson open now' : 'lessons open now'),
    statMinutes: (n) => (n === 1 ? 'minute of content' : 'minutes of content'),
    statHours: (n) => (n === 1 ? 'hour of content' : 'hours of content'),
    statStages: (n) => (n === 1 ? 'stage, step by step' : 'stages, step by step'),
    featured: (level, title) => `${level} course: ${title}`,
    eyebrow: 'Step by step',
    levelsTitle: 'Course levels',
    levelsLead: 'Ordered from easiest to hardest. Courses marked “Coming soon” are still being planned, and their names and content may change.',
  },


  kidsTopic: {
    pitch: (slogan) => `${slogan}. No typing code: just click and drag blocks to build web pages. We recommend a parent learns alongside.`,
    howTitle: 'How the kids’ course works',
    howLead: 'In the Member area, a parent sets class times and turns on Kids Mode. Your child then sees only the kids’ course, can start only at class time, and goes through the lessons one by one.',
    mapLead: 'New lessons are on the way; ones not open yet are marked “Coming soon”. Preview the first five lessons without signing in, then sign in to take the rest.',
  },

  gate: {
    loadError: 'We couldn’t load the course right now. Please try again in a moment.',
    reload: 'Reload',
    notOpen: 'This lesson isn’t open yet. It will appear on the course map when it’s ready.',
    backToMap: 'Back to course map',
  },

  kidsLesson: {
    notYetTime: 'It’s not class time yet',
    nextSlot: (slot, title) => `Your next class is ${slot}. Come back then for “${title}”!`,
    noSchedule: 'Your parent hasn’t set class times yet.',
    backToMyLessons: 'Back to my lessons',
    preparing: 'Getting ready…',
    locked: 'This lesson isn’t ready for you yet',
    finishFirst: (title) => `Finish “${title}” first, then keep going one lesson at a time!`,
    checkMap: 'Go back to the course map and take a look!',
    goTo: (title) => `Go to “${title}”`,
    thisLesson: 'This lesson',
    forParents: 'For parents',
    openSections: 'Show parts',
    closeSections: 'Hide parts',
    sectionsButton: '☰ Parts',
    closeButton: 'Hide ▴',
    gotIt: 'Got it',
  },

  map: {
    signInToLearn: 'Sign in to learn',
    start: 'Start',
    freePreview: 'Try it',
    planned: 'Coming soon',
    draft: 'Draft',
  },

  showcase: {
    title: 'Course preview',
    heading: 'See what a class looks like',
    lead: 'No sign-in needed. Just press play and try an interactive lesson.',
    sections: 'Lesson parts',
  },

  notFound: {
    title: 'Page not found',
    body: 'The address may be mistyped, or the page has moved.',
    home: 'Back to home',
  },

  lazy: {
    failedTitle: 'This page didn’t load',
    failedBody: 'The connection may be unstable, or the site was just updated. Refresh to continue.',
    reload: 'Refresh',
  },

  ad: {
    label: 'Ad',
    placeholder: 'Ad slot (dev preview)',
  },
}
