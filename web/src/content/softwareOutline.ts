// 「做出自己的軟體」(software)的骨架:有哪些階段(單元)、各階段有哪些課號。給「路由要在 build 時決定有哪些網址」用(courses/routes.tsx 的單課路由),
// 以及單課頁麵包屑的階段名稱;這些只需要課號與階段 id,不需要整份種子(courses_seed.json 約 54KB,不放進執行期主程式)。
// 課名、一句話、開放與否(status)、先不公開(hidden)、免費或登入等「會被 CLI / 管理員修改」的值一律執行時讀 API(useCourseMap('software')),不在這裡。
// 這份骨架與種子的一致由 softwareOutline.test.ts 檢查:種子新增、刪除、搬動課或階段改名時測試會失敗,照種子更新這裡。
// hidden 只是「讀到課程地圖之前的占位」(首頁階段列先不畫先不公開的階段,版面才不位移),讀到之後一律照 API 的 unit.hidden。

export type SoftwareOutlineUnit = { id: string; label: string; hidden?: boolean; lessons: string[] }

export const SOFTWARE_OUTLINE: SoftwareOutlineUnit[] = [
  { id: 'tools', label: '起步', lessons: ['0.intro', '0.0', '0.1', '0.2', '0.3'] },
  { id: 'ai-tools', label: '零基礎', hidden: true, lessons: ['1.0', '1.1', '1.2', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3'] },
  {
    id: 'vibe-coding-basics',
    label: '基礎',
    lessons: [
      '4.3', '5.2', '5.3', '6.1', '6.2', '6.3', '7.1', '7.2', '7.3', '8.1', '8.2', '8.3', '9.1', '9.2', '9.3', '9.4',
      '10.1', '10.2', '10.3', '10.4', '11.1', '11.2', '11.3', '11.4', '12.1', '12.2', '12.3', '12.4', '13.1', '13.2', '13.3', '13.4', '14.1', '14.2', '14.3', '14.4',
    ],
  },
]

/** 所有課號(照單元順序) */
export const SOFTWARE_LESSON_IDS: string[] = SOFTWARE_OUTLINE.flatMap((u) => u.lessons)
