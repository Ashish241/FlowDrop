$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskExe = Join-Path $taskRoot 'dist/FlowDrop/FlowDrop.exe'
$taskStorage = Join-Path $taskRoot '.flowdrop/exe-smoke'
New-Item -ItemType Directory -Path $taskStorage -Force | Out-Null
$env:FLOWDROP_STORAGE = $taskStorage
& $taskExe --help
if ($LASTEXITCODE -ne 0) { throw 'Executable help failed' }
$taskProcess = Start-Process -FilePath $taskExe -ArgumentList '--bind','127.0.0.1','--port','8766','--no-browser' -WorkingDirectory $env:TEMP -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskStorage 'stdout.log') -RedirectStandardError (Join-Path $taskStorage 'stderr.log')
try {
    $taskHealth = $null
    for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
        if ($taskProcess.HasExited) { throw 'Executable exited before health check' }
        try { $taskHealth = Invoke-RestMethod 'http://127.0.0.1:8766/api/health' -TimeoutSec 1; break } catch { Start-Sleep -Milliseconds 100 }
    }
    if ($taskHealth.status -ne 'ok') { throw 'Health failed' }
    $taskPage = Invoke-WebRequest 'http://127.0.0.1:8766/' -UseBasicParsing
    if (-not $taskPage.Content.Contains('FlowDrop')) { throw 'Bundled frontend missing' }
    $taskWorker = Invoke-WebRequest 'http://127.0.0.1:8766/stream-sw.js' -UseBasicParsing
    if ($taskWorker.StatusCode -ne 200) { throw 'Bundled download worker missing' }
    Write-Output 'PASS: Windows executable, loopback API, compiled frontend and download worker from outside the source checkout.'
} finally {
    if (-not $taskProcess.HasExited) { Stop-Process -Id $taskProcess.Id }
}
