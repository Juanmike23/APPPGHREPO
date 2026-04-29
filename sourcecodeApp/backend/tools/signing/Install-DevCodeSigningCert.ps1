param(
  [Parameter(Mandatory = $false)]
  [string]$SubjectContains = "PGH Internal Dev Code Signing"
)

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  throw "Script ini butuh Administrator. Buka PowerShell as Administrator lalu jalankan ulang."
}

$cert = Get-ChildItem Cert:\CurrentUser\My |
  Where-Object {
    $_.HasPrivateKey -and
    $_.Subject -like "*$SubjectContains*" -and
    ($_.EnhancedKeyUsageList | Where-Object { $_.FriendlyName -eq "Code Signing" })
  } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if ($null -eq $cert) {
  throw "Cert code-signing dengan subject like '*$SubjectContains*' tidak ditemukan di CurrentUser\My."
}

$tmpFile = Join-Path $env:TEMP "pgh-dev-codesign-$($cert.Thumbprint).cer"
Export-Certificate -Cert $cert -FilePath $tmpFile -Force | Out-Null

Import-Certificate -FilePath $tmpFile -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Import-Certificate -FilePath $tmpFile -CertStoreLocation Cert:\LocalMachine\TrustedPublisher | Out-Null

Write-Host "Installed cert $($cert.Thumbprint) to LocalMachine Root and TrustedPublisher."
Write-Host "Silakan build/run backend ulang."
Write-Host "Jika tetap muncul 0x800711C7, jalankan:"
Write-Host ".\apps\backend\tools\signing\Get-BackendAppControlDiagnostics.ps1"
Write-Host "Jika Smart App Control / WDAC aktif, allow policy OS tetap mungkin dibutuhkan."

