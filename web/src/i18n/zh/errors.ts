// 伺服器錯誤代碼(server/internal/api 的 writeError 第三個參數)對應的訊息(繁中,基準)。
// 這裡沒有的代碼,顯示伺服器附的 message(中文)。新增代碼時兩個語言都要加。
const weekdays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

export const errors = {
  codes: {
    auth_disabled: '登入功能尚未開放',
    invalid_email: 'Email 格式不正確',
    weak_password: '密碼至少需要 8 個字元',
    email_taken: '這個 Email 已經註冊過，請直接登入',
    invalid_credentials: 'Email 或密碼不正確',
    google_disabled: '目前未開放 Google 登入',
    invalid_google_token: 'Google 登入驗證失敗，請再試一次',
    google_email_unverified: '這個 Google 帳號的 Email 尚未驗證，請先到 Google 完成驗證，或改用其他帳號',
    google_retry: '登入時發生衝突，請再試一次',
    google_conflict: '這個 Email 已經綁定另一個 Google 帳號',
    json_required: '請以 JSON 送出',
    bad_request: '請求格式不正確',
    internal: '伺服器發生錯誤，請稍後再試',
    site_login_required: '請在網站登入後再修改帳號資料',
    unauthorized: '請先登入',
    rate_limited: '嘗試次數太多，請一分鐘後再試',
    forbidden: '沒有管理權限',
    invalid_locale: '不支援這個語言',
    kids_parent_only: '兒童模式中不能變更設定，請家長先離開兒童模式',
    kids_only: '兒童模式只能看兒童課程',
    kids_locked: '這一課還沒到，先上完前面的課',
    kids_closed: '還沒到上課時間，請家長在會員空間排入上課時段',
    login_required: '這一課要登入才能觀看',
    subscription_required: '這一課要訂閱才能觀看',
    plans_disabled: '方案功能尚未開放',
    plan_required: '這一課要選擇方案才能觀看',
    ad_required: '要先看完片頭廣告',
    too_early: '廣告還沒播完',
    invalid_token: '廣告紀錄無效，請重新整理',
  } as Record<string, string>,
  /** 播放器載不到腳本:要登入(後面會接登入連結) */
  scriptLoginRequired: '這一課要登入才能觀看，請登入後再試一次。',
  scriptSubscriptionRequired: '這一課要訂閱才能觀看。',
  scriptLoadFailed: (path: string, status: number) => `讀不到即時教學畫面的腳本 ${path}(${status})`,
  /** kids_closed 附了下一堂的時段(day:0 是週一) */
  kidsClosedNext: (day: number, time: string) => `還沒到上課時間，下一堂是 ${weekdays[day] ?? ''} ${time}`,
}
