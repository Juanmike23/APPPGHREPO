param(
  [Parameter(Mandatory = $false)]
  [string]$BuildOutputPath = "",
  [Parameter(Mandatory = $false)]
  [string]$SubjectContains = "PGH Internal Dev Code Signing"
)

$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host ("=" * 78)
  Write-Host $Title
  Write-Host ("=" * 78)
}

function Get-StoreMatch {
  param(
    [string]$StorePath,
    [string]$Thumbprint
  )

  if ([string]::IsNullOrWhiteSpace($Thumbprint)) {
    return $null
  }

  return Get-ChildItem -Path $StorePath -ErrorAction SilentlyContinue |
    Where-Object { $_.Thumbprint -eq $Thumbprint } |
    Select-Object -First 1
}

function Format-Bool {
  param([bool]$Value)
  if ($Value) { return "Yes" }
  return "No"
}

function Get-LatestCodeIntegrityBlockEvent {
  $events = Get-WinEvent -LogName "Microsoft-Windows-CodeIntegrity/Operational" -MaxEvents 100 -ErrorAction SilentlyContinue |
    Where-Object { $_.Id -eq 3077 }

  foreach ($event in $events) {
    [xml]$xml = $event.ToXml()
    $eventData = @{}
    foreach ($dataNode in $xml.Event.EventData.Data) {
      $eventData[$dataNode.Name] = $dataNode.'#text'
    }

    if ($eventData["File Name"] -like "*refactorbackend.dll") {
      return [PSCustomObject]@{
        TimeCreated           = $event.TimeCreated
        FileName              = $eventData["File Name"]
        ProcessName           = $eventData["Process Name"]
        RequestedSigningLevel = $eventData["Requested Signing Level"]
        ValidatedSigningLevel = $eventData["Validated Signing Level"]
        PolicyName            = $eventData["PolicyName"]
        PolicyGUID            = $eventData["PolicyGUID"]
        Status                = $eventData["Status"]
      }
    }
  }

  return $null
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$defaultBuildOutput = Join-Path $backendRoot "bin\Debug\net10.0"
$effectiveBuildOutput = if ([string]::IsNullOrWhiteSpace($BuildOutputPath)) { $defaultBuildOutput } else { $BuildOutputPath }

Write-Section "PGH Backend App Control Diagnostics"
Write-Host "Backend root     : $backendRoot"
Write-Host "Build output path: $effectiveBuildOutput"
Write-Host "Subject filter   : $SubjectContains"

$currentUserCert = Get-ChildItem Cert:\CurrentUser\My -ErrorAction SilentlyContinue |
  Where-Object {
    $_.HasPrivateKey -and
    $_.Subject -like "*$SubjectContains*" -and
    ($_.EnhancedKeyUsageList | Where-Object { $_.FriendlyName -eq "Code Signing" })
  } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

Write-Section "Signing Certificate"
if ($null -eq $currentUserCert) {
  Write-Host "CurrentUser\\My   : NOT FOUND"
} else {
  Write-Host "CurrentUser\\My   : FOUND"
  Write-Host "Thumbprint       : $($currentUserCert.Thumbprint)"
  Write-Host "Subject          : $($currentUserCert.Subject)"
  Write-Host "NotAfter         : $($currentUserCert.NotAfter)"

  $rootMatch = Get-StoreMatch -StorePath "Cert:\LocalMachine\Root" -Thumbprint $currentUserCert.Thumbprint
  $publisherMatch = Get-StoreMatch -StorePath "Cert:\LocalMachine\TrustedPublisher" -Thumbprint $currentUserCert.Thumbprint
  Write-Host "LM Root trusted  : $(Format-Bool -Value ($null -ne $rootMatch))"
  Write-Host "LM Publisher     : $(Format-Bool -Value ($null -ne $publisherMatch))"
}

Write-Section "Windows Policy Signals"
$sacState = "Unknown"
try {
  $mpStatus = Get-MpComputerStatus -ErrorAction Stop
  $sacState = $mpStatus.SmartAppControlState
} catch {
  $sacState = "Unavailable"
}
Write-Host "Smart App Control: $sacState"

$appIdService = Get-Service -Name AppIDSvc -ErrorAction SilentlyContinue
if ($null -eq $appIdService) {
  Write-Host "AppIDSvc         : Unavailable"
} else {
  Write-Host "AppIDSvc         : $($appIdService.Status)"
}

$ciPolicy = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction SilentlyContinue
if ($null -eq $ciPolicy) {
  Write-Host "CI Policy        : Unavailable"
} else {
  if ($null -ne $ciPolicy.VerifiedAndReputablePolicyState) {
    Write-Host "CI Verified/Reputable Policy State: $($ciPolicy.VerifiedAndReputablePolicyState)"
  }
  if ($null -ne $ciPolicy.PolicyScope) {
    Write-Host "CI PolicyScope                    : $($ciPolicy.PolicyScope)"
  }
}

$latestBlock = Get-LatestCodeIntegrityBlockEvent
Write-Section "Latest Backend Code Integrity Block"
if ($null -eq $latestBlock) {
  Write-Host "No recent refactorbackend.dll block event found."
} else {
  Write-Host "TimeCreated      : $($latestBlock.TimeCreated)"
  Write-Host "File             : $($latestBlock.FileName)"
  Write-Host "Process          : $($latestBlock.ProcessName)"
  Write-Host "PolicyName       : $($latestBlock.PolicyName)"
  Write-Host "PolicyGUID       : $($latestBlock.PolicyGUID)"
  Write-Host "Requested Level  : $($latestBlock.RequestedSigningLevel)"
  Write-Host "Validated Level  : $($latestBlock.ValidatedSigningLevel)"
  Write-Host "Status           : $($latestBlock.Status)"
  if ($latestBlock.RequestedSigningLevel -and $latestBlock.ValidatedSigningLevel) {
    if ($latestBlock.RequestedSigningLevel -ne $latestBlock.ValidatedSigningLevel) {
      Write-Host "Conclusion       : Policy requested a higher signing level than this dev binary currently satisfies."
    }
  }
}

Write-Section "Backend Binary Signatures"
$resolvedOutput = $null
try {
  $resolvedOutput = Resolve-Path -LiteralPath $effectiveBuildOutput -ErrorAction Stop
} catch {
  Write-Host "Build output path not found."
}

$targetFiles = @()
if ($null -ne $resolvedOutput) {
  $targetFiles = @(
    Join-Path $resolvedOutput "refactorbackend.dll"
    Join-Path $resolvedOutput "refactorbackend.exe"
  )
}

if ($targetFiles.Count -eq 0) {
  Write-Host "No binary path to inspect."
} else {
  foreach ($filePath in $targetFiles) {
    if (-not (Test-Path -LiteralPath $filePath)) {
      Write-Host ""
      Write-Host "$filePath"
      Write-Host "  Exists        : No"
      continue
    }

    $signature = Get-AuthenticodeSignature -FilePath $filePath
    $zoneIdentifier = Get-Item -LiteralPath "${filePath}:Zone.Identifier" -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host $filePath
    Write-Host "  Exists        : Yes"
    Write-Host "  Signature     : $($signature.Status)"
    Write-Host "  Signer        : $($signature.SignerCertificate.Subject)"
    Write-Host "  Thumbprint    : $($signature.SignerCertificate.Thumbprint)"
    Write-Host "  ZoneBlocked   : $(Format-Bool -Value ($null -ne $zoneIdentifier))"
  }
}

Write-Section "Recommended Next Step"
if ($null -eq $currentUserCert) {
  Write-Host "1. Install or import the dev code-signing certificate into CurrentUser\\My."
  Write-Host "2. Rebuild backend."
  Write-Host "3. Run this diagnostics script again."
} elseif ($sacState -eq "On") {
  Write-Host "Smart App Control is ON."
  Write-Host "Repo-side signing is already in place, but SAC can still block internal dev binaries."
  if ($null -ne $latestBlock -and $latestBlock.RequestedSigningLevel -ne $latestBlock.ValidatedSigningLevel) {
    Write-Host "Latest CI block shows requested signing level $($latestBlock.RequestedSigningLevel) but validated only $($latestBlock.ValidatedSigningLevel)."
  }
  Write-Host "If this is a personal PC, best practice is:"
  Write-Host "1. Use a dedicated dev machine/VM without Smart App Control, or"
  Write-Host "2. Turn off Smart App Control in Windows Security if this machine is intentionally used for local development."
  Write-Host "If this is a managed machine, ask IT/admin to allow this signer/path in WDAC/Code Integrity policy."
} else {
  Write-Host "If runtime is still blocked, compare this output with a machine that can run the backend."
  Write-Host "Focus on: SAC state, AppIDSvc, signer thumbprint, and LocalMachine trust stores."
}
