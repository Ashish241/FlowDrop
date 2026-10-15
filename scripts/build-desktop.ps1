$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (-not (Test-Path 'apps/web/dist-desktop/index.html')) { throw 'Build the frontend first: cd apps/web; npm run build:desktop' }
python -m PyInstaller --noconfirm --clean --name FlowDrop --onedir --add-data 'apps/web/dist-desktop;apps/web/dist' --collect-all zeroconf apps/desktop/launcher.py
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller build failed' }
$taskBuild = python -c 'import json; from services.version import VERSION, BUILD_ID; print(json.dumps({"version": VERSION, "build": BUILD_ID}))' | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Build identifier lookup failed' }
$taskManifest = [ordered]@{
    version = $taskBuild.version
    build = $taskBuild.build
    executable = 'FlowDrop.exe'
    executable_sha256 = (Get-FileHash -LiteralPath 'dist/FlowDrop/FlowDrop.exe' -Algorithm SHA256).Hash
    frontend_sha256 = (Get-FileHash -LiteralPath 'dist/FlowDrop/_internal/apps/web/dist/index.html' -Algorithm SHA256).Hash
}
$taskManifest | ConvertTo-Json | Set-Content -LiteralPath 'dist/FlowDrop/BUILD_INFO.json' -Encoding utf8
& (Join-Path $PSScriptRoot 'smoke-desktop.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Executable smoke checks failed; ZIP not generated' }
Compress-Archive -Path 'dist/FlowDrop/*' -DestinationPath 'dist/FlowDrop-windows.zip' -Force
