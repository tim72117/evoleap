// player.js — draws the scene for any time t. No timers, no CSS animation:
// renderAt(t) is a pure function of t, so the recorder can ask for exactly
// frame N at N/fps seconds. (A recorder that screenshots in real time runs
// slower than its target fps, and then ffmpeg plays the short frame list back
// too fast. Asking for each frame by time avoids that.)
(() => {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // [[x]] marks accent-coloured text, \n becomes a line break
  const rich = (s) => esc(s).replace(/\[\[(.+?)\]\]/g, "<em>$1</em>").replace(/\n/g, "<br>");
  const FADE_MS = 280;
  const BLINK_MS = 500;

  // ---------- tiny syntax highlighter ----------
  const STR = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/y;
  const NUM = /\b\d+(?:\.\d+)?\b/y;
  const RULES = {
    js: [["c", /\/\/.*/y], ["s", STR], ["n", NUM], ["k", /\b(?:const|let|var|function|return|if|else|for|while|import|from|export|default|async|await|new|class|extends|type|interface|of|in|true|false|null|undefined)\b/y], ["f", /[A-Za-z_$][\w$]*(?=\()/y]],
    yaml: [["c", /#.*/y], ["key", /[\w.-]+(?=\s*:)/y], ["s", STR], ["n", NUM], ["k", /\b(?:true|false|null)\b/y]],
    json: [["key", /"(?:[^"\\]|\\.)*"(?=\s*:)/y], ["s", STR], ["n", NUM], ["k", /\b(?:true|false|null)\b/y]],
    bash: [["c", /#.*/y], ["s", STR], ["flag", /--?[A-Za-z][\w-]*/y]],
  };
  RULES.ts = RULES.javascript = RULES.typescript = RULES.js;
  RULES.yml = RULES.yaml;
  RULES.sh = RULES.bash;

  function tokenize(line, lang) {
    const rules = RULES[lang] || [];
    const out = [];
    let plain = "";
    let i = 0;
    while (i < line.length) {
      let hit = null;
      for (const [cls, re] of rules) {
        re.lastIndex = i;
        const m = re.exec(line);
        if (m && m[0].length) { hit = [cls, m[0]]; break; }
      }
      if (hit) {
        if (plain) { out.push(["", plain]); plain = ""; }
        out.push(hit);
        i += hit[1].length;
      } else { plain += line[i]; i += 1; }
    }
    if (plain) out.push(["", plain]);
    return out;
  }

  // first `visible` chars rendered with colour, the rest kept (hidden) so the
  // line keeps its final width and nothing jumps while typing
  function tokensHtml(tokens, visible, cursor) {
    let left = visible;
    let html = "";
    let hidden = "";
    for (const [cls, text] of tokens) {
      if (left >= text.length) {
        html += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
        left -= text.length;
      } else if (left > 0) {
        const head = text.slice(0, left);
        html += cls ? `<span class="${cls}">${esc(head)}</span>` : esc(head);
        hidden += text.slice(left);
        left = 0;
      } else hidden += text;
    }
    if (cursor) html += '<span class="cur"></span>';
    if (hidden) html += `<span class="hid">${esc(hidden)}</span>`;
    return html;
  }

  // ---------- scene types ----------
  // each: dur(scene) -> default seconds; build(scene) -> { html, mount(root) -> update(localMs, durMs) -> key }
  // `key` summarises what is on screen, so the recorder can reuse the previous frame when nothing changed.
  const TYPES = {};

  TYPES.title = {
    dur: () => 3.2,
    build(sc) {
      return {
        html: `<div class="t-title">${sc.eyebrow ? `<span class="chip">${rich(sc.eyebrow)}</span>` : ""}<h1>${rich(sc.text)}</h1>${sc.sub ? `<p class="t-sub">${rich(sc.sub)}</p>` : ""}</div>`,
        mount(root) {
          const el = root.querySelector(".t-title");
          return (local) => {
            const p = ease(local / 700);
            el.style.opacity = p.toFixed(3);
            el.style.transform = `translateY(${((1 - p) * 2).toFixed(3)}rem)`;
            return Math.round(p * 60);
          };
        },
      };
    },
  };

  const bulletItems = (sc) => sc.items.map((it, i) => {
    const o = typeof it === "string" ? { text: it } : { ...it };
    o.at = o.at ?? 0.8 + i * (sc.step ?? 1.3);
    return o;
  });
  TYPES.bullets = {
    dur: (sc) => bulletItems(sc).at(-1).at + 2.4,
    build(sc) {
      const items = bulletItems(sc);
      return {
        html: `<div class="b-wrap"><h2>${rich(sc.title)}</h2><ul>${items.map((it) => `<li>${rich(it.text)}${it.note ? `<small>${rich(it.note)}</small>` : ""}</li>`).join("")}</ul></div>`,
        mount(root) {
          const lis = [...root.querySelectorAll("li")];
          return (local) => lis.map((li, i) => {
            const p = ease((local - items[i].at * 1000) / 450);
            li.style.opacity = p.toFixed(3);
            li.style.transform = `translateX(${((1 - p) * -2).toFixed(3)}rem)`;
            return Math.round(p * 40);
          }).join(",");
        },
      };
    },
  };

  const codeInfo = (sc) => {
    const lines = String(sc.code).replace(/\n$/, "").split("\n");
    const starts = [];
    let total = 0;
    lines.forEach((l) => { starts.push(total); total += l.length + 1; });
    return { lines, starts, total: total - 1 };
  };
  const codeCps = (sc) => sc.cps ?? 30;
  TYPES.code = {
    dur(sc) {
      const { total } = codeInfo(sc);
      const typing = sc.typing === false ? 0 : total / codeCps(sc);
      const hl = (sc.highlight || []).reduce((m, h) => Math.max(m, h.at ?? 0), 0);
      return Math.max(0.6 + typing + 3, hl + 3);
    },
    build(sc) {
      const { lines, starts, total } = codeInfo(sc);
      const lang = sc.lang || "js";
      const toks = lines.map((l) => tokenize(l, lang));
      const typeStartMs = (sc.typeStart ?? 0.6) * 1000;
      const typingDone = sc.typing === false ? 0 : typeStartMs + (total / codeCps(sc)) * 1000;
      const hls = (sc.highlight || []).map((h) => ({
        at: (h.at ?? typingDone / 1000 + 0.8) * 1000,
        set: new Set((Array.isArray(h.lines) ? Array.from({ length: h.lines[1] - h.lines[0] + 1 }, (_, i) => h.lines[0] + i) : [h.lines]).map((n) => n - 1)),
      }));
      return {
        html: `<div class="code-wrap">${sc.title ? `<h2>${rich(sc.title)}</h2>` : ""}<div class="editor" style="--fs:${sc.fontSize || 2.3}rem"><div class="bar"><i></i><i></i><i></i><span class="tab">${esc(sc.filename || "")}</span></div><div class="body">${lines.map((_, i) => `<div class="ln"><span class="no">${i + 1}</span><span class="tx"></span></div>`).join("")}</div></div></div>`,
        mount(root) {
          const rows = [...root.querySelectorAll(".ln")];
          const txs = rows.map((r) => r.querySelector(".tx"));
          const cache = [];
          return (local) => {
            const typed = sc.typing === false ? total : clamp(Math.floor(((local - typeStartMs) / 1000) * codeCps(sc)), 0, total);
            const blink = Math.floor(local / BLINK_MS) % 2 === 0;
            const showCursor = typed < total || blink;
            let cursorLine = lines.length - 1;
            for (let i = 0; i < lines.length; i++) if (typed <= starts[i] + lines[i].length) { cursorLine = i; break; }
            const cur = hls.filter((h) => h.at <= local).at(-1);
            const p = cur ? ease((local - cur.at) / 350) : 0;
            rows.forEach((row, i) => {
              const vis = clamp(typed - starts[i], 0, lines[i].length);
              const hasCursor = showCursor && i === cursorLine && typed >= starts[i];
              const sig = vis + ":" + hasCursor;
              if (cache[i] !== sig) { txs[i].innerHTML = tokensHtml(toks[i], vis, hasCursor); cache[i] = sig; }
              const lit = cur && cur.set.has(i);
              row.style.opacity = (cur ? (lit ? 1 : 1 - 0.55 * p) : 1).toFixed(3);
              row.style.background = lit ? `rgba(240,180,58,${(0.16 * p).toFixed(3)})` : "transparent";
              row.style.borderLeftColor = lit ? `rgba(240,180,58,${p.toFixed(3)})` : "transparent";
            });
            return `${typed}|${showCursor}|${hls.indexOf(cur)}|${Math.round(p * 30)}`;
          };
        },
      };
    },
  };

  const termRows = (sc) => {
    const cps = sc.cps ?? 16;
    let t = 0.6;
    const rows = [];
    for (const item of sc.items) {
      const dur = item.cmd.length / cps;
      rows.push({ kind: "cmd", text: item.cmd, start: t, dur });
      let o = t + dur + 0.35;
      for (const line of item.out || []) { rows.push({ kind: "out", text: line, start: o, dur: 0 }); o += item.outGap ?? 0.12; }
      t = o + (item.wait ?? 0.6);
    }
    return { rows, end: t };
  };
  TYPES.terminal = {
    dur: (sc) => termRows(sc).end + 1.2,
    build(sc) {
      const { rows } = termRows(sc);
      return {
        html: `<div class="term-wrap">${sc.title ? `<h2>${rich(sc.title)}</h2>` : ""}<div class="editor term"><div class="bar"><i></i><i></i><i></i><span class="tab">${esc(sc.tab || "Terminal")}</span></div><div class="body"></div></div></div>`,
        mount(root) {
          const body = root.querySelector(".body");
          return (local) => {
            const blink = Math.floor(local / BLINK_MS) % 2 === 0;
            let html = "";
            let key = "";
            let lastCmd = -1;
            rows.forEach((r, i) => { if (r.kind === "cmd" && local >= r.start * 1000) lastCmd = i; });
            rows.forEach((r, i) => {
              if (local < r.start * 1000) return;
              if (r.kind === "cmd") {
                const n = clamp(Math.floor(((local - r.start * 1000) / 1000) * (sc.cps ?? 16)), 0, r.text.length);
                const cursor = i === lastCmd && (n < r.text.length || blink);
                html += `<div class="row"><span class="ps">$</span> ${esc(r.text.slice(0, n))}${cursor ? '<span class="cur"></span>' : ""}</div>`;
                key += `c${n}${cursor ? "|" : ""};`;
              } else { html += `<div class="row out">${esc(r.text)}</div>`; key += "o;"; }
            });
            if (body.dataset.k !== key) { body.innerHTML = html; body.dataset.k = key; }
            return key;
          };
        },
      };
    },
  };

  TYPES.image = {
    dur: () => 4,
    build(sc) {
      return {
        html: `<div class="img-wrap"><img src="${esc(sc.src)}"></div>`,
        mount(root) {
          const img = root.querySelector("img");
          return (local, dur) => {
            const z = 1 + (sc.zoom ?? 0.05) * (local / dur);
            img.style.transform = `scale(${z.toFixed(4)})`;
            return Math.round(z * 1000);
          };
        },
      };
    },
  };

  // `web` scenes are real pages driven by the recorder; the player draws nothing for them.
  TYPES.web = {
    dur: (sc) => (sc.actions || []).reduce((m, a) => Math.max(m, (a.at || 0) + (a.dur || 0)), 0) + 2.5,
    build: () => ({ html: "", mount: () => () => "web" }),
  };

  // animated demo: question typed -> steps tick off -> chart grows -> answer types
  const chatPlan = (sc) => {
    const cpsQ = sc.cps ?? 14;
    const stepGap = sc.stepGap ?? 0.95;
    const qStart = 0.6;
    const qEnd = qStart + sc.question.length / cpsQ;
    const send = qEnd + 0.45;
    const stepsAt = (sc.steps || []).map((_, i) => send + 0.7 + i * stepGap);
    const chartAt = send + 0.7 + (sc.steps || []).length * stepGap;
    const ansAt = chartAt + 0.5;
    const ansEnd = ansAt + (sc.answer ? sc.answer.length / (sc.cpsAnswer ?? 18) : 0);
    return { cpsQ, stepGap, qStart, qEnd, send, stepsAt, chartAt, ansAt, ansEnd, end: ansEnd + 2 };
  };
  TYPES.chat = {
    dur: (sc) => chatPlan(sc).end,
    build(sc) {
      const plan = chatPlan(sc);
      const ch = sc.chart;
      const max = ch ? Math.max(...ch.values) : 1;
      const pts = ch && ch.type === "line" ? ch.values.map((v, i) => `${(i / (ch.values.length - 1)) * 100},${48 - (v / max) * 42}`).join(" ") : "";
      const chart = ch ? `<div class="panel chart-panel"><h3>${rich(ch.title)}</h3>${
        ch.type === "line"
          ? `<svg class="line-svg" viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#e8a200" stroke-width="1.6" vector-effect="non-scaling-stroke" style="stroke-width:6px"/></svg><div class="labels">${ch.labels.map((l) => `<span>${esc(l)}</span>`).join("")}</div>`
          : `<div class="bars">${ch.values.map((v, i) => `<div class="bar-col"><div class="bar${i === ch.hi ? " hi" : ""}" data-v="${v / max}"></div></div>`).join("")}</div><div class="labels">${ch.labels.map((l) => `<span>${esc(l)}</span>`).join("")}</div>`
      }${ch.note ? `<div class="chart-note">${esc(ch.note)}</div>` : ""}</div>` : "";
      return {
        html: `<div class="chat-wrap" style="${ch ? "" : "grid-template-columns:1fr"}"><div class="panel"><div class="chat-head">${esc(sc.name || "AI 助理")}</div><div class="chat-body"><div class="msg user" data-q></div><div class="steps">${(sc.steps || []).map((s) => `<div class="step"><span class="mk"></span>${esc(s)}</div>`).join("")}</div><div class="msg ai" data-a></div></div><div class="chat-input"><span data-in></span><span class="send">→</span></div></div>${chart}</div>`,
        mount(root) {
          const q = root.querySelector("[data-q]");
          const a = root.querySelector("[data-a]");
          const inp = root.querySelector("[data-in]");
          const steps = [...root.querySelectorAll(".step")];
          const bars = [...root.querySelectorAll(".bar")];
          const lineSvg = root.querySelector(".line-svg");
          return (local) => {
            const blink = Math.floor(local / BLINK_MS) % 2 === 0;
            const nQ = clamp(Math.floor(((local - plan.qStart * 1000) / 1000) * plan.cpsQ), 0, sc.question.length);
            const sent = local >= plan.send * 1000;
            inp.innerHTML = sent ? "" : (nQ ? esc(sc.question.slice(0, nQ)) : `<span class="ph">${esc(sc.placeholder || "輸入問題…")}</span>`) + (!sent && local >= plan.qStart * 1000 && (nQ < sc.question.length || blink) ? '<span class="cur"></span>' : "");
            const pq = ease((local - plan.send * 1000) / 300);
            q.style.display = sent ? "block" : "none";
            q.style.opacity = pq.toFixed(3);
            q.textContent = sc.question;
            let stepKey = "";
            steps.forEach((el, i) => {
              const at = plan.stepsAt[i] * 1000;
              const shown = local >= at;
              const done = local >= at + plan.stepGap * 1000 * 0.85;
              el.style.display = shown ? "flex" : "none";
              el.classList.toggle("done", done);
              stepKey += (shown ? 1 : 0) + "" + (done ? 1 : 0);
            });
            const pc = ease((local - plan.chartAt * 1000) / 1300);
            bars.forEach((b) => { b.style.height = `${(parseFloat(b.dataset.v) * 100 * pc).toFixed(2)}%`; });
            if (lineSvg) lineSvg.style.clipPath = `inset(0 ${(100 - pc * 100).toFixed(2)}% 0 0)`;
            const nA = sc.answer ? clamp(Math.floor(((local - plan.ansAt * 1000) / 1000) * (sc.cpsAnswer ?? 18)), 0, sc.answer.length) : 0;
            a.style.display = nA > 0 ? "block" : "none";
            a.textContent = sc.answer ? sc.answer.slice(0, nA) : "";
            return `${nQ}|${sent}|${Math.round(pq * 20)}|${stepKey}|${Math.round(pc * 60)}|${nA}|${blink}`;
          };
        },
      };
    },
  };

  // ---------- player ----------
  const sceneEl = document.getElementById("scene");
  const capEl = document.getElementById("caption");
  const player = {
    script: null,
    current: -1,
    update: null,
    capText: null,

    // default length (s) of each scene, from its content
    prepare(script) {
      return script.scenes.map((sc) => {
        const t = TYPES[sc.type];
        if (!t) throw new Error(`未知的場景類型:${sc.type}`);
        return t.dur(sc);
      });
    },

    // every scene must have a final `duration` (seconds) by now
    load(script) {
      this.script = script;
      let start = 0;
      script.scenes.forEach((sc) => { sc.startMs = start; start += sc.duration * 1000; });
      this.totalMs = start;
      document.body.dataset.theme = script.theme || "light";
      this.current = -1;
    },

    setGuides(on) { document.getElementById("guides").hidden = !on; },

    renderAt(tMs) {
      const scenes = this.script.scenes;
      let idx = scenes.findIndex((sc) => tMs >= sc.startMs && tMs < sc.startMs + sc.duration * 1000);
      if (idx < 0) idx = scenes.length - 1;
      const sc = scenes[idx];
      if (idx !== this.current) {
        const built = TYPES[sc.type].build(sc);
        sceneEl.innerHTML = built.html;
        this.update = built.mount(sceneEl);
        this.current = idx;
      }
      const local = Math.max(0, tMs - sc.startMs);
      const dur = sc.duration * 1000;
      const fadeIn = idx === 0 ? 1 : clamp(local / FADE_MS, 0, 1);
      const fadeOut = idx === scenes.length - 1 ? 1 : clamp((dur - local) / FADE_MS, 0, 1);
      const fade = Math.min(fadeIn, fadeOut);
      const key = this.update(local, dur);
      sceneEl.style.opacity = fade.toFixed(2);

      const caption = this.script.captions === false ? "" : (sc.caption ?? sc.narration ?? "");
      const capP = caption ? Math.min(clamp((local - 250) / 250, 0, 1), fadeOut) : 0;
      if (this.capText !== caption) { capEl.textContent = caption; this.capText = caption; }
      capEl.style.opacity = capP.toFixed(2);
      return { index: idx, type: sc.type, local, caption, capOpacity: capP, key: `${idx}|${key}|${fade.toFixed(2)}|${capP.toFixed(2)}` };
    },
  };
  window.player = player;
})();
