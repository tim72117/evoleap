# 宣傳影片錄製工具

用 JSON 分鏡腳本產生畫面，並錄成 1080p 影片。不是即時螢幕錄製：每個影格都向播放器要「時間 t 的畫面」再截圖，所以影格數固定等於時長乘 fps，影片不會變速。畫面沒變的影格直接重用，錄製很快。

需求：Node、ffmpeg、Google Chrome。在 `web/` 執行（用 web 的 npm 套件，不需要另外安裝）。錄影時直接以 file:// 開啟 `player/index.html`，不經過網站，也不會被打包進網站（`player.css` 是全域樣式，不能 import 進網站）。

> 課程網站上的即時教學畫面（舞台、演員、播放器外殼）不在這裡，在 `web/src/live/`，規格見 [web/src/live/README.md](../../live/README.md)。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `record.mjs` | 錄製：開啟 `player/index.html`，逐格截圖後交給 ffmpeg 輸出 mp4 與 .srt |
| `player/index.html`、`player.js`、`player.css` | 錄製用的播放器：依腳本畫出各場景（下方「腳本格式」） |

## 用法

腳本建議放在這個資料夾的 `scripts/<名稱>.json`（`code` 場景的 `file`、`image` 場景的 `src` 相對於腳本所在的資料夾）。以下指令都在 `web/` 執行：

```
npm run record -- src/studio/recorder/scripts/<名稱>.json --stills            # 每個場景一張畫面 → recordings/<名稱>-stills/
npm run record -- src/studio/recorder/scripts/<名稱>.json --stills --guides   # 疊出右上角 logo 與底部字幕預留區，檢查有沒有被擋住
npm run record -- src/studio/recorder/scripts/<名稱>.json --doc               # 產生分鏡腳本文件（腳本旁邊的 <名稱>.storyboard.md）
npm run record -- src/studio/recorder/scripts/<名稱>.json --audio-dir=voice   # 錄製成片，混入旁白錄音
npm run record -- --help                                                      # 所有選項（--tts、--captions、--scene、--fps、--out…）
```

成片輸出 `web/recordings/<名稱>.mp4` 與 `.srt`（字幕；`recordings/` 不進版控）。預設不把字幕燒進畫面（`--captions` 可燒）。

旁白錄音：照分鏡腳本每個場景錄一段，存成 `voice/01.wav`、`02.wav`…（格式不限，ffmpeg 讀得到即可），再用 `--audio-dir=voice`，場景會自動撐到錄音長度。`--tts` 用系統語音，只適合試聽節奏。

## 腳本格式

`scenes` 陣列，每個場景一個物件。共同欄位：`narration`（旁白稿）、`caption`（覆蓋字幕）、`duration`（最短秒數，旁白較長時會自動延長）。

| type | 用途 | 主要欄位 |
| --- | --- | --- |
| title | 標題卡 | eyebrow, text, sub |
| bullets | 條列，逐項出現 | title, items, step |
| code | 程式碼逐字輸入並高亮 | code 或 file, lang, filename, cps, highlight |
| terminal | 終端機指令與輸出 | items: [{cmd, out}] |
| chat | 提問、步驟、圖表、回答的示範動畫 | question, steps, answer, chart |
| image | 圖片 | src |
| web | 驅動真實網頁錄影 | url, actions: click／fill／hover／press／scroll／eval |

文字中 `[[...]]` 表示強調色。頂層可設 `theme`（light／dark）、`captions`、`limitsSec`（建議長度範圍，秒；`--doc` 會檢查）、`notes`。
