// 從 scripts/fundraising.json 與 out/ 裡的畫面,產生提案網站「募資影片」頁要用的資料
// (web/src/studio/proposal/videoData.json,由 VideoPage 匯入),並把畫面複製到
// web/public/materials/ 讓網站可以直接顯示。腳本或畫面更新後重跑:node build-proposal-page.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, "../../web");
const NAME = "fundraising";
const script = JSON.parse(fs.readFileSync(path.join(HERE, `scripts/${NAME}.json`), "utf8"));
const total = 130; // 預估秒數,與分鏡腳本一致

// 畫面檔名:有輸出過(node record.mjs --stills)就用 out/ 裡的實際檔名,
// 否則照 record.mjs 的命名規則推算(01-title.png…)。
const stillsDir = path.join(HERE, `out/${NAME}-stills`);
const stills = fs.existsSync(stillsDir)
  ? fs.readdirSync(stillsDir).filter((f) => f.endsWith(".png")).sort()
  : script.scenes.map((sc, i) => `${String(i + 1).padStart(2, "0")}-${sc.type}.png`);

// 把畫面(含疊上平台預留區的 -guides 版本)複製到 web/public/materials/
const copied = [];
for (const suffix of ["", "-guides"]) {
  const src = path.join(HERE, `out/${NAME}-stills${suffix}`);
  if (!fs.existsSync(src)) continue;
  const dst = path.join(WEB, `public/materials/${NAME}-stills${suffix}`);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
  copied.push(path.relative(path.join(HERE, "../.."), dst));
}

const data = {
  sceneCount: script.scenes.length,
  totalSec: total,
  stillsBase: `/materials/${NAME}-stills`, // 疊出預留區時改用 `${stillsBase}-guides`
  scenes: script.scenes.map((sc, i) => ({
    n: i + 1,
    still: stills[i],
    narration: sc.narration || "",
  })),
  notes: script.notes || [],
};

const outFile = path.join(WEB, "src/studio/proposal/videoData.json");
fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + "\n");
console.log("web/src/studio/proposal/videoData.json 已產生");
if (copied.length) console.log("畫面已複製到:" + copied.join("、"));
else console.log("(找不到 out/ 畫面,先跑 node record.mjs scripts/fundraising.json --stills 再重跑本工具)");
