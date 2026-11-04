// 法律頁面共用的營運者資訊。佔位字串(【...】)表示尚未填寫。
// 佔位字串在頁面上會以醒目樣式顯示(見 LegalDoc.tsx 的 <Fill>),方便檢查是否已填完。

/** 網站營運者(個人或公司/組織全名) */
export const OPERATOR_NAME = 'evoleap'
/** 隱私權與服務條款相關聯絡信箱 */
export const CONTACT_EMAIL = 'tim72117@gmail.com'

/** 字串是否仍為未填寫的佔位字串 */
export const isPlaceholder = (value: string) => value.startsWith('【') && value.endsWith('】')
