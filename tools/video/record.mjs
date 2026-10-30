#!/usr/bin/env node
// record.mjs — 用 JSON 分鏡腳本產生畫面並錄成影片。
//
// 不是「即時螢幕錄製」:每個影格都是向播放器要「時間 t 的畫面」再截圖,
// 影格數 = 總時長 × fps,所以不會因為截圖比較慢而讓影片變快。
// 畫面沒變的影格直接重用上一張,所以大部分時間是靜態的影片會很快。
//
// 用法見 README.md,或執行 node record.mjs --help

import { chromium } from "playwright-core";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `用法:node record.mjs <腳本.json> [選項]

  --stills          只輸出每個場景的一張靜態圖到 out/<名稱>-stills/(最快,用來檢查畫面)
  --doc             只輸出分鏡腳本文件(畫面 / 旁白 / 時間對照表)到腳本旁邊的 .storyboard.md
  --audio-dir=資料夾  老師本人的旁白錄音:資料夾內放 01.wav、02.wav…(對應第 N 個場景,
                    格式不限,ffmpeg 讀得到即可),場景會撐到錄音長度。Hahow 要求口白是老師本人
  --tts             用 macOS 語音念旁白,只供試聽(不能當最終版,Hahow 不接受機器人聲)
  --captions        把字幕燒進畫面(預設不燒,Hahow 要另外上傳 .srt)
  --guides          疊出 Hahow logo 與 CC 字幕預留區,檢查重要資訊有沒有被擋住
  --voice=Flo       旁白聲音(預設 Flo,可用 say -v '?' 查看)
  --rate=170        旁白語速(每分鐘字數,預設用系統值)
  --scene=N         只處理第 N 個場景(從 0 開始),方便單獨調整
  --fps=30          影格率(預設 30)
  --width --height  輸出尺寸(預設 1920×1080,需為偶數)
  --jpeg            影格改用 JPEG(較快,畫質略降)
  --out=路徑        輸出檔(預設 out/<腳本名稱>.mp4)
`;

// ---------- args ----------
const flags = {};
const positional = [];
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--")) {
    const [k, ...v] = a.slice(2).split("=");
    flags[k] = v.length ? v.join("=") : true;
  } else positional.push(a);
}
if (flags.help || !positional[0]) {
  console.log(USAGE);
  process.exit(flags.help ? 0 : 1);
}
const die = (msg) => { console.error(`\n錯誤:${msg}`); process.exit(1); };

const scriptPath = path.resolve(positional[0]);
if (!fs.existsSync(scriptPath)) die(`找不到腳本:${scriptPath}`);
const baseDir = path.dirname(scriptPath);
const name = path.basename(scriptPath, ".json");
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const W = Number(flags.width ?? script.width ?? 1920);
const H = Number(flags.height ?? script.height ?? 1080);
const FPS = Number(flags.fps ?? script.fps ?? 30);
if (W % 2 || H % 2) die("寬高必須是偶數(H.264 yuv420p 的限制)");

const OUT_DIR = path.join(HERE, "out");
const TMP_DIR = path.join(OUT_DIR, `.tmp-${name}`);
const outFile = path.resolve(String(flags.out ?? path.join(OUT_DIR, `${name}.mp4`)));
const stillsDir = path.join(OUT_DIR, `${name}-stills${flags.guides ? "-guides" : ""}`);

// ---------- resolve the script's resources ----------
const toUrl = (p) => (/^(https?|file|data):/.test(p) ? p : pathToFileURL(path.resolve(baseDir, p)).href);
let scenes = script.scenes;
if (!Array.isArray(scenes) || !scenes.length) die("腳本需要 scenes 陣列");
const sceneOffset = flags.scene !== undefined ? Number(flags.scene) : 0;
if (flags.scene !== undefined) {
  if (!scenes[sceneOffset]) die(`沒有第 ${flags.scene} 個場景(共 ${scenes.length} 個)`);
  scenes = [scenes[sceneOffset]];
}
for (const sc of scenes) {
  if (sc.type === "code" && sc.file) {
    let txt = fs.readFileSync(path.resolve(baseDir, sc.file), "utf8");
    if (sc.range) txt = txt.split("\n").slice(sc.range[0] - 1, sc.range[1]).join("\n");
    sc.code = txt;
    sc.filename ??= path.basename(sc.file);
  }
  if (sc.type === "image") sc.src = toUrl(sc.src);
  if (sc.type === "web") { sc.url = toUrl(sc.url); sc.actions ??= []; }
}
script.scenes = scenes;

// rough speaking time when there is no real audio yet (Mandarin ≈ 4.2 chars/sec)
const estimateNarration = (text) => text.replace(/\s/g, "").length / 4.2;

