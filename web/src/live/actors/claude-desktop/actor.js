// 演員 claude-desktop:仿 Claude 桌面版(Code 分頁)。規格見 ../../README.md「演員」。
//
// 演員只負責「自己長什麼樣、每個動作畫成什麼樣子」;章節卡、聚光燈、鏡頭、滑鼠、旁白時間由舞台處理。
//
// props(登場設定,寫在腳本 cast 裡):
//   title、folder、branch(null 不顯示)、model、mode(auto|ask|plan|accept)、user(頭像字母)、
//   sessions(側欄其他項目)、labels(介面文字)、cps({ user, say } 打字/回覆速度)、dark、noframe
//
// 動作(腳本 steps 裡,鍵名就是動作種類):
//   { "user": "幫我…" }                         在輸入框打字後送出
//   { "thinking": true | "Thinking", "ms": 1500 } 輸入框上方的思考中狀態
//   { "say": "回覆,支援 `程式碼` 與 **粗體**" }    逐字出現
//   { "tool": "Read", "arg": "…", "result": "…", "out": "…" }
//   { "edit": "檔名", "lines": [[行號, "+"|"-"|" ", "內容"], …] }
//   { "todos": [["內容", "pending"|"doing"|"done"], …] }
//   { "ask": "hello.txt", "q": "…", "where": "~/…", "preview": "…", "note": "…", "options": [...], "select": 1 }
//       沒有 select:提示停住,等下一個 choose
//   { "choose": 1, "hover": [2] }               (滑鼠)先停在 hover 的選項,再按下 choose 的選項
//   { "mode": "plan" }                          切換權限模式
//
// 目標(給鏡頭、聚光燈、滑鼠用,腳本裡寫成「演員代號:目標」,例如 claude:ask):
//   composer、input、send、mode、model、head、sidebar、log、ask(最後一個確認提示)、option:N(待選提示的第 N 個選項)、
//   user(最後一則使用者訊息)、say、tool、edit、todos
import { kit } from "../../kit.js";
import "./actor.css";

  const esc = kit.esc;
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<span class="code">$1</span>').replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  const paras = (s) => String(s).split(/\n{2,}/).map((p) => `<p>${inline(p).replace(/\n/g, "<br>")}</p>`).join("");
  // 逐字顯示時不要把 `程式碼` 或 **粗體** 切在中間:先切字再補上缺的結尾記號
  const cut = (s, n) => {
    let out = [...s].slice(0, n).join("");
    if ((out.match(/`/g) || []).length % 2) out += "`";
    if ((out.match(/\*\*/g) || []).length % 2) out += "**";
    return out;
  };
  const len = (x) => [...String(x || "")].length;

  const DEFAULTS = {
    title: "新的 session",
    folder: "~/projects/demo",
    branch: "main",
    model: "Opus 5.5",
    mode: "auto",
    user: "T",
    sessions: [],
    labels: { new: "新增 session", recent: "最近", placeholder: "描述你要做的事…", thinking: "思考中" },
    cps: { user: 14, say: 45 },
  };
  const MODES = { auto: "Auto", ask: "Ask permissions", plan: "Plan mode", accept: "Accept edits" };
  const ICONS = { Read: "▤", Write: "✎", Edit: "✎", Bash: "›_", Grep: "⌕", Glob: "⌕", WebFetch: "◎", WebSearch: "◎" };
  const TOOL_VERB = { Read: "讀取", Write: "寫入", Edit: "修改", Bash: "執行", Grep: "搜尋", Glob: "找檔案", WebFetch: "讀取網頁", WebSearch: "搜尋網路" };
  const askOptions = (s) => s.options || ["拒絕", "允許一次", "一律允許"];
  const conf = (props) => ({ ...DEFAULTS, ...props, labels: { ...DEFAULTS.labels, ...(props.labels || {}) }, cps: { ...DEFAULTS.cps, ...(props.cps || {}) } });

  // 選擇確認提示的時間表:先依序停在 hover 的選項(每個停 700ms),最後移到要選的選項按下
  function choosePlan(s) {
    const targets = [...(s.hover || []), s.choose];
    const moves = [];
    let t = 300;
    targets.forEach((idx, i) => {
      moves.push({ idx, at: t, arrive: t + 550, target: `option:${idx}` });
      t += 550 + (i === targets.length - 1 ? 250 : 700);
    });
    return { moves, clickAt: t, dur: t + 650 };
  }

  const actor = {
    name: "claude-desktop",
    kinds: ["user", "thinking", "say", "tool", "edit", "todos", "ask", "choose", "mode"],

    duration(kind, s, props) {
      const c = conf(props);
      switch (kind) {
        case "user": return (len(s.user) / c.cps.user) * 1000 + 450;
        case "thinking": return 1500;
        case "say": return Math.max(300, (len(s.say) / c.cps.say) * 1000);
        case "tool": return s.tool === "Bash" ? 1400 : 700;
        case "edit": return 300 + s.lines.length * 110;
        case "todos": return 350;
        case "ask": return s.select == null ? 900 : 2400;
        case "choose": return choosePlan(s).dur;
        case "mode": return 300;
      }
      return 0;
    },

    // 自動鏡頭:打字看輸入框、確認提示看提示;回覆與工具看全景;choose、mode 沿用上一個鏡頭
    autoFocus(kind) {
      if (kind === "user") return "composer";
      if (kind === "ask") return "ask";
      if (kind === "choose" || kind === "mode") return undefined;
      return false;
    },

    // 需要虛擬滑鼠的動作:回傳移動的時間表(時間相對於這個動作開始)
    cursor(kind, s) {
      if (kind !== "choose") return null;
      const plan = choosePlan(s);
      return { moves: plan.moves.map((m) => ({ at: m.at, target: m.target })), clickAt: plan.clickAt };
    },

    mount(root, props) {
      const c = conf(props);
      root.classList.add("A-claude-desktop");
      if (c.dark) root.classList.add("dark");
      if (c.noframe) root.classList.add("noframe");
      root.innerHTML = `
        <div class="cd-window">
          <div class="cd-titlebar">
            <span class="light red"></span><span class="light yellow"></span><span class="light green"></span>
            <div class="cd-tabs"><span>Chat</span><span>Cowork</span><span class="on">Code</span></div>
          </div>
          <div class="cd-body">
            <aside class="cd-sidebar">
              <div class="newbtn"><span class="plus">+</span><span>${esc(c.labels.new)}</span></div>
              <div class="side-label">${esc(c.labels.recent)}</div>
              <div class="cd-sessions"></div>
              <div class="cd-me"><span class="avatar">${esc(c.user)}</span><span>Max</span></div>
            </aside>
            <main class="cd-main">
              <header class="cd-head">
                <div class="cd-sessTitle">${esc(c.title)}</div>
                <div class="cd-sessMeta">${esc(c.branch ? `${c.folder} · ${c.branch}` : c.folder)}</div>
              </header>
              <div class="cd-scroll"><div class="cd-log"></div></div>
              <div class="cd-status"></div>
              <div class="cd-composer">
                <div class="cd-input"><span class="cd-typed"></span><span class="cd-caret off"></span><span class="cd-placeholder"></span></div>
                <div class="cd-bar">
                  <span class="chip cd-folder">▣ ${esc(c.folder.split("/").pop())}</span>
                  <span class="chip cd-branch"${c.branch ? "" : " hidden"}>⑂ ${esc(c.branch || "")}</span>
                  <span class="grow"></span>
                  <span class="chip cd-mode"></span>
                  <span class="chip cd-model">${esc(c.model)}</span>
                  <span class="cd-send">↑</span>
                </div>
              </div>
            </main>
          </div>
        </div>`;
      const $ = (sel) => root.querySelector(sel);
      const el = {
        log: $(".cd-log"), scroll: $(".cd-scroll"), status: $(".cd-status"), typed: $(".cd-typed"), caret: $(".cd-caret"),
        placeholder: $(".cd-placeholder"), send: $(".cd-send"), mode: $(".cd-mode"), sessions: $(".cd-sessions"),
      };

      // ---------- 各種區塊 ----------
      const userHtml = (text) => `<div class="user">${inline(text).replace(/\n/g, "<br>")}</div>`;
      const sayHtml = (text, streaming) => `<div class="say">${paras(text).replace(/<\/p>$/, streaming ? '<span class="stream"></span></p>' : "</p>")}</div>`;
      function toolHtml(s, p, ms) {
        const done = p >= 1;
        const state = done
          ? `<span class="state ok">${esc(s.result || "完成")}</span>`
          : `<span class="state"><span class="spin" style="--r:${kit.spin(ms, 100).toFixed(1)}deg"></span></span>`;
        const out = done && s.out ? `<div class="out">${esc(s.out)}</div>` : "";
        return `<div class="tool"><div class="row"><span class="icon">${esc(ICONS[s.tool] || "•")}</span><span class="verb">${esc(TOOL_VERB[s.tool] || s.tool)}</span><span class="arg">${esc(s.arg || "")}</span>${state}</div>${out}</div>`;
      }
      function editHtml(s, p) {
        const shown = Math.ceil(kit.clamp(p * 1.15) * s.lines.length);
        const plus = s.lines.filter((l) => l[1] === "+").length;
        const minus = s.lines.filter((l) => l[1] === "-").length;
        const rows = s.lines.slice(0, shown).map(([no, sg, text]) => {
          const cls = sg === "+" ? "add" : sg === "-" ? "del" : "";
          return `<div class="ln ${cls}"><span class="no">${no ?? ""}</span><span class="sg">${sg === " " ? "" : esc(sg)}</span><span>${esc(text)}</span></div>`;
        }).join("");
        return `<div class="card edit"><div class="card-head"><span class="icon">✎</span><span class="file">${esc(s.edit)}</span>${plus ? `<span class="plus-n">+${plus}</span>` : ""}${minus ? `<span class="minus-n">−${minus}</span>` : ""}</div><div class="diff">${rows}</div></div>`;
      }
      const todosHtml = (items) => `<div class="card todos-card"><div class="card-head"><span>待辦清單</span></div><div class="todos">${items.map(([text, st]) => `<div class="todo ${st}"><span class="box">${st === "done" ? "✓" : ""}</span><span class="txt">${esc(text)}</span></div>`).join("")}</div></div>`;
      // st: { chosen, hover, press, resolved }
      function askHtml(s, st) {
        const options = askOptions(s);
        if (st.resolved) {
          const deny = st.chosen === 0 || /拒絕/.test(options[st.chosen]);
          return `<div class="resolved${deny ? " deny" : ""}">${deny ? "✕" : "✓"} 已${esc(options[st.chosen])}：<span class="code">${esc(s.ask)}</span></div>`;
        }
        const opts = options.map((o, i) => {
          const cls = i === st.chosen ? " sel" + (st.press ? " press" : "") : i === st.hover ? " hov" : "";
          return `<span class="opt${cls}" data-opt="${i}">${esc(o)}</span>`;
        }).join("");
        return `<div class="card ask pending"><div class="q">${esc(s.q || "允許 Claude 執行這個指令?")}</div>${s.where ? `<div class="where">▣ ${esc(s.where)}</div>` : ""}<div class="cmd">${esc(s.ask)}</div>${s.preview ? `<div class="preview">${esc(s.preview)}</div>` : ""}${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}<div class="opts">${opts}</div></div>`;
      }

      let lastLog = "";
      return {
        render(events, ms) {
          const blocks = [];
          let typed = "", typing = false, status = "", mode = c.mode;
          let todos = null, todosAt = -1;
          const asks = [];
          const star = `<span class="star" style="--r:${(ms * 0.25) % 360}deg">✻</span>`;
          for (const ev of events) {
            const { kind, step: s, p, local } = ev;
            switch (kind) {
              case "user": {
                const chars = [...s.user];
                const n = Math.floor(kit.clamp(local / (ev.dur - 450)) * chars.length);
                if (p < 1) { typed = chars.slice(0, n).join(""); typing = true; } else blocks.push(userHtml(s.user));
                break;
              }
              case "thinking":
                if (p < 1) {
                  const secs = Math.floor(local / 1000);
                  status = `${star}<span>${esc(s.thinking === true ? c.labels.thinking : s.thinking)}…</span><span>${secs ? `${secs}s` : ""}</span>`;
                }
                break;
              case "say": blocks.push(sayHtml(cut(s.say, Math.ceil(p * len(s.say))), p < 1)); break;
              case "tool":
                blocks.push(toolHtml(s, p, ms));
                if (p < 1) status = `${star}<span>${esc(c.labels.thinking)}…</span>`;
                break;
              case "edit":
                blocks.push(editHtml(s, p));
                if (p < 1) status = `${star}<span>${esc(c.labels.thinking)}…</span>`;
                break;
              case "todos":
                // 同一份待辦清單會更新而不是重複出現:畫在第一次出現的位置,內容用最新的
                todos = s.todos;
                if (todosAt < 0) { todosAt = blocks.length; blocks.push(null); }
                break;
              case "ask": {
                const st = { s, idx: blocks.length, chosen: null, hover: -1, press: false, resolved: false };
                if (s.select != null) {
                  // 同一步裡自己選:前 55% 還沒選,接著選到要選的選項,最後 12% 是按下去的樣子
                  if (p >= 1) { st.resolved = true; st.chosen = s.select; } else if (p >= 0.55) { st.chosen = s.select; st.press = p > 0.88; }
                }
                asks.push(st);
                blocks.push(null);
                break;
              }
              case "choose": {
                const a = asks.filter((x) => !x.resolved).at(-1);
                if (!a) break;
                const plan = choosePlan(s);
                if (local >= plan.dur) { a.resolved = true; a.chosen = s.choose; break; }
                const at = plan.moves.filter((m) => local >= m.arrive).at(-1);
                if (local >= plan.clickAt) { a.chosen = s.choose; a.press = local < plan.clickAt + 220; } else if (at) a.hover = at.idx;
                break;
              }
              case "mode": mode = s.mode; break;
            }
          }
          if (todosAt >= 0) blocks[todosAt] = todosHtml(todos);
          for (const a of asks) blocks[a.idx] = askHtml(a.s, a);

          const html = blocks.join("");
          if (html !== lastLog) { el.log.innerHTML = html; lastLog = html; }
          kit.setIf(el.status, "html", status);
          kit.setIf(el.typed, "text", typed);
          kit.setIf(el.placeholder, "text", typed ? "" : c.labels.placeholder);
          el.caret.className = `cd-caret${typing && kit.blink(ms) ? "" : " off"}`;
          el.send.className = `cd-send${typed ? " on" : ""}`;
          kit.setIf(el.mode, "text", MODES[mode] || mode);
          el.mode.className = `chip cd-mode ${mode}`;
          // 對話貼齊底部(像真的捲到最新)
          el.log.style.top = `${kit.stickBottom(el.scroll.clientHeight, el.log.scrollHeight)}px`;

          const last = events.at(-1);
          const busy = last && ms < last.start + last.dur;
          const dot = !events.length ? "" : busy ? "run" : "ok";
          kit.setIf(el.sessions, "html", [`<div class="sess on"><span class="dot ${dot}"></span><span class="name">${esc(c.title)}</span></div>`]
            .concat(c.sessions.map((n) => `<div class="sess"><span class="dot"></span><span class="name">${esc(n)}</span></div>`)).join(""));
        },

        target(name) {
          const lastOf = (sel) => [...root.querySelectorAll(sel)].at(-1) || null;
          const opt = /^option:(\d+)$/.exec(name);
          if (opt) return lastOf(".cd-log .ask.pending")?.querySelector(`[data-opt="${opt[1]}"]`) || null;
          switch (name) {
            case "composer": return $(".cd-composer");
            case "input": return $(".cd-input");
            case "send": return $(".cd-send");
            case "mode": return $(".cd-mode");
            case "model": return $(".cd-model");
            case "head": return $(".cd-head");
            case "sidebar": return $(".cd-sidebar");
            case "log": return $(".cd-scroll");
            case "ask": return lastOf(".cd-log .ask, .cd-log .resolved");
            case "user": return lastOf(".cd-log .user");
            case "say": return lastOf(".cd-log .say");
            case "tool": return lastOf(".cd-log .tool");
            case "edit": return lastOf(".cd-log .edit");
            case "todos": return lastOf(".cd-log .todos-card");
          }
          return null;
        },
      };
    },
  };

export default actor;
