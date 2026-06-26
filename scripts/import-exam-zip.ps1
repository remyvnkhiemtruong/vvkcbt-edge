param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath,
  [Parameter(Mandatory = $true)]
  [string]$Username,
  [Parameter(Mandatory = $true)]
  [string]$Password,
  [string]$ApiBase = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ZipPath)) {
  Write-Error "Khong tim thay file ZIP: $ZipPath"
  exit 1
}

Write-Host "Dang nhap API ($ApiBase)..."
$loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "$ApiBase/api/auth/proctor/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $loginRes.token
if (-not $token) {
  Write-Error "Dang nhap that bai — khong co token"
  exit 1
}

Write-Host "Import ZIP: $ZipPath"
$zipFull = (Resolve-Path -LiteralPath $ZipPath).Path
$response = curl.exe -s -w "`n%{http_code}" -X POST "$ApiBase/api/proctor/packages/import" `
  -H "Authorization: Bearer $token" `
  -F "file=@$zipFull"

$lines = $response -split "`n"
$status = $lines[-1]
$body = ($lines[0..($lines.Length - 2)] -join "`n").Trim()

if ($status -ne "200" -and $status -ne "201") {
  Write-Error "Import that bai (HTTP $status): $body"
  exit 1
}

Write-Host "Import thanh cong:"
Write-Host $body
