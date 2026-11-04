# 即時教學畫面引擎規格

目標：教學影像不再錄製，改成「腳本 → 即時畫出」。課程頁直接在頁面上播放（可暫停、拖曳、倍速、複製畫面上的文字）。

引擎是一組 ES module，放在 `web/src/live/`，由 Vite 和網站一起打包：

```
web/src/live/
  shell.ts / shell.css                播放器外殼:時間軸、播放控制、舞台縮放、字幕、全螢幕(第 2 節)
  narration.ts                        分段旁白音檔的播放(外殼用):依外殼時鐘決定播哪一段
  stage.ts / stage.css                舞台:時間表、旁白長度、字幕、章節、練習點、教學效果(2A)
  camera.ts                           鏡頭:提示點 → 關鍵點 → 依時間算出鏡頭姿態
  types.ts                            共用型別:腳本格式、演員介面(Actor)與 defineActor
  actors/index.ts                     演員登記表
  actors/<名稱>/actor.ts、actor.css    演員(2A.1)
  kit.ts / kit.test.ts                舞台與演員共用的動畫工具(第 6 節)
  scripts.ts                          載入腳本:loadScript(path)、scriptPaths()、registerScripts(內部腳本)
web/src/content/live/<等級>/*.json     舞台腳本(2A.2),例如 l0/0.0-tools.json
```

```
┌──────────────────── 外殼 Shell(shell.ts) ─────────────────────┐
│ 時間軸 · 播放控制 · 舞台縮放 · 字幕 · 練習點暫停 · 全螢幕          │
│  ┌──────────── 舞台 Stage(stage.ts) ──────────────┐   ← kit   │
│  │ 章節卡 · 聚光燈 · 鏡頭 · 虛擬滑鼠 · 演員出場退場   │            │
│  │   演員 actors/<名稱>/:claude-desktop、finder…   │            │
│  └─────────────────────────────────────────────────┘           │
└────────────────────────────────────────────────────────────────┘
        ▲ 腳本(src/content/live/…/*.json):演員表、步驟、旁白、章節、練習點
```

- **外殼**只管時間和播放，不知道畫面長什麼樣，只要內容提供「總長度」與「畫出某個時間點」。
- **舞台**負責「怎麼演」，**演員**負責「長什麼樣」（2A）。
- **腳本**是資料：換腳本就是換內容。
- **kit** 是舞台與演員共用的繪製手法工具，見第 6 節。
- 繪製層（第 3 節）與素材包（第 5 節）是之後的規劃，尚未實作。

---

## 1. 共同原則：畫面是時間的純函式

所有繪製都必須滿足：**給定腳本與時間 t，畫面唯一確定。**

| 規則 | 原因 |
|---|---|
| 不用 `setTimeout`、`setInterval`、`requestAnimationFrame` | 時間只能來自外殼傳入的毫秒數 |
| 不用 CSS `animation`、`transition` | 會依真實時間跑，拖曳、逐格截圖時對不上 |
| 不用 `Date.now()`、`performance.now()`、`Math.random()` | 用傳入的時間與 `kit.rand(seed)` |
| 素材在 `load` 階段全部預載完，`render` 期間不發網路請求 | 拖曳、截圖時不能等載入 |
| 可以讀版面（`offsetWidth`、`kit.rectIn`），但只能在 `mount` 或依時間決定的時機讀 | 讀出來的值也要對同一個 t 一致 |
| 文字用真的 DOM 文字，不畫進 canvas 或圖片 | 學員可以選取、複製；字幕與螢幕閱讀器可用 |

---

## 2. 外殼 Shell（`shell.ts`）

### 2.1 舞台尺寸

- 邏輯尺寸固定 **1920 × 1080 px**，外殼用 `transform: scale()` 縮放到容器大小。舞台與演員一律用 px（或 `--u`）排版，`kit.rectIn`、鏡頭、滑鼠座標都在這個座標系。
- 字幕與控制列由外殼畫在畫面下緣；舞台的鏡頭推近時，目標下緣最多到畫面 68% 高，避開這一區。

### 2.2 時鐘

外殼自己推進時間；有旁白音訊（`audio`）時以音訊的 `currentTime` 為主時鐘，避免影音不同步。畫面一律透過 `renderAt(ms)` 畫出，而且可能以任意順序呼叫（拖曳、倒轉），見第 1 節。

### 2.3 API

型別與行為說明都在 `shell.ts` 開頭。

```js
import { mountShell } from "../live/shell";
import "../live/shell.css";

const vp = mountShell(container, {
  stage: element,                 // 1920×1080 的內容(例如 createStage 用的 div),外殼負責縮放
  title, duration,                // duration:總長度(毫秒)
  renderAt: (ms) => …,            // 畫出 ms 時的畫面
  chapters: [{ at, label }],
  captions: (ms) => "字幕" | "",
  stops: [{ at, title, body }],   // 練習點:播放經過時自動暫停
  clips: [{ at, ms, url }],       // 分段旁白:在 [at, at+ms) 之間播放,跟著外殼的時鐘同步(拖曳、倍速、暫停、練習點)
  audio, progress, globalKeys, onFullscreenRequest, autoLandscape,
});
vp.play() / pause() / seek(ms) / setRate(x) / toggleFullscreen() / update(opts) / destroy()
vp.time / vp.playing
```

內容晚一點才準備好時（例如腳本還在載入），先用 `stage` 掛上外殼，之後用 `vp.update({ duration, renderAt, chapters, … })` 補上。

### 2.4 外殼負責、舞台與演員不用管的事

字幕顯示、練習點暫停、旁白音訊播放、播放控制列、章節、鍵盤操作、全螢幕。

| 行為 | 說明 |
|---|---|
| 時間軸 | 拖曳（滑鼠、觸控共用）、懸停預覽時間與章節名稱、章節刻度 |
| 速度與字幕 | 0.5×–2× 選單；字幕開關會記住 |
| 全螢幕 | Fullscreen API，Android 進入全螢幕時鎖定橫向；iPhone 不支援元素全螢幕時改用固定滿版，直向時提示轉橫向 |
| 手機橫放 | 播放中或看過一部分時，手機轉橫向自動滿版，轉回直向恢復 |
| 控制列 | 播放中 2.6 秒沒動作自動隱藏（全螢幕時也隱藏游標）；暫停時一直顯示 |
| 手勢 | 桌機點畫面播放暫停、雙擊全螢幕；手機點一下顯示／隱藏控制列，左右兩側點兩下倒轉／快轉 10 秒 |
| 鍵盤 | 空白／K 播放暫停、←→ 5 秒、J／L 10 秒、, . 逐格、0–9 跳到 0%–90%、F 全螢幕、C 字幕、M 靜音、< > 速度、Home／End |
| 其他 | 記住看到哪裡、播放時螢幕不休眠（Wake Lock）、系統媒體控制（Media Session）、切換分頁自動暫停（時鐘不是單一音軌時，包括分段旁白）、暫停時可以選取複製畫面文字、手機直向小尺寸版面 |

### 2.5 課程頁直接掛載

