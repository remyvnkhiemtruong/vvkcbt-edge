# Tai nginx portable Windows vao tools/nginx/
param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$nginxDir = Join-Path $Root 'tools\nginx'
$nginxExe = Join-Path $nginxDir 'nginx.exe'

if (Test-Path $nginxExe) {
  Write-Host "nginx portable da co: $nginxExe"
  exit 0
}

$version = '1.26.3'
$url = "https://nginx.org/download/nginx-$version.zip"
$zipPath = Join-Path $env:TEMP "nginx-$version.zip"
$extractRoot = Join-Path $env:TEMP "nginx-$version-extract"

Write-Host "Tai nginx $version..."
Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

if (Test-Path $extractRoot) { Remove-Item $extractRoot -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

$inner = Get-ChildItem $extractRoot -Directory | Select-Object -First 1
if (-not $inner) {
  Write-Host '[LOI] Khong giai nen duoc nginx zip.'
  exit 1
}

if (Test-Path $nginxDir) { Remove-Item $nginxDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Split-Path $nginxDir -Parent) | Out-Null
Move-Item $inner.FullName $nginxDir

Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item $extractRoot -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Da cai nginx portable: $nginxExe"
