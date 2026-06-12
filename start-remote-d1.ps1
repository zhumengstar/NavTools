$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Starting NavTools with remote Cloudflare D1..."
Write-Host "Frontend: http://127.0.0.1:5173"
Write-Host "Worker API: http://127.0.0.1:8787"
Write-Host ""
Write-Host "This uses wrangler.remote.jsonc, where DB and KV bindings have remote=true."
Write-Host "Wrangler must be logged in or configured with a valid CLOUDFLARE_API_TOKEN."
Write-Host "Wrangler is started with an undici proxy shim so it can use the local proxy for workers.dev."
Write-Host ""

$frontendLog = Join-Path $root "navtools-dev.log"
$workerLog = Join-Path $root "navtools-worker.log"
Remove-Item -LiteralPath $frontendLog, $workerLog -ErrorAction SilentlyContinue

Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Get-NetTCPConnection -State Listen -LocalPort 8787 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev -- --host 127.0.0.1 > navtools-dev.log 2>&1" `
    -WorkingDirectory $root `
    -WindowStyle Hidden

Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev:api:remote > navtools-worker.log 2>&1" `
    -WorkingDirectory $root `
    -WindowStyle Hidden

Start-Sleep -Seconds 8

Write-Host "Listening ports:"
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in 5173, 8787 } |
    Select-Object LocalAddress, LocalPort, OwningProcess |
    Format-Table

Write-Host ""
Write-Host "Worker log tail:"
Get-Content -Path $workerLog -ErrorAction SilentlyContinue | Select-Object -Last 40