單課資料（`src/content/l0Lessons.ts` 等）的影片設定 `live: 'l0/0.0-tools.json'`（相對於 `src/content/live/`）時，課程頁改用 `web/src/courses/LivePlayer.tsx` 播放：

1. `createStage(div)` 建立舞台，`mountShell(box, { stage: div, … })` 直接掛在課程頁上。
2. `loadScript(path)`（`scripts.ts`，以 `import.meta.glob` 讀 `src/content/live/**/*.json`；每份腳本分開打包，播到那一課才載入），等字型載入後 `stage.load(script)`，再用 `vp.update` 補上長度、章節、字幕、練習點。
3. 播放秒數透過 `onTime` 回報給課程頁；腳本裡標了 `lessonStep` 的章節透過 `onCues` 回報，課程頁播到那裡就展開對應的步驟。
4. 全螢幕、手機橫放滿版與播放器的快捷鍵都由外殼處理（焦點在播放器裡時 ←/→ 是倒退／快轉，在頁面上時由課程頁切換步驟）。

### 2.6 檢查畫面

各課的即時教學畫面直接在研發基地頁（`/studio/tools`）每課的「影片切分」播放，和學員課程頁是同一個播放器（有旁白語音，但不記播放進度；`LivePlayer` 的 `saveProgress={false}`）。腳本有錯時播放器會顯示錯誤訊息（含第幾步）。

以前有一個內部預覽頁 `/studio/visuals/preview`（只畫出某個時間點的畫面、給 Playwright 逐段截圖用），因為播放已經搬到研發基地頁，已經移除。要逐時間點檢查畫面時，在研發基地頁的播放器拖到該時間點，或在測試裡直接 `createStage(div)` → `stage.load(script)` → `stage.renderAt(ms)`；互動場景的試做頁（`/studio/interactive/*`）也能播放腳本。

---

## 2A. 舞台與演員（已實作）

示範畫面拆成兩種角色：

- **演員**（`actors/<名稱>/`）：一個可以重複使用的示範元件，例如 Claude 桌面版、Finder。只負責「長什麼樣、每個動作畫成什麼樣子」，並告訴舞台各個目標在哪裡。
- **舞台**（`stage.ts`；`createStage(root)` 回傳 `load(script, { voice })`、`renderAt(ms)`、`duration`、`chapters`、`captions`、`stops`、`narrations`、`cameraKeys`，型別是同一個檔案裡的 `Stage`）：負責「怎麼演」。包括時間表、旁白長度、字幕、章節、練習點、演員的位置與出場退場，以及所有教學效果：章節卡、聚光燈與說明、鏡頭推近與平移、虛擬滑鼠。

效果寫在舞台，所以任何演員都能用；演員遵守同一份規格，所以可以抽換，也能安排到任何場景。

### 2A.1 演員規格

```
actors/<名稱>/
  actor.ts    必要:export default 用 defineActor 宣告的演員;開頭 import { kit } from "../../kit"、import { defineActor } from "../../types" 與 import "./actor.css"
  actor.css   必要:所有選擇器以 .A-<名稱> 開頭,不用 id,不影響舞台與其他演員
actors/index.ts  必要:import 這個演員並加進 ACTORS(腳本 cast 的 "actor" 名稱 → 演員定義)
```

演員的樣式由 `actor.ts` 自己 import，跟著舞台一起打包；沒在 `actors/index.ts` 登記的演員，載入腳本時會報「找不到演員」。

演員的介面是 `types.ts` 的 `Actor`：`defineActor<動作種類, 步驟, props, 狀態, 目標名稱>({ … })` 會在編譯時檢查，缺少必要成員（`name`、`kinds`、`duration`、`mount`）、`kinds` 與步驟型別對不上、`autoFocus`／`cues` 回傳不在目標名稱裡的值，`tsc` 都會報錯。

```ts
import { kit } from "../../kit";
import { defineActor } from "../../types";
import "./actor.css";

export default defineActor({
  name: "claude-desktop",
  kinds: ["user", "say", "ask", "choose", …],       // 會的動作;腳本裡步驟的鍵名就是動作種類

  duration(kind, step, props) { return ms; },        // 這個動作的自然長度
  autoFocus(kind, step) { return "composer"; },      // 選用:camera auto 時建議看哪裡;false = 全景,undefined = 沿用
  cues(kind, step) { return [{ at: 0, target: "composer" }, { at: 700, target: "send" }]; },
                                                     // 選用:鏡頭提示點(at 為相對於動作開始的毫秒;target 同 autoFocus 的回傳值)。
                                                     // 有 cues 就不用 autoFocus;一個動作需要多次運鏡時才寫
  cursor(kind, step) {                               // 選用:需要虛擬滑鼠的動作回傳時間表(相對於動作開始)
    return { moves: [{ at: 300, target: "option:2" }, …], clickAt: 2400 };
  },

  mount(root, props) {                               // 登場:在舞台給的位置(root)裡建立畫面
    return {
      render({ events, view }, ms) { … },            // 必要:畫出 ms 時的樣子(view 只有有狀態的演員才有)
      target(name, view) { return element | null; }, // 必要:目標名稱 → 元素,給鏡頭、聚光燈、滑鼠用
    };
  },
});
```

- `frame.events` 是「已經開始的、屬於這個演員的動作」，依時間排列，每一項有 `{ kind, step, start, dur, local, p }`。舞台的 `show`／`hide` 帶的其他欄位會以 `kind: "props"` 傳進來。
- `render` 會以任意順序呼叫（拖曳、倒轉），畫面只能由 `events` 與 `ms` 決定，見第 1 節。
- 演員自己的版面用 `--u`（1920 寬時 18px）或相對單位，大小跟著舞台給的位置走。
- 每個演員在 `actor.ts` 開頭列出：props、動作與欄位、目標名稱。這份說明也是給 AI 寫腳本看的。

現有演員：

| 演員 | 動作 | 目標 |
|---|---|---|
| `claude-desktop` | user、thinking、say、tool、edit、todos、ask、choose、mode、newSession、session、menu、fork、state（多個 session 見 `actor.ts` 開頭） | composer、input、send、mode、model、head、sidebar、log、ask、option:N、user、say、tool、edit、todos、new、sessions、session:名稱、more:名稱、menu、menuitem:項目 |
| `finder` | open、mkdir、create、delete、rename、select、drag、drop、highlight（有狀態，見 2A.5） | window、file:名稱（或 item:名稱） |
| `browser` | site、width、scroll、go、click、reload（有狀態；網頁放在 Shadow DOM，寬度條件由腳本指定的寬度判斷，素材在 `content/live/l0/site/<版本>/`） | window、tab、addressbar、content、viewport、section:id、sel:css選擇器 |
| `chat` | receive（帶 from）、reply（有狀態；通用手機聊天畫面，情境開場用） | window、msg:N、msg:last |
| `person` | say（帶 mood：calm、tired、worried、happy、busy；SVG 插畫半身像＋對話泡泡，props.look：boss、staff、customer；情境開場用） | window、face、bubble |
| `notes` | jot、lose（有狀態；桌上的便條紙，掉落的便條移到桌面下方，情境開場用） | window、note:N、note:last、floor |
| `editor` | open、type（有狀態；通用深色程式碼編輯器，依副檔名上色 html、css、js，演出「以前自己寫程式」） | window、code、caret、tab:檔名 |
| `macbook` | open、close、wake、sleep、type、tilt（有狀態；擬真筆電，宣傳片用，純 CSS 3D；props：opened、awake、angle、pitch、yaw、finish、wallpaper、dock、clock） | window、screen、keyboard、trackpad、lid、key:鍵 |

