param([Parameter(Mandatory = $true)][string[]]$Paths)
$ErrorActionPreference = 'Stop'
if (-not $env:POLYLOOT_WINDOWS_PUBLISHER) { throw 'Expected publisher must be configured.' }
foreach ($artifactPath in $Paths) {
    $signature = Get-AuthenticodeSignature -LiteralPath $artifactPath
    if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate) { throw "Untrusted or missing signature: $artifactPath" }
    $publisher = $signature.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
    if ($publisher -cne $env:POLYLOOT_WINDOWS_PUBLISHER) { throw "Unexpected signing publisher: $artifactPath" }
    if (-not $signature.TimeStamperCertificate) { throw "Missing trusted timestamp: $artifactPath" }
    if ($signature.SignerCertificate.Subject -eq $signature.SignerCertificate.Issuer) { throw "Self-signed certificate is not permitted: $artifactPath" }
    Write-Output "Verified publisher and timestamp: $artifactPath"
}
