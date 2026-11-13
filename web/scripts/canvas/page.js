// page.js — 在無頭 Chromium 頁面裡執行的工具(canvas-mcp.mjs 注入):掛上 SVG / 量位置 / 畫疊加線 / 檢查 / 拼圖 / 差異圖。
// 座標一律是作品的座標:SVG 是 viewBox 的單位,HTML 是 CSS px。
/* eslint-disable */
window.art = (() => {
  const NS = 'http://www.w3.org/2000/svg'
  const SKIP = 'defs, clipPath, mask, linearGradient, radialGradient, pattern, filter, symbol, marker, style, script, title, desc, metadata'
  const PALETTE = ['#ff2d55', '#007aff', '#34c759', '#ff9500', '#af52de', '#00c7be', '#ffcc00', '#5856d6', '#ff3b30', '#30b0c7']
  let cur = null // { mode: 'svg'|'html', el, vb: {x,y,w,h}, w, h }

  const num = (v) => {
    if (v == null || v === '' || /%$/.test(String(v))) return null
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }

  function svgSize(svg) {
    const vbA = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
    let w = num(svg.getAttribute('width'))
    let h = num(svg.getAttribute('height'))
    const vb = vbA.length === 4 && vbA.every(Number.isFinite) ? { x: vbA[0], y: vbA[1], w: vbA[2], h: vbA[3] } : null
    if (vb) {
      if (w == null && h == null) (w = vb.w), (h = vb.h)
      else if (w == null) w = (h * vb.w) / vb.h
      else if (h == null) h = (w * vb.h) / vb.w
    }
    w ??= 300
    h ??= 150
    return { w, h, vb: vb ?? { x: 0, y: 0, w, h } }
  }

  async function settle() {
    await document.fonts.ready
    const imgs = [...document.images].map((i) => i.decode().catch(() => {}))
    const svgImgs = [...document.querySelectorAll('image')].map((i) => {
      const src = i.getAttribute('href') || i.getAttribute('xlink:href')
      if (!src) return null
      const im = new Image()
      im.src = new URL(src, document.baseURI).href
      return im.decode().catch(() => {})
    })
    await Promise.all([...imgs, ...svgImgs])
  }

  async function mountSvg(markup, baseHref, bg) {
    document.getElementById('b').href = baseHref
    document.body.style.background = bg || 'transparent'
    const root = document.getElementById('root')
    root.innerHTML = markup
    const svg = root.querySelector('svg')
    if (!svg) throw new Error('找不到 <svg> 根元素')
    const s = svgSize(svg)
    svg.setAttribute('width', s.w)
    svg.setAttribute('height', s.h)
    svg.style.display = 'block'
    cur = { mode: 'svg', el: svg, ...s }
    await settle()
    return { w: s.w, h: s.h, vb: s.vb }
  }

  async function mountDoc(w, h, bg) {
    if (bg) document.documentElement.style.background = bg
    await settle()
    // 大小:沒指定時量內容的右下角(body 自己設了寬度就用 body 的寬)
    const br = document.body.getBoundingClientRect()
    let right = br.width < innerWidth - 1 ? br.right : 0
    let bottom = br.bottom
    for (const e of document.body.querySelectorAll('*')) {
      const r = e.getBoundingClientRect()
      if (!r.width && !r.height) continue
      right = Math.max(right, r.right)
      bottom = Math.max(bottom, r.bottom)
    }
    const W = w || Math.ceil(right + scrollX) || innerWidth
    const H = h || Math.ceil(bottom + scrollY) || innerHeight
    cur = { mode: 'html', el: document.body, w: W, h: H, vb: { x: 0, y: 0, w: W, h: H } }
    return { w: W, h: H, vb: cur.vb }
  }

  // 元素在作品座標的外框
  function boxOf(el) {
    const r = el.getBoundingClientRect()
    const o = cur.el.getBoundingClientRect()
    const kx = cur.vb.w / (cur.mode === 'svg' ? o.width : cur.w)
    const ky = cur.vb.h / (cur.mode === 'svg' ? o.height : cur.h)
    const ox = cur.mode === 'svg' ? o.left : -scrollX
    const oy = cur.mode === 'svg' ? o.top : -scrollY
    return { x: (r.left - ox) * kx + cur.vb.x, y: (r.top - oy) * ky + cur.vb.y, w: r.width * kx, h: r.height * ky }
  }
  const round = (b) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) })
  const visible = (el) => !el.closest(SKIP) && (el instanceof SVGGraphicsElement || el instanceof HTMLElement) && el !== cur.el
  function layerEls(filter) {
    const re = filter ? new RegExp(filter) : null
    return [...cur.el.querySelectorAll('[id]')].filter((el) => visible(el) && (!re || re.test(el.id)))
  }
  const depthOf = (el) => {
    let d = 0
    for (let p = el.parentElement; p && p !== cur.el; p = p.parentElement) if (p.id) d++
    return d
  }

  // ---------- 疊加線 ----------
  function overlays(list, outScale, opts = {}) {
    document.getElementById('art-ov')?.remove()
    if (!list?.length) return
    const { vb } = cur
    const ov = document.createElementNS(NS, 'svg')
    ov.id = 'art-ov'
    ov.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)
    ov.setAttribute('width', cur.w)
    ov.setAttribute('height', cur.h)
    ov.setAttribute('style', 'position:absolute;left:0;top:0;pointer-events:none;z-index:2147483647;overflow:visible')
    // 1 個輸出 px 等於幾個作品單位:線寬、字級照輸出的大小,不受作品縮放影響
    const u = vb.w / cur.w / (outScale || 1)
    const add = (tag, attrs, parent = ov) => {
      const e = document.createElementNS(NS, tag)
      for (const k in attrs) e.setAttribute(k, attrs[k])
      parent.appendChild(e)
      return e
    }
    const labels = []
    const label = (x, y, t, color, anchor = 'start') => {
      const fs = 12 * u
      const g = add('g', {})
      const r = add('rect', { fill: color, opacity: 0.85 }, g)
      const tx = add('text', { x: x + 3 * u, y: y + fs + 1 * u, 'font-size': fs, 'font-family': 'Consolas, monospace', fill: '#fff', 'text-anchor': anchor }, g)
      tx.textContent = t
      labels.push([r, tx])
    }
    const step = opts.grid || 100
    if (list.includes('grid')) {
      for (let x = Math.ceil(vb.x / (step / 2)) * (step / 2); x <= vb.x + vb.w; x += step / 2) {
        const major = Math.round(x) % step === 0
        add('line', { x1: x, y1: vb.y, x2: x, y2: vb.y + vb.h, stroke: major ? '#00b7ff' : '#00b7ff', 'stroke-opacity': major ? 0.55 : 0.2, 'stroke-width': u })
        if (major) label(x, vb.y, String(Math.round(x)), '#0077aa')
      }
      for (let y = Math.ceil(vb.y / (step / 2)) * (step / 2); y <= vb.y + vb.h; y += step / 2) {
        const major = Math.round(y) % step === 0
        add('line', { x1: vb.x, y1: y, x2: vb.x + vb.w, y2: y, stroke: '#00b7ff', 'stroke-opacity': major ? 0.55 : 0.2, 'stroke-width': u })
        if (major && y > vb.y) label(vb.x, y, String(Math.round(y)), '#0077aa')
      }
    }
    if (list.includes('rulers')) {
      const T = 18 * u
      add('rect', { x: vb.x, y: vb.y, width: vb.w, height: T, fill: '#111', opacity: 0.75 })
      add('rect', { x: vb.x, y: vb.y, width: T, height: vb.h, fill: '#111', opacity: 0.75 })
      const tick = 10
      for (let x = Math.ceil(vb.x / tick) * tick; x <= vb.x + vb.w; x += tick) {
        const m = Math.round(x) % 100 === 0 ? 1 : Math.round(x) % 50 === 0 ? 0.6 : 0.3
        add('line', { x1: x, y1: vb.y, x2: x, y2: vb.y + T * m, stroke: '#fff', 'stroke-width': u })
        if (m === 1) add('text', { x: x + 2 * u, y: vb.y + T - 4 * u, 'font-size': 10 * u, fill: '#fff', 'font-family': 'Consolas, monospace' }).textContent = Math.round(x)
      }
      for (let y = Math.ceil(vb.y / tick) * tick; y <= vb.y + vb.h; y += tick) {
        const m = Math.round(y) % 100 === 0 ? 1 : Math.round(y) % 50 === 0 ? 0.6 : 0.3
        add('line', { x1: vb.x, y1: y, x2: vb.x + T * m, y2: y, stroke: '#fff', 'stroke-width': u })
        if (m === 1) add('text', { x: vb.x + 2 * u, y: y - 2 * u, 'font-size': 10 * u, fill: '#fff', 'font-family': 'Consolas, monospace' }).textContent = Math.round(y)
      }
    }
    if (list.includes('bbox')) {
      const kids = [...cur.el.children].filter((el) => visible(el))
      kids.forEach((el, i) => {
        const b = boxOf(el)
        if (!b.w && !b.h) return
        const c = PALETTE[i % PALETTE.length]
        add('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: 'none', stroke: c, 'stroke-width': 1.5 * u, 'stroke-dasharray': `${6 * u} ${4 * u}` })
        label(b.x, b.y + b.h - 16 * u, `${el.id ? '#' + el.id : '<' + el.tagName + '>'} ${Math.round(b.w)}×${Math.round(b.h)}`, c)
      })
    }
    if (list.includes('layers')) {
      layerEls(opts.layers).slice(0, 120).forEach((el, i) => {
        const b = boxOf(el)
        if (!b.w && !b.h) return
        const c = PALETTE[i % PALETTE.length]
        const d = depthOf(el)
        add('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: 'none', stroke: c, 'stroke-width': (d ? 1.25 : 2.25) * u })
        label(b.x, b.y + d * 15 * u, '#' + el.id, c)
      })
    }
    if (list.includes('pivots')) {
      for (const el of cur.el.querySelectorAll('[data-pivot]')) {
        const [px, py] = el.getAttribute('data-pivot').split(/[\s,]+/).map(Number)
        add('circle', { cx: px, cy: py, r: 6 * u, fill: 'none', stroke: '#ff2d55', 'stroke-width': 2 * u })
        add('line', { x1: px - 10 * u, y1: py, x2: px + 10 * u, y2: py, stroke: '#ff2d55', 'stroke-width': 1.5 * u })
        add('line', { x1: px, y1: py - 10 * u, x2: px, y2: py + 10 * u, stroke: '#ff2d55', 'stroke-width': 1.5 * u })
        label(px + 6 * u, py, (el.id ? '#' + el.id : '') + ' pivot', '#ff2d55')
      }
    }
    if (list.includes('canvas')) add('rect', { x: vb.x, y: vb.y, width: vb.w, height: vb.h, fill: 'none', stroke: '#ff2d55', 'stroke-width': 2 * u, 'stroke-dasharray': `${8 * u} ${6 * u}` })
    ;(cur.mode === 'svg' ? document.getElementById('root') : document.body).appendChild(ov)
    if (cur.mode === 'html') document.body.style.position ||= 'relative'
    // 標籤的底色要等文字放進頁面才量得到大小;標籤移到最上層,不被外框蓋住
    for (const [r, tx] of labels) {
      const b = tx.getBBox()
      for (const [k, v] of Object.entries({ x: b.x - 2 * u, y: b.y - 1 * u, width: b.width + 4 * u, height: b.height + 2 * u })) r.setAttribute(k, v)
      ov.appendChild(r.parentNode)
    }
  }

  // ---------- 檢查 ----------
  function inspect(opts = {}) {
    const { vb } = cur
    const all = [...cur.el.querySelectorAll('*')]
    const drawn = all.filter((el) => visible(el))
    const tags = {}
    for (const el of all) tags[el.tagName] = (tags[el.tagName] || 0) + 1
    // 顏色:屬性與 style 裡的 fill / stroke / stop-color / color / background
    const colors = {}
    const addColor = (v) => {
      if (!v || /^(none|inherit|currentColor|transparent|url\()/i.test(v.trim())) return
      const k = v.trim().toLowerCase()
      colors[k] = (colors[k] || 0) + 1
    }
    const COLOR_PROPS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color', 'background', 'background-color']
    for (const el of [cur.el, ...all]) {
      for (const p of COLOR_PROPS) addColor(el.getAttribute(p))
      const st = el.getAttribute('style')
      if (st) for (const m of st.matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]+)/g)) if (COLOR_PROPS.includes(m[1])) addColor(m[2])
    }
    for (const s of cur.el.querySelectorAll('style')) for (const m of s.textContent.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)) addColor(m[0])
    // 路徑節點數(d 裡的指令數)
    const paths = [...cur.el.querySelectorAll('path')]
    const nodes = paths.reduce((n, p) => n + ((p.getAttribute('d') || '').match(/[a-df-z]/gi) || []).length, 0)
    // 找不到的參照 url(#x) / href="#x"
    const ids = new Set(all.map((el) => el.id).filter(Boolean))
    const missing = new Set()
    for (const el of all) {
      for (const a of el.attributes) {
        for (const m of a.value.matchAll(/url\(\s*['"]?#([^)'"]+)['"]?\s*\)/g)) if (!ids.has(m[1])) missing.add(m[1])
        if ((a.name === 'href' || a.name === 'xlink:href') && a.value.startsWith('#') && !ids.has(a.value.slice(1))) missing.add(a.value.slice(1))
      }
    }
    const dupIds = Object.entries(all.reduce((m, el) => (el.id && (m[el.id] = (m[el.id] || 0) + 1), m), {})).filter(([, n]) => n > 1).map(([id]) => id)
    // 有 id 的元素樹
    const tree = layerEls(opts.layers).map((el) => {
      const b = round(boxOf(el))
      const outside = b.x < vb.x - 0.5 || b.y < vb.y - 0.5 || b.x + b.w > vb.x + vb.w + 0.5 || b.y + b.h > vb.y + vb.h + 0.5
      return { id: el.id, tag: el.tagName, depth: depthOf(el), box: b, children: el.children.length, outside: outside || undefined, pivot: el.getAttribute('data-pivot') || undefined }
    })
    // 超出畫布的(有 id 的,與沒有 id 的最上層圖形)
    const outside = []
    for (const el of drawn) {
      if (el.closest('[id]') !== el && el.parentElement !== cur.el) continue
      const b = round(boxOf(el))
      if (!b.w && !b.h) continue
      if (b.x < vb.x - 0.5 || b.y < vb.y - 0.5 || b.x + b.w > vb.x + vb.w + 0.5 || b.y + b.h > vb.y + vb.h + 0.5) outside.push({ el: el.id ? '#' + el.id : `<${el.tagName}>`, box: b })
    }
    const texts = [...cur.el.querySelectorAll(cur.mode === 'svg' ? 'text' : 'h1,h2,h3,h4,p,span,li,button,div')]
      .filter((el) => cur.mode === 'svg' || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .slice(0, 60)
      .map((el) => ({ text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80), box: round(boxOf(el)), font: getComputedStyle(el).fontFamily.split(',')[0] }))
    const filters = [...cur.el.querySelectorAll('filter')].map((f) => ({ id: f.id, prims: [...f.children].map((c) => c.tagName).join(' ') }))
    const gradients = cur.el.querySelectorAll('linearGradient, radialGradient').length
    return {
      mode: cur.mode,
      size: { w: cur.w, h: cur.h },
      viewBox: vb,
      elements: all.length,
      tags,
      paths: paths.length,
      pathCommands: nodes,
      gradients,
      filters,
      colors: Object.entries(colors).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`),
      missingRefs: [...missing],
      duplicateIds: dupIds,
      outside,
      texts,
      tree,
    }
  }

  // ---------- 拼圖與差異(工具頁用) ----------
  async function compose({ items, cols, cell, gap = 12, title, bg = '#1c1c1e' }) {
    cols = Math.max(1, Math.min(cols || items.length, items.length))
    const rows = Math.ceil(items.length / cols)
    const labelH = items.some((i) => i.label) ? 28 : 0
    const titleH = title ? 34 : 0
    const W = cols * cell.w + (cols + 1) * gap
    const H = titleH + rows * (cell.h + labelH) + (rows + 1) * gap
    document.body.style.cssText = `margin:0;background:${bg};width:${W}px;height:${H}px;position:relative;font:16px/1.3 'Microsoft JhengHei', 'Noto Sans TC', Consolas, sans-serif;color:#eee`
    document.body.innerHTML = ''
    if (title) {
      const t = document.createElement('div')
      t.textContent = title
      t.style.cssText = `position:absolute;left:${gap}px;top:${gap}px;font-size:16px;font-weight:bold`
      document.body.appendChild(t)
    }
    await Promise.all(
      items.map(async (it, i) => {
        const x = gap + (i % cols) * (cell.w + gap)
        const y = titleH + gap + Math.floor(i / cols) * (cell.h + labelH + gap)
        const img = new Image()
        img.src = it.src
        await img.decode()
        const s = Math.min(cell.w / img.naturalWidth, cell.h / img.naturalHeight)
        img.style.cssText = `position:absolute;left:${x + (cell.w - img.naturalWidth * s) / 2}px;top:${y + labelH}px;width:${img.naturalWidth * s}px;height:${img.naturalHeight * s}px;background:repeating-conic-gradient(#3a3a3c 0 25%, #2c2c2e 0 50%) 0 0/16px 16px`
        document.body.appendChild(img)
        if (it.label) {
          const l = document.createElement('div')
          l.textContent = it.label
          l.style.cssText = `position:absolute;left:${x}px;top:${y + 4}px;width:${cell.w}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`
          document.body.appendChild(l)
        }
      }),
    )
    return { w: W, h: H }
  }

  async function diff(aSrc, bSrc) {
    const load = async (src) => {
      const i = new Image()
      i.src = src
      await i.decode()
      return i
    }
    const [a, b] = await Promise.all([load(aSrc), load(bSrc)])
    const w = Math.max(a.naturalWidth, b.naturalWidth)
    const h = Math.max(a.naturalHeight, b.naturalHeight)
    const px = (img) => {
      const c = new OffscreenCanvas(w, h)
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0)
      return g.getImageData(0, 0, w, h).data
    }
    const A = px(a)
    const B = px(b)
    const out = new ImageData(w, h)
    let changed = 0
    let minX = w, minY = h, maxX = -1, maxY = -1
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]), Math.abs(A[i + 3] - B[i + 3]))
      const gray = (B[i] * 0.3 + B[i + 1] * 0.59 + B[i + 2] * 0.11) * 0.35 + 30
      if (d > 8) {
        changed++
        const p = i / 4
        const x = p % w
        const y = (p - x) / w
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        const t = Math.min(1, d / 128)
        out.data[i] = 255
        out.data[i + 1] = Math.round(220 * (1 - t))
        out.data[i + 2] = 0
      } else {
        out.data[i] = out.data[i + 1] = out.data[i + 2] = gray
      }
      out.data[i + 3] = 255
    }
    const c = new OffscreenCanvas(w, h)
    c.getContext('2d').putImageData(out, 0, 0)
    const blob = await c.convertToBlob({ type: 'image/png' })
    const url = await new Promise((r) => {
      const fr = new FileReader()
      fr.onload = () => r(fr.result)
      fr.readAsDataURL(blob)
    })
    return { url, changed, total: w * h, region: maxX >= 0 ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null }
  }

  return { mountSvg, mountDoc, overlays, inspect, compose, diff, get current() { return cur && { mode: cur.mode, w: cur.w, h: cur.h, vb: cur.vb } } }
})()
