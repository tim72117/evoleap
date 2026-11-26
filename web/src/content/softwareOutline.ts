// 「做出自己的軟體」(software)的骨架:有哪些階段(單元)與階段名稱,給首頁階段列與單課頁麵包屑用。
// 各階段有哪些課、課名、一句話、開放與否(status)、先不公開(hidden)、免費或登入等一律執行時讀 API(useCourseMap('software')),
// 單課頁的路由是參數化的(/courses/software/:lesson),所以資料庫新增、刪除、搬動課都不用改這裡;階段改名或增減階段才要改。
// hidden 只是「讀到課程地圖之前的占位」(首頁階段列先不畫先不公開的階段,版面才不位移),讀到之後一律照 API 的 unit.hidden。

export type SoftwareOutlineUnit = { id: string; label: string; hidden?: boolean }

export const SOFTWARE_OUTLINE: SoftwareOutlineUnit[] = [
  { id: 'tools', label: '起步' },
  { id: 'ai-tools', label: '零基礎', hidden: true },
  { id: 'vibe-coding-basics', label: '基礎' },
]
