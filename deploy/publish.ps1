# Build dist/ and push it to the VPS. Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File <folder-proyek>\cirrava\deploy\publish.ps1 -Server root@203.0.113.10
# (replace 203.0.113.10 with your VPS's real IP address)
param([Parameter(Mandatory = $true)][string]$Server)
$ErrorActionPreference = 'Stop'

if ($Server -match 'IP_VPS|YOUR_VPS_IP' -or $Server -notmatch '@') {
    Write-Host "Ganti '$Server' dengan user@IP asli VPS kamu, contoh: -Server root@103.150.10.20" -ForegroundColor Yellow
    exit 1
}

function Invoke-Step([string]$Label, [scriptblock]$Cmd) {
    Write-Host "-> $Label"
    & $Cmd
    if ($LASTEXITCODE -ne 0) { Write-Host "Gagal di langkah: $Label (exit $LASTEXITCODE)" -ForegroundColor Red; exit $LASTEXITCODE }
}

Set-Location (Split-Path $PSScriptRoot)
Invoke-Step "Build dist/" { python deploy/build.py }
Invoke-Step "Cek koneksi SSH + folder /var/www/cirrava" { ssh $Server "test -d /var/www/cirrava || { echo 'Folder /var/www/cirrava belum ada: jalankan langkah 2 di PANDUAN-VPS.md dulu'; exit 2; }; rm -rf /tmp/cirrava-dist" }
Invoke-Step "Upload" { scp -r dist "${Server}:/tmp/cirrava-dist" }
Invoke-Step "Pasang di server" { ssh -t $Server "sudo rsync -a --delete /tmp/cirrava-dist/ /var/www/cirrava/ && sudo chown -R www-data:www-data /var/www/cirrava && rm -rf /tmp/cirrava-dist" }
Write-Host "Selesai: situs ada di /var/www/cirrava" -ForegroundColor Green
