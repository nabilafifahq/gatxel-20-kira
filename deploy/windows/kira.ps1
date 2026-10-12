<#
  Perintah singkat untuk server Kira di Windows (Docker Desktop).
  Jalankan dari folder repo atau dari mana saja: .\deploy\windows\kira.ps1 <perintah>
  Perintah: init, start, stop, update, status, logs [layanan], backup, admin <argumen>, apk, help
#>
param(
  [Parameter(Position = 0)][string]$Command = 'help',
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)][string[]]$Rest = @()
)
$ErrorActionPreference = 'Stop'
$Repo = 'nabilafifahq/gatxel-20-kira'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..'))

function Get-EnvValue([string]$Name, [string]$Default) {
  if (-not (Test-Path .env)) { throw 'File .env belum ada. Salin .env.example menjadi .env lalu isi (docs/pasang-windows.md).' }
  $line = Get-Content .env | Where-Object { $_ -match "^$Name=" } | Select-Object -Last 1
  if (-not $line) { return $Default }
  $value = ($line -replace "^$Name=", '').Trim().Trim('"')
  if ($value) { return $value } else { return $Default }
}

switch ($Command) {
  'init' {
    # Buat .env dari .env.example bila belum ada, lalu isi setiap nilai GANTI dengan 48 karakter hex acak
    # (24 byte dari RandomNumberGenerator). Nilai yang sudah diisi tidak diubah, jadi aman dijalankan ulang.
    if (-not (Test-Path .env)) {
      Copy-Item .env.example .env
      Write-Host 'File .env dibuat dari .env.example.'
    }
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $filled = New-Object System.Collections.Generic.List[string]
    $envPath = Join-Path (Get-Location) '.env'
    $lines = foreach ($line in [IO.File]::ReadAllLines($envPath, [Text.Encoding]::UTF8)) {
      if ($line -match '^([A-Z0-9_]+)=GANTI') {
        $name = $Matches[1]
        $bytes = New-Object byte[] 24
        $rng.GetBytes($bytes)
        $filled.Add($name)
        $name + '=' + (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
      } else {
        $line
      }
    }
    # UTF-8 tanpa BOM dan akhir baris LF, sama dengan .env.example: BOM merusak nama variabel pertama
    # saat Docker Compose membaca .env.
    [IO.File]::WriteAllText($envPath, (([string[]]$lines) -join "`n") + "`n", (New-Object System.Text.UTF8Encoding $false))
    if ($filled.Count -gt 0) { Write-Host ('Diisi acak: ' + ($filled -join ', ')) } else { Write-Host 'Tidak ada nilai GANTI yang tersisa.' }
    Write-Host 'Isi sendiri di Notepad: KIRA_ORIGIN (alamat tailscale serve), KIRA_LEGAL_NAME, KIRA_LEGAL_ADDRESS, KIRA_LEGAL_EMAIL, CLAUDE_CODE_OAUTH_TOKEN.'
    Write-Host 'Token untuk halaman /setup ada di baris KIRA_SETUP_TOKEN.'
  }
  'start' {
    docker compose up -d --build
    docker compose ps
  }
  'stop' {
    docker compose stop
  }
  'update' {
    git pull --ff-only
    docker compose up -d --build
    docker compose ps
  }
  'status' {
    docker compose ps
    docker compose run --rm migrate node tools/admin.mjs status
  }
  'logs' {
    docker compose logs -f --tail 200 @Rest
  }
  'backup' {
    docker compose exec backup /bin/sh /backup.sh now
  }
  'admin' {
    if ($Rest.Count -eq 0) { $Rest = @('help') }
    docker compose run --rm migrate node tools/admin.mjs @Rest
  }
  'apk' {
    $data = Get-EnvValue 'KIRA_HOST_DATA' './data'
    $tmp = Join-Path $env:TEMP ("kira-apk-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
      # Rilis bertanda tangan dulu (kunci tetap), lalu artefak build terbaru. Windows PowerShell 5.1 mengubah
      # stderr yang dialihkan menjadi error, dan 'Stop' akan menghentikan skrip saat belum ada rilis. Karena itu
      # perintah ini berjalan dengan 'Continue'; hasilnya dicek dari berkas yang terunduh.
      & { $ErrorActionPreference = 'Continue'; gh release download --repo $Repo --pattern 'kira-*.apk' --dir $tmp 2>$null } | Out-Null
      if (-not (Get-ChildItem $tmp -Filter *.apk -Recurse)) {
        gh run download --repo $Repo --name kira-apk --dir $tmp
      }
      $apk = Get-ChildItem $tmp -Filter *.apk -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if (-not $apk) { throw 'APK tidak ditemukan di GitHub. Jalankan workflow android-apk dulu (docs/android.md).' }
      $target = Join-Path $data 'apk'
      New-Item -ItemType Directory -Force -Path $target | Out-Null
      Copy-Item $apk.FullName (Join-Path $target 'kira.apk') -Force
      $hash = (Get-FileHash (Join-Path $target 'kira.apk') -Algorithm SHA256).Hash.ToLower()
      Write-Host "APK $($apk.Name) disalin ke $target\kira.apk"
      Write-Host "SHA-256 $hash"
      Write-Host 'Unduh di tablet lewat konsol, Pengaturan, Aplikasi tablet Android.'
    } finally {
      Remove-Item -Recurse -Force $tmp
    }
  }
  default {
    Write-Host 'Perintah Kira:'
    Write-Host '  init                buat .env dan isi semua rahasia GANTI dengan nilai acak'
    Write-Host '  start               build dan nyalakan semua layanan'
    Write-Host '  stop                hentikan semua layanan'
    Write-Host '  update              git pull, build ulang, migrasi otomatis'
    Write-Host '  status              status layanan dan isi database'
    Write-Host '  logs [layanan]      log berjalan (web, worker, db, backup, migrate)'
    Write-Host '  backup              cadangan database sekarang'
    Write-Host '  admin <argumen>     status, reset-link <email>, unlock <email>, pin-unlock <nama>'
    Write-Host '  apk                 ambil APK terbaru dari GitHub ke folder data'
  }
}
