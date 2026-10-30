// 法律頁面共用的營運者資訊。以下為待填寫的佔位字串,上線前請替換成實際資料。
// 佔位字串在頁面上會以醒目樣式顯示(見 LegalDoc.tsx 的 <Fill>),方便檢查是否已填完。

/** 網站營運者(個人或公司/組織全名) */
export const OPERATOR_NAME = '【營運者名稱】'
/** 隱私權與服務條款相關聯絡信箱 */
export const CONTACT_EMAIL = '【聯絡信箱】'
/** 第一審管轄法院,例如「臺灣臺北地方法院」(依營運者所在地決定) */
export const JURISDICTION_COURT = '【管轄法院】'

/** 字串是否仍為未填寫的佔位字串 */
export const isPlaceholder = (value: string) => value.startsWith('【') && value.endsWith('】')
