# art:場景共用的幾何與效果

從 `actors/agent-office` 抽出來的繪圖與視覺效果,給 `agent-office`、`manual-office` 等公開演員(以及研發基地場景)匯入。放在 `src/live/art`,是公開程式碼,不可 import `src/studio`。

## 座標與尺寸慣例

- 全部是 **1920×1080 舞台的 px**,座標原點在左上角;SVG 一律 `viewBox="0 0 1920 1080"` 疊在同尺寸的圖層上。
- 圖層(`position:absolute; width:1920px; height:1080px; transform-origin:0 0`)用 `fx/camera` 做視差推軌,深度 0 = 遠景、1 = 主體、>1 = 前景。
- SVG 的 id / class 都以 `<prefix>-` 開頭(預設 `ao`);兩個場景同頁時傳不同的 `prefix`,避免 `url(#…)` 的 id 撞名。共用的 DOM/CSS 類別用 `art-` 開頭,位置與大小由場景自己的 class 決定。
- 預設值等於 agent-office 的版面;別的場景用 options 傳自己的座標(例如 `deskSvg({ deskY, kb })`),場景專屬的座標放在場景自己的 `layout.ts`。

## SPEC 第 1 節(一定要守)

- 所有東西都是**時間的純函式**:render 每格依 `ms` 算出樣式再寫進 DOM,**不用 CSS animation / transition**。
- 亂數一律用固定種子的 `kit.rand(seed)`、雜訊用 `kit.noise`,**不用 `Math.random`**;同一個時間畫出來一定一樣。
- 只在值改變時才寫屬性(`kit.setIf` / `dom.attr`)。

## 檔案

| 檔案 | 匯出 | 用法 |
| --- | --- | --- |
| `geometry.ts` | `Pt`、`Quad`、`onQuad`、`solveArm`、`capsule`、`capsuleShine` | `onQuad(quad, u, v)` 四邊形上的透視位置;`solveArm(肩, 目標, 上臂, 前臂)` 兩節 IK |
| `office.ts` | `roomSvg`、`raysSvg`、`deskSvg`、`foreSvg`、`bokehDots`、`onKeyboard`、`DEFAULT_KB`、`DEFAULT_DESK_Y` | `` `${deskSvg({ deskY: 772, kb })}` `` 傳 SVG 字串進圖層;`onKeyboard(u, v, kb?)` |
| `characters.ts` | `robotSvg`、`manSvg`、`drawRobotArm`、`BotLayout`、`DEFAULT_BOT` | `robotSvg({ bot, deskY })`;每格 `drawRobotArm(parts, fingers, 肩, 目標, 長度, 半徑, 縮放, typing, ms, seed)` |
| `dom.ts` | `attr`、`fx` | `attr(el, 'd', s)` 只在改變時寫;`fx(n, 2)` 固定小數位 |
| `fx/hologram.ts` + `.css` | `holoIn`、`holoStyle`、`renderHolo` | 元素 `class="art-holo my-pos"`,每格 `renderHolo(el, p, seed, 'translate(0,0)')`(由上展開、閃爍) |
| `fx/codeStream.ts` + `.css` | `streamed`、`totalChars`、`highlight`、`codeHtml`、`codeHoloMarkup` | `el.innerHTML = codeHtml(streamed(LINES, n), { lang: 'html', tail: 8, caret })`;容器要有 `art-code` |
| `fx/permission.ts` + `.css` | `askMarkup`、`mountAsk`、`renderAsk` | `<div class="art-holo art-ask my-pos">${askMarkup()}</div>`,每格 `renderAsk(mountAsk(el), vis, seed, view)` |
| `fx/progress.ts` + `.css` | `progressMarkup`、`mountProgress`、`renderProgress` | 全息面板內放 `progressMarkup(lines, '標題')`,每格 `renderProgress(h, { prog, title, ok, rows })` |
| `fx/ambient.ts` + `.css` | `makeDust`、`dustMarkup`、`renderDust`、`bokehMarkup`、`renderBokeh`、`renderRays` | 灰塵、散景、窗光呼吸;都吃 `ms` |
| `fx/finish.ts` + `.css` | `finishMarkup`、`renderGrain`、`grainOffset` | 根元素最後放 `finishMarkup()`(調色、暗角、顆粒),每格 `renderGrain(el, ms)` |
| `fx/camera.ts` | `Cam`、`WIDE_CAM`、`lerpCam`、`handheld`、`closeness`、`layerTransform` | `layerTransform(lerpCam(a, b, p), depth, handheld(ms))` 設給每一層的 `transform` |
| `manRig.ts` | `manArmsSvg`、`mountManArm`、`drawManArm`、`ManPose`、`STAND_POSE`、`poseMap`、`poseCss`、`MAN_SHOULDER` | 人坐下/站起來:wrapper 套 `poseCss(pose)`(支點 `POSE_ORIGIN`),手臂另畫在桌上一層,肩膀用 `poseMap(pose, MAN_SHOULDER.near)`,手腕 IK 伸到鍵盤/頭旁邊 |
| `robotRig.ts` | `mountBotRig`、`renderBotRig`、`mountBotArms`、`renderBotArms`、`mixLook`、`botBlink` | 機器人的頭、臉罩、眼睛、耳燈、手臂每格操控(公式同 agent-office;`glow`/`earMul`/`core` 可做關機→開機) |
| `fx/clock.ts` + `.css` | `clockMarkup`、`mountClock`、`renderClock`、`nightOf`、`dayOf`、`todOf` | 牆上時鐘 + 「第 N 天」日曆;`hours`(經過幾小時)決定指針、天數與 `nightOf`(天色 0–1) |
| `fx/editor.ts` + `.css` | `editorHtml`、`scribbleCircle`、`rowTop`、`ROW_H` | 編輯器每行(行號、上色、游標、掃描亮條 `hot`、改完閃一下 `flash`)與手繪紅圈(path,用 pathLength=1 的 dashoffset 畫出來);容器 `art-code art-ed` |

## 範例(最小的場景骨架)

```ts
import { deskSvg } from '../../art/office'
import { finishMarkup, renderGrain } from '../../art/fx/finish'
import { renderHolo } from '../../art/fx/hologram'

root.innerHTML = `<div class="my-L">${deskSvg({ prefix: 'my' })}</div><div class="art-holo my-panel">…</div>${finishMarkup()}`
// render(ms):
renderHolo(panel, kit.progress(ms, 500, 600), 11, 'translate(0, 0)')
renderGrain(root.querySelector('.art-grain')!, ms)
```

## 測試

`art.test.ts`:預設 SVG 字串的指紋(確保抽出前後一樣)、`solveArm` 的長度不變量、`onQuad` 四角對應、各效果的純函式。
