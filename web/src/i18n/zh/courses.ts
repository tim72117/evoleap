// courses 的介面文字(繁中,基準)。英文在 ../en/courses.ts,鍵要一模一樣。
export const courses = {
  // ---------- 課程資料裡的固定格式(catalog.ts、levels.ts 的中文標籤;英文版依中文對照) ----------
  /** 等級標籤(course.level、levelLabel):起步、零基礎、基礎、中階…… */
  levelName: (level: string) => level,
  /** 課程地圖的開放標示(ACCESS_LABEL):免費 */
  accessName: (label: string) => label,
  /** 第 N 課 */
  lessonN: (n: string) => `第 ${n} 課`,
  /** 單課的特殊名稱(lesson.label):序章 */
  lessonName: (label: string) => label,
  /** 規劃中章節的編號(chapter.label):單元 N、期末專案、主題 N、4.1 */
  chapterName: (label: string) => label,
  /** 課程資料裡的課程長度(「約 15 分」);minutes 是換算後的分鐘數 */
  lessonLength: (raw: string, _minutes: number) => raw,
  /** 總時長 */
  aboutMinutes: (total: number) => `約 ${total} 分鐘`,
  aboutHours: (hours: number, minutes: number) => `約 ${hours} 小時${minutes ? ` ${minutes} 分` : ''}`,
  lessonCount: (n: number) => `${n} 課`,
  minutes: (n: number) => `${n} 分鐘`,
  progressLoadFailed: '讀不到學習進度',

  // ---------- 共用 ----------
  breadcrumb: '麵包屑',
  courseMap: '課程地圖',
  planned: '規劃中',
  prevLesson: '上一課',
  nextLesson: '下一課',
  nextChapter: '下一章',
  /** 同一個主題的下一門課 */
  nextCourse: '下一章',
  prevChapter: '上一章',
  backTo: '回到',
  courseOverview: '課程總覽',
  backToOverview: '回課程總覽',

  // ---------- 全部課程(CourseListPage) ----------
  list: {
    intro: '依主題列出所有課程。標示「規劃中」的課程名稱與內容仍在規劃，可能調整。',
    openN: (n: number) => `已開放 ${n} 課`,
    demoVideosN: (n: number) => `${n} 支示範影片`,
    otherPlanned: '其他規劃中',
    viewMap: '看課程地圖',
    viewScenarios: '看全部情境',
    viewContent: '看課程內容',
  },

  // ---------- 主題頁(home/TopicPage.tsx) ----------
  topicPage: {
    /** 頁面標題:<主題>｜主題 */
    title: (name: string) => `${name}｜主題`,
    heading: '這個主題的課程',
    plannedNote: '標示「規劃中」的內容仍在規劃，可能調整。',
  },

  // ---------- 課程總覽(CourseOverviewPage) ----------
  overview: {
    start: '開始學習',
    content: '課程內容',
    freePreview: '免費預覽',
    signInToLearn: '登入後學習',
    interactive: '互動',
    /** 只顯示一個單元(#stage-<id>)時,回到全部單元的連結 */
    otherUnits: '這門課還有其他單元',
    allUnits: '看全部單元',
  },

  // ---------- 規劃中的課程與章節(PlannedPages) ----------
  plannedPages: {
    chapters: '章節',
    chaptersPlannedOpen: '（',
    chaptersPlannedClose: '）',
    chapterGoal: '這一章的目標',
    afterDone: (result: string) => `完成後：${result}`,
    comingSoon: '這一章的影片與操作步驟製作中，完成後會在這裡上架。',
    pager: '上一章與下一章',
  },

  // ---------- AI 互動軟體中階(AiAgentCoursePage) ----------
  aiAgent: {
    features: '課程特色',
    viewUnits: '查看課程單元',
    outcomesEyebrow: '學習成果',
    outcomesTitle: '你會學到什麼',
    outcomesLead: '完成這堂課後，你將能夠：',
    audienceEyebrow: '適合對象',
    audienceTitle: '這堂課適合誰',
    fit: '適合',
    notFit: '較不適合',
    prerequisites: '需要具備的背景知識',
    unitsEyebrow: '課程單元',
    unitsTitle: '從第一個工具到上線的整合應用',
    unitsLead: '每個單元都有明確的學習目標與動手實作。單元內容持續規劃與更新中。',
    concepts: '對應概念',
    practice: '實作',
    teachingEyebrow: '教學方式',
    teachingTitle: '影片加實作，一次只講一個想法',
    teachingLead: '課程的切片長度、腳本與錄製方式，依據線上課程設計研究整理出的製作原則。',
  },

  // ---------- 單課頁(LessonPage) ----------
  lesson: {
    prompt: '提示詞',
    nowPlaying: '播放中',
    playFromStep: '從這一步開始播放',
    stepInVideo: (n: number) => `這一步在影片 ${n} 示範`,
    videoN: (n: number) => `影片 ${n}`,
    noPrompt: '這一步是介面操作，不需要提示詞。',
    expected: '應該看到',
    note: '注意',
    nextStep: '下一步',
    prevStep: '上一步',
    nextStepKey: '下一步（→）',
    prevStepKey: '上一步（←）',
    /** 「登入」連結後面接的說明 */
    guestHint: '後會記住你看到哪裡，下次從這裡接著看；未登入不會儲存播放進度。',
    videos: '本課影片',
    followSteps: '跟著步驟做',
    totalSteps: (n: number) => `共 ${n} 步`,
    stepN: (n: number) => `第 ${n} 步`,
    ofSteps: (n: number) => `${n} 步`,
    goal: '目標',
    railFoot: '影片播到哪一步就展開哪一步；也可以自己點開任一步。',
    wrapUpLink: '完成檢核 ↓',
    lessonGoal: '這一課的目標',
    wrapUp: '完成檢核',
    deliverable: '完成後你會有',
    materials: '需要準備',
    tryYourOwn: '換成你自己的點子',
    pager: '上一課與下一課',
    finishCourse: '完成這門課',
    backToMap: '回到課程地圖',
  },

  // ---------- 互動版單課頁(InteractiveLessonPage) ----------
  interactive: {
    back: '← 課程',
    /** 「登入」連結後面接的說明 */
    guestHint: '後會記住你看到哪裡，下次從這裡接著看。',
    prev: (label: string) => `← 上一課：${label}`,
    next: (label: string) => `下一課：${label} →`,
    nextChapter: (level: string) => `下一章：${level} →`,
    courseMap: '課程地圖 →',
  },

  // ---------- 要登入的單課頁(LoginGate、routes.tsx) ----------
  gate: {
    checkFailed: '暫時無法確認登入狀態，請重新整理再試一次。',
    reload: '重新整理',
    signInOrUp: '登入或註冊',
    note: '序章可以直接預覽；第 0 課登入後免費觀看，之後的課程需要訂閱。登入後也會記錄你的播放進度。',
  },

  // ---------- 訂閱課程的單課頁(SubscriptionGate) ----------
  subscriptionGate: {
    notOpen: '這門課還沒開放，敬請期待。',
    needPlan: '這一課需要登入並選擇方案。廣告方案免費，可以觀看基礎訂閱課程。',
    checkFailed: '暫時無法確認你能不能觀看這一課，請重新整理再試一次。',
  },

  // ---------- 模擬播放器(MockPlayer) ----------
  mock: {
    label: (title: string) => `預覽大綱：${title}`,
    badge: '預覽大綱 · ',
    badgePlanned: '影片規劃中',
    pressPlay: '按下播放預覽大綱',
    opening: '開場：目標 → 步驟拆解',
  },

  // ---------- 即時教學畫面(LivePlayer) ----------
  live: {
    cannotPlay: '無法播放：',
  },
}
