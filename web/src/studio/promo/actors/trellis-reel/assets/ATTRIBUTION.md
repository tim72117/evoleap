# 3D 模型來源與授權

本資料夾內的 `bust.vox128.b64` 與 `bust-render.webp`,是 TRELLIS.2 介紹片(演員 trellis-reel)用來示意的素材,**不是本專案自製**。

| 項目 | 內容 |
| --- | --- |
| 作品 | Marble Bust 01(大理石半身像) |
| 作者 | Rico Cilliers |
| 來源 | https://polyhaven.com/a/marble_bust_01(作者資料:https://api.polyhaven.com/info/marble_bust_01) |
| 授權 | CC0(公眾領域貢獻):商用、改作皆可,不必標示作者 |

CC0 不要求標示,影片仍以小字友善致謝:「模型：Marble Bust 01／Rico Cilliers（Poly Haven，CC0）」(程式常數 `CREDIT`,在 `bust.ts`;畫在開頭、原理各段與收尾)。

## 改作說明

- `bust.vox128.b64`:把原始網格(1k 版 glTF)的表面取樣成 **128 格高**的體素(約 3.2 萬個有東西的格子)。內容:格子位置(差分編碼)、每格的貼圖色(取樣 1k 底色貼圖,量化成 256 色調色盤)、每格的表面法線(256 方向),約 97KB(base64 約 129KB)。已不含三角網格、頂點與貼圖,**無法還原成原始模型**。16 / 32 / 64 格的粗階層在執行時由這份資料合併算出。烘焙頁的程式碼見 `bake-bust.html.txt`(離線一次性,用 three.js 的 GLTFLoader 載入模型;模型檔不在專案內)。
- `bust-render.webp`:影片中「輸入的一張圖」。用同一個模型(含 1k 底色、粗糙度、法線貼圖的 PBR 材質),以 three.js 內建的 RoomEnvironment 環境光加一盞平行光,1024×1024、淡藍灰底色渲染出來的一張圖,約 21KB。產生方式:`bake-bust.html.txt` 的 `?mode=render`(在 `bake` 模式的同一個頁面,多一段渲染程式,輸出 `toBlob('image/webp')`)。
- 影片裡的 3D 畫面是 2D 近似,不是 TRELLIS.2 的實際輸出,畫面一律標「示意」。
