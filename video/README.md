# 課程影片產生工具

用 JSON 分鏡腳本產生畫面，並錄成 1080p 影片。不是即時螢幕錄製：每個影格都向播放器要「時間 t 的畫面」再截圖，所以影格數固定等於時長乘 fps，影片不會變速。畫面沒變的影格直接重用，錄製很快。

需求：Node、ffmpeg、Google Chrome。第一次執行前在這個資料夾跑 `npm install`。

## 募資影片（目前的腳本）

腳本：`scripts/fundraising.json`，分鏡與旁白稿：`scripts/fundraising.storyboard.md`。

```
node record.mjs scripts/fundraising.json --stills            # 每個場景一張畫面 → out/fundraising-stills/
node record.mjs scripts/fundraising.json --stills --guides   # 疊出 Hahow logo 與字幕預留區，檢查有沒有被擋住
node record.mjs scripts/fundraising.json --doc               # 重新產生分鏡腳本文件
node record.mjs scripts/fundraising.json --audio-dir=voice   # 錄製成片，混入老師本人的錄音
```

成片輸出 `out/fundraising.mp4` 與 `out/fundraising.srt`（字幕，到 Hahow 募資影片頁的 zh-TW 欄位上傳）。

### 旁白一定要老師本人

Hahow 審核標準要求募資影片的口白是老師本人，且聲音不可是機器人聲。`--tts` 只能拿來試聽節奏。
最終版：照分鏡腳本每個場景錄一段，存成 `voice/01.wav`、`02.wav`…（格式不限，ffmpeg 讀得到即可），再用 `--audio-dir=voice`。場景會自動撐到錄音長度。

### Hahow 規格（2026-04 審核標準）

1 到 3 分鐘、16:9、1080p、mp4；必須說明課程目標、教學方式、與同類課程的差異、自我介紹；右上角留 Hahow logo、底部留 CC 字幕位置，重要資訊不可被擋住。本工具預設不把字幕燒進畫面（`--captions` 可燒），畫面已預留這兩個區域。

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

文字中 `[[...]]` 表示強調色。頂層可設 `theme`（light／dark）、`captions`、`limitsSec`、`notes`。
