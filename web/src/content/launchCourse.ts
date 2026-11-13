// 主題「從做好到上線」(主題頁 /topics/launch,home/LaunchTopicPage.tsx):課程說明與單元大綱。
// 2026-11-09 提出,序章與單元 1 開放中,單元 2 草稿,其他課規劃中;首頁放在「做出自己的軟體」下方(home/HomePage.tsx)。課程地圖也在資料庫(server/internal/store/courses_seed.json 的 launch),兩邊一致由 content/courseMap.test.ts 檢查。
// 哪些課可以上、播哪個腳本,看資料庫裡每一課的 status 與 script:序章三課與單元 1 已開放(open);單元 2 是草稿(draft),只有管理員看得到、點得進去。
// 序章是上線前的準備:觀念(0.1、0.2)與推上 GitHub 前要排除的檔案(0.3),不做平台與帳號的設定;設定從單元 1 開始。
// from 是研發中的全環節課程清單的環節編號(例如 16.1),之後可以沿用那邊的試做腳本;序章的觀念課沒有。
// 和「網頁怎麼運作」單元 5 的分工:那邊教上線的觀念與名詞,這門課實際把自己的作品放上線、讓別人使用。

import { isFreeByOrder } from './access'

export type LaunchLesson = {
  id: string
  title: string
  /** 這一課學會什麼(課程地圖上的一句話) */
  learn: string
  /** 全環節課程清單的環節編號;序章的觀念課(0.1、0.2)沒有 */
  from?: string
}

export type LaunchUnit = {
  id: string
  title: string
  /** 這個單元回答的問題 */
  question: string
  lessons: LaunchLesson[]
}

export const LAUNCH_PITCH: string[] = [
  '用 AI 做出網站或小工具後，下一步是讓別人也能用。部署、網域、DNS、資料庫、登入、收費、監控，這些流程又多又雜，自己一個一個查文件、一步一步設定，很容易卡住。',
  '這門課教你用 AI 處理這些繁雜的流程：請它看懂你的專案、寫好設定、帶你一步一步完成，出現白畫面或資料不見時，也請它幫你查原因。不用先變成工程師，也能輕鬆把作品放上線。',
  'AI 動手，你做決定：放在哪裡、花多少錢、金鑰和使用者資料怎麼保護，這些要你點頭。每一課都用自己的作品實際走一遍，知道 AI 在幫你做什麼、怎麼檢查它做對了沒有。',
]

