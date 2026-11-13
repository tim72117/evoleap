// 網站介面的多語言:I18nProvider 放在 AuthProvider 裡面(要讀會員的語言偏好)。
//
// 用法:
//   const t = useT()            // t.site.home、t.auth.loginTitle、t.member.joined(date)……
//   const { locale, setLocale } = useLocale()
//   React 以外(API 錯誤、模組層級的常數)用 i18n/current 的 messages()。
//
// 字典:i18n/zh/ 是基準(繁中),i18n/en/ 的型別必須和它一樣,漏翻或多一個鍵 tsc 就會報錯。
// 英文字典另外打包,切到英文時才下載;下載完成前先不渲染(只有第一次、很短)。
// 語言與字典是同一個 state:換語言時先把新字典下載好,再一起換(畫面、播放器、React 以外的程式讀到的語言永遠一致)。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { authApi } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { currentLocale, formatDate, loadedEnglish, messages, setCurrent } from './current'
import { initialLocale, isLocale, storeLocale, type Locale } from './locale'
import { zh, type Messages } from './zh'

// React 以外的程式請直接 import './current'(不要經過這裡,避免循環引用);這裡轉出去是給元件用
export { currentLocale, formatDate, messages }

const loadEn = (): Promise<Messages> => {
  const m = loadedEnglish()
  return m ? Promise.resolve(m) : import('./en').then((x) => x.en)
}

type I18nState = {
  locale: Locale
  t: Messages
  /** 換語言:記在這個瀏覽器;登入中的會員也存進帳號 */
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nState | null>(null)

type Active = { locale: Locale; t: Messages }

export function I18nProvider({ children }: { children: ReactNode }) {
  const { real, setUser } = useAuth()
  const [active, setActive] = useState<Active | null>(() => {
    const first = initialLocale()
    const t = first === 'zh-Hant' ? zh : loadedEnglish()
    if (!t) return null
    // 第一次渲染之前就讓 React 以外的程式用同一個語言(重複執行沒有影響)
    setCurrent(first, t)
    return { locale: first, t }
  })
  // 最後一次要求的語言:連按切換時,先下載完的舊要求不能蓋掉後面的選擇
  const wanted = useRef<Locale>(initialLocale())

  /** 換成這個語言:字典就緒後語言與字典一起換;下載失敗(離線等)時留在目前的語言(第一次載入就失敗則用中文) */
  const apply = useCallback(async (next: Locale) => {
    wanted.current = next
    let t: Messages | null
    try {
      t = next === 'zh-Hant' ? zh : await loadEn()
    } catch {
      t = null
    }
    if (wanted.current !== next) return
    if (!t) {
      setActive((cur) => cur ?? { locale: 'zh-Hant', t: zh })
      return
    }
    setCurrent(next, t)
    setActive({ locale: next, t })
  }, [])

  // 第一次:英文字典還沒下載時要等它(這段期間不渲染)
  useEffect(() => {
    if (!active) void apply(wanted.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 會員帳號存了偏好:登入(或啟動時確認登入)後照帳號的語言
  const accountLocale = real.status === 'user' ? real.user?.locale : undefined
  useEffect(() => {
    if (isLocale(accountLocale) && accountLocale !== wanted.current) {
      storeLocale(accountLocale)
      void apply(accountLocale)
    }
  }, [accountLocale, apply])

  const locale = active?.locale
  useEffect(() => {
    if (locale) document.documentElement.lang = locale
  }, [locale])

  // 存進帳號:一個接一個送(伺服器最後收到的一定是最後的選擇);只有最後一次的回應會更新登入中的會員資料,
  // 先送出的回應晚到時不能把畫面改回舊的語言
  const loggedIn = real.status === 'user'
  const writeChain = useRef<Promise<unknown>>(Promise.resolve())
  const writeSeq = useRef(0)
  const setLocale = useCallback(
    (next: Locale) => {
      storeLocale(next)
      void apply(next)
      // 存不成功(離線、登入過期)就只記在這個瀏覽器
      if (loggedIn) {
        const seq = ++writeSeq.current
        writeChain.current = writeChain.current
          .catch(() => {})
          .then(() => authApi.updateProfile({ locale: next }))
          .then((u) => {
            if (seq === writeSeq.current) setUser(u)
          })
          .catch(() => {})
      }
    },
    [apply, loggedIn, setUser],
  )

  const value = useMemo<I18nState | null>(() => (active ? { locale: active.locale, t: active.t, setLocale } : null), [active, setLocale])
  if (!value) return null
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function useI18n(): I18nState {
  const v = useContext(I18nContext)
  // 沒有 Provider(單元測試直接渲染元件)時用中文
  return v ?? { locale: 'zh-Hant', t: zh, setLocale: () => {} }
}

/** 目前語言的字典 */
export const useT = (): Messages => useI18n().t
export const useLocale = (): { locale: Locale; setLocale: (l: Locale) => void } => {
  const { locale, setLocale } = useI18n()
  return { locale, setLocale }
}
