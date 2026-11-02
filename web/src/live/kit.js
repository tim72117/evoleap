// kit.js — 舞台與演員共用的繪製手法工具(規格見 README.md「繪製工具 kit」)。
//
// 全部是「輸入時間/進度,輸出數值或字串」的純函式:不讀時鐘、不用亂數、不開計時器,
// 所以同一個時間點一定畫出同一個畫面,播放器可以任意拖曳,錄影可以逐格要畫面。
// 少數需要量 DOM 的函式(rectIn、focus、arrowBetween)只讀版面,不改版面。
//
// 用法:import { kit } from './kit.js'(型別宣告在 kit.d.ts)。
  // ---------- 數值與進度 ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  /** local 在 [start, start+dur] 之間的進度 0–1;dur 為 0 時到點就是 1 */
  const progress = (local, start, dur) => (dur <= 0 ? (local >= start ? 1 : 0) : clamp((local - start) / dur));
  /** 把 [inA, inB] 的值對應到 [outA, outB],超出範圍會夾住 */
  const map = (x, inA, inB, outA, outB, easeFn = ease.linear) => lerp(outA, outB, easeFn(clamp((x - inA) / (inB - inA))));

  // ---------- 緩動 ----------
  const ease = {
    linear: (p) => p,
    inQuad: (p) => p * p,
    outQuad: (p) => 1 - (1 - p) * (1 - p),
    inOutQuad: (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
    inCubic: (p) => p ** 3,
    outCubic: (p) => 1 - (1 - p) ** 3,
    inOutCubic: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
    outQuart: (p) => 1 - (1 - p) ** 4,
    outExpo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
    outBack: (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2; },
    outElastic: (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 2 ** (-10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    /** 進度分段:steps(4) 讓動畫一格一格跳 */
    steps: (n) => (p) => Math.min(1, Math.floor(p * n) / n),
  };
  /** 名稱或函式都可以:腳本裡寫 "outCubic",程式裡也能直接給函式 */
  const easeOf = (e) => (typeof e === "function" ? e : ease[e] || ease.outCubic);

  /**
   * 彈簧(解析解,不用逐步模擬,任意時間點都算得出來)。回傳從 0 往 1 前進的位置,可能超過 1(回彈)。
   * opts: stiffness(預設 170)、damping(26)、mass(1);local 單位毫秒。
   */
  function spring(localMs, { stiffness = 170, damping = 26, mass = 1 } = {}) {
    const t = Math.max(0, localMs) / 1000;
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1));
    const r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  }

  /**
   * 關鍵影格:keyframes([{at:0, x:0, o:0}, {at:400, x:120, o:1, ease:"outBack"}])(local) → {x, o}
   * 每個影格的 ease 決定「從上一格到這一格」的曲線。數值以外的欄位(字串、布林)到點才切換。
   */
  function keyframes(frames) {
    const ks = [...frames].sort((a, b) => a.at - b.at);
    return (local) => {
      if (local <= ks[0].at) return strip(ks[0]);
      for (let i = 1; i < ks.length; i++) {
        const a = ks[i - 1], b = ks[i];
        if (local <= b.at) {
          const p = easeOf(b.ease)(progress(local, a.at, b.at - a.at));
          const out = {};
          for (const k of Object.keys(b)) {
            if (k === "at" || k === "ease") continue;
            out[k] = typeof b[k] === "number" && typeof a[k] === "number" ? lerp(a[k], b[k], p) : p >= 1 ? b[k] : a[k] ?? b[k];
          }
          return out;
        }
      }
      return strip(ks.at(-1));
    };
  }
  const strip = (f) => { const { at, ease: _e, ...rest } = f; return rest; };

  /**
   * 依序排程:sequence(items, durOf, {gap, start}) → [{item, start, dur, end}]
   * item 可以寫 at(絕對開始時間)或 delay(相對前一項結束);沒寫就接在前一項後面加 gap。
   */
  function sequence(items, durOf, { gap = 250, start = 0 } = {}) {
    let t = start;
    return items.map((item, i) => {
      const s = item.at ?? t + (i === 0 ? 0 : item.delay ?? gap);
      const dur = item.ms ?? durOf(item, i);
      t = s + dur;
      return { item, start: s, dur, end: s + dur };
    });
  }
  /** 第 i 個項目的開始時間:每個間隔 gap,可以給 from 起始 */
  const stagger = (i, gap = 120, from = 0) => from + i * gap;

  // ---------- 週期與小動畫 ----------
  /** 閃爍(游標):回傳目前是不是「亮」 */
  const blink = (local, period = 1060) => Math.floor(local / (period / 2)) % 2 === 0;
  /** 轉圈角度(度) */
  const spin = (local, rpm = 60) => ((local / 60000) * rpm * 360) % 360;
  /** 0–1 之間來回的脈動 */
  const pulse = (local, period = 1200) => 0.5 - 0.5 * Math.cos((local / period) * 2 * Math.PI);
  /** 「思考中…」的點點 */
  const dots = (local, period = 400, max = 3) => ".".repeat(1 + (Math.floor(local / period) % max));
  /** 晃動(提示錯誤):在 dur 內衰減的左右位移,單位與 amp 相同 */
  const shake = (local, start, dur = 400, amp = 8, freq = 5) => {
    const p = progress(local, start, dur);
    return p <= 0 || p >= 1 ? 0 : Math.sin(p * freq * 2 * Math.PI) * amp * (1 - p);
  };

  // ---------- 決定性的亂數 ----------
  /** 固定種子的亂數產生器(mulberry32):rand(seed)() → 0–1,同一個種子永遠同一串 */
  function rand(seed = 1) {
    let a = typeof seed === "string" ? [...seed].reduce((h, c) => Math.imul(h ^ c.codePointAt(0), 16777619), 2166136261) : seed;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 一維平滑雜訊(飄動、手持感):noise(x, seed) → -1–1 */
  function noise(x, seed = 1) {
    const i = Math.floor(x), f = x - i;
    const h = (n) => rand(seed * 7919 + n)() * 2 - 1;
    const u = f * f * (3 - 2 * f);
    return lerp(h(i), h(i + 1), u);
  }

  // ---------- 文字 ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("zh-Hant", { granularity: "grapheme" }) : null;
  /** 切成「看得到的字」:emoji、組合字不會被切壞 */
  const graphemes = (s) => (seg ? [...seg.segment(String(s))].map((x) => x.segment) : [...String(s)]);

  /**
   * 逐字打出:typewriter(text, local, {start, cps}) → {text, done, n, total}
   * cps 每秒字數;中文建議 10–16(打字),英文/程式碼 25–40,AI 回覆串流 40–80。
   */
  function typewriter(text, local, { start = 0, cps = 14 } = {}) {
    const g = graphemes(text);
    const n = clamp(Math.floor(((local - start) / 1000) * cps), 0, g.length);
    return { text: g.slice(0, n).join(""), n, total: g.length, done: n >= g.length };
  }
  /** 打完 text 需要的毫秒數 */
  const typeDuration = (text, cps = 14) => (graphemes(text).length / cps) * 1000;

  /**
   * 行內標記(腳本的文字欄位共用):`程式碼`、**粗體**、[[強調色]]、換行。回傳 HTML,其餘一律跳脫。
   * 搭配 typewriter 使用時改用 richCut,避免標記被切在中間。
   */
  const rich = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code class="k-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[\[(.+?)\]\]/g, '<em class="k-em">$1</em>')
    .replace(/\n/g, "<br>");
  /** 只顯示前 n 個字的 rich(標記不算字數、不會被切壞) */
  function richCut(s, n) {
    let out = "", shown = 0;
    const open = [];
    const tokens = String(s).match(/`|\*\*|\[\[|\]\]|[\s\S]/gu) || [];
    for (const tk of tokens) {
      if (tk === "`" || tk === "**") { open.at(-1) === tk ? open.pop() : open.push(tk); out += tk; continue; }
      if (tk === "[[") { open.push("]]"); out += tk; continue; }
      if (tk === "]]") { if (open.at(-1) === "]]") open.pop(); out += tk; continue; }
      if (shown >= n) break;
      out += tk; shown++;
    }
    while (open.length) { const o = open.pop(); out += o === "]]" ? "]]" : o; }
    return rich(out);
  }

  /** 數字跳動:countUp(0, 1280, p, {decimals:0, sep:true}) → "1,280" */
  function countUp(from, to, p, { decimals = 0, sep = true, prefix = "", suffix = "" } = {}) {
    const v = lerp(from, to, clamp(p));
    const s = v.toFixed(decimals);
    return prefix + (sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : s) + suffix;
  }

  /** 亂碼解碼效果:前 p 比例的字是正確的,其餘用固定種子的亂碼 */
  function scramble(text, p, { chars = "▓▒░<>/\\{}[]#*", seed = 7 } = {}) {
    const g = graphemes(text);
    const n = Math.floor(clamp(p) * g.length);
    const r = rand(seed);
    return g.map((c, i) => (i < n || c === " " ? c : chars[Math.floor(r() * chars.length)])).join("");
  }

  // ---------- 出場與強調(回傳可直接套用的 style 物件) ----------
  /** 淡入加位移:dir 為 up/down/left/right,dist 為位移量(預設 1.2em) */
  function enter(p, { dir = "up", dist = "1.2em", scale = 1 } = {}) {
    const e = ease.outCubic(clamp(p));
    const d = (1 - e).toFixed(4);
    const axis = dir === "left" || dir === "right" ? "X" : "Y";
    const sign = dir === "up" || dir === "left" ? "" : "-";
    const sc = scale === 1 ? "" : ` scale(${lerp(scale, 1, e).toFixed(4)})`;
    return { opacity: e.toFixed(3), transform: `translate${axis}(calc(${sign}${dist} * ${d}))${sc}` };
  }
  /** 遮罩揭露:從 dir 方向逐漸露出(clip-path) */
  function wipe(p, dir = "right") {
    const r = ((1 - clamp(p)) * 100).toFixed(2) + "%";
    const inset = { right: `0 ${r} 0 0`, left: `0 0 0 ${r}`, down: `0 0 ${r} 0`, up: `${r} 0 0 0` }[dir];
    return { clipPath: `inset(${inset})` };
  }
  /** 螢光筆劃過:套在行內元素上,背景色從左往右塗滿 */
  function marker(p, color = "rgba(255, 213, 79, 0.55)") {
    return {
      backgroundImage: `linear-gradient(${color}, ${color})`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "0 85%",
      backgroundSize: `${(clamp(p) * 100).toFixed(2)}% 45%`,
    };
  }
  /** 底線畫出 */
  function underline(p, color = "currentColor", thickness = "0.12em") {
    return {
      backgroundImage: `linear-gradient(${color}, ${color})`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "0 100%",
      backgroundSize: `${(clamp(p) * 100).toFixed(2)}% ${thickness}`,
    };
  }
  /** 聚光燈:畫面其他地方變暗,只留一個圓/方形區域。rect 用舞台座標(見 rectIn) */
  function spotlight(p, rect, { dim = 0.6, pad = 16, radius = 14 } = {}) {
    const a = (clamp(p) * dim).toFixed(3);
    const x = rect.x - pad, y = rect.y - pad, w = rect.w + pad * 2, h = rect.h + pad * 2;
    return {
      boxShadow: `0 0 0 9999px rgba(0,0,0,${a})`,
      left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
      borderRadius: `${radius}px`, position: "absolute", pointerEvents: "none",
    };
  }

  // ---------- 線條與路徑 ----------
  /** SVG 線條逐步畫出:先用 el.getTotalLength() 取得 length,再把回傳值套到 style */
  const drawPath = (p, length) => ({ strokeDasharray: `${length}`, strokeDashoffset: `${(length * (1 - clamp(p))).toFixed(2)}` });
  /** 兩點之間的曲線箭頭路徑(SVG d 字串);bend 為彎曲程度(0 是直線) */
  function arrowPath([x1, y1], [x2, y2], bend = 0.2) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const cx = mx - dy * bend, cy = my + dx * bend;
    return `M ${x1} ${y1} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`;
  }
  /** 從 a 元素邊緣指到 b 元素邊緣的箭頭路徑(舞台座標) */
  function arrowBetween(a, b, bend = 0.2) {
    const ca = [a.x + a.w / 2, a.y + a.h / 2], cb = [b.x + b.w / 2, b.y + b.h / 2];
    const edge = (r, from, to) => {
      const dx = to[0] - from[0], dy = to[1] - from[1];
      const s = Math.min(Math.abs(r.w / 2 / (dx || 1e-9)), Math.abs(r.h / 2 / (dy || 1e-9)));
      return [from[0] + dx * s, from[1] + dy * s];
    };
    return arrowPath(edge(a, ca, cb), edge(b, cb, ca), bend);
  }

  // ---------- 版面量測與鏡頭 ----------
  /** 元素在 root 內的位置(不受 transform/縮放影響,用 offset 累加) */
  function rectIn(el, root) {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  /**
   * 鏡頭:把 rect 放大置中到 view 大小。回傳 {x, y, zoom} 給 cameraStyle;p 控制從全景到特寫的進度。
   * margin 是特寫時留白的比例。
   */
  function focus(rect, view, p = 1, { margin = 0.15, maxZoom = 2.5 } = {}) {
    const zoom = Math.min(maxZoom, (view.w * (1 - margin * 2)) / rect.w, (view.h * (1 - margin * 2)) / rect.h);
    const e = ease.inOutCubic(clamp(p));
    const z = lerp(1, Math.max(1, zoom), e);
    const tx = lerp(0, view.w / 2 - (rect.x + rect.w / 2) * z, e);
    const ty = lerp(0, view.h / 2 - (rect.y + rect.h / 2) * z, e);
    return { x: tx, y: ty, zoom: z };
  }
  const cameraStyle = ({ x = 0, y = 0, zoom = 1 }) => ({ transformOrigin: "0 0", transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${zoom.toFixed(4)})` });

  /** 內容貼齊底部(對話、終端機):回傳內容要往上移多少 px */
  const stickBottom = (viewH, contentH) => Math.min(0, viewH - contentH);
  /** 平滑捲動:在 [start, start+dur] 間從 from 捲到 to */
  const scrollTo = (local, start, dur, from, to, e = "inOutCubic") => lerp(from, to, easeOf(e)(progress(local, start, dur)));

  // ---------- 虛擬滑鼠與鍵盤 ----------
  /**
   * 滑鼠路徑:moves = [{at, to:[x,y], ms?, ease?, click?}],回傳該時間點的 {x, y, down, ripple}
   * ripple = {x, y, r: 0–1, o: 0–1} 點擊漣漪,沒有就是 null。
   */
  function cursor(local, moves, { from = [0, 0], moveMs = 600, clickMs = 160, rippleMs = 450 } = {}) {
    let pos = from, down = false, ripple = null;
    for (const m of moves) {
      if (local < m.at) break;
      const dur = m.ms ?? moveMs;
      const p = easeOf(m.ease || "inOutCubic")(progress(local, m.at, dur));
      const cur = [lerp(pos[0], m.to[0], p), lerp(pos[1], m.to[1], p)];
      if (m.click) {
        const ct = m.at + dur;
        if (local >= ct && local < ct + clickMs) down = true;
        const rp = progress(local, ct, rippleMs);
        if (local >= ct && rp < 1) ripple = { x: m.to[0], y: m.to[1], r: ease.outCubic(rp), o: 1 - rp };
      }
      pos = p >= 1 ? m.to : cur;
      if (p < 1) return { x: cur[0], y: cur[1], down, ripple };
    }
    return { x: pos[0], y: pos[1], down, ripple };
  }
  /** 按鍵提示(⌘ K 之類):keys = [{at, label, ms?}],回傳目前要顯示的 {label, o} 或 null */
  function keycap(local, keys, { ms = 900, fade = 150 } = {}) {
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      if (local < k.at) continue;
      const end = k.at + (k.ms ?? ms);
      if (local >= end) return null;
      return { label: k.label, o: Math.min(progress(local, k.at, fade), progress(end - local, 0, fade)) };
    }
    return null;
  }

  // ---------- 圖表 ----------
  /** 長條圖逐根長出:回傳每根的高度比例 0–1 */
  const bars = (values, p, { stagger: gap = 0.12 } = {}) => {
    const max = Math.max(...values, 1e-9);
    return values.map((v, i) => (v / max) * ease.outCubic(clamp((p - i * gap) / Math.max(1e-9, 1 - (values.length - 1) * gap))));
  };
  /** 折線圖的 SVG points 字串(viewBox 0 0 w h),搭配 drawPath 畫出 */
  const linePoints = (values, w = 100, h = 50, pad = 4) => {
    const max = Math.max(...values), min = Math.min(...values, 0);
    return values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(2)},${(h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)).toFixed(2)}`).join(" ");
  };

  // ---------- 繪製效能 ----------
  /** 只有值變了才寫入 DOM(innerHTML 重建很貴);回傳是否有變 */
  function setIf(el, prop, value) {
    const k = "__k_" + prop;
    if (el[k] === value) return false;
    el[k] = value;
    if (prop === "html") el.innerHTML = value;
    else if (prop === "text") el.textContent = value;
    else el.style[prop] = value;
    return true;
  }
  /** 套用 style 物件(enter、wipe、marker… 的回傳值) */
  const css = (el, styles) => { for (const [k, v] of Object.entries(styles)) setIf(el, k, v); };
  /** 組影格 key:畫面相同 ⇔ key 相同(錄影時用來跳過重複影格);數值會先四捨五入 */
  const key = (...parts) => parts.map((p) => (typeof p === "number" ? Math.round(p * 100) / 100 : p)).join("|");

  export const kit = {
    clamp, lerp, progress, map, ease, easeOf, spring, keyframes, sequence, stagger,
    blink, spin, pulse, dots, shake, rand, noise,
    esc, graphemes, typewriter, typeDuration, rich, richCut, countUp, scramble,
    enter, wipe, marker, underline, spotlight,
    drawPath, arrowPath, arrowBetween,
    rectIn, focus, cameraStyle, stickBottom, scrollTo,
    cursor, keycap, bars, linePoints,
    setIf, css, key,
  };
