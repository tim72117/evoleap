// desk 演員的房間與桌上物件(寫實繪製)。全部是靜態的 SVG/HTML 字串,mount 時塞一次,render 不會再動它們。
// 光源:左後方的窗戶(自然光)。所以物件左側較亮、右側較暗,投影往右前方落在桌面上。
// 材質圖(木紋、灰泥)在 actor.css 用 background-image 貼,來源與授權見 textures/README.md。

const r = (n: number) => Math.round(n * 10) / 10

/** 同一頁可能有好幾個 desk(並排對照),而且隱藏的那個在 display:none 裡;SVG 的漸層 id 要每個演員各自一份才不會互相參照壞掉 */
export function scopeIds(svg: string, prefix: string): string {
  return svg.replace(/id="/g, `id="${prefix}`).replace(/url\(#/g, `url(#${prefix}`)
}

/** 鍵盤(俯視,之後用 CSS 的 rotateX 壓成透視):鋁底座 + 白色低鍵程鍵帽 */
export function keyboardSvg(): string {
  const W = 1000
  const pad = 24
  const u = (W - pad * 2) / 15
  const gap = u * 0.13
  const rows: Array<{ h: number; keys: Array<[number, string?]> }> = [
    { h: 0.56, keys: [[1.25, 'esc'], ...Array.from({ length: 12 }, (_, i): [number, string] => [1.0625, `F${i + 1}`]), [1.0]] },
    { h: 1, keys: [[1, '`'], ...'1234567890-='.split('').map((c): [number, string] => [1, c]), [2, 'delete']] },
    { h: 1, keys: [[1.5, 'tab'], ...'QWERTYUIOP[]'.split('').map((c): [number, string] => [1, c]), [1.5, '\\']] },
    { h: 1, keys: [[1.8, 'caps'], ...'ASDFGHJKL;\''.split('').map((c): [number, string] => [1, c]), [2.2, 'return']] },
    { h: 1, keys: [[2.3, 'shift'], ...'ZXCVBNM,./'.split('').map((c): [number, string] => [1, c]), [2.7, 'shift']] },
    { h: 1, keys: [[1, 'fn'], [1, 'ctrl'], [1, 'opt'], [1.25, 'cmd'], [5.5], [1.25, 'cmd'], [1, 'opt'], [1, '◀'], [1, '▲'], [1, '▶']] },
  ]
  const H = Math.round(pad * 2 + rows.reduce((s, row) => s + row.h * u, 0) + gap * (rows.length - 1) * 0.5)
  let y = pad
  let keys = ''
  for (const row of rows) {
    const total = row.keys.reduce((s, [w]) => s + w, 0)
    const scale = 15 / total
    let x = pad
    const h = row.h * u - gap * 0.5
    for (const [w0, label] of row.keys) {
      const w = w0 * scale * u
      const kx = r(x + gap / 2)
      const kw = r(w - gap)
      const ky = r(y)
      const kh = r(h)
      // 鍵帽:底部一條暗邊(鍵的側面),上面是微亮的頂面
      keys += `<rect x="${kx}" y="${ky + 2}" width="${kw}" height="${kh}" rx="7" fill="#b7bcc3"/><rect x="${kx}" y="${ky}" width="${kw}" height="${r(kh - 2)}" rx="7" fill="url(#kbKey)"/>`
      if (label) {
        const small = label.length > 1
        keys += `<text x="${r(small ? kx + 8 : kx + kw / 2)}" y="${r(small ? ky + kh - 10 : ky + kh * 0.62)}" font-size="${small ? 17 : 27}" text-anchor="${small ? 'start' : 'middle'}" fill="#5d636c">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
      }
      x += w
    }
    y += row.h * u + gap * 0.5
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
<defs>
  <linearGradient id="kbBase" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9ebee"/><stop offset=".45" stop-color="#d3d6db"/><stop offset="1" stop-color="#a9adb4"/></linearGradient>
  <linearGradient id="kbKey" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f3f4f6"/><stop offset="1" stop-color="#dfe2e6"/></linearGradient>
  <linearGradient id="kbShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
</defs>
<rect x="0" y="0" width="${W}" height="${H}" rx="26" fill="url(#kbBase)"/>
<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="23" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>
<g font-family="-apple-system, 'Segoe UI', sans-serif">${keys}</g>
<rect x="0" y="0" width="${W}" height="${H}" rx="26" fill="url(#kbShade)"/>
</svg>`
}

/** 滑鼠(俯視,之後一樣壓成透視) */
export const MOUSE_SVG = `<svg viewBox="0 0 60 104" aria-hidden="true">
<defs>
  <radialGradient id="msBody" cx=".34" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#eef0f2"/><stop offset=".8" stop-color="#c9cdd3"/><stop offset="1" stop-color="#9ea3aa"/></radialGradient>
  <linearGradient id="msRim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<path d="M30 2C47 2 57 18 57 44v28c0 18-12 30-27 30S3 90 3 72V44C3 18 13 2 30 2z" fill="url(#msBody)"/>
<path d="M30 3v34" stroke="#a3a8af" stroke-width=".9"/>
<rect x="27.6" y="12" width="4.8" height="11" rx="2.4" fill="#8f949b"/><rect x="28.3" y="12.6" width="3.4" height="8" rx="1.7" fill="#c3c7cc"/>
<path d="M12 22C15 10 22 5 30 4" fill="none" stroke="url(#msRim)" stroke-width="2.2" stroke-linecap="round"/>
</svg>`

/** 馬克杯(微斜的正視圖):霧面陶瓷,左邊受光;杯裡是咖啡 */
export const MUG_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true">
<defs>
  <linearGradient id="mgBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9d7d2"/><stop offset=".16" stop-color="#fbfaf7"/><stop offset=".3" stop-color="#f3f1ec"/><stop offset=".72" stop-color="#cfccc5"/><stop offset="1" stop-color="#9c9890"/></linearGradient>
  <linearGradient id="mgHandle" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bdb9b1"/><stop offset=".5" stop-color="#d8d5ce"/><stop offset="1" stop-color="#8e8a82"/></linearGradient>
  <radialGradient id="mgCoffee" cx=".4" cy=".45" r=".7"><stop offset="0" stop-color="#5a3520"/><stop offset=".7" stop-color="#3a2114"/><stop offset="1" stop-color="#24140b"/></radialGradient>
  <linearGradient id="mgInner" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bab6ae"/><stop offset="1" stop-color="#ece9e3"/></linearGradient>
</defs>
<path d="M78 34c18-2 28 6 28 20s-10 24-28 26" fill="none" stroke="url(#mgHandle)" stroke-width="9" stroke-linecap="round"/>
<path d="M80 41c11 0 17 5 17 13s-6 15-17 17" fill="none" stroke="#7d7970" stroke-opacity=".35" stroke-width="2"/>
<path d="M14 20v76c0 9 15 16 33 16s33-7 33-16V20z" fill="url(#mgBody)"/>
<ellipse cx="47" cy="20" rx="33" ry="9" fill="url(#mgInner)"/>
<ellipse cx="47" cy="21.5" rx="29.5" ry="7" fill="url(#mgCoffee)"/>
<ellipse cx="40" cy="19.6" rx="9" ry="1.6" fill="#fff" fill-opacity=".22"/>
<path d="M14 20c0 5 15 9 33 9s33-4 33-9" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/>
<path d="M21 30v62" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
</svg>`

/** 虎尾蘭(葉片是劍形,好畫也像真的)+ 霧面陶盆 */
export function plantSvg(): string {
  // [底部 x, 頂端 x, 頂端 y, 寬度, 色調]
  const leaves: Array<[number, number, number, number, number]> = [
    [52, 22, 70, 13, 0],
    [70, 104, 58, 12, 1],
    [58, 46, 18, 15, 2],
    [66, 76, 8, 14, 1],
    [62, 92, 40, 13, 0],
    [56, 34, 44, 14, 2],
    [64, 62, 30, 13, 0],
  ]
  const tones = [
    ['#2c5532', '#3f7444', '#1f3f25'],
    ['#335f37', '#4c8450', '#22442a'],
    ['#2a5130', '#46804a', '#1c3b22'],
  ]
  const leafPaths = leaves
    .map(([bx, tx, ty, w, t]) => {
      const [, mid] = tones[t]
      const by = 196
      const cx = (bx + tx) / 2 + (tx - bx) * 0.15
      const cy = (by + ty) / 2
      const d = `M${bx - w / 2} ${by} Q${cx - w * 0.75} ${cy} ${tx} ${ty} Q${cx + w * 0.75} ${cy} ${bx + w / 2} ${by} Z`
      return `<path d="${d}" fill="url(#plLeaf${t})"/><path d="${d}" fill="url(#plBands)" opacity=".28"/><path d="${d}" fill="none" stroke="#b3a95e" stroke-opacity=".45" stroke-width="1.3"/><path d="M${bx} ${by} Q${cx} ${cy} ${tx} ${ty}" fill="none" stroke="${mid}" stroke-opacity=".5" stroke-width="1"/>`
    })
    .join('')
  return `<svg viewBox="0 0 130 280" aria-hidden="true">
<defs>
  ${tones.map(([a, b, c], i) => `<linearGradient id="plLeaf${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${b}"/><stop offset=".5" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient>`).join('')}
  <pattern id="plBands" width="18" height="11" patternUnits="userSpaceOnUse"><path d="M0 4q3.5-3 7 0t7 0" fill="none" stroke="#9ec08f" stroke-opacity=".55" stroke-width="1.6"/></pattern>
  <linearGradient id="plPot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfc8bd"/><stop offset=".22" stop-color="#ebe6dd"/><stop offset=".55" stop-color="#d2cbbf"/><stop offset="1" stop-color="#8f877b"/></linearGradient>
  <linearGradient id="plRim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6e0d6"/><stop offset=".3" stop-color="#f6f2ea"/><stop offset="1" stop-color="#a69e92"/></linearGradient>
  <radialGradient id="plSoil" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#4a3a2c"/><stop offset="1" stop-color="#241a12"/></radialGradient>
</defs>
<path d="M22 196h86l-8 74c-1 6-12 9-35 9s-34-3-35-9z" fill="url(#plPot)"/>
<ellipse cx="65" cy="196" rx="44" ry="8" fill="url(#plRim)"/>
<ellipse cx="65" cy="197" rx="39" ry="5.6" fill="url(#plSoil)"/>
${leafPaths}
<path d="M26 206l6 58" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
</svg>`
}

/** 牆上的相框:細黑框、白色卡紙、一張山景照片(漸層畫的) */
export const PHOTO_SVG = `<svg viewBox="0 0 160 120" preserveAspectRatio="none" aria-hidden="true">
<defs>
  <linearGradient id="phSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb8cf"/><stop offset=".6" stop-color="#e9d2b4"/><stop offset="1" stop-color="#f2c9a0"/></linearGradient>
  <linearGradient id="phFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8495a8"/><stop offset="1" stop-color="#a7afb8"/></linearGradient>
  <linearGradient id="phNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5a52"/><stop offset="1" stop-color="#2d3833"/></linearGradient>
  <linearGradient id="phGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<rect width="160" height="120" fill="#22201d"/>
<rect x="3" y="3" width="154" height="114" fill="#f4f1ea"/>
<rect x="22" y="20" width="116" height="80" fill="url(#phSky)"/>
<path d="M22 72l20-16 14 8 22-24 18 16 14-8 28 22v30H22z" fill="url(#phFar)"/>
<path d="M22 84l26-10 20 6 26-12 22 8 22-6v30H22z" fill="url(#phNear)"/>
<circle cx="112" cy="46" r="6" fill="#fbe7c6" opacity=".9"/>
<rect x="22" y="20" width="116" height="80" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.5"/>
<rect width="160" height="120" fill="url(#phGlass)"/>
</svg>`
