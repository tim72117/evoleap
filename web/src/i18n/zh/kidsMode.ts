// kidsMode 的介面文字(繁中,基準)。英文在 ../en/kidsMode.ts,鍵要一模一樣。
export const kidsMode = {
  /** 星期(0 是週一),排課表與上課時段用 */
  days: ['週一', '週二', '週三', '週四', '週五', '週六', '週日'],
  /** 下週的時段前面加的字(「下週一 19:00」) */
  nextWeekPrefix: '下',
  simulatedChild: '模擬兒童',
  avatarFallback: '童',
  thisWeek: '這週的課',
  loadFailed: '無法讀取課程資訊，請稍後再試。',
  nextWeek: '下週的課',
  openUntil: (time: string) => `現在可以上課，到 ${time} 結束。`,
  notYet: (slot: string) => `還沒到上課時間，下一堂是 ${slot}。`,
  noSlots: '家長還沒排上課時間，請家長到會員空間的「兒童」排課。',
  laterByProgress: '之後依進度安排',
  allDone: '已開放的課都上完了',
  startClass: '開始上課',
  state: { now: '現在上課', next: '下一堂', done: '本週已上過', later: '' },
  capsuleLabel: (name: string) => `兒童模式:${name}`,
  menuLabel: '兒童模式',
  active: '兒童模式中',
  leaving: '離開中…',
  leave: '離開兒童模式',
}
