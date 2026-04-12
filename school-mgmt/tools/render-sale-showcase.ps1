param(
  [string]$RunDate = $(Get-Date -Format 'yyyy-MM-dd')
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendDir = Join-Path $projectRoot 'backend'
$frontendDir = Join-Path $projectRoot 'frontend'
$runtimeLogDir = Join-Path $projectRoot 'runtime-logs'
$playwrightBin = Join-Path $frontendDir 'node_modules\.bin\playwright.cmd'
$videoPath = Join-Path $projectRoot ("..\\frontend-ui-evidence\\{0}\\videos\\UI_Sale_Full_Workflow_VI_{1}.mp4" -f $RunDate, ($RunDate -replace '-', ''))
$backendLogPath = Join-Path $runtimeLogDir ("sale-demo-backend-{0}.log" -f ($RunDate -replace '-', ''))
$backendPort = 3000

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

function Wait-ForLogPattern {
  param(
    [string]$LogPath,
    [string]$Pattern,
    [int]$Attempts = 60,
    [int]$SleepSeconds = 2
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      if (Test-Path $LogPath) {
        $content = [System.IO.File]::ReadAllText($LogPath)
        if ($content -match $Pattern) {
          return $true
        }
      }
    }
    catch {
      # ignore until log file is flushed
    }
    Start-Sleep -Seconds $SleepSeconds
  }

  return $false
}

function Wait-ForLogPatterns {
  param(
    [string]$LogPath,
    [string[]]$Patterns,
    [int]$Attempts = 60,
    [int]$SleepSeconds = 2
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      if (Test-Path $LogPath) {
        $content = [System.IO.File]::ReadAllText($LogPath)
        $allMatched = $true
        foreach ($pattern in $Patterns) {
          if ($content -notmatch $pattern) {
            $allMatched = $false
            break
          }
        }
        if ($allMatched) {
          return $true
        }
      }
    }
    catch {
      # ignore until log file is flushed
    }
    Start-Sleep -Seconds $SleepSeconds
  }

  return $false
}

function Wait-ForDemoReady {
  param(
    [string]$BaseUrl,
    [string]$Email,
    [string]$Password,
    [int]$Attempts = 90,
    [int]$SleepSeconds = 2
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      $response = Invoke-WebRequest `
        -Uri ($BaseUrl.TrimEnd('/') + '/auth/login') `
        -Method Post `
        -ContentType 'application/json' `
        -Body (@{
          email = $Email
          password = $Password
        } | ConvertTo-Json) `
        -UseBasicParsing `
        -TimeoutSec 10

      if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 201) {
        return $true
      }
    }
    catch {
      # ignore until seeded demo accounts accept login
    }

    Start-Sleep -Seconds $SleepSeconds
  }

  return $false
}

$backendCommand = "cd /d `"$backendDir`" && set `"NODE_ENV=development`" && set `"REDIS_ENABLED=false`" && set `"DEMO_PASSWORD=Demo123456!`" && set `"PORT=$backendPort`" && npx ts-node scripts/run-demo-memory-server.ts > `"$backendLogPath`" 2>&1"

$backendProcess = Start-Process `
  -FilePath 'cmd.exe' `
  -ArgumentList '/d', '/s', '/c', $backendCommand `
  -PassThru `
  -WindowStyle Hidden

$frontendPushed = $false

try {
  if (-not (Wait-ForPort -ComputerName '127.0.0.1' -Port $backendPort)) {
    throw "Backend demo server did not become ready. Check log: $backendLogPath"
  }

  Start-Sleep -Seconds 35

  Push-Location $frontendDir
  $frontendPushed = $true

  $env:UI_EVIDENCE_DATE = $RunDate
  $env:E2E_SALE_EMAIL = 'sale.demo@school.local'
  $env:E2E_DEMO_PASSWORD = 'Demo123456!'
  $env:E2E_BASE_URL = 'http://localhost:4200'
  $env:E2E_API_BASE_URL = ("http://127.0.0.1:{0}" -f $backendPort)

  & $playwrightBin test -c playwright.config.ts e2e/sale-full-workflow-video.spec.ts
  if ($LASTEXITCODE -ne 0) {
    throw "Playwright sale demo recording failed with exit code $LASTEXITCODE."
  }

  & node scripts/render-sale-demo-mp4.mjs --run-date $RunDate
  if ($LASTEXITCODE -ne 0) {
    throw "MP4 render failed with exit code $LASTEXITCODE."
  }

  Write-Host "Sale showcase video ready: $videoPath"
}
finally {
  if ($frontendPushed) {
    Pop-Location
  }

  if ($backendProcess -and -not $backendProcess.HasExited) {
    Stop-Process -Id $backendProcess.Id -Force
  }
}
