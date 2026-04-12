param(
  [ValidateSet('pilot', 'extended', 'remaining', 'showcase', 'finance', 'order-side-effects', 'all-core', 'all')]
  [string]$Suite = 'all-core',
  [string[]]$Specs = @(),
  [string]$BaseUrl = 'http://localhost:4200',
  [string]$ApiBaseUrl = 'http://localhost:3000',
  [string]$RunDate = (Get-Date -Format 'yyyy-MM-dd'),
  [string]$Root = '',
  [string]$Grep = '',
  [string]$FfmpegPath = '',
  [switch]$RemoveWebm,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
}

function New-DirectoryIfMissing {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Resolve-FfmpegPath {
  param([string]$ProvidedPath)

  $candidates = New-Object System.Collections.Generic.List[string]

  if (-not [string]::IsNullOrWhiteSpace($ProvidedPath)) {
    $candidates.Add($ProvidedPath) | Out-Null
  }

  if ($env:FFMPEG_PATH) {
    $candidates.Add($env:FFMPEG_PATH) | Out-Null
  }

  $candidates.Add('C:\Users\PC\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe') | Out-Null

  try {
    $cmd = Get-Command ffmpeg.exe -ErrorAction Stop
    if ($cmd -and $cmd.Source) {
      $candidates.Add($cmd.Source) | Out-Null
    }
  }
  catch {
  }

  foreach ($candidate in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  throw 'Khong tim thay ffmpeg. Truyen -FfmpegPath hoac cai ffmpeg vao PATH.'
}

function Get-SuiteSpecs {
  param([string]$Name)

  switch ($Name) {
    'pilot' {
      return @('e2e/ui-automation-video-pilots.spec.ts')
    }
    'extended' {
      return @('e2e/ui-automation-video-extended.spec.ts')
    }
    'remaining' {
      return @('e2e/ui-automation-video-remaining.spec.ts')
    }
    'showcase' {
      return @('e2e/linked-ui-showcase-video.spec.ts')
    }
    'finance' {
      return @('e2e/b07-invoices-wallets-payroll-video.spec.ts')
    }
    'order-side-effects' {
      return @(
        'e2e/order-approval-linked-views-video.spec.ts',
        'e2e/order-approval-blocked-no-counter-receipt-video.spec.ts'
      )
    }
    'all-core' {
      return @(
        'e2e/ui-automation-video-pilots.spec.ts',
        'e2e/ui-automation-video-extended.spec.ts',
        'e2e/ui-automation-video-remaining.spec.ts'
      )
    }
    'all' {
      return @(
        'e2e/ui-automation-video-pilots.spec.ts',
        'e2e/ui-automation-video-extended.spec.ts',
        'e2e/ui-automation-video-remaining.spec.ts',
        'e2e/linked-ui-showcase-video.spec.ts',
        'e2e/b07-invoices-wallets-payroll-video.spec.ts',
        'e2e/order-approval-linked-views-video.spec.ts',
        'e2e/order-approval-blocked-no-counter-receipt-video.spec.ts'
      )
    }
    default {
      throw "Suite khong hop le: $Name"
    }
  }
}

function Convert-ToQuotedArgument {
  param([string]$Value)

  if ($Value -match '\s') {
    return '"' + $Value + '"'
  }

  return $Value
}

$frontendDir = Join-Path $Root 'school-mgmt\frontend'
$evidenceDir = Join-Path $Root ('frontend-ui-evidence\' + $RunDate)
$videoDir = Join-Path $evidenceDir 'videos'
$playwrightCmd = Join-Path $frontendDir 'node_modules\.bin\playwright.cmd'
$dateStamp = $RunDate.Replace('-', '')
$selectedSpecs = @()

if ($Specs -and $Specs.Count -gt 0) {
  $selectedSpecs = @($Specs)
}
else {
  $selectedSpecs = @(Get-SuiteSpecs -Name $Suite)
}

if ($selectedSpecs.Count -eq 0) {
  throw 'Khong co spec nao duoc chon de chay.'
}

$ffmpeg = Resolve-FfmpegPath -ProvidedPath $FfmpegPath

if (-not (Test-Path -LiteralPath $playwrightCmd)) {
  throw ('Khong tim thay Playwright local executable: ' + $playwrightCmd)
}

foreach ($dir in @($evidenceDir, $videoDir, (Join-Path $videoDir 'raw'))) {
  New-DirectoryIfMissing -Path $dir
}

$playwrightArgs = @('test', '-c', 'playwright.config.ts')
$playwrightArgs += $selectedSpecs

if (-not [string]::IsNullOrWhiteSpace($Grep)) {
  $playwrightArgs += @('-g', $Grep)
}

if ($DryRun) {
  Write-Host 'Auto video runner dry-run'
  Write-Host ('- Suite: ' + $Suite)
  Write-Host ('- Frontend dir: ' + $frontendDir)
  Write-Host ('- Video dir: ' + $videoDir)
  Write-Host ('- ffmpeg: ' + $ffmpeg)
  Write-Host '- Specs:'
  foreach ($spec in $selectedSpecs) {
    Write-Host ('  - ' + $spec)
  }
  Write-Host ('- Command: ' + $playwrightCmd + ' ' + (($playwrightArgs | ForEach-Object { Convert-ToQuotedArgument $_ }) -join ' '))
  return
}

$env:PLAYWRIGHT_DISABLE_WEB_SERVER = '1'
$env:PLAYWRIGHT_BASE_URL = $BaseUrl
$env:PLAYWRIGHT_API_BASE_URL = $ApiBaseUrl
$env:UI_EVIDENCE_DATE = $RunDate
$env:UI_EVIDENCE_VIDEO_DIR = $videoDir

Push-Location $frontendDir
$playwrightExitCode = 0
try {
  & $playwrightCmd @playwrightArgs
  $playwrightExitCode = $LASTEXITCODE
}
finally {
  Pop-Location
}

$webmFiles = Get-ChildItem -LiteralPath $videoDir -File -Filter '*.webm' | Sort-Object Name
$convertedFiles = New-Object System.Collections.Generic.List[string]

foreach ($webm in $webmFiles) {
  $mp4Path = [System.IO.Path]::ChangeExtension($webm.FullName, '.mp4')
  $needConvert = $true

  if (Test-Path -LiteralPath $mp4Path) {
    $mp4Info = Get-Item -LiteralPath $mp4Path
    if ($mp4Info.LastWriteTimeUtc -ge $webm.LastWriteTimeUtc) {
      $needConvert = $false
    }
  }

  if (-not $needConvert) {
    continue
  }

  & $ffmpeg -y -i $webm.FullName -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart -an $mp4Path
  if ($LASTEXITCODE -ne 0) {
    throw "Convert MP4 that bai cho $($webm.Name)"
  }

  $convertedFiles.Add($mp4Path) | Out-Null

  if ($RemoveWebm) {
    Remove-Item -LiteralPath $webm.FullName -Force
  }
}

$reportPath = Join-Path $evidenceDir ('AUTO-VIDEO-RUN_' + $dateStamp + '.vi.md')
$reportLines = @()
$reportLines += ('# Auto video run ' + $RunDate)
$reportLines += ''
$reportLines += '## Cau hinh'
$reportLines += ''
$reportLines += ('- Suite: `' + $Suite + '`')
$reportLines += ('- Frontend: `' + $BaseUrl + '`')
$reportLines += ('- Backend API: `' + $ApiBaseUrl + '`')
$reportLines += ('- Video dir: `' + $videoDir + '`')
$reportLines += ('- Playwright exit code: `' + $playwrightExitCode + '`')
$reportLines += ''
$reportLines += '## Specs da chay'
$reportLines += ''
foreach ($spec in $selectedSpecs) {
  $reportLines += ('- `' + $spec + '`')
}
$reportLines += ''
$reportLines += '## MP4 da tao/cap nhat'
$reportLines += ''
if ($convertedFiles.Count -eq 0) {
  $reportLines += '- Khong co file MP4 moi. Kiem tra lai video .webm va spec vua chay.'
}
else {
  foreach ($file in $convertedFiles) {
    $reportLines += ('- `' + $file + '`')
  }
}
$reportLines | Set-Content -Encoding utf8 $reportPath

Write-Host ''
Write-Host 'Da chay xong auto video runner.'
Write-Host ('- Bao cao: ' + $reportPath)
Write-Host ('- Playwright exit code: ' + $playwrightExitCode)
Write-Host '- MP4 da tao/cap nhat:'
if ($convertedFiles.Count -eq 0) {
  Write-Host '  - Khong co file moi.'
}
else {
  foreach ($file in $convertedFiles) {
    Write-Host ('  - ' + $file)
  }
}

if ($playwrightExitCode -ne 0) {
  throw "Playwright that bai voi ma loi $playwrightExitCode"
}
