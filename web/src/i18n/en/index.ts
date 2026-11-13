// 英文字典:另外打包,切到英文時才下載(I18nProvider)。型別 Messages 由繁中字典決定。
import type { Messages } from '../zh'
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

export const en: Messages = { common, site, errors, home, auth, member, kidsMode, courses, player, kids, legal }
