param(
  [string]$RunDate = $(Get-Date -Format 'yyyy-MM-dd'),
  [int]$Port = 4306
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$frontendDir = Join-Path $projectRoot 'frontend'
$runtimeLogDir = Join-Path $projectRoot 'runtime-logs'
$playwrightBin = Join-Path $frontendDir 'node_modules\.bin\playwright.cmd'
$videoPath = Join-Path $projectRoot ("..\frontend-ui-evidence\{0}\videos\UI_KeToan_Full_Workflow_VI_{1}.mp4" -f $RunDate, ($RunDate -replace '-', ''))
$frontendLogPath = Join-Path $runtimeLogDir ("accounting-demo-frontend-{0}.log" -f ($RunDate -replace '-', ''))

New-Item -ItemType Directory -Force -Path $runtimeLogDir | Out-Null

function Wait-ForPort {
  param(
    [string]$ComputerName,
    [int]$Port,
    [int]$Attempts = 90,
    [int]$SleepSeconds = 2
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    $client = $null
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $async = $client.BeginConnect($ComputerName, $Port, $null, $null)
      if ($async.AsyncWaitHandle.WaitOne(1000, $false) -and $client.Connected) {
        $client.EndConnect($async) | Out-Null
        $client.Dispose()
        return $true
      }
    }
    catch {
      # ignore transient connection failures while booting
    }
    finally {
      if ($client) {
        $client.Dispose()
      }
    }
    Start-Sleep -Seconds $SleepSeconds
  }

  return $false
}

function Wait-ForHttpReady {
  param(
    [string]$Url,
    [int]$Attempts = 90,
    [int]$SleepSeconds = 2
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    }
    catch {
      # ignore while frontend is still compiling
    }
    Start-Sleep -Seconds $SleepSeconds
  }

  return $false
}

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  throw "Port $Port is already in use. Choose another port before running render-accounting-showcase.ps1."
}

$frontendCommand = "cd /d `"$frontendDir`" && set BROWSER=none && npm run start -- --host 127.0.0.1 --port $Port > `"$frontendLogPath`" 2>&1"

$frontendProcess = Start-Process `
  -FilePath 'cmd.exe' `
  -ArgumentList '/d', '/s', '/c', $frontendCommand `
  -PassThru `
  -WindowStyle Hidden

$frontendPushed = $false

try {
  if (-not (Wait-ForPort -ComputerName '127.0.0.1' -Port $Port)) {
    throw "Frontend dev server did not open port $Port. Check log: $frontendLogPath"
  }

  if (-not (Wait-ForHttpReady -Url ("http://127.0.0.1:{0}" -f $Port))) {
    throw "Frontend dev server did not respond in time. Check log: $frontendLogPath"
  }

  Push-Location $frontendDir
  $frontendPushed = $true

  $env:UI_EVIDENCE_DATE = $RunDate
  $env:PLAYWRIGHT_DISABLE_WEB_SERVER = '1'
  $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:$Port"
  $env:E2E_BASE_URL = "http://127.0.0.1:$Port"

  & $playwrightBin test -c playwright.config.ts e2e/accounting-master-workflow.spec.ts --grep "Accounting full workflow video"
  if ($LASTEXITCODE -ne 0) {
    throw "Playwright accounting demo recording failed with exit code $LASTEXITCODE."
  }

  & node scripts/render-accounting-demo-mp4.mjs --run-date $RunDate
  if ($LASTEXITCODE -ne 0) {
    throw "MP4 render failed with exit code $LASTEXITCODE."
  }

  Write-Host "Accounting showcase video ready: $videoPath"
}
finally {
  if ($frontendPushed) {
    Pop-Location
  }

  if ($frontendProcess -and -not $frontendProcess.HasExited) {
    Stop-Process -Id $frontendProcess.Id -Force
  }
}
