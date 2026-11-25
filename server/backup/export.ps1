# 把正式資料庫的 lesson_files / studio_files 備份到 gs://evoleap-backup(唯讀讀資料庫,只寫 GCS 與本目錄的對照表)。
# 用法(在 server/ 底下):powershell -File backup/export.ps1 -Cli $env:TEMP\evoleap.exe
# 前提:evoleap 已用管理員登入(evoleap login),且線上伺服器已部署 GET /api/admin/script-export;gcloud 已登入。
param(
  [Parameter(Mandatory)] [string]$Cli,
  [string]$Bucket = 'gs://evoleap-backup',
  [string]$Project = 'shuttle-045094509',  # 一律明確帶專案,不用 gcloud 預設值
  [string]$Prefix = '',                    # 物件前綴(例如 '_test/20260101/');空 = 正式備份。manifest/ 也跟著前綴走
  [string]$ManifestPath = (Join-Path $PSScriptRoot 'gcs-manifest.json'),   # 對照表輸出位置
  [string]$Api = ''                        # 傳給 evoleap 的 -api(空 = CLI 預設的正式站);測試用本機後端
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$work = Join-Path ([IO.Path]::GetTempPath()) ("evoleap-backup-" + [guid]::NewGuid().ToString('N'))
$apiArgs = @(); if ($Api) { $apiArgs = @('-api', $Api) }
& $Cli @apiArgs backup export -out $work | Out-Host
if ($LASTEXITCODE) { throw 'backup export 失敗' }
$index = (Get-Content (Join-Path $work 'index.json') -Raw -Encoding UTF8 | ConvertFrom-Json).files

# gcloud 的進度與錯誤訊息走 stderr;Windows PowerShell 5.1 在 Stop 模式下會把 stderr 當成終止錯誤,
# 所以呼叫 gcloud 時改成 Continue,成敗只看結束碼。stdout 當輸出回傳,stderr 丟掉。
function Invoke-Gcloud {
  $ErrorActionPreference = 'Continue'
  & gcloud @args 2>$null
}

function Get-Remote {  # 物件路徑 -> @{md5; generation}(前綴下還沒有任何物件時 gcloud 會回錯,視為空)
  $map = @{}
  $json = (Invoke-Gcloud storage ls --json -r --project=$Project "$Bucket/${Prefix}scripts/") -join "`n"
  if ($LASTEXITCODE -ne 0 -or -not $json) { return $map }
  foreach ($o in ($json | ConvertFrom-Json)) {
    if ($o.type -ne 'cloud_object') { continue }
    $map[$o.metadata.name] = @{ md5 = $o.metadata.md5Hash; generation = [string]$o.metadata.generation }
  }
  return $map
}

$old = @{}
$manifestPath = $ManifestPath
if (Test-Path $manifestPath) {
  foreach ($f in (Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json).files) { $old[$f.object] = $f }
}
$remote = Get-Remote
$now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$md5 = [Security.Cryptography.MD5]::Create()
$uploaded = 0
# gcloud 啟動很慢(每次呼叫要幾十秒),所以不逐檔上傳:內容有變的檔先複製到暫存目錄(同樣的 lesson/、studio/ 結構),
# 每個來源一次 gcloud storage cp -r 傳完。內容沒變的不進暫存、不重傳,bucket 不會多出新版本。
$stage = Join-Path $work '_stage'
$changed = @{}
foreach ($f in $index) {
  $obj = "${Prefix}scripts/$($f.source)/$($f.path)"
  $local = Join-Path $work (Join-Path $f.source ($f.path -replace '/', '\'))
  $localMd5 = [Convert]::ToBase64String($md5.ComputeHash([IO.File]::ReadAllBytes($local)))
  if (-not $remote.ContainsKey($obj) -or $remote[$obj].md5 -ne $localMd5) {
    $dst = Join-Path $stage (Join-Path $f.source ($f.path -replace '/', '\'))
    New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
    Copy-Item $local $dst
    $changed[$obj] = $true
    $uploaded++
    $f | Add-Member -NotePropertyName exportedAt -NotePropertyValue $now
  } elseif ($old.ContainsKey($obj) -and $old[$obj].sha256 -eq $f.sha256) {
    $f | Add-Member -NotePropertyName exportedAt -NotePropertyValue $old[$obj].exportedAt
  } else {
    $f | Add-Member -NotePropertyName exportedAt -NotePropertyValue $now
  }
}
foreach ($src in 'lesson', 'studio') {
  $dir = Join-Path $stage $src
  if (-not (Test-Path $dir)) { continue }
  Invoke-Gcloud storage cp -r --project=$Project --content-type='application/json; charset=utf-8' $dir "$Bucket/${Prefix}scripts/" | Out-Null
  if ($LASTEXITCODE) { throw "上傳失敗 scripts/$src" }
}
$remote = Get-Remote
$files = foreach ($f in ($index | Sort-Object { $_.source }, { $_.path })) {
  $obj = "${Prefix}scripts/$($f.source)/$($f.path)"
  [ordered]@{
    source = $f.source; path = $f.path; course = $(if ($f.source -eq 'studio') { 'studio' } else { $f.courseId });
    lesson = $(if ($f.source -eq 'studio') { $null } else { $f.lessonId }); bytes = $f.bytes; sha256 = $f.sha256;
    object = $obj; generation = $remote[$obj].generation; exportedAt = $f.exportedAt
  }
}
$doc = [ordered]@{ bucket = $Bucket; files = @($files) }
$text = ($doc | ConvertTo-Json -Depth 6) -replace "`r`n", "`n"
[IO.File]::WriteAllText($manifestPath, $text + "`n", $utf8)

# GCS 上的 manifest:帶時間戳的一份 + latest.json(含 exportedAt,所以每次執行都會各多一個版本)
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$bucketDoc = [ordered]@{ exportedAt = $now; bucket = $Bucket; files = @($files) }
$tmp = Join-Path $work 'manifest.json'
[IO.File]::WriteAllText($tmp, (($bucketDoc | ConvertTo-Json -Depth 6) -replace "`r`n", "`n") + "`n", $utf8)
foreach ($dst in "${Prefix}manifest/$stamp.json", "${Prefix}manifest/latest.json") {
  Invoke-Gcloud storage cp --project=$Project --content-type='application/json; charset=utf-8' $tmp "$Bucket/$dst" | Out-Null
  if ($LASTEXITCODE) { throw "上傳失敗 $dst" }
}
Remove-Item $work -Recurse -Force
"完成:$($index.Count) 個檔,本次上傳 $uploaded 個。對照表 $manifestPath"
