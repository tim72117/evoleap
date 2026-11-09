// 首頁的主題。一個主題是一組不同目標的課程:「做出自己的軟體」(levels.ts 的 LEVELS)與「打造 AI 互動軟體」(AI_APP_LEVELS)各有課程地圖頁。
// 規劃中的主題只放暫定的名稱、標語與預計做出的成果;不要寫未確認的事實(價格、日期、收入、學員數等)。
import { KIDS_OPEN_LESSONS, kidsLessonTitle } from './kidsCourse'
import { launchLessonPath } from './launchCourse'
import { AI_APP_LEVELS, SOFTWARE_LEDE } from './levels'
import { WEB_OPEN_LESSONS, webLesson } from './webCourse'

export const HOME_INTRO = {
  title: '善用 AI，把時間用在真正想做的事',
  pitch: '選一個主題，跟著實際操作，做出看得見的成果。',
  description: '善用 AI，把時間用在真正想做的事：選一個主題，跟著實際操作，從免費的入門課開始，做出看得見的成果。',
}

export const SOFTWARE_TOPIC = {
  name: '做出自己的軟體',
  slogan: '不會寫程式，也能打造自己的軟體',
  lede: SOFTWARE_LEDE,
  /** 課程地圖所在的頁面 */
  path: '/topics/software',
  /** 搜尋結果的標題與描述:寫學員會搜尋的說法,不要寫未確認的事實 */
  seoTitle: '不會寫程式也能做軟體：零基礎 AI 開發課程地圖',
  description: `${SOFTWARE_LEDE}。零基礎也能開始，用 AI 做出網站與小工具，再學會串接自動化流程，免費從入門課開始。`,
}

/** 主題「打造 AI 互動軟體」：中階、進階兩門課（levels.ts 的 AI_APP_LEVELS），都還在規劃中 */
export const AI_APPS_TOPIC = {
  name: '打造 AI 互動軟體',
  slogan: '不只是對話，讓 AI 查資料、跑分析、畫出圖表',
  path: '/topics/ai-apps',
  seoTitle: 'AI 互動軟體開發課程：讓 AI 查資料、跑分析、畫圖表',
  description: '學會打造會動手做事的 AI 軟體：寫出工具、讓 AI 自己判斷要呼叫哪一個，做成打字提問就能用的介面，並穩定上線。課程規劃中。',
}

/** 主題「Claude Code 工作術」:只整理使用情境、沒有實作,不分等級,還在規劃中 */
export const CLAUDE_CODE_TOPIC = {
  name: 'Claude Code 工作術',
  slogan: '遇到這些情況時，該怎麼用',
  path: '/topics/claude-code',
  seoTitle: 'Claude Code 使用技巧：常見情境與對應做法',
  description: '整理使用 Claude Code 時的常見情境：換手機接著做、同時試好幾版、接回昨天的對話、把規則寫下來。遇到哪個情況就看哪一個。內容規劃中。',
}

/** 主題「從做好到上線」:開放中(序章三課可以上,其他課規劃中),課程地圖在 /topics/launch(home/LaunchTopicPage.tsx),大綱在 content/launchCourse.ts;首頁放在「做出自己的軟體」下方 */
export const LAUNCH_TOPIC = {
  name: '從做好到上線',
  slogan: '繁雜的上線流程交給 AI，輕鬆讓作品變成服務',
  path: '/topics/launch',
  seoTitle: '從做好到上線：用 AI 處理繁雜流程，輕鬆把作品放上線',
  description: '部署、網域、資料與登入、收費、監控，這些繁雜的上線流程，學會用 AI 處理，輕鬆把做好的網站與工具變成別人能用的服務。序章開放中，第一課可以免費預覽。',
  open: true,
  start: { label: '開始第一課', path: launchLessonPath('0.1') },
  pains: [
    '做好了，網址卻是 localhost，傳給朋友打不開',
    '一上線就白畫面、資料不見，錯誤訊息看不懂',
    '金鑰放在程式裡安不安全？流量變大會不會收到一大筆帳單？',
    '想讓人登入、想收費，不知道從哪裡開始',
    '上線後有沒有人在用、哪裡壞了，都要等別人來講才知道',
  ],
  learnTitle: '你會學會',
  learn: ['用 AI 架設公開網站', '用 AI 做自動部署', '用 AI 避開資安風險', '用 AI 做網站監控'],
} satisfies PlannedTopic & { path: string; seoTitle: string; description: string }

