// 第 2 課練習的規則:一段需求(或一句調整)→ 小森烘焙網頁的設定。純函式,不接真的 AI。
// 重點是讓學員看到「需求說得越清楚,第一版越接近想要的;只說『好看』就會得到亂猜的版本」,
// 以及「一句話只動該動的地方;說得太籠統,AI 會改太多,要能還原」。

export type Style = 'warm' | 'tech' | 'minimal'
export type Section = 'products' | 'booking' | 'hours' | 'faq' | 'contact'
export type Site = {
  style: Style
  sections: Section[]
  cols: 1 | 2 | 3
  heading: 's' | 'm' | 'l'
  burger: boolean
  /** 搶眼的「立即購買」大按鈕(亂猜的版本才有) */
  shout: boolean
}

export const SECTION_NAME: Record<Section, string> = { products: '本週商品', booking: '預約流程', hours: '營業時間', faq: '常見問題', contact: '聯絡方式' }
export const STYLE_NAME: Record<Style, string> = { warm: '溫暖手作', tech: '深色科技', minimal: '簡約' }

const SECTION_WORDS: [Section, RegExp][] = [
  ['products', /商品|產品|麵包|蛋糕|甜點|菜單/],
  ['booking', /預約|訂購|取貨|流程/],
  ['hours', /營業時間|幾點|時間表|開店/],
  ['faq', /常見問題|FAQ|faq|問答/],
  ['contact', /聯絡|地址|電話|交通/],
]

const styleOf = (t: string): Style | null =>
  /溫暖|手作|溫馨|暖/.test(t) ? 'warm' : /科技|深色|酷|未來/.test(t) ? 'tech' : /簡約|極簡|乾淨|留白/.test(t) ? 'minimal' : null

const ORDER: Section[] = ['products', 'booking', 'hours', 'faq', 'contact']
const sortSections = (s: Section[]) => [...new Set(s)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))

export function firstDraft(text: string): { site: Site; say: string; vague: boolean } {
  const sections = SECTION_WORDS.filter(([, re]) => re.test(text)).map(([s]) => s)
  const style = styleOf(text)
  if (sections.length < 2 && !style) {
    return {
      vague: true,
      say: '需求有點模糊，我自己猜了：深色科技風、大大的「立即購買」，只有商品區。這可能不是你要的——把想放的區塊、風格說清楚，再送出一次。',
      site: { style: 'tech', sections: ['products'], cols: 3, heading: 'l', burger: false, shout: true },
    }
  }
  const secs = sortSections(sections.length ? sections : ['products'])
  return {
    vague: false,
    say: `好的，第一版完成：${STYLE_NAME[style ?? 'warm']}風格，包含${secs.map((s) => SECTION_NAME[s]).join('、')}。用右邊的預覽對照需求檢查，再一區一區調整。`,
    site: { style: style ?? 'warm', sections: secs, cols: 2, heading: 'm', burger: false, shout: false },
  }
}

export type Adjust = { site: Site; say: string; changed: string[]; broad: boolean }

export function adjust(site: Site, text: string, target?: Section | 'nav' | 'title'): Adjust {
  const s: Site = { ...site, sections: [...site.sections] }
  const changed: string[] = []
  const note = (x: string) => changed.push(x)

  if (/再好看|整個.*(改|重做)|全部.*(改|重做)|大改|換個感覺/.test(text)) {
    const order: Style[] = ['warm', 'tech', 'minimal']
    s.style = order[(order.indexOf(s.style) + 1) % 3]
    s.cols = s.cols === 3 ? 1 : ((s.cols + 1) as 2 | 3)
    s.heading = 'l'
    s.sections = [...s.sections].reverse()
    s.shout = !s.shout
    note('整體風格'); note('卡片欄數'); note('標題大小'); note('區塊順序'); note('按鈕樣式')
    return { site: s, say: '好的，我把整頁都重新調整了一遍。', changed, broad: true }
  }

  const col = /(兩|二|2)\s*欄/.test(text) ? 2 : /(三|3)\s*欄/.test(text) ? 3 : /(一|1|單)\s*欄/.test(text) ? 1 : 0
  if (col && target !== 'nav') {
    if (s.cols !== col) note('卡片欄數')
    s.cols = col as 1 | 2 | 3
  }
  if (/標題.*(放大|大一點|加大)/.test(text)) { if (s.heading !== 'l') note('標題大小'); s.heading = 'l' }
  if (/標題.*(縮小|小一點)/.test(text)) { if (s.heading !== 's') note('標題大小'); s.heading = 's' }
  if (/手機.*選單|漢堡|收合|收起來/.test(text)) { if (!s.burger) note('手機選單'); s.burger = true }
  if (/拿掉|移除|刪掉|不要/.test(text)) {
    for (const [sec, re] of SECTION_WORDS) if (re.test(text) && s.sections.includes(sec)) { s.sections = s.sections.filter((x) => x !== sec); note(`${SECTION_NAME[sec]}區塊`) }
    if (/立即購買|大按鈕/.test(text) && s.shout) { s.shout = false; note('立即購買按鈕') }
  } else if (/加(上|入)?|新增/.test(text)) {
    for (const [sec, re] of SECTION_WORDS) if (re.test(text) && !s.sections.includes(sec)) { s.sections = sortSections([...s.sections, sec]); note(`${SECTION_NAME[sec]}區塊`) }
  }
  const st = styleOf(text)
  if (st && /改成|換成|風格|顏色|配色/.test(text) && st !== s.style) { s.style = st; note('整體風格') }
  if (/不要.*立即購買|拿掉.*立即購買|立即購買.*(拿掉|不要)/.test(text) && s.shout) { s.shout = false; note('立即購買按鈕') }

  if (!changed.length) return { site, say: '我不確定要改哪裡。可以說「卡片改兩欄」、「標題放大」、「加手機選單」、「拿掉常見問題」、「風格改簡約」。', changed, broad: false }
  return { site: s, say: `好的，只改了：${changed.join('、')}。`, changed, broad: false }
}