**`macbook` 演員（擬真筆電）**：`actors/macbook/`，示範腳本 `content/live/lab/macbook-demo.json`。

- props：`opened`（預設 false）、`awake`（預設等於 opened）、`angle`（開蓋角度 90–135，預設 105）、`pitch`（俯視角 0–70，預設 15）、`yaw`（水平旋轉 -60–60，預設 0）、`finish`（`silver`／`space-gray`）、`wallpaper`（`dawn`／`ocean`／`graphite`／`meadow`／`dusk`）、`dock`（Dock 圖示 0–10，預設 7）、`clock`（選單列時間文字）。
- 動作：`{ "open": true, "angle": 110 }`（開蓋約 1.7 秒）、`{ "close": true }`、`{ "wake": true }`（亮屏）、`{ "sleep": true }`、`{ "type": "文字", "cps": 8 }` 或 `{ "type": true, "keys": 24 }`（按鍵下沉、鍵帽淡淡亮起；英數字按對應鍵，其他字按固定亂數選的鍵）、`{ "tilt": { "pitch": 30, "yaw": -15 } }`（約 2.4 秒，給運鏡用）。操作對不上狀態（已開蓋又 open、闔著 wake／type）載入時報錯。鏡頭推近平移用一般的 `focus`，不另外發明。
- 目標：`screen`、`keyboard`、`trackpad`、`lid`、`window`、`key:<鍵>`（如 `key:a`）。量的是 3D 投影後的外框（演員內部放了替身，不受 3D 影響）。
- 大小：依 `place` 的 w、h 等比例縮放，設計盒寬高比 **1240:1120**，放不下時取較小的邊、置中。place 的 w:h 取 1240:1120（例如 h 760、w 841.4）時，螢幕發亮區域（16:10）在 place 內的位置：左 10.8%、上 10.9%、寬 78.4%、高 56.4%（設計座標 x 133.9、y 121.6、w 972.3、h 631.5）。
- 疊其他演員在螢幕上：算出螢幕的舞台座標，把演員的 `place` 設成它（或螢幕內縮一圈，像浮動視窗；選單列與瀏海佔螢幕上緣約 3%）。**要條件**：開蓋角度 = 90 + pitch（預設 105 與 15 就是），螢幕才會正對鏡頭、是標準矩形；疊上去的演員不會跟著 tilt、開蓋旋轉，所以疊上去之後不要 tilt，要 tilt 先 `hide` 它。疊上去的演員在演員表要排在 macbook 之後。
- 限制：舞台的鏡頭規定目標下緣不超過畫面 68% 高，所以 `focus: "mac:screen"` 能推近的倍率約 ≤ 1080×0.68×0.9 ÷ 螢幕高；要推近 1.5 倍以上，廣角時機身要縮小（螢幕高 ≲ 430px）。

**演員的區塊（`parts`）**：演員用 `parts` 宣告可以關掉的區塊（名稱 → CSS 選擇器），避免某些情境畫面露出太多資訊。

- 登場設定：演員表寫 `"parts": { "sidebar": false, "model": false }`，沒寫的區塊照常顯示。
- 播放途中切換：舞台動作 `{ "parts": "claude", "set": { "sidebar": true } }`，不佔時間。
- 名稱打錯時載入就報錯，並列出可用的區塊。關掉的區塊量不到位置，鏡頭、聚光燈、滑鼠不要再指向它。
- 每位演員有哪些區塊、關掉後長怎樣：`/studio/actor-interaction/showcase`（演員展示：動態展示照示範腳本播放，靜態展示只有舞台、按操作才演出；示範腳本在 `content/live/lab/actors/<演員>.json`）。

**演員的可點區（`hotspots`）**：選用。`hotspots(state, props)` 回傳目前可以點什麼：`{ target, label, step }`，或要先打字的 `{ target, label, input: { placeholder, step(text) } }`。演員不處理點擊事件，互動層（目前只有 `/studio/actor-interaction/showcase` 的靜態展示）量出目標位置、疊上透明按鈕，點下去就接一步、重新載入，畫面仍只由時間決定。和腳本的關係還沒設計，見構想頁 `/studio/actor-interaction`。

### 2A.2 舞台腳本

```json
{
  "title": "第一個檔案，以及允許與拒絕",
  "camera": "auto",
  "cast": {
    "claude": { "actor": "claude-desktop", "props": { "folder": "~/Documents/practice", "mode": "ask" }, "place": "window" },
    "finder": { "actor": "finder", "props": { "tree": { "practice": {} }, "open": "practice" }, "place": "right", "hidden": true }
  },
  "steps": [
    { "card": "第一個檔案", "eyebrow": "L0 · 第 0 課", "narration": "…" },
    { "user": "建立 hello.txt，寫一句問候", "chapter": "建立第一個檔案", "lessonStep": 4 },
    { "ask": "hello.txt", "where": "~/Documents/practice" },
    { "callout": "claude:ask", "text": "先看三件事…", "narration": "…" },
    { "choose": 1 },
    { "show": "finder", "create": "hello.txt", "narration": "…" },
    { "hide": "finder" },
    { "checkpoint": "換你試試", "body": "…" }
  ]
}
```

- **位置** `place`：`window`（預設）、`full`、`left`、`right`、`center`，或 `{ x, y, w, h }`（1920×1080 的 px 或百分比，`h` 可省略）。
- **演員的動作**交給演員表中會這個動作的演員；演員表裡有多個演員都會時（例如兩個 `claude-desktop`），必須加 `"on": "代號"`，否則載入時報錯。
- **舞台的動作**：`card`、`callout`、`show`、`hide`、`move`（移到新位置）、`checkpoint`、`wait`、`parts`（切換區塊顯示）。
- **每一步都能加**：`narration`、`chapter`、`lessonStep`、`ms`、`pause`、`focus`。
- **目標**寫成「演員代號:目標名稱」，例如 `claude:ask`；只寫代號表示整個演員。
- **字幕**：旁白由 `kit.splitCaption` 切成單行、每條不超過約 24 個字，按字數分配時間，寫旁白不用自己斷句。
- **旁白長度**：一段旁白到下一段旁白（或練習點）之前的時間不夠時，帶旁白的 `card`／`callout`／`show` 會自己延長，其他情況則補在最後一步之後。
- **鏡頭**：`focus` 指定目標與倍率，`false` 拉回全景；頂層 `"camera": "auto"` 時，沒寫的步驟由演員建議：`cues(kind, step)` 回傳多個時間點的提示點，沒有 `cues` 就用 `autoFocus` 的單一目標（等同 `at: 0` 的一個提示點）。每次切換以 0.9 秒的平滑緩動過渡，**演員的動作會等鏡頭到位才開始**（換鏡頭的演員動作前面自動留 0.9 秒，舞台自己的動作如章節卡、出場不等）；目標下緣最多到畫面 68% 高，避開字幕與控制列。

