# VVKCBT - Setup tu dong Windows (native, khong Docker)
param(
  [switch]$Dev,
  [string]$PostgresPassword = ''
)

if ($args -contains '--dev') { $Dev = $true }

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root

function Test-TcpPort([int]$Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $Port)
    $c.Close()
    return $true
  } catch {
    return $false
  }
}

function Wait-TcpPort([int]$Port, [int]$TimeoutSec = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpPort $Port) { return $true }
    Start-Sleep -Seconds 3
  }
  return $false
}

function Find-Psql {
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    'C:\Program Files\PostgreSQL\16\bin\psql.exe',
    'C:\Program Files\PostgreSQL\15\bin\psql.exe',
    'C:\Program Files\PostgreSQL\14\bin\psql.exe'
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Ensure-PostgresService {
  $names = @('postgresql-x64-16', 'postgresql-x64-15', 'postgresql-x64-14')
  foreach ($name in $names) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc) { continue }
    if ($svc.Status -ne 'Running') {
      Write-Host "  Khoi dong service $name..."
      Start-Service $name -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 5
    }
    return $true
  }
  return $false
}

function Get-PostgresPasswordCandidates {
  $list = [System.Collections.Generic.List[string]]::new()
  $seen = @{}

  function Add-Candidate([string]$Value) {
    $key = if ($null -eq $Value) { '' } else { $Value }
    if ($seen.ContainsKey($key)) { return }
    $seen[$key] = $true
    [void]$list.Add($key)
  }

  if ($PostgresPassword) { Add-Candidate $PostgresPassword }
  if ($env:PGPASSWORD) { Add-Candidate $env:PGPASSWORD }
  if ($env:POSTGRES_PASSWORD) { Add-Candidate $env:POSTGRES_PASSWORD }

  $envPath = Join-Path $Root '.env'
  if (Test-Path $envPath) {
    foreach ($line in Get-Content $envPath) {
      if ($line -match '^POSTGRES_PASSWORD=(.*)$') {
        Add-Candidate ($matches[1].Trim().Trim('"').Trim("'"))
      }
    }
  }

  Add-Candidate ''
  return $list
}

function Test-PsqlConnection([string]$PsqlPath, [string]$Password, [string]$PgHost = '127.0.0.1', [string]$User = 'postgres', [string]$Database = 'postgres') {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  if ($Password) { $env:PGPASSWORD = $Password } else { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

  $output = if ($PgHost) {
    & $PsqlPath -w -h $PgHost -U $User -d $Database -c 'SELECT 1' -q -t 2>&1
  } else {
    & $PsqlPath -w -U $User -d $Database -c 'SELECT 1' -q -t 2>&1
  }

  $ok = $LASTEXITCODE -eq 0
  $err = ($output | Where-Object { $_ -is [string] -or $_ -is [System.Management.Automation.ErrorRecord] } | ForEach-Object { "$_" }) -join ' '
  if (-not $err -and -not $ok) { $err = 'psql exit code ' + $LASTEXITCODE }

  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $ErrorActionPreference = $prev
  return @{ Ok = $ok; Error = $err.Trim() }
}

function Test-VnuAppDatabase([string]$PsqlPath) {
  $r = Test-PsqlConnection $PsqlPath 'vnu_secret' '127.0.0.1' 'vnu' 'vnu_exam'
  return $r.Ok
}

function Find-PostgresDataDir {
  foreach ($v in 17, 16, 15, 14) {
    $p = "C:\Program Files\PostgreSQL\$v\data"
    if (Test-Path (Join-Path $p 'pg_hba.conf')) { return $p }
  }
  return $null
}

function Restart-PostgresService {
  foreach ($name in @('postgresql-x64-17', 'postgresql-x64-16', 'postgresql-x64-15', 'postgresql-x64-14')) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc) { continue }
    Write-Host "  Khoi dong lai service $name..."
    Restart-Service $name -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 4
    return $true
  }
  return $false
}

function Enable-LocalPostgresTrust([string]$DataDir) {
  $hba = Join-Path $DataDir 'pg_hba.conf'
  $bak = "$hba.vvkbt.bak"
  if (-not (Test-Path $bak)) { Copy-Item $hba $bak -Force }
  $content = Get-Content $hba
  $new = $content | ForEach-Object {
    if ($_ -match '127\.0\.0\.1/32' -or $_ -match '::1/128' -or ($_ -match '^local\s+' -and $_ -notmatch 'replication')) {
      $_ -replace 'scram-sha-256|md5|password', 'trust'
    } else {
      $_
    }
  }
  Set-Content -Path $hba -Value $new -Encoding ASCII
  Restart-PostgresService | Out-Null
}

