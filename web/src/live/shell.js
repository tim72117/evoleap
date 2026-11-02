// shell.js — 播放器外殼(規格見 README.md 第 2 節;型別宣告在 shell.d.ts)。
//
// 外殼不知道畫面長什麼樣,只要內容提供「總長度」與「畫出某個時間點」:
//
//   const vp = mountShell(container, {
//     title: "加上 /health 端點",
//     duration: 18800,                      // 毫秒
//     renderAt: (ms) => …,                  // 畫出 ms 時的畫面
//     stage: element,                       // 1920×1080 的內容(div),外殼負責縮放;內容晚點才準備好時,之後用 vp.update({...}) 補上長度等資料
//     chapters: [{ at: 0, label: "提出需求" }, …],
//     captions: (ms) => "字幕文字" | "",     // 選用
//     stops: [{ at, title, body }],         // 選用:練習點,播放經過時自動暫停並顯示要學員做的事
//     audio: "narration.mp3",               // 選用:有旁白時以音訊為主時鐘
//     clips: [{ at, ms, url }],              // 選用:分段旁白音檔,在 [at, at+ms) 之間播放,跟著外殼的時鐘同步(拖曳、倍速、暫停)
//     resumeKey: "l0-0.2",                  // 選用:記住看到哪裡
//     globalKeys: true,                     // 頁面沒有其他焦點時也接收快捷鍵;一頁多個播放器時設 false
//     onFullscreenRequest: (on) => …,       // 選用:全螢幕交給外層處理,外層再用 vp.setExternalFullscreen(on) 回報
//     autoLandscape: true,                  // 手機橫放自動滿版
//   });
//   vp.play() / pause() / seek(ms) / setRate(x) / toggleFullscreen() / update(opts) / destroy()
//
// 播放器行為:播放暫停、拖曳時間軸(含預覽時間與章節)、章節刻度、倍速、字幕開關、音量(有音訊時)、
// 全螢幕(手機自動轉橫向;iPhone 不支援元素全螢幕時改用滿版)、手機橫放自動滿版、
// 控制列自動隱藏、鍵盤快捷鍵、觸控雙擊快轉倒轉、記住進度、播放時螢幕不休眠、系統媒體控制。
  const W = 1920, H = 1080;
  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const HIDE_MS = 2600;
  const STEP_MS = 1000 / 30;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const coarse = () => matchMedia("(pointer: coarse)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* 私密模式等情況 */ } },
  };

  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
    fs: '<svg viewBox="0 0 24 24"><path d="M5 9V5h4V3H3v6zm10-6v2h4v4h2V3zM5 15H3v6h6v-2H5zm14 0v4h-4v2h6v-6z"/></svg>',
    fsExit: '<svg viewBox="0 0 24 24"><path d="M9 3H7v4H3v2h6zm6 0v6h6V7h-4V3zM3 15v2h4v4h2v-6zm12 0v6h2v-4h4v-2z"/></svg>',
    cc: '<svg viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm6.5 5.2A2.6 2.6 0 0 0 8.4 9.3c-1.5 0-2.4 1.1-2.4 2.7s.9 2.7 2.4 2.7c1 0 1.7-.4 2.1-1l-1-.6c-.2.3-.6.5-1 .5-.8 0-1.2-.6-1.2-1.6s.4-1.6 1.2-1.6c.4 0 .8.2 1 .5zm6.5 0a2.6 2.6 0 0 0-2.1-.9c-1.5 0-2.4 1.1-2.4 2.7s.9 2.7 2.4 2.7c1 0 1.7-.4 2.1-1l-1-.6c-.2.3-.6.5-1 .5-.8 0-1.2-.6-1.2-1.6s.4-1.6 1.2-1.6c.4 0 .8.2 1 .5z"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zm12.5 3a4 4 0 0 0-2-3.5v7a4 4 0 0 0 2-3.5zM14.5 4v2a6 6 0 0 1 0 12v2a8 8 0 0 0 0-16z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zm12.6.2 1.4-1.4 2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2z"/></svg>',
  };

  export function mountShell(container, opts) {
    const o = { chapters: [], stops: [], duration: 0, renderAt: () => {}, ...opts };
    const root = document.createElement("div");
    root.className = "vp paused show-ui";
    root.tabIndex = 0;
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", `影片播放器:${o.title || ""}`);
    root.innerHTML = `
      <div class="vp-stage"><div class="vp-canvas"></div></div>
      <div class="vp-caption" aria-live="off"></div>
      <div class="vp-hit"></div>
      <div class="vp-seekfx vp-seekfx-l"></div><div class="vp-seekfx vp-seekfx-r"></div>
      <button class="vp-big" type="button" aria-label="播放">${ICON.play}</button>
      <div class="vp-hint" hidden>把手機轉成橫向可以看得更清楚</div>
      <div class="vp-stop" hidden role="dialog" aria-live="polite">
        <div class="vp-stop-in">
          <div class="vp-stop-eyebrow">停一下</div>
          <h3 class="vp-stop-title"></h3>
          <p class="vp-stop-body"></p>
          <div class="vp-stop-btns"><button type="button" class="vp-stop-back">再看一次這段</button><button type="button" class="vp-stop-go">完成了，繼續</button></div>
        </div>
      </div>
      <div class="vp-ui">
        <div class="vp-top"><span class="vp-title"></span></div>
        <div class="vp-bottom">
          <div class="vp-bar" role="slider" tabindex="-1" aria-label="播放進度" aria-valuemin="0">
            <div class="vp-track"><div class="vp-fill"></div><div class="vp-ticks"></div><div class="vp-knob"></div></div>
            <div class="vp-tip"><span class="vp-tip-ch"></span><span class="vp-tip-t"></span></div>
          </div>
          <div class="vp-row">
            <button class="vp-btn vp-play" type="button" aria-label="播放">${ICON.play}</button>
            <button class="vp-btn vp-vol" type="button" aria-label="靜音" hidden>${ICON.vol}</button>
            <span class="vp-time"><span class="vp-cur">0:00</span> / <span class="vp-dur">0:00</span></span>
            <span class="vp-chapter"></span>
            <span class="vp-grow"></span>
            <button class="vp-btn vp-cc" type="button" aria-label="字幕" aria-pressed="true" hidden>${ICON.cc}</button>
            <div class="vp-ratebox">
              <button class="vp-btn vp-rate" type="button" aria-label="播放速度" aria-haspopup="menu">1×</button>
              <div class="vp-menu" role="menu" hidden>${RATES.map((r) => `<button type="button" role="menuitemradio" data-rate="${r}">${r}×</button>`).join("")}</div>
            </div>
            <button class="vp-btn vp-fs" type="button" aria-label="全螢幕">${ICON.fs}</button>
          </div>
        </div>
      </div>`;
    container.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const canvas = $(".vp-canvas");
    canvas.appendChild(o.stage);
    $(".vp-title").textContent = o.title || "";

    const audio = o.audio ? Object.assign(new Audio(o.audio), { preload: "auto" }) : null;
    if (audio) $(".vp-vol").hidden = false;
    // 分段旁白:同一時間只播一段,依外殼時鐘決定播哪一段、播到哪裡。
    // 兩個 <audio> 輪流用:一個播目前這段,另一個先載入下一段,換段時直接交換,開頭不會被網路延遲吃掉。
    let clipEl = new Audio();
    let nextEl = new Audio();
    clipEl.preload = nextEl.preload = "auto";
    let clipIdx = -1;
    let clipsUnlocked = false;
    const hasClips = () => !!(o.clips && o.clips.length);
    const clipAt = (t) => { let i = -1; for (let k = 0; k < o.clips.length; k++) if (o.clips[k].at <= t) i = k; return i; };
    const setSrc = (el, url) => { if (el.getAttribute("src") !== url) el.src = url; };
    function startClip(i, off) {
      const c = o.clips[i];
      if (nextEl.getAttribute("src") === c.url) [clipEl, nextEl] = [nextEl, clipEl];
      else setSrc(clipEl, c.url);
      clipIdx = i;
      clipEl.muted = state.muted;
      clipEl.playbackRate = state.rate;
      clipEl.currentTime = off;
      clipEl.play().catch(() => {});
      const n = o.clips[i + 1];
      if (n) setSrc(nextEl, n.url);
    }
    function syncClips() {
      if (!hasClips()) return;
      const i = clipAt(state.t);
      const c = o.clips[i];
      const off = c ? (state.t - c.at) / 1000 : 0;
      const inClip = c && off * 1000 < c.ms;
      if (!state.playing || state.scrubbing || !inClip) {
        if (!clipEl.paused) clipEl.pause();
        if (!c) clipIdx = -1;
        // 還沒播到第一段時,先載入第一段
        else if (!inClip && o.clips[i + 1]) setSrc(nextEl, o.clips[i + 1].url);
        return;
      }
      if (i !== clipIdx) return startClip(i, off);
      if (clipEl.paused && !clipEl.ended) { clipEl.currentTime = off; clipEl.play().catch(() => {}); return; }
      // 偏差校正:只在音檔已經能順暢播放時做(還在緩衝時重設位置只會一直重新緩衝)
      if (!clipEl.paused && !clipEl.seeking && clipEl.readyState >= 3 && Math.abs(clipEl.currentTime - off) > 0.35) clipEl.currentTime = off;
    }
    /** 在使用者按播放的當下解鎖音訊(iOS 等瀏覽器只允許在使用者操作中開始播放) */
    function unlockClips() {
      if (clipsUnlocked || !hasClips()) return;
      clipsUnlocked = true;
      const i = Math.max(0, clipAt(state.t));
      // 靜音播一下再停,只為了取得播放權限,不會聽到聲音;被瀏覽器拒絕(NotAllowedError)時下次按播放再試
      for (const el of [clipEl, nextEl]) {
        setSrc(el, o.clips[Math.min(i + (el === nextEl ? 1 : 0), o.clips.length - 1)].url);
        el.muted = true;
        el.play()
          .then(() => { if (el !== clipEl || clipIdx < 0) el.pause(); })
          .catch((e) => { if (e?.name === "NotAllowedError") clipsUnlocked = false; })
          .finally(() => { el.muted = state.muted; });
      }
    }
    const syncOptional = () => { $(".vp-cc").hidden = !o.captions; $(".vp-vol").hidden = !(audio || hasClips()); };
    syncOptional();

    const state = {
      t: 0, playing: false, rate: 1, ended: false,
      captions: store.get("vp:cc") !== "0",
      muted: store.get("vp:muted") === "1",
      fs: false, pseudo: false, landscape: false, ext: false,
      lastTick: 0, hideTimer: 0, scrubbing: false, raf: 0, wake: null, lastSave: 0,
    };
    const dur = () => o.duration || 1;

    // ---------- 縮放 ----------
    const fit = () => {
      const stage = $(".vp-stage");
      const s = Math.min(stage.clientWidth / W, stage.clientHeight / H);
      canvas.style.transform = `translate(${(stage.clientWidth - W * s) / 2}px, ${(stage.clientHeight - H * s) / 2}px) scale(${s})`;
      root.style.setProperty("--vp-scale", s);
      root.classList.toggle("compact", root.clientWidth < 560);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(root);

    // ---------- 章節刻度 ----------
    let chapters = [];
    const setChapters = () => {
      chapters = [...o.chapters].sort((a, b) => a.at - b.at);
      $(".vp-ticks").innerHTML = chapters.filter((c) => c.at > 0).map((c) => `<i style="left:${(c.at / dur()) * 100}%"></i>`).join("")
        + (o.stops || []).map((x) => `<b style="left:${(x.at / dur()) * 100}%" title="${String(x.title || "").replace(/"/g, "&quot;")}"></b>`).join("");
    };
    setChapters();
    const chapterAt = (ms) => chapters.filter((c) => c.at <= ms).at(-1)?.label || "";

    // ---------- 畫面 ----------
    let lastKey = "";
    function draw() {
      const t = state.t;
      o.renderAt(t);
      const pct = (t / dur()) * 100;
      $(".vp-fill").style.width = `${pct}%`;
      $(".vp-knob").style.left = `${pct}%`;
      const cur = fmt(t);
      const k = `${cur}|${state.playing}|${state.ended}`;
      if (k !== lastKey) {
        lastKey = k;
        $(".vp-cur").textContent = cur;
        $(".vp-dur").textContent = fmt(dur());
        $(".vp-chapter").textContent = chapterAt(t);
        const bar = $(".vp-bar");
        bar.setAttribute("aria-valuemax", String(Math.round(dur() / 1000)));
        bar.setAttribute("aria-valuenow", String(Math.round(t / 1000)));
        bar.setAttribute("aria-valuetext", `${cur} / ${fmt(dur())}`);
        const icon = state.ended ? ICON.replay : state.playing ? ICON.pause : ICON.play;
        const label = state.ended ? "重播" : state.playing ? "暫停" : "播放";
        for (const b of [$(".vp-play"), $(".vp-big")]) { b.innerHTML = icon; b.setAttribute("aria-label", label); }
        root.classList.toggle("paused", !state.playing);
        root.classList.toggle("ended", state.ended);
      }
      const cap = o.captions && state.captions ? o.captions(t) : "";
      const capEl = $(".vp-caption");
      if (capEl.textContent !== cap) capEl.textContent = cap;
      capEl.hidden = !cap;
      if (o.resumeKey && Math.abs(t - state.lastSave) > 2000) { state.lastSave = t; store.set(`vp:t:${o.resumeKey}`, String(Math.round(t))); }
    }

    // ---------- 時鐘:有音訊時跟著音訊走,沒有時用 rAF 累加 ----------
    function tick(now) {
      state.raf = requestAnimationFrame(tick);
      if (!state.playing || state.scrubbing) { state.lastTick = now; return; }
      const prev = state.t;
      if (audio && !audio.paused && !audio.ended) state.t = audio.currentTime * 1000;
      else state.t += Math.min(250, now - state.lastTick) * state.rate;
      state.lastTick = now;
      // 播放經過練習點:停在那裡,請學員動手(拖曳、跳轉經過不會觸發)
      const stop = (o.stops || []).find((x) => prev < x.at && state.t >= x.at);
      if (stop) { state.t = stop.at; pause(); showStop(stop); return; }
      if (state.t >= dur()) { state.t = dur(); state.playing = false; state.ended = true; audio?.pause(); onPauseSide(); showUi(); }
      draw();
      syncClips();
    }

    function showStop(stop) {
      $(".vp-stop-title").textContent = stop.title || "換你試試";
      $(".vp-stop-body").textContent = stop.body || "";
      $(".vp-stop").hidden = false;
      root.classList.add("stopped");
      $(".vp-stop-go").focus({ preventScroll: true });
    }
    function hideStop() { $(".vp-stop").hidden = true; root.classList.remove("stopped"); }
    function play() {
      hideStop();
      if (state.ended || state.t >= dur()) { state.t = 0; state.ended = false; }
      state.playing = true;
      state.lastTick = performance.now();
      unlockClips();
      syncClips();
      if (audio && state.t / 1000 < (audio.duration || Infinity)) { audio.currentTime = state.t / 1000; audio.playbackRate = state.rate; audio.play().catch(() => {}); }
      requestWake();
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
      draw();
      scheduleHide();
    }
    function pause() {
      state.playing = false;
      audio?.pause();
      clipEl.pause();
      onPauseSide();
      draw();
      showUi();
    }
    function onPauseSide() {
      releaseWake();
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    }
    const toggle = () => (state.playing ? pause() : play());
    function seek(ms) {
      hideStop();
      state.t = clamp(ms, 0, dur());
      state.ended = state.t >= dur() && !state.playing;
      if (audio && audio.readyState) audio.currentTime = Math.min(state.t / 1000, audio.duration || 0);
      clipIdx = -1;
      draw();
      syncClips();
    }
    function setRate(r) {
      state.rate = r;
      if (audio) audio.playbackRate = r;
      clipEl.playbackRate = nextEl.playbackRate = r;
      $(".vp-rate").textContent = `${r}×`;
      root.querySelectorAll(".vp-menu button").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.rate) === r)));
    }

    // ---------- 全螢幕 ----------
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
    async function enterFs() {
      try {
        if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: "hide" });
        else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
        else return setPseudo(true);
      } catch { return setPseudo(true); }
      // Android Chrome 在全螢幕時可以鎖成橫向;不支援的瀏覽器(iOS、桌機)直接略過
      try { await screen.orientation?.lock?.("landscape"); } catch { /* 不支援 */ }
    }
    async function exitFs() {
      if (state.pseudo) return setPseudo(false);
      try { screen.orientation?.unlock?.(); } catch { /* 不支援 */ }
      if (document.exitFullscreen) await document.exitFullscreen().catch(() => {});
      else document.webkitExitFullscreen?.();
    }
    const toggleFullscreen = () => {
      if (o.onFullscreenRequest) return o.onFullscreenRequest(!state.ext);
      return state.fs || state.pseudo ? exitFs() : enterFs();
    };
    // iPhone Safari 不支援元素全螢幕:改用固定滿版,並提示轉橫向
    function setPseudo(on) {
      state.pseudo = on;
      root.classList.toggle("pseudo-fs", on);
      document.documentElement.classList.toggle("vp-lock", on);
      syncFsUi();
    }
    function syncFsUi() {
      state.fs = !!fsElement() && fsElement() === root;
      const on = state.fs || state.pseudo || state.landscape || state.ext;
      const full = state.fs || state.pseudo || state.ext;
      root.classList.toggle("is-fs", on);
      $(".vp-fs").innerHTML = full ? ICON.fsExit : ICON.fs;
      $(".vp-fs").setAttribute("aria-label", full ? "離開全螢幕" : "全螢幕");
      $(".vp-hint").hidden = !((state.pseudo || state.ext) && matchMedia("(orientation: portrait)").matches);
      requestAnimationFrame(fit);
    }
    document.addEventListener("fullscreenchange", syncFsUi);
    document.addEventListener("webkitfullscreenchange", syncFsUi);

    // 手機橫放時自動滿版(不需要使用者再按全螢幕);轉回直向就恢復
    const landscapeMq = matchMedia("(orientation: landscape) and (pointer: coarse) and (max-height: 540px)");
    const onOrient = () => {
      if (o.autoLandscape === false) return syncFsUi();
      const want = landscapeMq.matches && (state.playing || state.t > 0);
      if (want !== state.landscape) {
        state.landscape = want;
        root.classList.toggle("landscape-fs", want);
        document.documentElement.classList.toggle("vp-lock", want || state.pseudo);
        if (want) root.scrollIntoView({ block: "center" });
      }
      syncFsUi();
    };
    landscapeMq.addEventListener("change", onOrient);
    matchMedia("(orientation: portrait)").addEventListener("change", syncFsUi);

    // ---------- 控制列顯示/隱藏 ----------
    function showUi() {
      root.classList.add("show-ui");
      scheduleHide();
    }
    function scheduleHide() {
      clearTimeout(state.hideTimer);
      if (!state.playing) return;
      state.hideTimer = setTimeout(() => {
        if (state.playing && !state.scrubbing && !root.querySelector(".vp-menu:not([hidden])")) root.classList.remove("show-ui");
      }, HIDE_MS);
    }
    root.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") showUi(); });
    root.addEventListener("mouseleave", () => { if (state.playing) root.classList.remove("show-ui"); });

    // ---------- 點擊與觸控手勢 ----------
    // 桌機:點畫面播放/暫停。手機:點一下顯示/隱藏控制列,左右兩側點兩下倒轉/快轉 10 秒。
    let lastTap = { t: 0, x: 0 };
    let tapTimer = 0;
    $(".vp-hit").addEventListener("click", (e) => {
      root.focus({ preventScroll: true });
      if (!coarse()) return toggle();
      const now = performance.now();
      const w = root.clientWidth;
      const side = e.offsetX < w / 3 ? -1 : e.offsetX > (w * 2) / 3 ? 1 : 0;
      if (side && now - lastTap.t < 300 && Math.sign(lastTap.x) === side) {
        clearTimeout(tapTimer);
        skip(side * 10000);
        lastTap = { t: now, x: side };
        return;
      }
      lastTap = { t: now, x: side };
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { root.classList.contains("show-ui") && state.playing ? root.classList.remove("show-ui") : showUi(); }, side ? 300 : 0);
    });
    $(".vp-hit").addEventListener("dblclick", (e) => { if (!coarse()) { e.preventDefault(); toggleFullscreen(); } });

    function skip(delta) {
      seek(state.t + delta);
      const fx = $(delta < 0 ? ".vp-seekfx-l" : ".vp-seekfx-r");
      fx.textContent = `${delta < 0 ? "−" : "+"}${Math.abs(delta / 1000)} 秒`;
      fx.classList.remove("on"); void fx.offsetWidth; fx.classList.add("on");
      showUi();
    }

    // ---------- 時間軸拖曳(滑鼠與觸控共用 pointer events) ----------
    const bar = $(".vp-bar");
    const posToMs = (clientX) => { const r = bar.getBoundingClientRect(); return clamp((clientX - r.left) / r.width, 0, 1) * dur(); };
    const showTip = (clientX) => {
      const ms = posToMs(clientX);
      const r = bar.getBoundingClientRect();
      const tip = $(".vp-tip");
      $(".vp-tip-t").textContent = fmt(ms);
      $(".vp-tip-ch").textContent = chapterAt(ms);
      tip.style.left = `${clamp(clientX - r.left, 40, r.width - 40)}px`;
      root.classList.add("tip");
    };
    let wasPlaying = false;
    bar.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      state.scrubbing = true;
      wasPlaying = state.playing;
      if (audio) audio.pause();
      root.classList.add("scrubbing");
      seek(posToMs(e.clientX));
      showTip(e.clientX);
      showUi();
    });
    bar.addEventListener("pointermove", (e) => {
      if (state.scrubbing) seek(posToMs(e.clientX));
      if (state.scrubbing || e.pointerType === "mouse") showTip(e.clientX);
    });
    const endScrub = () => {
      if (!state.scrubbing) return;
      state.scrubbing = false;
      root.classList.remove("scrubbing", "tip");
      if (wasPlaying && state.t < dur()) play(); else draw();
    };
    bar.addEventListener("pointerup", endScrub);
    bar.addEventListener("pointercancel", endScrub);
    bar.addEventListener("pointerleave", () => { if (!state.scrubbing) root.classList.remove("tip"); });

    // ---------- 按鈕 ----------
    $(".vp-stop-go").addEventListener("click", () => { state.t += 1; play(); });
    $(".vp-stop-back").addEventListener("click", () => {
      const back = chapters.filter((c) => c.at < state.t - 500).at(-1);
      seek(back ? back.at : 0);
      play();
    });
    $(".vp-play").addEventListener("click", toggle);
    $(".vp-big").addEventListener("click", toggle);
    $(".vp-fs").addEventListener("click", toggleFullscreen);
    $(".vp-cc").addEventListener("click", () => {
      state.captions = !state.captions;
      store.set("vp:cc", state.captions ? "1" : "0");
      $(".vp-cc").setAttribute("aria-pressed", String(state.captions));
      draw();
    });
    $(".vp-cc").setAttribute("aria-pressed", String(state.captions));
    $(".vp-vol").addEventListener("click", () => toggleMute());
    function toggleMute() {
      state.muted = !state.muted;
      store.set("vp:muted", state.muted ? "1" : "0");
      syncMuteUi();
    }
    function syncMuteUi() {
      if (audio) audio.muted = state.muted;
      clipEl.muted = nextEl.muted = state.muted;
      $(".vp-vol").innerHTML = state.muted ? ICON.mute : ICON.vol;
      $(".vp-vol").setAttribute("aria-label", state.muted ? "取消靜音" : "靜音");
    }
    const menu = $(".vp-menu");
    $(".vp-rate").addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; showUi(); });
    menu.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-rate]");
      if (!b) return;
      setRate(Number(b.dataset.rate));
      menu.hidden = true;
      scheduleHide();
    });
    document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest(".vp-ratebox")) menu.hidden = true; });

    // ---------- 鍵盤(焦點在播放器上,或全螢幕時) ----------
    function onKey(e) {
      if (e.target.closest?.("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      // 焦點在播放器上、全螢幕中,或頁面上沒有其他元素取得焦點時(單一播放器的頁面)都接收快捷鍵
      const free = !document.activeElement || document.activeElement === document.body;
      if (!(root.contains(document.activeElement) || state.fs || state.pseudo || state.ext || (o.globalKeys !== false && free))) return;
      const k = e.key;
      const step = (d) => { if (state.playing) pause(); seek(state.t + d); };
      const map = {
        " ": toggle, k: toggle, K: toggle,
        ArrowLeft: () => skip(-5000), ArrowRight: () => skip(5000),
        j: () => skip(-10000), J: () => skip(-10000), l: () => skip(10000), L: () => skip(10000),
        f: toggleFullscreen, F: toggleFullscreen, m: toggleMute, M: toggleMute,
        c: () => $(".vp-cc").hidden || $(".vp-cc").click(), C: () => $(".vp-cc").hidden || $(".vp-cc").click(),
        Home: () => seek(0), End: () => seek(dur()),
        ",": () => step(-STEP_MS), ".": () => step(STEP_MS),
        "<": () => setRate(RATES[Math.max(0, RATES.indexOf(state.rate) - 1)] ?? 1),
        ">": () => setRate(RATES[Math.min(RATES.length - 1, RATES.indexOf(state.rate) + 1)] ?? 1),
        Escape: () => { if (state.pseudo) setPseudo(false); else if (state.ext) o.onFullscreenRequest?.(false); },
      };
      if (/^[0-9]$/.test(k)) { seek((Number(k) / 10) * dur()); showUi(); e.preventDefault(); return; }
      if (map[k]) {
        // 按鈕有焦點時,空白鍵交給按鈕本身
        if (k === " " && e.target.tagName === "BUTTON") return;
        e.preventDefault();
        map[k]();
        showUi();
      }
    }
    document.addEventListener("keydown", onKey);

    // ---------- 播放時螢幕不休眠、系統媒體控制、分頁切換 ----------
    async function requestWake() {
      try { if ("wakeLock" in navigator && !state.wake) state.wake = await navigator.wakeLock.request("screen"); } catch { /* 不支援或被拒 */ }
    }
    function releaseWake() { state.wake?.release().catch(() => {}); state.wake = null; }
    const onVisibility = () => {
      if (document.visibilityState === "visible") { state.lastTick = performance.now(); if (state.playing) { state.wake = null; requestWake(); } }
      else if (state.playing && !audio) pause();   // 時鐘不是音訊時(包括分段旁白),切到別的分頁就暫停,回來不會跳過內容
    };
    document.addEventListener("visibilitychange", onVisibility);
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: o.title || "" });
        navigator.mediaSession.setActionHandler("play", play);
        navigator.mediaSession.setActionHandler("pause", pause);
        navigator.mediaSession.setActionHandler("seekbackward", () => skip(-10000));
        navigator.mediaSession.setActionHandler("seekforward", () => skip(10000));
        navigator.mediaSession.setActionHandler("seekto", (d) => seek(d.seekTime * 1000));
      } catch { /* 部分瀏覽器不支援某些動作 */ }
    }

    // ---------- 開始 ----------
    setRate(1);
    syncMuteUi();
    const resume = () => {
      const saved = o.resumeKey ? Number(store.get(`vp:t:${o.resumeKey}`)) : 0;
      if (o.duration && saved > 5000 && saved < dur() - 5000) state.t = saved;
    };
    resume();
    fit();
    draw();
    state.raf = requestAnimationFrame(tick);

    return {
      play, pause, seek, setRate, toggleFullscreen,
      /** 補上或更換內容資料(duration、renderAt、chapters、captions、title) */
      update(next) {
        const first = !o.duration && next.duration;
        Object.assign(o, next);
        $(".vp-title").textContent = o.title || "";
        setChapters();
        syncOptional();
        clipIdx = -1;
        lastKey = "";
        if (first) resume();
        state.t = clamp(state.t, 0, dur());
        draw();
      },
      get time() { return state.t; },
      /** 外層頁面處理全螢幕時,回報目前是否全螢幕(更新按鈕圖示與版面) */
      setExternalFullscreen(on) { state.ext = !!on; syncFsUi(); },
      get playing() { return state.playing; },
      destroy() {
        cancelAnimationFrame(state.raf);
        clearTimeout(state.hideTimer);
        ro.disconnect();
        releaseWake();
        audio?.pause();
        for (const el of [clipEl, nextEl]) { el.pause(); el.removeAttribute("src"); }
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("visibilitychange", onVisibility);
        document.removeEventListener("fullscreenchange", syncFsUi);
        document.removeEventListener("webkitfullscreenchange", syncFsUi);
        landscapeMq.removeEventListener("change", onOrient);
        document.documentElement.classList.remove("vp-lock");
        root.remove();
      },
    };
  }
