# desk 演員的材質圖

兩張都是 Poly Haven 的 CC0（公眾領域）材質，可以自由使用、修改、商用，不需要標示作者。這裡還是記下來源，方便查證。

| 檔案 | 作品名稱 | 來源 | 授權 | 處理方式 |
| --- | --- | --- | --- | --- |
| `oak-veneer.webp`（約 80 KB） | Oak Veneer 01 | https://polyhaven.com/a/oak_veneer_01（1K diffuse） | CC0 | 轉 90 度讓木紋變成橫向，轉成 WebP（品質 78） |
| `plaster.webp`（約 20 KB） | White Plaster 02 | https://polyhaven.com/a/white_plaster_02（1K diffuse） | CC0 | 縮成 768px、轉灰階、降低對比，轉成 WebP（品質 70）；在牆上用 multiply 疊加 |

授權說明：https://polyhaven.com/license

貼法見 `../actor.css`（木桌的 `.dk-wood` 用 rotateX 壓成透視，牆的 `.dk-wall::before` 平鋪）。兩層都是靜態的，不會動。