### 2A.3 新增演員的步驟

1. 建 `actors/<名稱>/actor.ts`、`actor.css`，用 `defineActor` 照 2A.1 的介面實作（`actor.ts` 要 import 自己的 `actor.css`），開頭寫清楚 props、動作與目標。
2. 在 `actors/index.ts` import 並登記。
3. 動作照 2A.4 設計成「操作」，狀態照 2A.5 用 `init`／`apply` 推算。
4. 在腳本（`src/content/live/`）的 `cast` 加上它，在研發基地頁的播放器檢查各時間點的畫面（2.6）。
5. 檢查拖曳與倒轉：`render` 不能依賴上一次的結果。

### 2A.4 動作要是「操作」，不是「設定畫面」（所有演員必須遵守）

腳本作者只需要知道這個 App 一般怎麼操作，就能讓演員演出來；演員內部怎麼記狀態、怎麼畫，外部不用知道。

| | 操作式（要這樣） | 設定式（不要） |
|---|---|---|
| Finder 新增資料夾 | `{ "mkdir": "practice" }` | `{ "files": [原本的全部, "practice"] }` |
| Finder 進入資料夾 | `{ "open": "practice" }` | `{ "folder": "practice", "files": [] }` |
| 瀏覽器開網址 | `{ "goto": "https://…" }` | `{ "url": "…", "title": "…", "body": "…" }` |

- **動作名稱用該 App 的一般操作**：開啟、新增、刪除、改名、輸入、點選、捲動。參數只放「使用者會給的資訊」（名稱、路徑、文字），不放「操作後的結果」。
- **結果由演員推算**：新增後清單長怎樣、刪除後誰消失，由演員依自己的狀態算出來，腳本不重抄。
- **登場設定（props）只描述起始狀態**，例如 Finder 的目錄樹與一開始打開的資料夾。
- **有錯就報錯**：操作對不上狀態（打開不存在的資料夾、刪除不存在的檔案）時，`load` 直接丟錯並指出是第幾步，不默默畫錯。
- **動作清單是對外接口**：`actor.ts` 開頭列出每個動作、參數與效果；寫腳本的人（或 AI）只看這份說明。

### 2A.5 演員狀態：init／apply（已實作：舞台、`finder`）

演員常需要記得前面發生過什麼（目前在哪個資料夾、選了哪個檔案、選單有沒有打開），才能演出連續的動作。為了維持「畫面是時間的純函式」（第 1 節），狀態不存在演員身上，而是由舞台在載入時依序推算：

```js
export default {
  name: "finder",
  kinds: ["open", "mkdir", "create", "delete", "rename", "select", "drag", "drop"],

  init(props) { return { tree: props.tree, cwd: props.open, temp: {} }; },

  // 純函式:套用一個動作,回傳新狀態(不能改原本的 state)。操作對不上時丟錯。
  apply(state, kind, step) {
    switch (kind) {
      case "mkdir":  return { ...state, tree: addDir(state.tree, state.cwd, step.mkdir), last: step.mkdir };
      case "select": return { ...state, temp: { ...state.temp, selected: step.select } };
      case "drop":   return { ...state, tree: move(state.tree, state.temp.selected, step.drop), temp: {} };
      …
    }
  },

  mount(root, props) {
    return {
      // view.state:目前這個動作完成後的狀態;view.prev:動作開始前的狀態
      // view.ev:進行中的動作 { kind, step, local, p };沒有動作進行時為 null
      render(view, ms) { … },
      target(name, view) { … },
    };
  },
};
```

- **推算一次、到處重用**：舞台在 `load` 時對每個演員從 `init(props)` 開始，依序 `apply` 它的每個動作，存下每一步前後的狀態快照。`renderAt(ms)` 只是找出 ms 落在哪一步，把 `prev`、`state` 與進度 `p` 交給演員，所以拖曳、倒轉都不用重算。
- **過場由演員自己內插**：動作進行中（`0 ≤ p < 1`）畫 `prev` 到 `state` 之間的樣子，例如新資料夾淡入、被刪的檔案淡出、選單展開一半。
- **暫時狀態放 `state.temp`**：只在一連串動作之間有意義的東西，例如選取、拖曳中的項目、打開的選單、輸入到一半的文字。規則：
  - 由開始的動作寫入（`select`、`drag`、`menu`），由結束的動作清掉（`drop`、`cancel`、`close`）；
  - 演員退場（`hide`）時舞台自動清空 `temp`；
  - 下一個動作需要的暫時狀態不存在時（例如沒有 `select` 就 `drop`），`apply` 丟錯。
- **連續動作的例子**：
  ```json
  { "on": "docs", "select": "idea.txt" },
  { "on": "docs", "drag": "notes", "narration": "把它拖進 notes 資料夾" },
  { "on": "docs", "drop": true }
  ```
  `select` 讓檔案反白並記在 `temp.selected`；`drag` 的 `p` 從 0 到 1 時，檔案沿路徑移向 notes（虛擬滑鼠跟著走，見 `cursor`）；`drop` 才真的改動目錄樹並清掉 `temp`。
- **show／hide 帶動作**：`{ "show": "finder", "open": "practice" }` 會先套用那個動作；一次只能帶一個，多個會報錯。這時 `view.ev.kind` 是 `show`／`hide`，實際動作要從 `view.ev.step` 找。退場淡出的過程中 `view.state` 仍是退場前的狀態，完成後才清空 `temp`。
- **props 錯誤**：`init` 丟錯時，訊息會帶演員代號。
- **已知限制（虛擬滑鼠）**：每段移動固定 550ms、inOutCubic；最後一個 move 一律畫成點擊；動作結束滑鼠就消失（`drag` 與 `drop` 之間看不到滑鼠）；`clickAt` 尚未使用。之後讓 `moves` 可帶 `ms`、`ease` 與「按住拖曳」。
- **與舊介面相容**：沒有 `init` 的演員照舊收到 `events`（2A.1），可以逐步改寫。`claude-desktop` 現在在 `render` 裡自己重播事件（例如 `choose` 去找最後一個待選的 `ask`），改寫後這段邏輯移到 `apply`。
- **之後的擴充：共用檔案系統**。舞台可以提供一份共用的狀態（虛擬檔案系統），讓 Claude 的 `Write`、`Bash rm` 和所有 Finder 讀寫同一份，腳本不必在兩個演員各寫一次。等 `init`／`apply` 穩定後再做。

### 2A.6 互動教學場景（試做）

頁面 `/studio/interactive`（`web/src/studio/interactive/`）：整個視窗都是舞台，播放條是浮動的膠囊（`mountShell` 的 `layout: "capsule"`），右側在「步驟」與「互動」之間切換。

互動點寫在 `checkpoint` 步驟上，舞台只把它當一般的練習點：

```json
{
  "checkpoint": "客人甲明天就要蛋糕，你怎麼回？", "body": "…", "id": "cake",
  "options": [{ "label": "選項文字", "steps": [{ "reply": "…" }, { "say": "…", "mood": "happy" }] }],
  "free": { "placeholder": "自己打一句回覆", "steps": [{ "reply": "{{text}}" }, { "say": "…" }] }
}
```

