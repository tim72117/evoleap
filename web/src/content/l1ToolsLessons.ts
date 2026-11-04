// L1「生活小工具」的單課資料（型別見 lessonTypes.ts）。與 L1「AI 工具入門」並列的第二門 L1 課程。
// 每課做一個日常用得到的純前端小工具：專案只有 index.html、styles.css、script.js，雙擊在瀏覽器打開；
// 不用伺服器、不裝套件、不連外部服務，資料只在學員自己的電腦與瀏覽器裡處理。
// 一課只新增一種瀏覽器能力；沿用 L0 的會操作檔案的 AI 工具與「親眼確認」習慣。
// 課號 T1.1 = 單元 T1 第 1 課；各單元的資料在 l1Tools/ 底下，一個單元一個檔案。
// 沒選進課程的工具構想在 src/studio/proposal/l1Ideas.ts（研發基地 L1 構想區）。
import type { CourseLesson } from './lessonTypes'
import { L1T_T1_LESSONS } from './l1Tools/t1'
import { L1T_T2_LESSONS } from './l1Tools/t2'
import { L1T_T3_LESSONS } from './l1Tools/t3'

export const L1T_LESSONS: CourseLesson[] = [...L1T_T1_LESSONS, ...L1T_T2_LESSONS, ...L1T_T3_LESSONS]
