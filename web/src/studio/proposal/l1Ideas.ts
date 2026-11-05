// L1 構想區：還沒排進 L1 課程的構想（目前來自「生活小工具」的選題）。頁面在 L1IdeasPage.tsx。
// 選進課程的條件見 basicsData.ts 的 TIER_INFO.L1T.rationale；要排進課程時，從這裡移到 src/content/l1Tools/。

export type L1Idea = {
  title: string
  /** 日常情境 */
  scenario: string
  /** 會用到的瀏覽器能力 */
  capability: string
  /** 先放構想區、還沒排進課程的原因 */
  reason: string
  /** 可能的去向 */
  fate: string
}

export const L1_IDEAS: L1Idea[] = [
  {
    title: '截圖馬賽克',
    scenario: '截圖分享前，遮掉姓名、電話、帳號等個資。',
    capability: '滑鼠框選、canvas 像素處理、下載圖片',
    reason: '和 T2.1 證件浮水印用到的能力（讀圖、canvas、下載）幾乎相同，同一單元重複度高。',
    fate: 'T2.1 的「換成自己的資料」延伸練習，或 T2 單元的補充課。',
  },
  {
    title: '名單 CSV 合併與去重',
    scenario: '活動報名表來自好幾個來源，要合併成一份、去掉重複的人。',
    capability: '讀取 CSV、比對欄位、匯出 CSV',
    reason: 'T3.1 已經用到「貼上名單」；多檔合併、欄位對應、Excel 匯出的編碼（Big5、UTF-8 BOM）問題對零基礎偏難。',
    fate: '確認編碼問題的處理方式後，可接在 T3.1 之前當名單整理課。',
  },
  {
    title: '番茄鐘',
    scenario: '專心工作 25 分鐘、休息 5 分鐘，時間到會響。',
    capability: '計時器、音效',
    reason: '能力單純，和 T3.2 抽籤的動畫、音效重疊；瀏覽器在背景分頁會放慢計時器，系統通知需要授權，容易讓學員以為做錯。',
    fate: '短篇補充，或 T3.2 的延伸練習。',
  },
  {
    title: '記帳本與月統計圖表',
    scenario: '記下每天的花費，月底看分類統計與圖表。',
    capability: 'localStorage、資料彙整、用 SVG 畫圖表',
    reason: '資料長期累積，只存在瀏覽器有遺失風險；加上圖表會讓一課超過 45 分鐘。',
    fate: 'T1.2 之後的進階課，或 L2 有後端與登入之後再做。',
  },
  {
    title: '文字整理',
    scenario: '從各處複製來的文字：全形半形混雜、多餘空白、要計算字數。',
    capability: '文字處理、規則取代',
    reason: '成果不夠「看得見」，一課的份量也偏少。',
    fate: '短篇補充，或和其他文字工具合成一課。',
  },
  {
    title: '日期計算',
    scenario: '距離某天還有幾天、扣掉假日剩幾個工作天。',
    capability: '日期計算',
    reason: '工作天要用國定假日資料，每年更新，學員要對照官方行事曆查證，零基礎不容易驗證結果。',
    fate: '只做「相隔天數」可當短篇；工作天待決定資料來源。',
  },
  {
    title: 'QR Code 產生器',
    scenario: '分享 Wi-Fi、活動報名連結。',
    capability: '產生 QR Code（需要外部函式庫）',
    reason: '原生瀏覽器沒有產生 QR Code 的功能，要引用函式庫；L0 規定不裝套件。',
    fate: '看「是否開放外部函式庫」的決定（見總覽生活小工具的待決定）。',
  },
  {
    title: 'PDF 合併與拆頁',
    scenario: '把幾份掃描檔合成一份 PDF，或只取其中幾頁。',
    capability: '讀寫 PDF（需要外部函式庫）',
    reason: '要引用函式庫；檔案大時瀏覽器處理慢，學員不容易判斷是當掉還是在處理。',
    fate: '看「是否開放外部函式庫」的決定。',
  },
  {
    title: '讀取 Excel',
    scenario: '直接選 .xlsx 檔，不用先另存成 CSV。',
    capability: '讀取 Excel 檔（需要外部函式庫）',
    reason: '要引用函式庫；可先用「貼上表格」或 CSV 代替。',
    fate: '看「是否開放外部函式庫」的決定。',
  },
  {
    title: '密碼產生器',
    scenario: '註冊新服務時產生一組強密碼。',
    capability: '安全的亂數',
    reason: '零基礎學員無法判斷 AI 寫的產生方式是否夠安全；不鼓勵自製安全相關的工具，改用密碼管理器較妥當。',
    fate: '不排進課程。',
  },
  {
    title: '加班費、貸款試算',
    scenario: '算加班費、房貸每月要繳多少。',
    capability: '表單與計算',
    reason: '公式牽涉法規與金融，要對照官方來源查證，算錯的影響大；做法和 T1.1 分帳計算機相同。',
    fate: '暫不排；若要當「查證」教材，需先準備官方來源與驗算資料。',
  },
]