其他欄位：`skip: { label, steps }` 把略過改成看示範；`requires: "<id>"` 表示要先回答前面的互動點才會出現（例如先下指令才有確認提示），收回前面的回答時後面的一起收回。第二個場景 `/studio/interactive/l0-claude` 用這些欄位做 L0 第 0 課的「下指令、看懂確認提示、允許或拒絕」。

**把演員推到主畫面**（`/studio/interactive/l0-claude-stage`，同一份腳本，頁面加 `interaction="stage"`）：互動點寫了 `stage: { focus: "claude:composer" }` 時，舞台推近目標、其他地方變暗，學員直接操作演員：`stage.choices` 指定固定選項要放在哪裡（例如 `claude:input`，選項就出現在 Claude 的輸入框裡，點了直接送出），選項的 `target` 放可以點的熱區（`ActorPush.tsx`）。控制項用舞台座標疊在舞台上，只在暫停於互動點時存在，不屬於時間軸。右側欄固定放課程章節與步驟，也是重新回答的地方。

**正式課程頁**（序章、第 0、1、2 課，由 `courses/routes.tsx` 的 `INTERACTIVE_LESSONS` 決定）：`prepare` 把互動點加進課程原本的腳本（`l0-intro.ts`、`l0-0.0.ts`、`l0-0.1.ts`、`l0-0.2.ts`），腳本本身不變，首頁的預覽播放器也照舊用它。每個選項最後都要回到原本的演員狀態，後面的演出才接得上。原本的示範寫成互動點的 `skip`，學員沒回答直接播放時就演原本的內容，旁白語音照常；選其他選項時新寫的旁白還沒有語音，只顯示字幕。序章只看不操作，互動點是「選一選、想一想」：沒有要操作的演員，`stage.focus` 放在當時看得到的演員目標上（選項顯示在提問卡裡），選項的回應用章節卡（`card`），不動演員，所以每個選項演完都不用還原狀態；`skip` 的步驟是空的，原本的內容就接在互動點後面。

學員回答後，`scene.ts` 的 `expandAnswers` 把對應的步驟插到互動點後面，重新 `stage.load`：回答就是時間軸的一部分，畫面仍是時間的純函式（第 1 節），拖曳、倒轉、演員狀態都不用另外處理。第 2 課的互動點是響應式設計（`device`）：學員選手機、平板或桌面，瀏覽器演員用 `width` 動作（`phone` 390、`tablet` 768、`desktop` 1280，切換時內插）重新排版，再用 `callout` 說明；說明文字以當時載入的網站版本（`site/v3`）實際的 CSS 為準，選項最後還原成桌面寬度與頁面頂端。`skip` 的步驟是空的，原本步驟 4 的「手機 → 桌面」示範就接在後面。

目前回答只存在頁面上，重新整理就清空；打字的回應是固定台詞，還沒接 AI。

---

## 3. 繪製層 Layer（規劃，尚未實作）

> 第 3–5 節是之後把場景畫法與外觀分開的規劃；目前的畫面都由舞台與演員（2A）畫出，腳本格式以 2A.2 為準。

### 3.1 檔案

```
layers/<name>/
  layer.js       必要,ES module,export default defineLayer({...})
  layer.css      選用,樣式一律加上 .L-<name> 前綴,不得影響外殼與其他層
  schema.json    必要,場景欄位的 JSON Schema(給驗證與 AI 看)
  example.json   必要,至少一個完整場景範例,也用來產生預覽圖
  README.md      選用,手法說明、注意事項
```

### 3.2 介面

```js
export default defineLayer({
  name: "agent-desktop",
  version: "1.0.0",
  packs: { skin: "agent-skin" },        // 需要的素材包種類;腳本可用 scene.skin 指定哪一包

  // 場景的自然長度(毫秒)。腳本的 duration 只能拉長,不能比這短(旁白較長時外殼也會拉長)。
  duration(scene, ctx) { … },

  // 進入場景時呼叫一次:建立 DOM,回傳每格要呼叫的 update。
  mount(root, scene, ctx) {
    root.innerHTML = `…`;
    return {
      update(local, info) { …; return kit.key(…); },   // 必要:畫出 local 時的樣子,回傳影格 key
      destroy() { … },                                   // 選用
    };
  },

  markers(scene, ctx) { return [{ at: 1200, label: "允許執行" }]; },   // 選用:章節/跳轉點
  describe(scene) { return "Claude 桌面版示範:加上 /health"; },       // 選用:分鏡文件用的一句話
});
```

- `local`：場景內的時間（毫秒，從 0 開始）。`info`：`{ dur, rate, theme }`。
- `update` 會被以**任意順序**呼叫（拖曳、倒轉），不能依賴上一次呼叫的結果。可以快取（例如 `kit.setIf`），但快取內容必須只由輸入決定。
- 外殼保證：`mount` 前素材與字型已載入；`root` 已經是 1920×1080；場景淡入淡出由外殼處理。

### 3.3 ctx

| 欄位 | 內容 |
|---|---|
| `ctx.kit` | 繪製工具（第 6 節） |
| `ctx.asset(ref)` | 把 `@pack/key` 轉成可用的網址 |
| `ctx.pack(name)` | 取得素材包內容（`strings`、`data`、`tokens`） |
| `ctx.skin` | 這個場景套用的素材包（`scene.skin` 或預設） |
| `ctx.theme` | `light` / `dark` |
| `ctx.safe` | 保留區 |
| `ctx.lang` | 腳本語言，預設 `zh-Hant` |

### 3.4 schema.json 的寫法（AI 能不能寫對，主要看這份）

- 每個欄位都要有 `description`，寫「這是什麼、單位、建議範圍」，例如 `"cps": {"type":"number","description":"打字速度,每秒字數。中文 10–16,程式碼 25–40","minimum":1,"maximum":120}`。
- 能用 `enum` 就用 `enum`，能給 `default` 就給。
- 時間一律毫秒、整數。
- 一個場景盡量只有一種「步驟陣列」（例如 `steps`），每一步用一個代表類型的鍵開頭：`{ "user": "…" }`、`{ "tool": "Bash", … }`。這種寫法 AI 最穩定。
- 不接受任意 HTML 或 JS 字串；需要強調就用行內標記（`` `程式碼` ``、`**粗體**`、`[[強調色]]`）。

---

## 4. 場景腳本 v2（規劃，尚未實作）

### 4.1 頂層

```json
{
  "version": 2,
  "meta": { "title": "L0 0.2 做出一頁式網站", "lang": "zh-Hant", "course": "L0", "lesson": "0.2" },
  "theme": "light",
  "packs": ["claude-desktop", "bakery"],
  "defaults": { "transition": { "type": "fade", "ms": 280 }, "skin": "claude-desktop" },
  "captions": true,
  "scenes": [ … ]
}
```

| 欄位 | 說明 |
|---|---|
| `version` | 2。沒有這個欄位視為宣傳影片錄製工具（`web/src/studio/recorder/`）的 v1 格式（時間單位是秒） |
| `packs` | 要載入的素材包；場景只能引用這裡列出的包 |
| `defaults` | 每個場景沒寫時使用的共同欄位 |

