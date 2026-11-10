// 顯示名稱的規則(會員空間改名用),和伺服器的 api/auth.go validName、store.MaxNameLen 一致。

/** 名稱長度上限(字數) */
export const NAME_MAX = 50

/** 名稱裡不能有的字元:換行等控制字元、零寬與方向控制字元(和伺服器的 validName 一致);沒問題回傳空字串 */
export function nameProblem(name: string): string {
  if (/[\p{Cc}\p{Cf}]/u.test(name)) return '名稱不能包含換行或看不見的特殊字元'
  if (!/[^\p{Z}]/u.test(name)) return '請輸入名稱'
  return ''
}