function Restore-PostgresHba([string]$DataDir) {
  $hba = Join-Path $DataDir 'pg_hba.conf'
  $bak = "$hba.vvkbt.bak"
  if (-not (Test-Path $bak)) { return }
  Copy-Item $bak $hba -Force
  Restart-PostgresService | Out-Null
  Remove-Item $bak -Force -ErrorAction SilentlyContinue
}

function Invoke-InitDatabase([string]$PsqlPath, [string]$Password) {
  if ($Password) { $env:PGPASSWORD = $Password } else { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  & node (Join-Path $Root 'scripts\sql\init-native-db.mjs')
  $ok = $LASTEXITCODE -eq 0
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if (-not $ok) { return $false }
  return (Test-VnuAppDatabase $PsqlPath)
}

function Connect-PostgresAdmin([string]$PsqlPath) {
  foreach ($pass in (Get-PostgresPasswordCandidates)) {
    $r = Test-PsqlConnection $PsqlPath $pass
    if ($r.Ok) { return @{ Ok = $true; Password = $pass } }
  }

  Write-Host ''
  Write-Host 'PostgreSQL can mat khau user postgres (dat khi cai dat PostgreSQL).'
  Write-Host 'Co the dat POSTGRES_PASSWORD trong .env hoac bien moi truong truoc khi chay setup.'

  for ($attempt = 1; $attempt -le 3; $attempt++) {
    $pass = Read-Host 'Nhap mat khau postgres (Enter neu khong co mat khau)'
    $r = Test-PsqlConnection $PsqlPath $pass
    if ($r.Ok) { return @{ Ok = $true; Password = $pass } }
    Write-Host "[LOI] $($r.Error)"
    if ($attempt -lt 3) { Write-Host 'Thu lai...' }
  }

  Write-Host ''
  Write-Host 'Khong dang nhap duoc user postgres.'
  $ans = Read-Host 'Sua pg_hba tam thoi (trust localhost) de tao database? [Y/N]'
  if ($ans -notmatch '^[Yy]') {
    return @{ Ok = $false }
  }

  $dataDir = Find-PostgresDataDir
  if (-not $dataDir) {
    Write-Host '[LOI] Khong tim thay thu muc data PostgreSQL.'
    return @{ Ok = $false }
  }

  Write-Host '  Bat trust localhost tam thoi trong pg_hba.conf...'
  Enable-LocalPostgresTrust $dataDir

  $r = Test-PsqlConnection $PsqlPath ''
  if (-not $r.Ok) {
    Write-Host "[LOI] Van khong ket noi duoc sau khi bat trust: $($r.Error)"
    Restore-PostgresHba $dataDir
    return @{ Ok = $false }
  }

  if (-not (Invoke-InitDatabase $PsqlPath '')) {
    Write-Host '[LOI] Tao database that bai trong che do trust.'
    Restore-PostgresHba $dataDir
    return @{ Ok = $false }
  }
  Write-Host '  Database vnu_exam san sang.'

  $newPass = Read-Host 'Dat mat khau moi cho user postgres (Enter de bo qua)'
  if ($newPass) {
    $env:PGPASSWORD = ''
    & $PsqlPath -w -h 127.0.0.1 -U postgres -d postgres -c "ALTER USER postgres PASSWORD '$($newPass -replace '''', '''''')';" -q 2>&1 | Out-Null
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -eq 0) {
      Write-Host '  Da dat mat khau postgres.'
    }
  }

  Write-Host '  Khoi phuc pg_hba.conf...'
  Restore-PostgresHba $dataDir

  return @{ Ok = $true; Password = $newPass; InitDone = $true }
}

function Invoke-PsqlFile([string]$PsqlPath, [string]$SqlFile, [string]$Password) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  if ($Password) { $env:PGPASSWORD = $Password } else { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  $output = & $PsqlPath -w -h 127.0.0.1 -U postgres -d postgres -f $SqlFile 2>&1
  $code = $LASTEXITCODE
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $ErrorActionPreference = $prev
  foreach ($line in $output) { Write-Host $line }
  return $code
}

function Try-WingetInstall([string]$Id, [string]$Label) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Host "[CANH BAO] Khong tim thay winget - cai $Label thu cong."
    return $false
  }
  Write-Host "Dang cai $Label qua winget..."
  & winget install --id $Id -e --accept-package-agreements --accept-source-agreements
  return $LASTEXITCODE -eq 0
}

Write-Host '[1/9] Kiem tra Node.js...'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  if (-not (Try-WingetInstall 'OpenJS.NodeJS.LTS' 'Node.js LTS')) {
    Write-Host '[LOI] Can Node.js 20+: https://nodejs.org/'
    exit 1
  }
}
Write-Host "  Node: $(node -v)"