### 4.2 場景共同欄位

| 欄位 | 說明 |
|---|---|
| `type` | 繪製層名稱（必要） |
| `id` | 場景代號，英數與 `-`，用於章節連結與錯誤訊息 |
| `chapter` | 有寫就成為章節，例如 `"允許 Claude 執行指令"` |
| `narration` | 旁白稿；也是預設字幕 |
| `caption` | 覆寫字幕；`""` 表示這個場景不顯示字幕 |
| `audio` | 旁白音檔（`@pack/key` 或相對路徑）；場景長度至少等於音檔長度 |
| `duration` | 最短長度（毫秒）；比繪製層的自然長度短時以自然長度為準 |
| `transition` | `{ "type": "fade" \| "cut" \| "slide" \| "wipe", "ms": 280 }` |
| `skin` | 這個場景用哪個素材包當外觀 |
| `notes` | 給人看的備註，不影響畫面 |

其餘欄位由各繪製層的 `schema.json` 定義。

### 4.3 範例

```json
{
  "type": "agent-desktop",
  "id": "health-endpoint",
  "chapter": "請 Claude 加一個 API",
  "narration": "我們直接用一句話告訴 Claude 要做什麼，它會先讀程式碼，再提出修改。",
  "skin": "claude-desktop",
  "session": { "title": "加上 /health 端點", "folder": "~/projects/shuttle", "branch": "main" },
  "steps": [
    { "user": "幫我在 API 加一個 /health 端點" },
    { "thinking": true, "ms": 1200 },
    { "tool": "Read", "arg": "server/internal/api/api.go", "result": "86 行" },
    { "edit": "server/internal/api/api.go", "lines": [[42, "+", "mux.HandleFunc(\"GET /health\", …)"]] },
    { "ask": "go test ./...", "select": 1 },
    { "say": "完成了，`GET /health` 會回傳 `{\"status\":\"ok\"}`。" }
  ]
}
```

---

## 5. 素材包 Pack（規劃，尚未實作）

### 5.1 檔案

```
packs/<name>/
  pack.json
  tokens.css     選用:CSS 變數(配色、圓角、字級)
  images/ icons/ fonts/ audio/ data/