/** 這個主題的情境,依遇到的情況列出,沒有先後順序。tools 是會用到的功能,名稱以官方文件為準,改版時要更新 */
export const CLAUDE_CODE_SCENARIOS: {
  title: string
  summary: string
  tools: string[]
  /** 示範影片:src/content/live/ 底下的腳本路徑 */
  video?: { script: string; title: string; duration: string }
}[] = [
  {
    title: '拿不定主意，想同時試好幾版',
    summary: '從同一段對話分出去，各試一個方向，看過再決定留哪一個。',
    tools: ['/fork', '/branch', 'Worktree'],
    video: { script: 'claude-code/fork.json', title: 'Fork：帶著對話另開一條路', duration: '約 1 分鐘' },
  },
  { title: '出門了，想用手機接著做', summary: 'AI 繼續在電腦上做，你在路上也能看進度、接著下指令。', tools: ['/remote-control'] },
  { title: '好幾件事想同時做', summary: '把互不相干的事分給不同的對話，自己只負責檢查與決定。', tools: ['多個 session', 'Worktree'] },
  { title: '昨天做到一半，今天想接著做', summary: '找回之前的對話接著做，不用重新交代一次。', tools: ['/resume', 'claude --continue'] },
  { title: '對話越聊越長', summary: '把目前的對話濃縮成摘要繼續，或開一段乾淨的新對話。', tools: ['/compact', '/clear'] },
  { title: '每次都要重講同樣的規則', summary: '把專案的固定規則寫進說明檔，每次新對話都會先讀。', tools: ['CLAUDE.md', '/init'] },
  { title: '任務要跑很久，不想一直盯著', summary: '把對話丟到背景繼續跑，先去忙別的，之後再回來看結果。', tools: ['/background', 'claude agents'] },
]

/** 全部課程的清單頁:跨主題列出 catalog.ts 的每一門課,以及網頁怎麼運作、從做好到上線、給孩子的網頁程式、Claude Code 工作術 */
export const COURSE_LIST = {
  name: '全部課程',
  path: '/courses',
  seoTitle: '全部課程：從零基礎到 AI 互動軟體',
  description: '依主題列出所有 AI 課程：從零基礎做出自己的網站與小工具、看懂網頁怎麼運作、給孩子的網頁程式課，到打造會查資料、跑分析的 AI 互動軟體，也整理 Claude Code 的常見使用情境。可以看到每門課目前開放與規劃中的狀態。',
}

/** 課程所在的主題(依課程頁路徑判斷):麵包屑、「課程地圖」連結用 */
export function topicOfCourse(coursePath: string): { name: string; path: string } {
  return AI_APP_LEVELS.some((l) => l.link === coursePath) ? AI_APPS_TOPIC : SOFTWARE_TOPIC
}

export type PlannedTopic = {
  name: string
  slogan: string
  /** 主題名稱旁的圖示(HomePage 的 TOPIC_ICONS) */
  icon?: 'terminal'
  /** 已有課程地圖頁的主題：首頁卡片連到這裡 */
  path?: string
  /** 預計會做出的成果 */
  outcomes?: string[]
  /** 這個主題解決的痛點(首頁卡片的「你是不是也卡在這裡」) */
  pains?: string[]
  /** 只整理使用情境、沒有實作的主題:列出涵蓋的情境(取代 outcomes) */
  scenarios?: string[]
  /** 過程的步驟(沒有 sample 時顯示) */
  flow?: string[]
  /** 整理前後的示意 */
  sample?: { caption: string; before: string[]; after: string[] }
  /**
   * 課程預覽:src/content/live/ 底下的腳本,用兒童版播放器(kids/KidsPlayer.tsx)播。
   * intro 放在環節清單上方;sections 是腳本的段落名稱 → 給家長看的說明、是不是要孩子動手(可互動)
   */
  preview?: { script: string; intro?: string; sections?: Record<string, { note?: string; interactive?: boolean }> }
  /** 首頁卡片的主色標籤:有標籤時取代「開放中/規劃中」 */
  tag?: string
  /** 首頁卡片標語下的一段說明 */
  intro?: string
  /** 首頁卡片的「學完你會」 */
  learn?: string[]
  /** learn 的標題(預設「學完你會」) */
  learnTitle?: string
  /** 已經開放的主題:首頁卡片用實線外框;不寫就是規劃中,標題旁標「規劃中」(首頁不標「開放中」) */
  open?: boolean
  /** 首頁卡片的「開始」按鈕:已經可以上的第一課 */
  start?: { label: string; path: string }
}

/**
 * 主題「給孩子的網頁程式」:開放中(課程陸續開放),首頁單獨放在「更多主題課程」上方;課程地圖在 /topics/kids(home/KidsTopicPage.tsx)。
 * 單元與課程在 content/kidsCourse.ts;研發中的大綱與試做在研發基地 /studio/kids-web。這裡只寫大綱裡已有的內容。
 */
