$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 43117
$url = "http://127.0.0.1:$port"
$buildIdPath = Join-Path $projectRoot ".next\\BUILD_ID"
$buildStampPath = Join-Path $projectRoot "shiftai-active-build.txt"
$logPath = Join-Path $projectRoot "shiftai-launch.log"

function Test-ShiftAiReady {
  param([string]$TargetUrl)

  try {
    $response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match "ShiftAI"
  } catch {
    return $false
  }
}

function Get-CurrentBuildId {
  if (-not (Test-Path $buildIdPath)) {
    return ""
  }

  return (Get-Content $buildIdPath -Raw).Trim()
}

function Test-BuildNeeded {
  if (-not (Test-Path $buildIdPath)) {
    return $true
  }

  $buildTime = (Get-Item $buildIdPath).LastWriteTimeUtc
  $pathsToCheck = @(
    (Join-Path $projectRoot "src"),
    (Join-Path $projectRoot "public"),
    (Join-Path $projectRoot "package.json"),
    (Join-Path $projectRoot "package-lock.json"),
    (Join-Path $projectRoot "next.config.ts")
  )

  foreach ($path in $pathsToCheck) {
    if (-not (Test-Path $path)) {
      continue
    }

    $item = Get-Item $path
    if ($item.PSIsContainer) {
      $latestChild = Get-ChildItem $path -Recurse -File |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

      if ($latestChild -and $latestChild.LastWriteTimeUtc -gt $buildTime) {
        return $true
      }
    } elseif ($item.LastWriteTimeUtc -gt $buildTime) {
      return $true
    }
  }

  return $false
}

function Get-ShiftAiProcess {
  try {
    $processIds = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {
    return $null
  }

  foreach ($processId in $processIds) {
    try {
      $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
      $commandLine = $process.CommandLine

      if (
        $commandLine -and
        $commandLine -like "*$projectRoot*" -and
        ($commandLine -like "*next* start*" -or $commandLine -like "*npm run start*")
      ) {
        return $process
      }
    } catch {
      continue
    }
  }

  return $null
}

function Stop-ShiftAiProcess {
  param($ProcessRecord)

  if (-not $ProcessRecord) {
    return
  }

  try {
    Stop-Process -Id $ProcessRecord.ProcessId -Force -ErrorAction Stop
    Start-Sleep -Seconds 1
  } catch {
    Write-Warning "Unable to stop previous ShiftAI server process."
  }
}

function Test-ShiftAiProcessOutdated {
  param($ProcessRecord)

  if (-not $ProcessRecord -or -not $ProcessRecord.CreationDate -or -not (Test-Path $buildIdPath)) {
    return $false
  }

  if ($ProcessRecord.CreationDate -is [DateTime]) {
    $processStart = $ProcessRecord.CreationDate.ToUniversalTime()
  } else {
    $processStart = [Management.ManagementDateTimeConverter]::ToDateTime($ProcessRecord.CreationDate).ToUniversalTime()
  }
  $buildTime = (Get-Item $buildIdPath).LastWriteTimeUtc

  return $processStart -lt $buildTime
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Install Node.js first."
}

Push-Location $projectRoot

try {
  if (-not (Test-Path (Join-Path $projectRoot "node_modules"))) {
    npm install
  }

  if (Test-BuildNeeded) {
    npm run build
  }

  $buildId = Get-CurrentBuildId
  $runningProcess = Get-ShiftAiProcess
  $activeBuildId = if (Test-Path $buildStampPath) { (Get-Content $buildStampPath -Raw).Trim() } else { "" }
  $processOutdated = Test-ShiftAiProcessOutdated -ProcessRecord $runningProcess

  if (
    $runningProcess -and
    -not $processOutdated -and
    $activeBuildId -eq $buildId -and
    (Test-ShiftAiReady -TargetUrl $url)
  ) {
    Start-Process $url
    exit 0
  }

  if ($runningProcess) {
    Stop-ShiftAiProcess -ProcessRecord $runningProcess
  }

  $launchCommand = "cd /d `"$projectRoot`" && set PORT=$port&& npm run start > `"$logPath`" 2>&1"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $launchCommand -WindowStyle Minimized | Out-Null

  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-ShiftAiReady -TargetUrl $url) {
      Set-Content -Path $buildStampPath -Value $buildId -NoNewline
      Start-Process $url
      exit 0
    }
  }

  throw "ShiftAI did not start in time. Check shiftai-launch.log."
} finally {
  Pop-Location
}
