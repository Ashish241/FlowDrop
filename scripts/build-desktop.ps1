$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (-not (Test-Path 'apps/web/dist/index.html')) { throw 'Build the frontend first: cd apps/web; npm run build' }
python -m PyInstaller --noconfirm --clean --name FlowDrop --onedir --add-data 'apps/web/dist;apps/web/dist' --collect-all zeroconf apps/desktop/launcher.py
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller build failed' }
& (Join-Path $PSScriptRoot 'smoke-desktop.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Executable smoke checks failed; ZIP not generated' }
Compress-Archive -Path 'dist/FlowDrop/*' -DestinationPath 'dist/FlowDrop-windows.zip' -Force