// ---------- narration (macOS `say`) ----------
async function synthesize(sc, i, voice, rate) {
  const txt = path.join(TMP_DIR, `n${i}.txt`);
  const aiff = path.join(TMP_DIR, `n${i}.aiff`);
  fs.writeFileSync(txt, sc.narration);
  const args = ["-v", voice, "-o", aiff, "-f", txt];
  if (rate) args.push("-r", String(rate));
  await execFileAsync("say", args);
  return { file: aiff, dur: await probeDuration(aiff) };
}

async function buildNarrationTrack(clips, totalSec) {
  const out = path.join(TMP_DIR, "narration.wav");
  const args = ["-y"];
  clips.forEach((c) => args.push("-i", c.file));
  const delays = clips.map((c, i) => `[${i}]adelay=${Math.round(c.startSec * 1000)}|${Math.round(c.startSec * 1000)}[a${i}]`);
  const mix = clips.length === 1 ? "[a0]anull[out]" : `${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0:dropout_transition=0[out]`;
  args.push("-filter_complex", `${delays.join(";")};${mix}`, "-map", "[out]", "-t", String(totalSec), out);
  await execFileAsync("ffmpeg", args);
  return out;
}

// ---------- subtitles ----------
const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
function buildSrt(scenesWithTimes) {
  let n = 1;
  let out = "";
  for (const sc of scenesWithTimes) {
    const text = sc.caption ?? sc.narration;
    if (!text) continue;
    const from = sc.startMs / 1000 + (sc.narration ? 0.4 : 0.25);
    const to = sc.startMs / 1000 + sc.duration - 0.25;
    const parts = text.split(/(?<=[。!?;！？；])/).map((s) => s.trim()).filter(Boolean);
    const total = parts.reduce((m, p) => m + p.length, 0);
    let t = from;
    for (const part of parts) {
      const len = ((to - from) * part.length) / total;
      out += `${n++}\n${srtTime(t)} --> ${srtTime(t + len)}\n${part}\n\n`;
      t += len;
    }
  }
  return out;
}

// ---------- storyboard doc ----------
function describeScene(sc) {
  const flat = (s) => String(s).replace(/\[\[|\]\]/g, "").replace(/\n/g, " ");
  switch (sc.type) {
    case "title": return `標題卡:「${flat(sc.text)}」${sc.sub ? `／${flat(sc.sub)}` : ""}`;
    case "bullets": return `條列:${flat(sc.title)}(${sc.items.map((i) => flat(typeof i === "string" ? i : i.text)).join("、")})`;
    case "code": return `程式碼畫面:${sc.filename || ""}${sc.title ? `(${flat(sc.title)})` : ""}`;
    case "terminal": return `終端機畫面:${sc.items.map((i) => i.cmd).join(" → ")}`;
    case "chat": return `對話示範:使用者問「${sc.question}」→ ${(sc.steps || []).join(" → ")}${sc.chart ? ` → 圖表「${flat(sc.chart.title)}」` : ""}`;
    case "image": return `圖片:${path.basename(sc.src)}`;
    case "web": return `網頁操作:${sc.url}`;
    default: return sc.type;
  }
}
function writeStoryboard(finalScenes) {
  const total = finalScenes.reduce((m, s) => m + s.duration, 0);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  let md = `# ${script.title || name} — 分鏡腳本\n\n`;
  if (script.goal) md += `${script.goal}\n\n`;
  md += `預估總長 ${mmss(total)}(${Math.round(total)} 秒),${finalScenes.length} 個場景。旁白長度以每秒約 4.2 字估算,實際長度以老師錄音為準。\n\n`;
  if (script.limitsSec) md += `Hahow 規定長度 ${script.limitsSec[0] / 60}–${script.limitsSec[1] / 60} 分鐘:${total >= script.limitsSec[0] && total <= script.limitsSec[1] ? "符合" : "**不符合**"}。\n\n`;
  md += "| # | 時間 | 畫面 | 旁白 |\n| --- | --- | --- | --- |\n";
  finalScenes.forEach((sc, i) => {
    md += `| ${i + 1} | ${mmss(sc.startMs / 1000)}–${mmss((sc.startMs + sc.duration * 1000) / 1000)} | ${describeScene(sc)} | ${sc.narration ? sc.narration.replace(/\|/g, "\\|") : "(無旁白)"} |\n`;
  });
  if (script.notes?.length) md += `\n## 待補或待確認\n\n${script.notes.map((n) => `- ${n}`).join("\n")}\n`;
  const docPath = path.join(baseDir, `${name}.storyboard.md`);
  fs.writeFileSync(docPath, md);
  return docPath;
}

