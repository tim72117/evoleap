// 從 scripts/fundraising.json 與 out/ 裡的畫面,產生提案網站的「募資影片」頁
// (proposal/video.html)。腳本或畫面更新後重跑:node build-proposal-page.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const script = JSON.parse(fs.readFileSync(path.join(HERE, "scripts/fundraising.json"), "utf8"));
const stills = fs.readdirSync(path.join(HERE, "out/fundraising-stills")).sort();
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const total = 130; // 預估秒數,與分鏡腳本一致

const cards = script.scenes.map((sc, i) => `
    <figure>
      <img src="../video/out/fundraising-stills/${stills[i]}" data-name="${stills[i]}" alt="場景 ${i + 1}">
      <figcaption><b>${i + 1}</b>${esc(sc.narration || "")}</figcaption>
    </figure>`).join("");

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>募資影片 · Hahow 課程提案</title>
<link rel="stylesheet" href="style.css">
<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 22px; }
  figure { margin: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  figure img { display: block; width: 100%; height: auto; }
  figcaption { padding: 12px 16px; font-size: 14.5px; }
  figcaption b { display: inline-block; min-width: 1.6em; color: var(--accent); font-family: var(--mono); }
  .toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; margin: 0 0 18px; cursor: pointer; }
</style>
</head>
<body>
<header class="topbar"><div class="topbar-inner">
  <a class="brand" href="index.html">HAHOW 課程提案</a>
  <nav>
    <a href="index.html">總覽</a>
    <a href="fields.html">提案內容</a>
    <a href="structure.html">課程架構</a>
    <a href="cover.html">封面圖</a>
    <a href="video.html" aria-current="page">募資影片</a>
  </nav>
</div></header>

<main>
  <a class="back" href="index.html">← 回總覽</a>
  <h1>募資影片</h1>
  <p class="lead">共 ${script.scenes.length} 個場景，預估 ${Math.floor(total / 60)} 分 ${total % 60} 秒。下方是各場景接近結尾時的畫面與老師要念的旁白稿。</p>

  <section class="card">
    <table>
      <thead><tr><th>項目</th><th>狀態</th></tr></thead>
      <tbody>
        <tr><td>畫面（${script.scenes.length} 個場景）</td><td><span class="chip done">已完成</span></td></tr>
        <tr><td>旁白稿</td><td><span class="chip todo">待補自我介紹（場景 2）</span></td></tr>
        <tr><td>旁白錄音（老師本人）</td><td><span class="chip todo">待錄</span></td></tr>
        <tr><td>成片與字幕檔（.srt）</td><td><span class="chip todo">待錄製</span></td></tr>
      </tbody>
    </table>
  </section>

  <h2>Hahow 規格</h2>
  <section class="card">
    <table>
      <tbody>
        <tr><td>長度</td><td>1 到 3 分鐘</td></tr>
        <tr><td>畫面</td><td>16:9、1080p、mp4</td></tr>
        <tr><td>必須說明</td><td>課程目標、教學方式、與同類課程的差異、自我介紹</td></tr>
        <tr><td>口白</td><td>必須是老師本人，不能是機器人聲</td></tr>
        <tr><td>預留位置</td><td>右上角 Hahow logo、底部 CC 字幕；重要資訊不可被擋住</td></tr>
        <tr><td>字幕</td><td>另外上傳 .srt（zh-TW），不燒進畫面</td></tr>
      </tbody>
    </table>
  </section>

  <h2>畫面與旁白稿</h2>
  <label class="toggle"><input type="checkbox" id="guides"> 疊出 Hahow logo 與字幕預留區</label>
  <div class="grid">${cards}
  </div>

  <h2>待補或待確認</h2>
  <div class="note"><ul style="margin:0">${script.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>

  <h2>相關檔案</h2>
  <section class="card">
    <table>
      <tbody>
        <tr><td><a href="../video/scripts/fundraising.storyboard.md">分鏡腳本</a></td><td>每個場景的畫面、時間、旁白對照表</td></tr>
        <tr><td><a href="../video/scripts/fundraising.json">腳本原始檔</a></td><td>改這個檔，重跑工具就會更新畫面</td></tr>
        <tr><td><a href="../video/README.md">影片工具說明</a></td><td>如何產生畫面、錄製與混入旁白</td></tr>
      </tbody>
    </table>
  </section>
</main>
<footer><a class="back" href="index.html">← 回總覽</a> · course/proposal/video.html</footer>
<script>
  document.getElementById("guides").addEventListener("change", (e) => {
    document.querySelectorAll(".grid img").forEach((img) => {
      img.src = "../video/out/fundraising-stills" + (e.target.checked ? "-guides" : "") + "/" + img.dataset.name;
    });
  });
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(HERE, "../proposal/video.html"), html);
console.log("proposal/video.html 已產生");
