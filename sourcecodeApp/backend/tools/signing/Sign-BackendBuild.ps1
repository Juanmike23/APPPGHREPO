param(
  [Parameter(Mandatory = $true)]
  [string]$BuildOutputPath,
  [Parameter(Mandatory = $false)]
  [string]$SubjectContains = "PGH Internal Dev Code Signing"
)

$ErrorActionPreference = "Stop"

function Get-CodeSigningCert {
  param([string]$SubjectFilter)

  $candidates = Get-ChildItem Cert:\CurrentUser\My |
    Where-Object {
      $_.HasPrivateKey -and
      $_.Subject -like "*$SubjectFilter*" -and
      ($_.EnhancedKeyUsageList | Where-Object { $_.FriendlyName -eq "Code Signing" })
    } |
    Sort-Object NotAfter -Descending

  return $candidates | Select-Object -First 1
}

function Test-CertInStore {
  param(
    [string]$Thumbprint,
    [string]$StorePath
  )

  if ([string]::IsNullOrWhiteSpace($Thumbprint)) { return $false }
  $found = Get-ChildItem -Path $StorePath -ErrorAction SilentlyContinue |
    Where-Object { $_.Thumbprint -eq $Thumbprint }
  return [bool]$found
}

$outputPath = Resolve-Path -LiteralPath $BuildOutputPath -ErrorAction Stop

$cert = Get-CodeSigningCert -SubjectFilter $SubjectContains
if ($null -eq $cert) {
  Write-Warning "Dev signing cert tidak ditemukan di CurrentUser\\My (subject like '*$SubjectContains*')."
  Write-Warning "Build tetap lanjut tanpa signing. Jika WDAC/Smart App Control aktif, backend bisa tetap diblok."
  exit 0
}

$targetFiles = @(
  Join-Path $outputPath "refactorbackend.dll"
  Join-Path $outputPath "refactorbackend.exe"
) | Where-Object { Test-Path -LiteralPath $_ }

if ($targetFiles.Count -eq 0) {
  Write-Host "Tidak ada target backend binary di $outputPath, skip signing."
  exit 0
}

$signedCount = 0
foreach ($filePath in $targetFiles) {
  $result = Set-AuthenticodeSignature -FilePath $filePath -Certificate $cert -HashAlgorithm SHA256
  if ($result.Status -ne "Valid") {
    throw "Sign gagal untuk '$filePath': $($result.Status) - $($result.StatusMessage)"
  }
  $signedCount++
}

Write-Host "Signed $signedCount backend file(s) with cert thumbprint $($cert.Thumbprint)."

$trustedRoot = Test-CertInStore -Thumbprint $cert.Thumbprint -StorePath "Cert:\LocalMachine\Root"
$trustedPublisher = Test-CertInStore -Thumbprint $cert.Thumbprint -StorePath "Cert:\LocalMachine\TrustedPublisher"
if (-not ($trustedRoot -and $trustedPublisher)) {
  Write-Warning "Cert belum terpasang penuh di LocalMachine\\Root + LocalMachine\\TrustedPublisher."
  Write-Warning "Jika masih muncul 0x800711C7, jalankan PowerShell as Administrator:"
  Write-Warning ".\apps\backend\tools\signing\Install-DevCodeSigningCert.ps1 -SubjectContains '$SubjectContains'"
}