export const LAUNCH_UNITS: LaunchUnit[] = [
  {
    id: '0',
    title: '序章　上線前準備',
    question: '自己電腦上的作品和網路上的服務，差在哪裡？',
    lessons: [
      { id: '0.1', title: '本機與網路上', learn: '看懂 localhost 和網址的差別，知道作品現在只有自己看得到。' },
      { id: '0.2', title: '上線前要想清楚的事', learn: '放哪裡、用什麼網址、資料存哪、秘密怎麼保管，先想清楚再動手。' },
      { id: '0.3', from: '6.2', title: '哪些檔案絕不能 commit：.gitignore', learn: '推上 GitHub 前，先把金鑰和不該公開的檔案排除。' },
    ],
  },
  {
    id: '1',
    title: '單元 1　先讓別人打得開',
    question: '怎麼讓作品有一個別人連得到、屬於自己的網址？',
    lessons: [
      { id: '1.1', from: '8.4', title: '環境變數與設定', learn: '把寫死的金鑰與網址搬進設定檔，本機和正式站各用各的。' },
      { id: '1.2', from: '16.1', title: '部署到 GitHub Pages', learn: '拿到第一個可以分享的公開網址，之後推上去就自動更新。' },
      { id: '1.3', from: '16.3', title: 'HTTPS 與快取', learn: '網址有鎖頭，更新後馬上看得到新版。' },
      { id: '1.4', from: '17.1', title: '網域是什麼、怎麼挑', learn: '比較網域名稱、網域商與續約價，選好自己的網域。' },
      { id: '1.5', from: '17.2', title: '買網域', learn: '買下網域，確認自動續約與隱私保護都設好。' },
      { id: '1.6', from: '17.3', title: 'DNS 紀錄入門', learn: '看懂網域的 DNS 紀錄各在做什麼。' },
      { id: '1.7', from: '17.4', title: '把網域接到網站', learn: '用自己的網域打開網站。' },
    ],
  },
  {
    id: '2',
    title: '單元 2　會記住資料的服務',
    question: '使用者填的資料要存在哪裡，才不會不見？',
    lessons: [
      { id: '2.1', from: '8.1', title: '前端、後端與 API', learn: '分出畫面和伺服器各自負責的事，知道什麼時候需要後端。' },
      { id: '2.2', from: '9.1', title: '什麼時候需要資料庫', learn: '依自己的作品選定資料庫，說得出理由。' },
      { id: '2.3', from: '18.1', title: '建立帳號與專案', learn: '開好雲端帳號與專用的專案。' },
      { id: '2.4', from: '18.2', title: '先設預算警示', learn: '費用超過預算就收到通知，不怕突然來一筆大帳單。' },
      { id: '2.5', from: '19.1', title: '用 Docker 打包', learn: '把後端打包成容器，在自己電腦上先跑起來。' },
      { id: '2.6', from: '19.2', title: '部署到 Cloud Run', learn: '後端放上雲端，拿到打得開的網址。' },
      { id: '2.7', from: '19.3', title: '雲端資料庫 Cloud SQL', learn: '正式站的資料存在雲端資料庫，有自動備份。' },
      { id: '2.8', from: '19.4', title: '機密放進 Secret Manager', learn: '正式站的金鑰都由雲端保管，程式和 GitHub 上都沒有。' },
      { id: '2.9', from: '10.3', title: '用 Google 帳號登入', learn: '使用者用 Google 帳號就能註冊登入，不用自己保管密碼。' },
    ],
  },
  {
    id: '3',
    title: '單元 3　放心讓別人用',
    question: '別人能看到什麼？用的人變多會發生什麼事？',
    lessons: [
      { id: '3.1', from: '15.1', title: '機密不外洩', learn: '掃描程式與紀錄裡的金鑰，也準備好外洩時的更換步驟。' },
      { id: '3.2', from: '15.3', title: '常見攻擊與防護', learn: '擋下最常見的攻擊，每一項都有測試證明。' },
      { id: '3.3', from: '8.3', title: '串接第三方 API', learn: '用到 AI 或其他服務時，金鑰放在後端，也知道用量上限在哪。' },
      { id: '3.4', from: '15.4', title: '上線前請 AI 做安全審查', learn: '請另一個 AI 從頭審查一次，修好再上線。' },
      { id: '3.5', from: '24.1', title: '隱私權政策與服務條款', learn: '依網站實際收集的資料，寫出隱私權政策與服務條款。' },
    ],
  },
  {
    id: '4',
    title: '單元 4　收費與通知',
    question: '怎麼收錢、怎麼通知使用者？',
    lessons: [
      { id: '4.1', from: '11.1', title: '選金流服務', learn: '依商品與所在地比較金流，選定一家並備好開通資料。' },
      { id: '4.2', from: '11.2', title: '用測試模式串接結帳', learn: '先用測試卡號跑通付款流程，再切換成正式收款。' },
      { id: '4.3', from: '11.3', title: '用 webhook 同步訂閱狀態', learn: '付款、取消訂閱後，會員權限自動跟著改。' },
      { id: '4.4', from: '12.1', title: '寄信服務與寄件網域驗證', learn: '寄出去的信不會被當成垃圾信。' },
      { id: '4.5', from: '12.2', title: '交易信：註冊確認與重設密碼', learn: '寄出註冊確認信與重設密碼信。' },
    ],
  },
  {
    id: '5',
    title: '單元 5　上線之後',
    question: '出問題時，怎麼比使用者先知道、先處理？',
    lessons: [
      { id: '5.1', from: '20.1', title: '推送標籤才部署', learn: '發版時推一個標籤，自動測試、自動部署。' },
      { id: '5.2', from: '21.1', title: '讀雲端紀錄', learn: '使用者說壞了，知道去哪裡查最近的錯誤。' },
      { id: '5.3', from: '14.5', title: '只在正式環境發生的錯誤', learn: '本機好好的、正式站卻壞了，找出兩邊的差別。' },
      { id: '5.4', from: '21.2', title: '網站掛了會通知', learn: '網站打不開時，幾分鐘內收到通知。' },
      { id: '5.5', from: '20.4', title: '上線後出問題：退版', learn: '新版出錯時，快速切回上一個正常的版本。' },
      { id: '5.6', from: '22.1', title: '備份與還原演練', learn: '真的從備份把資料救回來一次，出事時才不慌。' },
    ],
  },
]

/**
 * 有課程頁的課(/topics/launch/0-1):路由與 SEO 用。能不能上、播哪個腳本不看這裡,看資料庫(status、script);
 * 和種子資料裡有 script 的課一致,由 content/courseMap.test.ts 檢查。
 */
export const LAUNCH_LESSON_PAGES = ['0.1', '0.2', '0.3', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9']

/** 已開放的課:課程地圖的備援資料與「已開放幾課」用;和種子資料的 status open 一致,由 content/courseMap.test.ts 檢查 */
export const LAUNCH_OPEN_LESSONS = ['0.1', '0.2', '0.3', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7']

/** 課號 → 課程頁網址 */
export const launchLessonPath = (id: string): string => `/topics/launch/${id.replace('.', '-')}`

/** 課號 → 訪客上課紀錄的名稱(InteractiveScenePage 記成 live:<腳本>);後台標課名用,腳本照這個規則命名 */
export const launchScriptKey = (id: string): string => `live:launch/${id}.json`

/** 課號 → 課 */
export const launchLesson = (id: string): LaunchLesson | undefined => LAUNCH_UNITS.flatMap((u) => u.lessons).find((l) => l.id === id)

/** 前兩課(0.1、0.2)不用登入就能看,第三課起要登入(content/access.ts) */
export const launchNeedsLogin = (id: string): boolean => !isFreeByOrder(LAUNCH_UNITS.flatMap((u) => u.lessons.map((l) => l.id)), id)
