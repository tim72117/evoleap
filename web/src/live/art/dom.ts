// art/dom:場景 render 用的小工具。
const attrCache = new WeakMap<Element, Map<string, string>>()
/** 只在值改變時才寫 SVG 屬性 */
export const attr = (el: Element, name: string, value: string): void => {
  let m = attrCache.get(el)
  if (!m) attrCache.set(el, (m = new Map()))
  if (m.get(name) === value) return
  m.set(name, value)
  el.setAttribute(name, value)
}
/** 固定小數位的字串(預設 2 位) */
export const fx = (n: number, d = 2): string => n.toFixed(d)