export const KIDS_TOPIC = {
  name: '給孩子的網頁程式',
  slogan: '用積木蓋網頁，陪 9 歲的孩子做出自己的小網站',
  path: '/topics/kids',
  seoTitle: '給孩子的網頁程式課：用積木認識 HTML、CSS、JavaScript',
  description: '給 9 歲左右孩子的網頁程式課：不用打程式碼，用積木蓋網頁、幫網頁換衣服、讓網頁動起來，做出自己的小網站。課程陸續開放中，第一課可以免費預覽。',
  open: true,
  start: { label: '開始第一課', path: KIDS_OPEN_LESSONS['0.1'].path },
  flow: ['用積木蓋網頁', '幫網頁換衣服', '讓網頁動起來', '說清楚，請 AI 幫忙做'],
  outcomes: ['說得出網頁每個部分的名字', '一張自己的寵物名片網頁', '請 AI 做出自己的小網站'],
  // 這張卡片是給家長看的:環節說明寫孩子會做什麼;段落名稱要和 content/live/kids/0.1.json 的 chapter 一致
  preview: {
    script: KIDS_OPEN_LESSONS['0.1'].script,
    intro: '這堂課可以互動：標著「可互動」的環節會停下來，等孩子自己點畫面上的網頁和積木。點下面的環節可以直接跳過去看。',
    sections: {
      網頁有背面: { note: '跟著旁白看：網頁翻到背面，原來是一塊一塊印著名字的積木。' },
      換你試試看: { note: '孩子自己點網頁上的東西或積木，把 4 塊積木都找出來。', interactive: true },
      找找看: { note: '三個小問題，答錯會說明原因，再試一次。', interactive: true },
      學會: { note: '用一句話整理：網頁是用一塊一塊積木蓋出來的。' },
    },
  },
} satisfies PlannedTopic & { path: string; seoTitle: string; description: string }

/** 兒童課課程頁的標題(頁面的 document.title 與 seo/pages.ts 共用) */
export const kidsLessonDocTitle = (id: string): string => `${kidsLessonTitle(id)}｜${KIDS_TOPIC.name}`

/**
 * 主題「網頁怎麼運作」:開放中(序章、單元 1 的 1.1、1.2 可以上,其他課規劃中),課程地圖在 /topics/web(home/WebTopicPage.tsx)。
 * 單元與課程在 content/webCourse.ts;研發中的構想在研發基地 /studio/web-basics。第一課(0.1)不用登入就能預覽,其他開放的課要登入(訂閱制上線後改成訂閱才能看)。
 */
export const WEB_TOPIC = {
  name: '網頁怎麼運作',
  slogan: '語法交給 AI，看懂原理才能跟 AI 說清楚',
  path: '/topics/web',
  seoTitle: '網頁怎麼運作：AI 時代的網頁基礎課',
  description: 'AI 已經能寫出大部分的程式碼，這門課不教語法，教網頁怎麼運作：瀏覽器、HTML 與 CSS、前端與後端、上線。懂了原理、用對名詞，才能跟 AI 說清楚要什麼。第一課可以免費預覽。',
  open: true,
  start: { label: '開始第一課', path: WEB_OPEN_LESSONS['0.1'].path },
  tag: 'AI 寫程式，我還需要知道什麼？',
  intro: 'AI 已經能寫出大部分的程式碼，但寫得出來，不代表你看得懂、說得準。這門課不教語法，教網頁怎麼運作：瀏覽器怎麼畫出畫面、樣式和資料各歸誰管、網站怎麼放上網路。',
  learn: ['用對名詞，把想要的畫面和功能跟 AI 說清楚', '看懂 AI 改了哪裡、為什麼這樣改', '畫面壞掉時，知道該往哪裡找問題'],
} satisfies PlannedTopic & { path: string; seoTitle: string; description: string }

/** 網頁怎麼運作課程頁的標題(頁面的 document.title 與 seo/pages.ts 共用) */
export const webLessonDocTitle = (id: string): string => `${webLesson(id)?.title ?? id}｜${WEB_TOPIC.name}`

export const PLANNED_TOPICS: PlannedTopic[] = [
  WEB_TOPIC,
  {
    ...AI_APPS_TOPIC,
    flow: ['寫出工具', '讓 AI 呼叫工具', '做成互動介面'],
    outcomes: ['打字提問就能用的資料分析介面', '能查資料、畫圖表的 AI 助理', '可以穩定上線的 AI 功能'],
  },
  {
    name: 'AI 變現術',
    slogan: '把你會的事，變成有人願意付錢的服務',
    flow: ['找出專長', '做成小工具', '寫出第一份報價'],
    outcomes: ['一個能收費的小工具', '一份數位商品', '一份接案報價單'],
  },
  {
    name: '生活資料處理',
    slogan: '帳單、照片、表格，交給 AI 整理',
    sample: {
      caption: '示意：把散落的檔案整理好',
      before: ['IMG_2031.jpg', '帳單(1).pdf', '新增資料夾 (3)'],
      after: ['照片/2026-07/海邊-01.jpg', '帳單/2026-07-電費.pdf', '支出/2026-07.xlsx'],
    },
    outcomes: ['每月支出表', '依日期分類好的照片資料夾', '合併好、沒有重複的表格'],
  },
  {
    ...CLAUDE_CODE_TOPIC,
    icon: 'terminal',
    scenarios: CLAUDE_CODE_SCENARIOS.map((s) => s.title),
  },
]