// ---------- main ----------
const cleanup = async () => { await browser?.close().catch(() => {}); fs.rmSync(TMP_DIR, { recursive: true, force: true }); };
const AUDIO_EXT = ["wav", "m4a", "mp3", "aiff", "aif", "aac", "flac", "ogg"];
const findAudio = (i) => {
  if (!flags["audio-dir"]) return null;
  const dir = path.resolve(String(flags["audio-dir"]));
  const base = String(i + sceneOffset + 1).padStart(2, "0");
  for (const ext of AUDIO_EXT) { const f = path.join(dir, `${base}.${ext}`); if (fs.existsSync(f)) return f; }
  return null;
};
const probeDuration = async (file) => parseFloat((await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file])).stdout);
let browser;
fs.mkdirSync(TMP_DIR, { recursive: true });
browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(pathToFileURL(path.join(HERE, "player", "index.html")).href);
await page.evaluate(() => document.fonts.ready);

try {
  // 1) default durations from content, then stretch for narration
  const autos = await page.evaluate((s) => window.player.prepare(s), script);
  const voice = String(flags.voice ?? script.voice ?? "Flo");
  const rate = flags.rate ? Number(flags.rate) : script.rate;
  const clips = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    let dur = sc.duration ?? autos[i];
    const real = findAudio(i);
    if (real && !flags.doc) {
      const d = await probeDuration(real);
      sc._clip = { file: real, dur: d };
      dur = Math.max(dur, 0.5 + d + 0.8);
    } else if (sc.narration) {
      let speak = estimateNarration(sc.narration);
      if (flags.tts && !flags.doc && !flags.stills) {
        process.stdout.write(`旁白 ${i + 1}/${scenes.length}…\r`);
        const clip = await synthesize(sc, i, voice, rate);
        speak = clip.dur;
        sc._clip = clip;
      }
      dur = Math.max(dur, 0.5 + speak + 0.8);
    }
    sc.duration = Math.round(dur * 100) / 100;
  }
  if (flags.captions) script.captions = true;
  await page.evaluate((s) => window.player.load(s), script);
  await page.evaluate((g) => window.player.setGuides(g), !!flags.guides);
  let acc = 0;
  for (const sc of scenes) { sc.startMs = acc; acc += sc.duration * 1000; }
  const totalMs = acc;
  const totalSec = totalMs / 1000;
  const total = Math.round(totalSec * FPS);
  if (script.limitsSec && flags.scene === undefined && (totalSec < script.limitsSec[0] || totalSec > script.limitsSec[1])) {
    console.warn(`\n⚠ 影片長度 ${totalSec.toFixed(0)} 秒,不在規定的 ${script.limitsSec[0]}–${script.limitsSec[1]} 秒內`);
  }
  if (flags.tts && !flags["audio-dir"]) console.warn("\n⚠ 目前使用系統語音,僅供試聽。Hahow 要求口白為老師本人,最終版請用 --audio-dir 混入你自己的錄音。");

  if (flags.doc) {
    const docPath = writeStoryboard(scenes);
    console.log(`分鏡腳本已輸出:${docPath}`);
    await cleanup();
    process.exit(0);
  }

  const shot = flags.jpeg ? { type: "jpeg", quality: 95 } : { type: "png" };

  // ----- real web pages (type: "web") are driven here, frame by frame -----
  let webPage = null;
  let webState = null;
  const unit = W / 120;
  async function webFrame(info) {
    const sc = scenes[info.index];
    if (!webState || webState.index !== info.index) {
      webPage ??= await context.newPage();
      await webPage.setViewportSize({ width: W, height: H });
      await webPage.goto(sc.url, { waitUntil: "load" });
      await webPage.evaluate((u) => {
        const d = document.createElement("div");
        d.id = "__cap";
        Object.assign(d.style, { position: "fixed", left: "50%", bottom: `${u * 4}px`, transform: "translateX(-50%)", maxWidth: `${u * 96}px`, boxSizing: "border-box", background: "rgba(28,26,16,.88)", color: "#fff", padding: `${u * 0.9}px ${u * 1.9}px`, borderRadius: `${u}px`, fontSize: `${u * 2.3}px`, lineHeight: "1.5", textAlign: "center", opacity: "0", zIndex: "2147483647", fontFamily: '-apple-system,"PingFang TC",sans-serif', pointerEvents: "none" });
        document.documentElement.appendChild(d);
      }, unit);
      webState = { index: info.index, done: new Set(), from: new Map() };
    }
    let fired = false;
    for (const [i, a] of sc.actions.entries()) {
      const at = (a.at || 0) * 1000;
      if (info.local < at) continue;
      if (a.do === "scroll") {
        if (!webState.from.has(i)) {
          const from = await webPage.evaluate(() => window.scrollY);
          const to = a.selector
            ? await webPage.evaluate(([sel, off]) => document.querySelector(sel).getBoundingClientRect().top + window.scrollY - off, [a.selector, a.offset ?? 80])
            : a.y;
          webState.from.set(i, { from, to });
        }
        if (webState.done.has(i)) continue;
        const { from, to } = webState.from.get(i);
        const p = a.dur ? Math.min(1, (info.local - at) / (a.dur * 1000)) : 1;
        const e = 1 - Math.pow(1 - p, 3);
        await webPage.evaluate((y) => window.scrollTo(0, y), from + (to - from) * e);
        if (p >= 1) webState.done.add(i);
        continue;
      }
      if (webState.done.has(i)) continue;
      if (a.do === "click") await webPage.click(a.selector, { timeout: 5000 });
      else if (a.do === "fill") await webPage.fill(a.selector, a.text, { timeout: 5000 });
      else if (a.do === "hover") await webPage.hover(a.selector, { timeout: 5000 });
      else if (a.do === "press") await webPage.keyboard.press(a.key);
      else if (a.do === "eval") await webPage.evaluate(a.js);
      webState.done.add(i);
      fired = true;
    }
    await webPage.evaluate(([t, o]) => { const d = document.getElementById("__cap"); if (d) { d.textContent = t; d.style.opacity = String(o); } }, [info.caption, info.capOpacity]);
    if (fired) await webPage.waitForTimeout(120);
    return webPage.screenshot(shot);
  }

  async function grab(tMs) {
    const info = await page.evaluate((t) => window.player.renderAt(t), tMs);
    if (info.type === "web") return { info, buf: await webFrame(info) };
    return { info, buf: null };
  }

  // ----- stills mode: one picture per scene -----
  if (flags.stills) {
    fs.rmSync(stillsDir, { recursive: true, force: true });
    fs.mkdirSync(stillsDir, { recursive: true });
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const t = sc.startMs + Math.max(0, sc.duration * 1000 * 0.8 - 100);
      let { info, buf } = await grab(t);
      buf ??= await page.screenshot({ type: "png" });
      const file = path.join(stillsDir, `${String(i + sceneOffset + 1).padStart(2, "0")}-${sc.type}.png`);
      fs.writeFileSync(file, buf);
    }
    console.log(`\n已輸出 ${scenes.length} 張場景靜態圖:${stillsDir}`);
    await cleanup();
    process.exit(0);
  }

  // ----- video -----
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  let audioPath = null;
  const clipList = scenes.filter((s) => s._clip).map((s) => ({ file: s._clip.file, startSec: s.startMs / 1000 + 0.5 }));
  if (clipList.length) audioPath = await buildNarrationTrack(clipList, totalSec);

  const ffArgs = ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", flags.jpeg ? "mjpeg" : "png", "-i", "-"];
  if (audioPath) ffArgs.push("-i", audioPath);
  ffArgs.push("-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
  if (audioPath) ffArgs.push("-c:a", "aac", "-b:a", "192k", "-af", "apad", "-t", totalSec.toFixed(3));
  ffArgs.push(outFile);
  const ff = spawn("ffmpeg", ffArgs, { stdio: ["pipe", "ignore", "pipe"] });
  let ffErr = "";
  ff.stderr.on("data", (d) => { ffErr = (ffErr + d).slice(-2000); });
  const ffDone = new Promise((res, rej) => { ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg 結束代碼 ${c}\n${ffErr}`)))); });
  ff.stdin.on("error", () => {});
  const write = (buf) => new Promise((res, rej) => ff.stdin.write(buf, (e) => (e ? rej(e) : res())));

  console.log(`錄製 ${scenes.length} 個場景,${totalSec.toFixed(1)} 秒,${W}×${H} @ ${FPS}fps(共 ${total} 影格)${audioPath ? ",含旁白" : ""}`);
  const startedAt = Date.now();
  let lastKey = null;
  let last = null;
  let reused = 0;
  let lastPct = -1;
  for (let f = 0; f < total; f++) {
    const { info, buf: webBuf } = await grab((f * 1000) / FPS);
    let buf;
    if (webBuf) { buf = webBuf; lastKey = null; }
    else if (info.key === lastKey && last) { buf = last; reused++; }
    else { buf = await page.screenshot(shot); last = buf; lastKey = info.key; }
    await write(buf);
    const pct = Math.floor((f / total) * 10) * 10;
    if (pct !== lastPct) { lastPct = pct; process.stdout.write(`  ${pct}%\r`); }
  }
  ff.stdin.end();
  await ffDone;
  fs.writeFileSync(outFile.replace(/\.mp4$/, ".srt"), buildSrt(scenes));
  writeStoryboard(scenes);
  const sec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n完成:${outFile}\n字幕:${outFile.replace(/\.mp4$/, ".srt")}\n耗時 ${sec} 秒,重用影格 ${reused}/${total}`);
} finally {
  await cleanup();
}
