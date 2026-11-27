// home 的介面文字(繁中,基準)。英文在 ../en/home.ts,鍵要一模一樣。
// 範圍:首頁、各主題頁、主題課程頁外殼、展示頁、找不到頁面、頁面載入失敗、廣告位。
// 主題名稱、標語、課名、簡介是課程內容(src/content/),不放在這裡。

/** 粗體夾在中間的一句話:pre<strong>strong</strong>post */
type Rich = { pre: string; strong: string; post: string }

export const home = {
  /** 首頁最上面的大標與一句話(與 content/topics.ts 的 HOME_INTRO 相同;SEO 用那邊的) */
  introTitle: '善用 AI，把時間用在真正想做的事',
  introPitch: '選一個主題，跟著實際操作，做出看得見的成果。',
  courseMap: '課程地圖',
  viewCourseMap: '查看課程地圖',
  startFirstLesson: '開始第一課',
  planned: '規劃中',
  openNow: '開放中',
  /** 課的顯示名稱:序章、第 N 課 */
  /** 等級名稱(起步、零基礎、基礎、中階、進階);課程資料裡是中文,英文版照表換 */
  levelName: (label: string) => label,

  home: {
    facts: {
      free: { pre: '', strong: '免費', post: '開始' } as Rich,
      noCode: { pre: '不用先學', strong: '程式', post: '' } as Rich,
    },
    ladderLabel: '課程順序',
    learnTitle: '你會學到什麼',
    moreTopics: '更多主題課程',
  },

  themeCard: {
    youWillMake: '你會做出',
    stuck: '你是不是也卡在這裡',
    learnDefault: '學完你會',
    flowLabel: '會經歷的步驟',
    before: '整理前',
    after: '整理後',
    scenarios: '涵蓋的情境',
    seePlan: '看課程規劃',
    views: (n: number) => `${n.toLocaleString('zh-Hant')} 次觀看`,
  },

  software: {
    free: '免費',
    contentReady: '課程內容已上架',
    /** 已開放的課名之間的分隔 */
    listSep: '、',
    openedLessons: (list: string) => `${list}已開放`,
    lessonContent: '課程內容',
    tentative: '（暫定）',
    prerequisite: '先備條件',
    viewCourse: '查看課程內容',
    overviewLabel: '等級總覽',
    tour: '導覽影片',
    tourPlay: '播放導覽',
    demoLabel: '序章互動畫面的示範片段：游標切換做法、對 AI Agent 說一句話，再看它寫好程式並跑測試。',
    startLearning: '我要開始學',
    statLessons: (_n: number) => '堂已開放的課',
    statMinutes: (_n: number) => '分鐘課程內容',
    statHours: (_n: number) => '小時課程內容',
    statStages: (_n: number) => '個階段，由淺入深',
    featured: (level: string, title: string) => `${level}課程：${title}`,
    eyebrow: '由淺入深',
    levelsTitle: '課程等級',
    levelsLead: '由上往下依難度排列。標示「規劃中」的課程名稱與內容仍在規劃，可能調整。',
  },


  kidsTopic: {
    pitch: (slogan: string) => `${slogan}。不用打程式碼，點一點、拖一拖積木就能做出網頁；建議家長在旁陪學。`,
    howTitle: '怎麼使用兒童課程',
    howLead: '家長在會員空間替孩子排好上課時間、開啟兒童模式，孩子就只看得到兒童課程，時間到了才能上課，一課一課照進度往下上。',
    mapLead: '課程陸續開放中，還沒開放的課標「規劃中」。前五課不用登入就能預覽，之後的課登入後就能學習。',
  },

  gate: {
    loadError: '暫時讀不到課程資料，請稍後再試一次。',
    reload: '重新載入',
    notOpen: '這一課還沒開放，完成後會出現在課程地圖上。',
    backToMap: '回課程地圖',
  },

  kidsLesson: {
    notYetTime: '還沒到上課時間',
    nextSlot: (slot: string, title: string) => `下一堂是 ${slot}，到時候再來上「${title}」吧！`,
    noSchedule: '家長還沒排上課時間。',
    backToMyLessons: '回到我的課',
    preparing: '準備中…',
    locked: '這一課還沒到',
    finishFirst: (title: string) => `先上完「${title}」，再一課一課往下上吧！`,
    checkMap: '先回到課程地圖看看吧！',
    goTo: (title: string) => `去上「${title}」`,
    thisLesson: '這一課',
    forParents: '給家長',
    openSections: '打開段落',
    closeSections: '收起段落',
    sectionsButton: '☰ 段落',
    closeButton: '收起 ▴',
    gotIt: '知道了',
  },

  map: {
    signInToLearn: '登入後學習',
    start: '開始學習',
    freePreview: '試看',
    planned: '規劃中',
    draft: '草稿',
  },

  showcase: {
    title: '課程展示',
    heading: '看看上課的樣子',
    lead: '不用登入，直接按播放，體驗互動課程。',
    sections: '課程環節',
  },

  notFound: {
    title: '找不到頁面',
    body: '網址可能打錯了，或頁面已經移動。',
    home: '回首頁',
  },

  lazy: {
    failedTitle: '這一頁沒有載入成功',
    failedBody: '可能是網路不穩，或網站剛更新。重新整理就能繼續。',
    reload: '重新整理',
  },

  ad: {
    label: '廣告',
    placeholder: '廣告位（開發預覽）',
  },
}
