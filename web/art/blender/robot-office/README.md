# robot-office（Blender 純腳本實驗）

用 Python（bpy）從基本幾何建出「白色機器人在辦公室打字＋全息程式碼面板」場景，並無頭渲染。

## 需求
- Blender 4.5 LTS（路徑例：`C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`），腳本只用 Blender 內建的 numpy。

## 執行
```
blender -b --python build_scene.py -- --engine cycles --preset preview --cam main --out r1
blender -b --python build_scene.py -- --engine cycles --preset final --cam close --samples 256 --out final_close
```
參數：`--engine cycles|eevee`、`--preset preview|final`、`--cam main|close`、`--device cpu|hip`、`--samples N`、`--out 檔名`。
預設值與相機位置在 `build_scene.py` 檔頭。輸出（PNG 與 .blend）寫到 `renders/`，該資料夾已 gitignore。

## 備註
- Cycles CPU（含 OpenImageDenoise）品質與速度最佳；HIP（AMD 內顯）在此機器較慢，EEVEE 較暗、全域光較弱。
- 全息文字用 Blender 文字物件，不需外部字型。
