param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$nginxDir = Join-Path $Root "tools\nginx"
$nginxExe = Join-Path $nginxDir "nginx.exe"
$confTemplate = Join-Path $PSScriptRoot "nginx-native.conf"
$confOut = Join-Path $nginxDir "conf\vvkcbt.conf"
$rootSlash = $Root -replace '\\', '/'

if (-not (Test-Path $nginxExe)) {
  Write-Host "Chua co nginx portable tai: $nginxDir"
  Write-Host "Tai nginx Windows zip tu https://nginx.org/en/download.html"
  Write-Host "Giai nen vao tools\nginx\ (co nginx.exe trong thu muc do)"
  exit 1
}

$confDir = Split-Path $confOut -Parent
if (-not (Test-Path $confDir)) { New-Item -ItemType Directory -Force -Path $confDir | Out-Null }

$content = Get-Content $confTemplate -Raw
$content = $content -replace '__VNU_ROOT__', $rootSlash
Set-Content -Path $confOut -Value $content -Encoding UTF8

Push-Location $nginxDir
try {
  & .\nginx.exe -t -p $nginxDir -c conf\vvkcbt.conf
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & .\nginx.exe -p $nginxDir -c conf\vvkcbt.conf
  Write-Host "nginx da khoi dong — http://localhost/student/ va /proctor/"
} finally {
  Pop-Location
}
