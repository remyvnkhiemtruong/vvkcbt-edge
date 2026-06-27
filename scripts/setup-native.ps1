# VVKCBT — Thiet lap native (khong Docker)
param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
Set-Location $Root

$envExample = Join-Path $Root ".env.example"
$envFile = Join-Path $Root ".env"
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
  Copy-Item $envExample $envFile
  Write-Host "Da tao .env tu .env.example"
}

$lanIp = (
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1
).IPAddress

if (-not $lanIp) { $lanIp = "192.168.1.50" }

Write-Host "IP LAN goi y: $lanIp"

$origins = "http://localhost,http://127.0.0.1,http://$lanIp,http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
$lines = Get-Content $envFile -ErrorAction SilentlyContinue
$out = @()
$seenDeploy = $false
$seenOrigins = $false
$seenLock = $false
$seenLight = $false

foreach ($line in $lines) {
  if ($line -match '^DEPLOY_PROFILE=') { $out += "DEPLOY_PROFILE=native"; $seenDeploy = $true; continue }
  if ($line -match '^EDGE_ORIGINS=') { $out += "EDGE_ORIGINS=$origins"; $seenOrigins = $true; continue }
  if ($line -match '^VITE_EXAM_LOCK_MODE=') { $out += "VITE_EXAM_LOCK_MODE=browser"; $seenLock = $true; continue }
  if ($line -match '^EDGE_LIGHTWEIGHT=') { $out += "EDGE_LIGHTWEIGHT=false"; $seenLight = $true; continue }
  $out += $line
}
if (-not $seenDeploy) { $out += "DEPLOY_PROFILE=native" }
if (-not $seenOrigins) { $out += "EDGE_ORIGINS=$origins" }
if (-not $seenLock) { $out += "VITE_EXAM_LOCK_MODE=browser" }
if (-not $seenLight) { $out += "EDGE_LIGHTWEIGHT=false" }
Set-Content -Path $envFile -Value $out -Encoding UTF8

$infoPath = Join-Path $Root "THONG-TIN-PHONG-THI.txt"
@"
VVKCBT — THPT Vo Van Kiet
=========================
IP may chu (LAN): $lanIp

Thi sinh:  http://$lanIp/student/
Giam thi:  http://$lanIp/proctor/  (hoac http://localhost/proctor/ tren may chu)
Composer:  http://localhost:5176  (may soan de)

Khoi dong may chu:  scripts\start-edge-server.bat
May giam thi 2GB:  scripts\start-proctor-client.bat

Thi sinh (Chrome kiosk): scripts\student-kiosk.bat $lanIp

CHECKLIST NGAY G
----------------
Composer (may soan)          | Edge (may chu)
[ ] Cau hinh ca + lich mon   | [ ] scripts\setup-windows.bat
[ ] Soan de 3 mode           | [ ] npm run build
[ ] Import DS + in phieu     | [ ] Import ZIP (dry-run truoc)
[ ] Xuat ZIP                 | [ ] Mo de dung gio (Lich mon)
                             | [ ] Grid giam sat + kiosk thu

Checklist ky thuat: node scripts/edge-bootstrap.mjs
Runbook: docs\RUNBOOK-NGAY-G.md
"@ | Set-Content -Path $infoPath -Encoding UTF8

Write-Host "Da cap nhat .env va $infoPath"

$desktop = [Environment]::GetFolderPath('Desktop')
$serverBat = Join-Path $Root "scripts\start-edge-server.bat"
$clientBat = Join-Path $Root "scripts\start-proctor-client.bat"
$WshShell = New-Object -ComObject WScript.Shell
foreach ($pair in @(
  @("VVKCBT - May chu", $serverBat),
  @("VVKCBT - Giam thi (2GB)", $clientBat)
)) {
  $lnk = Join-Path $desktop "$($pair[0]).lnk"
  $sc = $WshShell.CreateShortcut($lnk)
  $sc.TargetPath = $pair[1]
  $sc.WorkingDirectory = $Root
  $sc.Save()
  Write-Host "Shortcut: $lnk"
}
