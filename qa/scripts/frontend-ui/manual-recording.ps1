param(
  [ValidateSet('start', 'stop')]
  [string]$Action,
  [string]$RunDate = (Get-Date -Format 'yyyy-MM-dd'),
  [string]$Root = '',
  [string]$BatchId = '',
  [string]$ShortName = '',
  [string]$FileBaseName = '',
  [string]$FfmpegPath = '',
  [switch]$Force,
  [switch]$DryRun,
  [switch]$Worker,
  [string]$SessionFile = ''
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

function Convert-ToSlug {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ''
  }

  $slug = $Value -replace '[^A-Za-z0-9]+', '_'
  $slug = $slug.Trim('_')

  if ([string]::IsNullOrWhiteSpace($slug)) {
    throw "Khong tao duoc slug hop le tu ShortName: $Value"
  }

  return $slug
}

function Get-SessionPaths {
  param(
    [string]$RunDateValue,
    [string]$RootPath,
    [string]$BaseName
  )

  $evidenceDir = Join-Path $RootPath ('frontend-ui-evidence\' + $RunDateValue)
  $videoDir = Join-Path $evidenceDir 'videos'
  $rawDir = Join-Path $videoDir 'raw'
  $sessionDir = Join-Path $evidenceDir 'manual-sessions'

  return [ordered]@{
    EvidenceDir = $evidenceDir
    VideoDir    = $videoDir
    RawDir      = $rawDir
    SessionDir  = $sessionDir
    SessionFile = Join-Path $sessionDir ($BaseName + '.json')
    StopFile    = Join-Path $sessionDir ($BaseName + '.stop')
    RawFile     = Join-Path $rawDir ($BaseName + '.mkv')
    FinalFile   = Join-Path $videoDir ($BaseName + '.mp4')
  }
}

function Save-SessionState {
  param(
    [string]$Path,
    [hashtable]$State
  )

  $State | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $Path
}

function Load-SessionState {
  param([string]$Path)

  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-FileBaseName {
  param(
    [string]$RunDateValue,
    [string]$Batch,
    [string]$Name,
    [string]$ProvidedBaseName
  )

  if (-not [string]::IsNullOrWhiteSpace($ProvidedBaseName)) {
    return $ProvidedBaseName
  }

  if ([string]::IsNullOrWhiteSpace($Batch) -or [string]::IsNullOrWhiteSpace($Name)) {
    throw 'Can truyen -FileBaseName hoac day du -BatchId va -ShortName.'
  }

  $dateStamp = $RunDateValue.Replace('-', '')
  return ('UI_' + $Batch + '_' + (Convert-ToSlug -Value $Name) + '_' + $dateStamp)
}

function Wait-ForSessionToFinish {
  param(
    [string]$Path,
    [int]$TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (-not (Test-Path -LiteralPath $Path)) {
      Start-Sleep -Seconds 1
      continue
    }

    $state = Load-SessionState -Path $Path
    if ($state.status -in @('completed', 'failed')) {
      return $state
    }

    Start-Sleep -Seconds 1
  }

  throw "Cho qua timeout $TimeoutSeconds giay nhung session van chua dung."
}

if ($Worker) {
  if ([string]::IsNullOrWhiteSpace($SessionFile)) {
    throw 'Worker mode can -SessionFile.'
  }

  $state = Load-SessionState -Path $SessionFile

  foreach ($dir in @($state.evidenceDir, $state.videoDir, $state.rawDir, $state.sessionDir)) {
    New-DirectoryIfMissing -Path $dir
  }

  Remove-Item -LiteralPath $state.stopFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $state.rawFile -Force -ErrorAction SilentlyContinue

  $ffmpegArgs = @(
    '-y',
    '-f', 'gdigrab',
    '-framerate', '30',
    '-draw_mouse', '1',
    '-i', 'desktop',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    $state.rawFile
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $state.ffmpegPath
  $psi.Arguments = (($ffmpegArgs | ForEach-Object {
        if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
      }) -join ' ')
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  $process.Start() | Out-Null

  $mutableState = [ordered]@{}
  foreach ($property in $state.PSObject.Properties) {
    $mutableState[$property.Name] = $property.Value
  }
  $mutableState.status = 'recording'
  $mutableState.ffmpegPid = $process.Id
  $mutableState.recordingStartedAt = (Get-Date).ToString('s')
  Save-SessionState -Path $SessionFile -State $mutableState

  try {
    while (-not $process.HasExited) {
      if (Test-Path -LiteralPath $mutableState.stopFile) {
        $process.StandardInput.WriteLine('q')
        $process.StandardInput.Flush()
        if (-not $process.WaitForExit(30000)) {
          $process.Kill()
          $process.WaitForExit()
        }
        break
      }

      Start-Sleep -Seconds 1
      $process.Refresh()
    }

    if (-not (Test-Path -LiteralPath $mutableState.rawFile)) {
      throw 'Khong tim thay file MKV sau khi dung recorder.'
    }

    & $mutableState.ffmpegPath -y -i $mutableState.rawFile -c copy -movflags +faststart $mutableState.finalFile
    if ($LASTEXITCODE -ne 0) {
      throw 'Remux MKV sang MP4 that bai.'
    }

    $mutableState.status = 'completed'
    $mutableState.recordingEndedAt = (Get-Date).ToString('s')
    Save-SessionState -Path $SessionFile -State $mutableState
  }
  catch {
    $mutableState.status = 'failed'
    $mutableState.error = $_.Exception.Message
    $mutableState.recordingEndedAt = (Get-Date).ToString('s')
    Save-SessionState -Path $SessionFile -State $mutableState
    throw
  }
  finally {
    Remove-Item -LiteralPath $mutableState.stopFile -Force -ErrorAction SilentlyContinue
  }

  return
}

$resolvedBaseName = Get-FileBaseName -RunDateValue $RunDate -Batch $BatchId -Name $ShortName -ProvidedBaseName $FileBaseName
$paths = Get-SessionPaths -RunDateValue $RunDate -RootPath $Root -BaseName $resolvedBaseName
$ffmpeg = Resolve-FfmpegPath -ProvidedPath $FfmpegPath

foreach ($dir in @($paths.EvidenceDir, $paths.VideoDir, $paths.RawDir, $paths.SessionDir)) {
  New-DirectoryIfMissing -Path $dir
}

if ($Action -eq 'start') {
  if (Test-Path -LiteralPath $paths.SessionFile) {
    $existing = Load-SessionState -Path $paths.SessionFile
    if ($existing.status -in @('starting', 'running', 'recording')) {
      if (-not $Force) {
        throw ('Dang co session manual chua dong: ' + $paths.SessionFile + '. Dung -Force de dung session cu roi tao lai.')
      }

      New-Item -ItemType File -Path $paths.StopFile -Force | Out-Null
      try {
        Wait-ForSessionToFinish -Path $paths.SessionFile -TimeoutSeconds 120 | Out-Null
      }
      catch {
        throw ('Khong dung duoc session manual cu truoc khi tao lai: ' + $_.Exception.Message)
      }
    }
  }

  if ($DryRun) {
    Write-Host 'Manual recorder dry-run (start)'
    Write-Host ('- Session: ' + $paths.SessionFile)
    Write-Host ('- MKV tam: ' + $paths.RawFile)
    Write-Host ('- MP4 cuoi: ' + $paths.FinalFile)
    Write-Host ('- ffmpeg: ' + $ffmpeg)
    return
  }

  $state = [ordered]@{
    action       = 'manual-recording'
    status       = 'starting'
    runDate      = $RunDate
    batchId      = $BatchId
    shortName    = $ShortName
    fileBaseName = $resolvedBaseName
    ffmpegPath   = $ffmpeg
    evidenceDir  = $paths.EvidenceDir
    videoDir     = $paths.VideoDir
    rawDir       = $paths.RawDir
    sessionDir   = $paths.SessionDir
    rawFile      = $paths.RawFile
    finalFile    = $paths.FinalFile
    stopFile     = $paths.StopFile
    startedAt    = (Get-Date).ToString('s')
  }
  Save-SessionState -Path $paths.SessionFile -State $state

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'powershell.exe'
  $psi.Arguments = ('-NoProfile -ExecutionPolicy Bypass -File "{0}" -Worker -SessionFile "{1}"' -f $PSCommandPath, $paths.SessionFile)
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $workerProcess = [System.Diagnostics.Process]::Start($psi)
  if (-not $workerProcess) {
    throw 'Khong khoi dong duoc worker ghi hinh manual.'
  }

  $state.workerPid = $workerProcess.Id
  $state.status = 'running'
  Save-SessionState -Path $paths.SessionFile -State $state

  Write-Host 'Da bat dau quay manual.'
  Write-Host ('- Session: ' + $paths.SessionFile)
  Write-Host ('- Dung lenh stop de ket thuc va tao MP4: powershell -ExecutionPolicy Bypass -File ' + $PSCommandPath + ' -Action stop -RunDate ' + $RunDate + ' -FileBaseName ' + $resolvedBaseName)
  return
}

if ($Action -eq 'stop') {
  if (-not (Test-Path -LiteralPath $paths.SessionFile)) {
    throw ('Khong tim thay session manual: ' + $paths.SessionFile)
  }

  if ($DryRun) {
    Write-Host 'Manual recorder dry-run (stop)'
    Write-Host ('- Session: ' + $paths.SessionFile)
    Write-Host ('- Stop file: ' + $paths.StopFile)
    return
  }

  New-Item -ItemType File -Path $paths.StopFile -Force | Out-Null
  $finalState = Wait-ForSessionToFinish -Path $paths.SessionFile

  if ($finalState.status -ne 'completed') {
    throw ('Dung recorder that bai: ' + $finalState.error)
  }

  Write-Host 'Da dung quay manual va tao MP4.'
  Write-Host ('- MP4: ' + $finalState.finalFile)
  Write-Host ('- Session: ' + $paths.SessionFile)
}