Write-Host '[2/9] Kiem tra PostgreSQL...'
if (-not (Test-TcpPort 5432)) {
  if (-not (Try-WingetInstall 'PostgreSQL.PostgreSQL.16' 'PostgreSQL 16')) {
    Write-Host '[LOI] PostgreSQL chua chay tren port 5432. Cai Postgres 16 va khoi dong service.'
    exit 1
  }
  Write-Host '  Cho PostgreSQL khoi dong (co the mat 1-2 phut sau winget)...'
}
Ensure-PostgresService | Out-Null
if (-not (Wait-TcpPort 5432 180)) {
  Write-Host '[LOI] PostgreSQL van chua mo port 5432.'
  Write-Host '      Kiem tra Windows Services: postgresql-x64-16'
  exit 1
}

Write-Host '[3/9] Kiem tra Redis...'
$redisOk = Test-TcpPort 6379
if (-not $redisOk) {
  Try-WingetInstall 'Memurai.MemuraiDeveloper' 'Memurai (Redis)' | Out-Null
  Start-Sleep -Seconds 5
  $redisOk = Test-TcpPort 6379
}
if (-not $redisOk) {
  Write-Host '[CANH BAO] Redis chua chay - se dat EDGE_LIGHTWEIGHT=true trong .env'
}

Write-Host '[4/9] Tao database vnu_exam...'
$psql = Find-Psql
if (-not $psql) {
  Write-Host '[LOI] Khong tim thay psql. Them PostgreSQL bin vao PATH.'
  exit 1
}

if (Test-VnuAppDatabase $psql) {
  Write-Host '  Database vnu_exam da san sang (user vnu OK).'
} else {
  $pgConn = Connect-PostgresAdmin $psql
  if (-not $pgConn.Ok) {
    Write-Host '[LOI] Khong the tao database.'
    Write-Host '      Thu dat POSTGRES_PASSWORD trong .env roi chay lai setup-windows.bat'
    exit 1
  }

  if (-not $pgConn.InitDone) {
    $pgPass = $pgConn.Password
    if (-not (Invoke-InitDatabase $psql $pgPass)) {
      Write-Host '[LOI] Tao database that bai.'
      exit 1
    }
    Write-Host '  Database vnu_exam san sang.'
  }
}

Write-Host '[5/9] Cau hinh .env va shortcut...'
if (-not $redisOk) {
  $envPath = Join-Path $Root '.env'
  if (-not (Test-Path $envPath) -and (Test-Path (Join-Path $Root '.env.example'))) {
    Copy-Item (Join-Path $Root '.env.example') $envPath
  }
  if (Test-Path $envPath) {
    $lines = Get-Content $envPath
    $out = @()
    $seenLight = $false
    foreach ($line in $lines) {
      if ($line -match '^EDGE_LIGHTWEIGHT=') {
        $out += 'EDGE_LIGHTWEIGHT=true'
        $seenLight = $true
      } else {
        $out += $line
      }
    }
    if (-not $seenLight) { $out += 'EDGE_LIGHTWEIGHT=true' }
    Set-Content -Path $envPath -Value $out -Encoding UTF8
  }
}
& (Join-Path $PSScriptRoot 'setup-native.ps1') -Root $Root

Write-Host '[6/9] npm install...'
& npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not $Dev) {
  Write-Host '[7/9] npm run build...'
  & npm run build
  if ($LASTEXITCODE -ne 0) { exit 1 }

  Write-Host '[8/9] nginx portable...'
  $nginxExe = Join-Path $Root 'tools\nginx\nginx.exe'
  if (-not (Test-Path $nginxExe)) {
    & (Join-Path $PSScriptRoot 'download-nginx-portable.ps1') -Root $Root
  }
} else {
  Write-Host '[7-8/9] Che do --dev: bo qua build production va nginx.'
}

Write-Host '[9/9] Migration + seed giam thi...'
& npm run migration:run
if ($LASTEXITCODE -ne 0) { exit 1 }
& node (Join-Path $Root 'scripts\seed-proctor-user.mjs') 'proctor' 'proctor123'
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ''
Write-Host '========================================'
Write-Host '  VVKCBT setup hoan tat'
Write-Host '========================================'
if ($Dev) {
  Write-Host '  Dev:    npm run dev'
} else {
  Write-Host '  Server: scripts\start-edge-server.bat'
  Write-Host '  Check:  node scripts\edge-bootstrap.mjs'
}
Write-Host '  Proctor login: proctor / proctor123'
Write-Host '========================================'
