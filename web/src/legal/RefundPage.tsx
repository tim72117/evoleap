import { useLocale } from '../i18n/I18nProvider'
import { lazyPage } from '../site/lazyPage'
import { RefundZh } from './zh/RefundZh'

// 條文分兩個語言的版本:繁中(zh/RefundZh.tsx,正式版本)與英文(en/RefundEn.tsx,參考譯本)。
// 修改條文時兩個版本要一起改,日期在 updated.ts。英文版另外打包,中文使用者不用下載。
const RefundEn = lazyPage(() => import('./en/RefundEn').then((m) => m.RefundEn))

export function RefundPage() {
  const { locale } = useLocale()
  return locale === 'en' ? <RefundEn /> : <RefundZh />
}
