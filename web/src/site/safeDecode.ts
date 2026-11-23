/** decodeURIComponent 的安全版:壞掉的百分比編碼(例如 %E0%A4%A、單獨的 %)不丟錯,原字串照回 */
export function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
