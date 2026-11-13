// 繁中字典(基準):Messages 的型別由這裡決定,英文字典(../en)必須完全對上。
// 每個區域一個檔案,元件用 useT() 取:t.site.tagline、t.auth.…
import { auth } from './auth'
import { common } from './common'
import { courses } from './courses'
import { errors } from './errors'
import { home } from './home'
import { kids } from './kids'
import { kidsMode } from './kidsMode'
import { legal } from './legal'
import { member } from './member'
import { player } from './player'
import { site } from './site'

export const zh = { common, site, errors, home, auth, member, kidsMode, courses, player, kids, legal }
export type Messages = typeof zh
