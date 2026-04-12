param(
  [string]$BaseUrl = 'http://localhost:4200',
  [string]$ApiBaseUrl = 'http://localhost:3000',
  [string]$RunDate = (Get-Date -Format 'yyyy-MM-dd'),
  [string]$Root = '',
  [string]$Grep = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
}

$root = $Root
$frontendDir = Join-Path $root 'school-mgmt\frontend'
$videoDir = Join-Path $root ("frontend-ui-evidence\{0}\videos" -f $RunDate)
$ffmpeg = 'C:\Users\PC\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe'
$dateStamp = $RunDate.Replace('-', '')
$targets = @(
  "UI_B01_Auth_AppShell_$dateStamp",
  "UI_B02_Dashboard_Handbook_P1_$dateStamp",
  "UI_B03_Users_Students_Products_$dateStamp",
  "UI_B04_Orders_Trials_P1_$dateStamp",
  "UI_B04_Orders_Trials_P2_$dateStamp",
  "UI_B05_Classes_Sessions_Attendance_P1_$dateStamp"
)

if (-not (Test-Path $ffmpeg)) {
  throw "Khong tim thay ffmpeg tai: $ffmpeg"
}

New-Item -ItemType Directory -Force -Path $videoDir | Out-Null

$env:PLAYWRIGHT_DISABLE_WEB_SERVER = '1'
$env:PLAYWRIGHT_BASE_URL = $BaseUrl
$env:PLAYWRIGHT_API_BASE_URL = $ApiBaseUrl
$env:UI_EVIDENCE_DATE = $RunDate
$env:UI_EVIDENCE_VIDEO_DIR = $videoDir

Push-Location $frontendDir
try {
  if ([string]::IsNullOrWhiteSpace($Grep)) {
    npx playwright test 'e2e/ui-automation-video-pilots.spec.ts'
  }
  else {
    npx playwright test 'e2e/ui-automation-video-pilots.spec.ts' -g $Grep
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Playwright recorder that bai voi ma loi $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

foreach ($name in $targets) {
  $src = Join-Path $videoDir ($name + '.webm')
  $dst = Join-Path $videoDir ($name + '.mp4')

  if (-not (Test-Path $src)) {
    Write-Warning "Bo qua $name vi khong tim thay file webm."
    continue
  }

  if (Test-Path $dst) {
    Remove-Item -LiteralPath $dst -Force
  }

  & $ffmpeg -y -i $src -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart -an $dst
  if ($LASTEXITCODE -ne 0) {
    throw "Convert MP4 that bai cho $name"
  }
}

Write-Host ''
Write-Host 'Da tao xong video pilot frontend UI:'
Get-ChildItem -Path $videoDir -Filter '*.mp4' |
  Sort-Object Name |
  ForEach-Object { Write-Host ("- {0}" -f $_.FullName) }