```

```json
{
  "name": "claude-desktop",
  "version": "1.0.0",
  "kind": ["agent-skin"],
  "description": "仿 Claude 桌面版 Code 分頁的外觀(近似,非官方素材)",
  "tokens": "tokens.css",
  "strings": { "zh-Hant": { "newSession": "新增 session", "thinking": "思考中", "allowOnce": "允許一次" } },
  "images": { "avatar": "images/avatar.svg" },
  "icons": "icons/sprite.svg",
  "fonts": [{ "family": "Inter", "src": "fonts/Inter.woff2", "weight": "400 700" }],
  "data": { "sessions": "data/sessions.json" },
  "license": { "source": "自製", "terms": "課程內使用" }
}
```

### 5.2 規則

- 腳本與繪製層用 `@<pack>/<key>` 引用素材，例如 `@bakery/logo`；`key` 對應 `images`、`audio`、`data` 等欄位的鍵。外殼載入時檢查引用是否存在。
- `tokens.css` 的變數加上種類前綴，例如 `agent-skin` 一律用 `--skin-*`（`--skin-accent`、`--skin-bg`、`--skin-radius`）。同一種類的素材包必須提供同一組變數，才能互相替換。每種類需要哪些變數，由對應繪製層的 README 列出。
- 介面文字放 `strings`，不要寫死在繪製層裡，方便換語言或換產品。
- **模擬其他產品介面的素材包，不得使用該產品的官方 Logo、商標圖像或截圖**；只做近似的版面與配色，並在 `description` 註明「近似，非官方素材」。
- `license` 必填：來源與可用範圍。

### 5.3 建議的素材包種類

| 種類 | 內容 | 例子 |
|---|---|---|
| `brand` | 課程本身的配色、字型、Logo、片頭片尾 | `shuttle-brand` |
| `agent-skin` | AI 工具介面的外觀 | `claude-desktop`、`claude-cli`、`generic-agent` |
| `case` | 貫穿案例的素材：店名、商品圖、假資料 | `bakery`（小森烘焙） |
| `media` | 共用圖示、插圖、音效 | `icons-basic` |

---

## 6. 繪製工具 kit（`kit.ts`）

全部是純函式，已有單元測試（`kit.test.ts`，`npm test` 時由 vitest 執行）。舞台與演員以 `import { kit } from "…/kit"` 使用（有完整型別）。

### 6.1 時間與進度

| 函式 | 用途 |
|---|---|
| `progress(local, start, dur)` | 某段動畫的進度 0–1，最常用 |
| `map(x, inA, inB, outA, outB, ease)` | 把時間對應到數值（位置、透明度…） |
| `ease.*`、`easeOf(name)` | 緩動：`outCubic`（預設出場）、`inOutCubic`（移動、鏡頭）、`outBack`（彈出）、`outElastic`、`steps(n)` 等 |
| `spring(local, {stiffness, damping})` | 彈簧動態，解析解，任意時間點可算 |
| `keyframes([...])(local)` | 多個屬性的關鍵影格內插，非數值欄位到點切換 |
| `sequence(items, durOf, {gap})` | 把步驟陣列排成時間表（`at` 絕對時間、`delay` 相對、`ms` 覆寫長度） |
| `stagger(i, gap)` | 列表逐項出現的開始時間 |

### 6.2 循環小動畫

| 函式 | 用途 |
|---|---|
| `blink(local)` | 游標閃爍 |
| `spin(local, rpm)` | 載入中轉圈角度 |
| `pulse(local, period)` | 呼吸燈、提示脈動 |
| `dots(local)` | 「思考中…」的點點 |
| `shake(local, start)` | 錯誤時左右晃動 |
| `rand(seed)`、`noise(x, seed)` | 固定種子亂數、平滑雜訊（飄動、手持感） |

### 6.3 文字

| 函式 | 用途 |
|---|---|
| `typewriter(text, local, {start, cps})` | 逐字打出，不切壞 emoji／組合字 |
| `typeDuration(text, cps)` | 打完需要多久，給 `duration()` 用 |
| `rich(s)`、`richCut(s, n)` | 行內標記轉 HTML；`richCut` 逐字顯示時不切壞標記 |
| `countUp(from, to, p)` | 數字跳動（千分位、小數、前後綴） |
| `scramble(text, p)` | 亂碼解碼效果 |
| `graphemes(s)`、`esc(s)` | 依「看得到的字」切字、HTML 跳脫 |

### 6.4 出場與強調（回傳 style 物件，用 `css(el, …)` 套用）

| 函式 | 用途 |
|---|---|
| `enter(p, {dir, dist, scale})` | 淡入加位移／縮放 |
| `wipe(p, dir)` | 遮罩揭露 |
| `marker(p, color)` | 螢光筆劃過重點 |
| `underline(p)` | 底線畫出 |
| `spotlight(p, rect)` | 其他地方變暗，只留重點區域 |

### 6.5 線條、鏡頭、捲動

| 函式 | 用途 |
|---|---|
| `drawPath(p, length)` | SVG 線條逐步畫出（流程圖、架構圖） |
| `arrowPath(a, b, bend)`、`arrowBetween(rectA, rectB)` | 兩點或兩個元素之間的曲線箭頭 |
| `rectIn(el, root)` | 元素在舞台上的位置（不受縮放影響） |
| `focus(rect, view, p)` + `cameraStyle()` | 鏡頭從全景推近到某個元素 |
| `stickBottom(viewH, contentH)` | 對話、終端機貼齊底部 |
| `scrollTo(local, start, dur, from, to)` | 平滑捲動 |

### 6.6 操作示範

| 函式 | 用途 |
|---|---|
| `cursor(local, moves)` | 虛擬滑鼠：移動路徑、按下、點擊漣漪 |
| `keycap(local, keys)` | 畫面角落顯示按下的快捷鍵（⌘K、Enter） |

### 6.7 圖表

| 函式 | 用途 |
|---|---|
| `bars(values, p)` | 長條圖逐根長出 |
| `linePoints(values)` + `drawPath` | 折線圖畫出 |

### 6.8 效能與影格 key

| 函式 | 用途 |
|---|---|
| `setIf(el, prop, value)` | 值沒變就不碰 DOM（`html`、`text` 或任一 style 屬性） |
| `css(el, styles)` | 套用上面各函式回傳的 style 物件 |
| `key(...parts)` | 組影格 key，數值自動四捨五入 |

需要新手法時，先確認能寫成「輸入時間，輸出數值或樣式」的純函式，再加進 kit 並補測試；只有一個演員會用的手法留在該演員裡。

---

## 7. 驗證與 AI 製作流程

1. 給 AI：本規格 2A.2（舞台腳本）、2A.4，以及要用的演員 `actor.ts` 開頭的說明（props、動作、目標）。
2. AI 產出腳本 JSON，放進 `web/src/content/live/<等級>/`，在單課資料加上 `live: '<等級>/<檔名>.json'`。
3. 在研發基地頁播放：腳本有錯時 `stage.load` 丟出的錯誤（含第幾步）會直接顯示在播放器上。
4. 拖到各章節檢查畫面（2.6），人工或交給 AI 看圖檢查。
5. 在研發基地頁或課程頁上播放，確認節奏。

---

## 8. 實作進度

| 階段 | 內容 | 狀態 |
|---|---|---|
| 1 | 繪製工具 kit 與測試 | 完成 |
| 2 | 舞台與演員（2A）：`claude-desktop`、`finder`、`browser` 演員，章節卡、聚光燈、鏡頭、滑鼠、練習點 | 完成；`claude-code`（終端機版）演員待做 |
| 2B | 鏡頭規劃 `camera.ts`（提示點 → 關鍵點 → 連續姿態、不閃動、鏡頭到位後演員才開始演）；引擎全部改寫成 TypeScript，演員用 `defineActor` 宣告並受介面約束；開發時改程式整頁重新載入 | 完成 |
| 3 | 外殼 `shell.ts`、課程頁直接掛載（`LivePlayer`，章節對應課程步驟；研發基地頁也用同一個播放器）；登入的會員才記住播放進度（外殼只管何時讀存，存哪裡由外層決定） | 完成，L0 第 0、1、2 課已上線 |
| 3B | 旁白語音（Gemini TTS 分段產生、GCS `shuttle-voice`、外殼同步播放；每段完成就寫入清單、旁白沒改的段落不重新產生） | 完成；L0 第 0、1 課已全部產生，第 2 課已產生前 10 段 |
| 4 | 繪製層、素材包、腳本驗證工具（第 3–5 節） | 待做 |

### 旁白語音

- **產生**：`npm run voice -- l0/0.0-tools.json`（在 `web/` 執行，`--all` 全部、`--max-sec 20` 只產生開頭、`--limit 10` 只產生前 10 段、`--sample "一句" --voices A,B` 試聽）。每段 `narration` 送 Gemini TTS（`gemini-3.8-flash-tts`，聲音 Sulafat），轉成 48 kbps MP3 上傳到 GCS `gs://shuttle-voice/<腳本資料夾>/<雜湊>.mp3`（公開讀取、永久快取）。金鑰放 `web/.env.local` 的 `GEMINI_API_KEY`，只在本機用。
- **清單**：腳本旁的 `<名稱>.voice.json`（進版控）記錄「旁白文字 → { file, ms }」與模型、聲音、語氣。雜湊由模型、聲音、語氣、文字決定；旁白改了一個字就對不到舊音檔，那段會退回只有字幕，直到重新產生。GCS 上的舊檔不自動刪除（正式站部署前仍可能用到）。
- **播放**：課程頁讀腳本與清單；舞台用語音實際長度排時間（`load(script, { voice })`），`narrations` 給出每段開始時間；外殼的 `clips` 依時間軸播放對應音檔（兩個 `<audio>` 輪流，先載入下一段；按播放的當下取得播放權限）。音檔可先抓成 Blob 放在記憶體（往後 3 段，其餘釋放；抓不到就直接用網址；GCS bucket 設好 CORS 後以 `VITE_VOICE_BLOB=1` 開啟，預設關閉），播放中以音檔的 `currentTime` 為主時鐘（`narration.clock()`，不讓時間軸倒退）：音檔卡住時時間軸與字幕一起停，不再做偏差校正的強制 seek；旁白之間的空檔仍由外殼累加。字幕在語音長度內依字數分配。讀不到清單時只顯示字幕。
- **章節音軌**（手機上每句換一次音檔容易斷續，所以把連續的旁白合成一個音檔）：`npm run mix -- l0/0.0-tools.json`（`--all` 全部；加 `--publish` 才上傳）。`scripts/mix.mjs` 起一個 vite、用 Playwright 在 Chrome 裡跑舞台排時間，取得每段旁白的開始時間與練習點，以練習點切章節，每章用 ffmpeg 依時間把旁白接起來、中間補靜音（48 kbps 單聲道 mp3），預設只產生在 `web/recordings/mix/`；`--publish` 上傳到 `gs://shuttle-voice/mix/<腳本>/<章節>-<雜湊>.mp3`，並寫出 `<名稱>.mix.json`（進版控）記錄每章的檔案，以及每句旁白在章節檔裡的位置、當時用的語音檔。**旁白或腳本改了要重新執行**；沒重新執行時播放器發現文字、語音檔或間隔對不上，就自動退回逐句播放，不會錯位。
- **旁白計畫**（`src/live/mixPlan.ts`，純函式）：`narrationClips(narrations, voice, mix)` 把目前時間軸的每句旁白對到章節音軌：時間軸上連續（間隔和章節音軌裡相同）的旁白併成一段範圍（一個 `Clip`，`from` 是音檔裡的起點），對不到的有語音者逐句播放，沒語音的（例如互動分支新寫的旁白）不播、只有字幕。互動課程學員回答後舞台重排時間軸，回到主線的旁白彼此間隔不變，仍是章節音軌裡連續的一段，從該句的位置 seek 一次就接得上；第 0、0.1 課各回答組合都已驗證沒有任何一句需要退回逐句播放。
- **費用**：見研究文章「旁白語音的費用評估」（`/docs/research/voice-cost`）。

