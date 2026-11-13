import { useLocale } from '../i18n/I18nProvider'
import { lazyPage } from '../site/lazyPage'
import { TermsZh } from './zh/TermsZh'

// 條文分兩個語言的版本:繁中(zh/TermsZh.tsx,正式版本)與英文(en/TermsEn.tsx,參考譯本)。
// 修改條文時兩個版本要一起改,日期在 updated.ts。英文版另外打包,中文使用者不用下載。
const TermsEn = lazyPage(() => import('./en/TermsEn').then((m) => m.TermsEn))

export function TermsPage() {
  const { locale } = useLocale()
  return locale === 'en' ? <TermsEn /> : <TermsZh />
}
