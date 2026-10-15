$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskExe = Join-Path $taskRoot 'dist/FlowDrop/FlowDrop.exe'
$taskStorage = Join-Path $taskRoot '.flowdrop/exe-smoke'
New-Item -ItemType Directory -Path $taskStorage -Force | Out-Null
$env:FLOWDROP_STORAGE = $taskStorage
$env:FLOWDROP_ONLINE_CONFIG = Join-Path $taskStorage "online-unconfigured.json"
$taskHelp = & $taskExe --help
if ($LASTEXITCODE -ne 0) { throw 'Executable help failed' }
if (-not ($taskHelp -match '--lan')) { throw 'Packaged executable lacks --lan; stale build' }
$taskInfo = & $taskExe --build-info | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $taskInfo.build -ne 'INTEGRATED-20261016.1') { throw 'Executable build identifier mismatch' }
if ((Get-FileHash -LiteralPath $taskExe -Algorithm SHA256).Hash -ne (Get-Content (Join-Path (Split-Path $taskExe -Parent) 'BUILD_INFO.json') -Raw | ConvertFrom-Json).executable_sha256) { throw 'Executable/manifest hash mismatch' }
& $taskExe --version
if ($LASTEXITCODE -ne 0) { throw 'Executable version failed' }
$taskProcess = Start-Process -FilePath $taskExe -ArgumentList '--bind','127.0.0.1','--port','8766','--no-browser','--shutdown-after','5' -WorkingDirectory $env:TEMP -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskStorage 'stdout.log') -RedirectStandardError (Join-Path $taskStorage 'stderr.log')
try {
    $taskHealth = $null
    for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
        if ($taskProcess.HasExited) { throw 'Executable exited before health check' }
        try { $taskHealth = Invoke-RestMethod 'http://127.0.0.1:8766/api/health' -TimeoutSec 1; break } catch { Start-Sleep -Milliseconds 100 }
    }
    if ($taskHealth.status -ne 'ok') { throw 'Health failed' }
    $taskPage = Invoke-WebRequest 'http://127.0.0.1:8766/' -UseBasicParsing
    if (-not $taskPage.Content.Contains('FlowDrop')) { throw 'Bundled frontend missing' }
    if (-not $taskProcess.WaitForExit(20000)) { throw 'Host failed to stop gracefully' }
    $taskProcess.Refresh()
    if ($taskProcess.ExitCode -ne 0) { throw "Host graceful exit failed: $($taskProcess.ExitCode)" }
    Write-Output 'PASS: Windows executable/version, loopback API, offline compiled frontend and graceful shutdown from outside the source checkout.'
} finally {
    if (-not $taskProcess.HasExited) { Stop-Process -Id $taskProcess.Id }
}