### 待決定

- **旁白來源**：目前用 Gemini TTS 產生（見「旁白語音」一節）；是否改成真人錄音，聽過整課後再決定。
- **輸出 mp4**：已有 `web/scripts/record-live.mjs`（`npm run record:live -- promo/0.promo-intro.json [--from 毫秒] [--to 毫秒]`）。它開 `/materials/promo?script=…&record=1`（只顯示 1920×1080 的舞台），以 30 fps 逐格呼叫 `window.__promo.renderAt(ms)` 截圖，用 ffmpeg 合成 1080p mp4；腳本有旁白語音（`*.voice.json`）時依各段旁白的開始時間混成音軌，另輸出 `.srt` 字幕，檔案在 `web/recordings/promo/`。腳本放在 `src/content/live/promo/`，網頁播放在 `/materials/promo`。`web/src/studio/recorder/` 的 `npm run record` 是另一種舊版（v1 分鏡腳本）。

## 直式舞台(原型)

目的:看 9:16 的直式舞台能不能成立,並找出各演員在直式槽裡的問題,作為下一階段「演員依舞台換樣態」的依據。

**做法(時間軸不變、空間可變)**:同一支腳本、旁白、章節音軌都不變;方向是播放時的參數,不寫在腳本裡。

- 畫布:橫式 1920×1080(預設,行為與原本逐像素相同)、直式 1080×1920。`createStage(root, { aspect: 'portrait' })` 或 `stage.load(script, { aspect })`;外殼 `mountShell(box, { aspect: 'portrait', … })`(外框 9:16,縮放用同一組寬高;可搭配 `layout: "capsule"`,互動課程頁就是這樣用)。尺寸與位置換算在 `place.ts`(`stageSize`、`PLACES`、`placeOf`,有單元測試)。
- `place`(與 `move.to`)可以寫成 `{ "landscape": <原本的寫法>, "portrait": <原本的寫法> }`;沒有指定方向的值兩種方向共用,只寫一個方向時另一個方向沿用它。語意名稱在直式自動換算:window = 留邊的滿版(1000×1560)、full = 滿版、left = 上半部、right = 下半部、center = 垂直置中;百分比相對於該方向的畫布。
- 字卡、說明框、聚光燈、滑鼠:`.live-stage.portrait`(stage.css)調整基準字級 `--u`(24px)、字卡寬度與字級、說明框最大寬度;橫式不受影響。字幕在直式可折行(shell.css 的 `.vp-portrait`)。
- 鏡頭(camera.ts):演算法不變,只把「目標下緣的安全線」依舞台寬高決定(`safeBottomOf`:橫式 68%、直式 84%);其餘(倍率上限、不露出空白)本來就用舞台實際寬高。
- 直式互動課程頁:`/courses/tools/intro?aspect=portrait`(第 0、1、2 課同理,`?aspect=` 由 `studio/interactive/portrait.ts` 解析)。視窗 ≤820px 時課程章節與步驟側欄改成底部抽屜(收合 56px 把手、展開 55dvh;播到互動點自動展開並只顯示提問與選項,回答後收合);>820px 維持右側浮動面板、舞台 9:16 置中。工具列有「橫/直」切換鈕(切換時暫停、保留時間與已作答內容)。序章的 `0.intro.json` 已補 `{landscape,portrait}` 位置;第 0、1、2 課還沒補,直式下沿用橫式位置,版面不佳。
- 看直式:`/materials/promo?script=promo/portrait-demo.json&aspect=portrait`;`script` 可以是 `src/content/live/` 底下任何腳本(例如 `l0/0.2-site.json`);`&record=1` 輸出舞台、`npm run record:live -- promo/portrait-demo.json --aspect portrait` 輸出 1080×1920 的 mp4。

**逐演員觀察**(各演員原樣放進直式槽,槽尺寸 1000×1400、1000×700、500×700;演員程式這次沒有改):

| 演員 | 看到的問題 | 建議的直式樣態 |
| --- | --- | --- |
| person | 人物固定畫在槽左上角、尺寸很小,槽再大也只是旁邊多一大片空白;對話泡泡在 500 寬槽內折成兩行還擠著人物 | 依槽放大(半身像撐滿槽寬),泡泡改放人物下方或上方;槽很窄時泡泡在頭像下方 |
| chat | 1000×1400 時訊息全擠在底部、上方一大片空;字級小(手機畫面被拉成平板比例,像寬螢幕);500×700 剛好像手機,表現最好 | 直式槽固定成手機比例(置中、寬度受限),或字級依槽寬放大;訊息區比例跟著槽高 |
| claude-desktop | 為桌面橫向設計:側欄占去約 1/5 寬,對話區變窄、文字再折行;全部是小字(1000 寬下約 8 到 9px 等效),手機上不可讀;1400 高時中間大片空白,輸入框貼底、離內容很遠;500 寬時側欄只剩縮寫 | 直式隱藏側欄、字級放大約 1.6 倍、輸入框與內容靠近;或只演 composer + log 的精簡版 |
| browser | 網頁寬度固定(tablet 768 / desktop 1280)再縮放進槽:寬槽下字清楚、卻整頁高度長得塞不滿;500×700 時被縮到約 0.6,字很小;網址列 500 寬被截斷 | 直式預設用 phone 寬度(390)並撐滿槽高,網址列簡化成只有網域;上下堆疊時內容區 phone 化 |
| editor | 程式碼字級小且行很少,1400 高時下半部全空;500 寬時右側程式碼被切掉(沒有折行,也沒有橫向捲動)、檔案清單占掉約 1/5 寬 | 直式隱藏檔案清單、字級放大、長行折行;槽高很大時行距加大或只顯示最近 N 行 |
| finder | 列表視窗寬度鋪滿,但每列只有一個小圖示和短檔名,內容只占頂端幾列,其餘白色空白;字小 | 直式改圖示格狀(icon view)或放大列高與字級;高度依內容自動縮短(h 不寫) |
| notes | 便條位置是固定的(em 為單位、左右交錯、往下排),桌面超大時便條集中在上方、下面大片空;1000 寬時便條只占中間;文字在 500 寬時折行 | 便條散布依槽尺寸縮放、置中排列,桌面尺寸跟內容走 |
| macbook | 依 1240:1120 等比例縮放,置中、不會被切掉,但橫向的筆電在直式槽上下留白很多(1000×1400 時上下各約 400px 空);500 寬時很小 | 直式可 `tilt`(俯視角大)或直接用 `screen` 推近,或加直立擺放(螢幕為主、鍵盤在下半部);槽高不要設太大 |

沒有任何演員完全不能用(都沒有崩壞或消失),主要問題是「版面是橫式的比例,直式槽下留白多、字相對太小」與「窄槽(500)被切掉或折行」。字小的問題與基準字級 `--u` 無關(演員多用自己的 px 字級),要在演員內依槽寬換算。

**橫式與直式的差別提醒**:語意名稱 `right`(橫式 h 依內容)在直式換成固定高度的下半部,依內容高度的演員(finder、person)在 `right` 直式下不再是內容高。
